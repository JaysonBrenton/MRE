# @fileoverview Ingestion pipeline orchestrator
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Main pipeline orchestrator for event ingestion
# 
# @purpose Coordinates connector calls, validation, normalization, and
#          database persistence with proper locking and transaction management.

import asyncio
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
from uuid import UUID

from ingestion.common.logging import get_logger
from ingestion.common import metrics
from ingestion.common.tracing import TraceSpan
from ingestion.connectors.liverc.connector import LiveRCConnector
from ingestion.connectors.liverc.models import (
    ConnectorEventSummary,
    ConnectorRacePackage,
    ConnectorRaceSummary,
    ConnectorEntryList,
)
from ingestion.connectors.liverc.utils import build_event_url
from ingestion.db.models import (
    IngestDepth,
    EventEntry,
    UserDriverLinkStatus,
    EventDriverLinkMatchType,
    Track,
    Event,
)
from ingestion.db.repository import Repository
from ingestion.db.session import db_session
from sqlalchemy import select, and_, func
from ingestion.ingestion.errors import (
    IngestionInProgressError,
    StateMachineError,
    ValidationError,
    IngestionTimeoutError,
    ConstraintViolationError,
)
from ingestion.ingestion.normalizer import Normalizer
from ingestion.ingestion.state_machine import IngestionStateMachine
from ingestion.ingestion.validator import Validator
from ingestion.ingestion.driver_matcher import DriverMatcher
from ingestion.ingestion.auto_confirm import check_and_confirm_links

logger = get_logger(__name__)


@dataclass
class EventContext:
    """Lightweight snapshot of event metadata required for ingestion."""
    event_id: UUID
    track_id: UUID
    track_slug: str
    source_event_id: str


@dataclass
class TrackContext:
    """Snapshot of track metadata needed for discovery/creation flows."""
    track_id: UUID
    source_track_slug: str


class IngestionPipeline:
    """Main ingestion pipeline orchestrator."""
    
    # Race fetch concurrency - increased to improve performance for large events
    # Parallel fetching significantly reduces ingestion time for events with many races
    # Increased from 4 to 8 for better I/O utilization
    # Note: Ensure worker pool, Redis locks, and downstream APIs can handle increased concurrency
    RACE_FETCH_CONCURRENCY = 8
    # Inactivity timeout - only triggers if no progress is made for this duration
    INACTIVITY_TIMEOUT_SECONDS = 5 * 60  # 5 minutes of inactivity
    # Maximum total duration - safety limit to prevent runaway processes
    MAX_TOTAL_DURATION_SECONDS = 60 * 60  # 1 hour maximum total duration
    
    def __init__(self):
        """Initialize pipeline."""
        self.connector = LiveRCConnector()
        self._current_stage: str = "idle"
        self._last_activity_time: Optional[float] = None

    def _set_stage(self, stage: str, event_id: Optional[UUID] = None) -> None:
        """Update the current pipeline stage for observability/timeout tracking."""
        self._current_stage = stage
        if event_id:
            logger.debug("ingestion_stage", event_id=str(event_id), stage=stage)

    def _record_activity(self) -> None:
        """Record that activity/progress has occurred. Call this whenever progress is made."""
        # Update activity time directly (thread-safe for our use case)
        # The activity_lock in monitor_activity() ensures safe concurrent access
        self._last_activity_time = time.time()

    async def _run_with_inactivity_timeout(
        self,
        coro,
        event_id: UUID,
        ingestion_timer: Optional[metrics.IngestionDurationTracker] = None,
    ):
        """
        Wrap ingestion work with inactivity-based timeout.
        
        Only times out if there's been no progress for INACTIVITY_TIMEOUT_SECONDS.
        This allows long-running imports to complete as long as they're making progress.
        
        Args:
            coro: Coroutine to run
            event_id: Event ID for logging
            ingestion_timer: Optional timer for metrics
        """
        start_time = time.time()
        self._last_activity_time = start_time
        monitor_task = None
        
        async def monitor_activity():
            """Monitor for inactivity and raise timeout if no progress is made."""
            while True:
                await asyncio.sleep(10)  # Check every 10 seconds
                current_time = time.time()
                elapsed_total = current_time - start_time
                
                # Check maximum total duration (safety limit)
                if elapsed_total > self.MAX_TOTAL_DURATION_SECONDS:
                    metrics.record_lock_timeout(str(event_id), self._current_stage)
                    logger.error(
                        "ingestion_max_duration_exceeded",
                        event_id=str(event_id),
                        stage=self._current_stage,
                        total_duration_seconds=elapsed_total,
                        max_duration_seconds=self.MAX_TOTAL_DURATION_SECONDS,
                    )
                    if ingestion_timer:
                        ingestion_timer.finish("timeout")
                    raise IngestionTimeoutError(str(event_id), self._current_stage)
                
                # Check inactivity timeout
                # Note: Reading _last_activity_time is safe without lock since it's a simple float assignment
                # and Python's GIL ensures atomic reads/writes for simple types
                last_activity = self._last_activity_time
                if last_activity is None:
                    # No activity recorded yet, reset to current time
                    self._last_activity_time = current_time
                    continue
                
                inactivity_duration = current_time - last_activity
                if inactivity_duration > self.INACTIVITY_TIMEOUT_SECONDS:
                    metrics.record_lock_timeout(str(event_id), self._current_stage)
                    logger.error(
                        "ingestion_inactivity_timeout",
                        event_id=str(event_id),
                        stage=self._current_stage,
                        inactivity_seconds=inactivity_duration,
                        total_duration_seconds=elapsed_total,
                        inactivity_timeout_seconds=self.INACTIVITY_TIMEOUT_SECONDS,
                    )
                    if ingestion_timer:
                        ingestion_timer.finish("timeout")
                    raise IngestionTimeoutError(str(event_id), self._current_stage)
        
        # Start monitoring task
        monitor_task = asyncio.create_task(monitor_activity())
        
        try:
            # Run the main coroutine
            result = await coro
            # Cancel monitor if coroutine completes successfully
            monitor_task.cancel()
            try:
                await monitor_task
            except asyncio.CancelledError:
                pass
            return result
        except IngestionTimeoutError:
            # Re-raise timeout errors
            raise
        except Exception as e:
            # Cancel monitor on any other error
            if monitor_task:
                monitor_task.cancel()
                try:
                    await monitor_task
                except asyncio.CancelledError:
                    pass
            raise

    def _load_event_context(self, event_id: UUID) -> EventContext:
        """Load the immutable metadata for an event without holding the ingestion lock."""
        with db_session() as session:
            stmt = (
                select(Event, Track)
                .join(Track, Track.id == Event.track_id)
                .where(Event.id == str(event_id))
            )
            row = session.execute(stmt).first()
            if not row:
                raise StateMachineError(
                    f"Event {event_id} not found",
                    event_id=str(event_id),
                )
            event_row, track_row = row
            try:
                track_uuid = UUID(track_row.id)
            except ValueError as exc:
                raise StateMachineError(
                    f"Invalid track id for event {event_id}",
                    event_id=str(event_id),
                ) from exc

            return EventContext(
                event_id=event_id,
                track_id=track_uuid,
                track_slug=track_row.source_track_slug,
                source_event_id=event_row.source_event_id,
            )

    def _load_track_context(self, track_id: UUID) -> TrackContext:
        """Load minimal track metadata for source-ingestion flows."""
        with db_session() as session:
            track = session.get(Track, str(track_id))
            if not track:
                raise StateMachineError(
                    f"Track {track_id} not found",
                    track_id=str(track_id),
                )
            return TrackContext(
                track_id=track_id,
                source_track_slug=track.source_track_slug,
            )

    def _ensure_event_record(
        self,
        source_event_id: str,
        track_id: UUID,
        normalized_event: Dict[str, Any],
        event_url: str,
    ) -> UUID:
        """Ensure an Event row exists for a source_event_id, guarded by a source-level lock."""
        with db_session() as session:
            repo = Repository(session)
            if not repo.acquire_source_event_lock(source_event_id):
                raise IngestionInProgressError(source_event_id)
            lock_held = True

            try:
                existing = repo.get_event_by_source_event_id("liverc", source_event_id)
                if existing:
                    return UUID(existing.id)

                event = repo.upsert_event(
                    source="liverc",
                    source_event_id=source_event_id,
                    track_id=track_id,
                    event_name=normalized_event["event_name"],
                    event_date=normalized_event["event_date"],
                    event_entries=normalized_event["event_entries"],
                    event_drivers=normalized_event["event_drivers"],
                    event_url=event_url,
                )
                session.flush()
                logger.info(
                    "event_record_created",
                    event_id=str(event.id),
                    source_event_id=source_event_id,
                )
                return UUID(event.id)
            finally:
                if lock_held:
                    repo.release_source_event_lock(source_event_id)
    
    async def _fetch_race_page_with_validation(
        self,
        race_summary: ConnectorRaceSummary,
        event_id: UUID,
    ) -> ConnectorRacePackage:
        """
        Fetch and validate a single race page.
        
        Args:
            race_summary: Race summary to fetch
            event_id: Event ID for logging/validation
        
        Returns:
            ConnectorRacePackage with race data
        
        Raises:
            ValidationError: If race validation fails
            ConnectorHTTPError: On network errors
            RacePageFormatError: On parsing errors
        """
        # Validate race first
        Validator.validate_race(race_summary, str(event_id))
        
        race_id = race_summary.source_race_id
        logger.info("connector_fetch_start", event_id=str(event_id), race_id=race_id, type="race_page")
        start = time.perf_counter()
        with TraceSpan(
            "race_page_fetch",
            event_id=str(event_id),
            race_id=race_id,
        ):
            race_package = await self.connector.fetch_race_page(race_summary)
        duration = time.perf_counter() - start
        metrics.observe_race_fetch(
            event_id=str(event_id),
            race_id=race_id,
            method=race_package.fetch_method,
            duration_seconds=duration,
        )
        logger.info("connector_fetch_end", event_id=str(event_id), race_id=race_id, type="race_page")
        
        # Validate race results
        Validator.validate_race_results(
            race_package.results,
            str(event_id),
            race_summary.source_race_id,
        )
        
        return race_package
    
    async def _process_races_batch(
        self,
        race_summaries: List[ConnectorRaceSummary],
        event_id: UUID,
    ) -> List[Tuple[ConnectorRaceSummary, ConnectorRacePackage]]:
        """
        Fetch multiple race pages in parallel.
        
        Args:
            race_summaries: List of race summaries to fetch
            event_id: Event ID for logging/validation
        
        Returns:
            List of tuples (race_summary, race_package) in the same order as input
        """
        # Create tasks for parallel fetching
        tasks = [
            self._fetch_race_page_with_validation(race_summary, event_id)
            for race_summary in race_summaries
        ]
        
        # Fetch all races in parallel with exception handling
        # Use return_exceptions=True to handle individual race failures gracefully
        race_packages = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions and log them, but continue processing valid races
        valid_pairs = []
        for race_summary, race_package in zip(race_summaries, race_packages):
            if isinstance(race_package, Exception):
                logger.warning(
                    "race_fetch_failed",
                    event_id=str(event_id),
                    race_id=race_summary.source_race_id,
                    error_type=type(race_package).__name__,
                    error_message=str(race_package),
                    message="Skipping failed race and continuing with others",
                )
                continue
            valid_pairs.append((race_summary, race_package))
        
        return valid_pairs
    
    async def _process_races_parallel(
        self,
        race_summaries: List[ConnectorRaceSummary],
        event_id: UUID,
        repo: Repository,
        depth: str,
    ) -> Tuple[int, int, int]:
        """
        Process races with parallel fetching but sequential database writes.
        
        This method:
        1. Fetches race pages in parallel batches (configurable concurrency)
        2. Processes database writes sequentially for consistency
        3. Maintains race_order for proper sequencing
        
        Args:
            race_summaries: List of race summaries to process
            event_id: Event ID
            repo: Repository instance for database operations
            depth: Ingestion depth
            entry_list: Optional entry list for transponder number matching
        
        Returns:
            Tuple of (races_ingested, results_ingested, laps_ingested)
        """
        races_ingested = 0
        results_ingested = 0
        laps_ingested = 0
        
        # Preload all event entries for this event and cache by class name
        # This eliminates redundant database queries inside the race processing loop
        all_event_entries = repo.get_event_entries_by_event(event_id=event_id)
        event_entries_cache: Dict[str, List[EventEntry]] = {}
        for entry in all_event_entries:
            class_name = entry.class_name
            if class_name not in event_entries_cache:
                event_entries_cache[class_name] = []
            event_entries_cache[class_name].append(entry)
        
        logger.debug(
            "event_entries_cached",
            event_id=str(event_id),
            total_entries=len(all_event_entries),
            classes=len(event_entries_cache),
        )
        
        # Process races in batches to limit concurrent requests
        batch_size = self.RACE_FETCH_CONCURRENCY
        # Commit in batches to reduce transaction overhead (every 20 races, increased from 10)
        COMMIT_BATCH_SIZE = 20
        races_since_commit = 0
        
        # Accumulate laps across races within commit batches for better batching efficiency
        # This reduces function call overhead and allows larger, more efficient batches
        accumulated_laps: List[Dict[str, Any]] = []
        
        total_batches = (len(race_summaries) + batch_size - 1) // batch_size  # Ceiling division
        
        for batch_num, batch_start in enumerate(range(0, len(race_summaries), batch_size)):
            batch = race_summaries[batch_start:batch_start + batch_size]
            
            # Fetch this batch in parallel
            race_data_pairs = await self._process_races_batch(batch, event_id)
            
            # Process fetched races sequentially for database consistency
            for race_idx, (race_summary, race_package) in enumerate(race_data_pairs):
                # Skip races with no results (empty races that haven't been run yet)
                if not race_package.results or len(race_package.results) == 0:
                    logger.info(
                        "skipping_empty_race",
                        event_id=str(event_id),
                        race_id=race_summary.source_race_id,
                        message="Race has no results - skipping ingestion",
                    )
                    # Still create the race record so it's tracked, but mark it as having no results
                    normalized_race = Normalizer.normalize_race(race_package.race_summary)
                    race = repo.upsert_race(
                        event_id=event_id,
                        source="liverc",
                        source_race_id=normalized_race["source_race_id"],
                        class_name=normalized_race["class_name"],
                        race_label=normalized_race["race_label"],
                        race_order=normalized_race["race_order"],
                        race_url=normalized_race["race_url"],
                        start_time=normalized_race["start_time"],
                        duration_seconds=normalized_race["duration_seconds"],
                    )
                    races_ingested += 1
                    races_since_commit += 1
                    self._record_activity()  # Record progress
                    # Commit in batches or immediately for empty races (to keep them tracked)
                    if races_since_commit >= COMMIT_BATCH_SIZE:
                        repo.session.commit()
                        races_since_commit = 0
                    continue
                
                # Normalize race data
                normalized_race = Normalizer.normalize_race(race_package.race_summary)
                
                # Upsert race
                race = repo.upsert_race(
                    event_id=event_id,
                    source="liverc",
                    source_race_id=normalized_race["source_race_id"],
                    class_name=normalized_race["class_name"],
                    race_label=normalized_race["race_label"],
                    race_order=normalized_race["race_order"],
                    race_url=normalized_race["race_url"],
                    start_time=normalized_race["start_time"],
                    duration_seconds=normalized_race["duration_seconds"],
                )
                races_ingested += 1
                self._record_activity()  # Record progress
                
                # Collect all race laps for bulk upsert
                race_laps = []
                
                lap_timer = metrics.start_lap_extraction_timer(
                    event_id=str(event_id),
                    race_id=race_summary.source_race_id,
                )
                try:
                    # Process results sequentially
                    for result in race_package.results:
                        # Validate result
                        Validator.validate_result(result, str(event_id), race_summary.source_race_id)
                        
                        # Normalize result
                        normalized_result = Normalizer.normalize_result(result)
                        
                        # Match race result driver to EventEntry record
                        # Use cached event entries instead of querying database for each result
                        class_name = normalized_race["class_name"]
                        event_entries = event_entries_cache.get(class_name, [])
                        
                        # Track cache usage
                        metrics.record_event_entry_cache_lookup(str(event_id))
                        if event_entries:
                            metrics.record_event_entry_cache_hit(str(event_id))
                        
                        matched_event_entry = None
                        
                        if event_entries:
                            matched_event_entry = DriverMatcher.match_race_result_to_event_entry(
                                event_entries=event_entries,
                                race_result=result,
                                class_name=class_name,
                            )
                            
                            if matched_event_entry:
                                # Update driver's source_driver_id if it's still a temporary one
                                driver = matched_event_entry.driver
                                if driver.source_driver_id.startswith("entry_"):
                                    # Check if a driver with the real source_driver_id already exists
                                    from ingestion.db.models import Driver as DriverModel
                                    existing_driver = repo.session.query(DriverModel).filter(
                                        DriverModel.source == "liverc",
                                        DriverModel.source_driver_id == normalized_result["source_driver_id"],
                                    ).first()
                                    
                                    if existing_driver and existing_driver.id != driver.id:
                                        # Driver with real ID already exists - use that one and update EventEntry
                                        logger.debug(
                                            "driver_merged",
                                            old_driver_id=str(driver.id),
                                            new_driver_id=str(existing_driver.id),
                                            source_driver_id=normalized_result["source_driver_id"],
                                        )
                                        matched_event_entry.driver_id = existing_driver.id
                                        matched_event_entry.updated_at = datetime.utcnow()
                                        driver = existing_driver
                                    else:
                                        # Update driver with actual source_driver_id from race result
                                        old_id = driver.source_driver_id
                                        driver.source_driver_id = normalized_result["source_driver_id"]
                                        driver.updated_at = datetime.utcnow()
                                        logger.debug(
                                            "driver_source_id_updated",
                                            driver_id=str(driver.id),
                                            old_id=old_id,
                                            new_id=normalized_result["source_driver_id"],
                                        )
                        else:
                            logger.warning(
                                "no_event_entries_for_class",
                                event_id=str(event_id),
                                class_name=class_name,
                                race_id=race_summary.source_race_id,
                            )
                        
                        # If no match found, create driver from race result (fallback)
                        if not matched_event_entry:
                            driver = repo.upsert_driver(
                                source="liverc",
                                source_driver_id=normalized_result["source_driver_id"],
                                display_name=normalized_result["display_name"],
                                transponder_number=None,  # No transponder from race results
                            )
                            logger.warning(
                                "driver_not_matched_to_entry",
                                event_id=str(event_id),
                                race_id=race_summary.source_race_id,
                                driver_id=normalized_result["source_driver_id"],
                                driver_name=normalized_result["display_name"],
                                class_name=class_name,
                            )
                        else:
                            driver = matched_event_entry.driver
                        
                        # Upsert race driver
                        # Note: Transponder numbers are stored in EventEntry (source of truth), not RaceDriver
                        race_driver = repo.upsert_race_driver(
                            race_id=race.id,
                            source="liverc",
                            source_driver_id=normalized_result["source_driver_id"],
                            display_name=normalized_result["display_name"],
                            transponder_number=None,  # Transponders come from EventEntry, not race results
                        )
                        
                        # Upsert result
                        race_result = repo.upsert_race_result(
                            race_id=race.id,
                            race_driver_id=race_driver.id,
                            position_final=normalized_result["position_final"],
                            laps_completed=normalized_result["laps_completed"],
                            total_time_raw=normalized_result.get("total_time_raw"),
                            total_time_seconds=normalized_result["total_time_seconds"],
                            fast_lap_time=normalized_result["fast_lap_time"],
                            avg_lap_time=normalized_result["avg_lap_time"],
                            consistency=normalized_result["consistency"],
                        )
                    results_ingested += 1
                    
                    # Process laps
                    driver_laps = race_package.laps_by_driver.get(normalized_result["source_driver_id"], [])
                    
                    # Validate laps - if validation fails, skip lap ingestion but continue with result
                    try:
                        Validator.validate_laps(
                            driver_laps,
                            normalized_result["laps_completed"],
                            str(event_id),
                            race_summary.source_race_id,
                            normalized_result["source_driver_id"],
                        )
                        
                        # Collect normalized laps for bulk upsert
                        for lap in driver_laps:
                            normalized_lap = Normalizer.normalize_lap(lap)
                            race_laps.append({
                                "race_result_id": str(race_result.id),
                                "lap_number": normalized_lap["lap_number"],
                                "position_on_lap": normalized_lap["position_on_lap"],
                                "lap_time_raw": normalized_lap["lap_time_raw"],
                                "lap_time_seconds": normalized_lap["lap_time_seconds"],
                                "pace_string": normalized_lap.get("pace_string"),
                                "elapsed_race_time": normalized_lap["elapsed_race_time"],
                                "segments_json": normalized_lap.get("segments"),
                            })
                    except ValidationError as e:
                        # Log warning but continue - result is still saved, just without lap data
                        logger.warning(
                            "lap_validation_failed_skipping_laps",
                            event_id=str(event_id),
                            race_id=race_summary.source_race_id,
                            driver_id=normalized_result["source_driver_id"],
                            laps_completed=normalized_result["laps_completed"],
                            error_message=str(e),
                            message="Lap validation failed - skipping lap ingestion for this result but continuing with event import",
                        )
                
                finally:
                    lap_timer.observe()

                # Accumulate laps instead of immediately bulk upserting
                # This allows batching across multiple races for better efficiency
                if race_laps:
                    accumulated_laps.extend(race_laps)
                    laps_ingested += len(race_laps)

                races_since_commit += 1
                # Commit in batches to reduce transaction overhead
                # Commit immediately if this is the last race in the last batch or we've hit the batch size
                is_last_batch = (batch_num + 1) == total_batches
                is_last_race_in_batch = (race_idx + 1) == len(race_data_pairs)
                is_last_race = is_last_batch and is_last_race_in_batch
                
                # Before committing, bulk upsert all accumulated laps from this commit batch
                # This maintains transaction boundaries while improving batching efficiency
                if races_since_commit >= COMMIT_BATCH_SIZE or is_last_race:
                    if accumulated_laps:
                        repo.bulk_upsert_laps(accumulated_laps)
                        accumulated_laps = []  # Clear for next commit batch
                    repo.session.commit()
                    races_since_commit = 0
                    self._record_activity()  # Record progress after commit
        
        # Final bulk upsert for any remaining accumulated laps (safety check)
        if accumulated_laps:
            repo.bulk_upsert_laps(accumulated_laps)
            repo.session.commit()

        return races_ingested, results_ingested, laps_ingested
    
    def _process_entry_list(
        self,
        entry_list: ConnectorEntryList,
        event_id: UUID,
        repo: Repository,
    ) -> Dict[str, Any]:
        """
        Process entry list to create drivers and EventEntry records.
        
        This method:
        1. Creates/updates Driver records from entry list
        2. Creates EventEntry records linking drivers to classes
        
        Args:
            entry_list: Entry list from connector
            event_id: Event ID
            repo: Repository instance
        
        Returns:
            Dictionary with processing statistics
        """
        drivers_created = 0
        drivers_updated = 0
        entries_created = 0
        
        # Generate a temporary source_driver_id for entry list drivers
        # We'll use a hash of the driver name + class as a temporary ID
        # This will be updated when we match race results
        import hashlib
        
        for class_name, entry_drivers in entry_list.entries_by_class.items():
            for entry_driver in entry_drivers:
                # Generate temporary source_driver_id from driver name
                # Format: "entry_{hash_of_name}" - this will be updated when we match race results
                temp_id_source = f"{entry_driver.driver_name.lower().strip()}"
                temp_id_hash = hashlib.md5(temp_id_source.encode()).hexdigest()[:16]
                temp_source_driver_id = f"entry_{temp_id_hash}"
                
                # Create/update driver from entry list
                # Note: We'll update source_driver_id later when we match race results
                driver = repo.upsert_driver(
                    source="liverc",
                    source_driver_id=temp_source_driver_id,
                    display_name=entry_driver.driver_name,
                    transponder_number=entry_driver.transponder_number,
                )
                
                if driver.transponder_number != entry_driver.transponder_number:
                    drivers_updated += 1
                else:
                    drivers_created += 1
                
                # Create EventEntry record
                repo.upsert_event_entry(
                    event_id=event_id,
                    driver_id=driver.id,
                    class_name=class_name,
                    transponder_number=entry_driver.transponder_number,
                    car_number=entry_driver.car_number,
                )
                entries_created += 1
        
        logger.info(
            "entry_list_processed",
            event_id=str(event_id),
            drivers_created=drivers_created,
            drivers_updated=drivers_updated,
            entries_created=entries_created,
            class_count=len(entry_list.entries_by_class),
        )
        
        return {
            "drivers_created": drivers_created,
            "drivers_updated": drivers_updated,
            "entries_created": entries_created,
        }
    
    def _match_users_to_drivers_for_event(
        self,
        event_id: UUID,
        repo: Repository,
    ) -> None:
        """
        Match users to drivers for an event.
        
        Preloads all users once, then matches all drivers in the event to users.
        Creates UserDriverLink and EventDriverLink records.
        
        Args:
            event_id: Event ID
            repo: Repository instance
        """
        # Preload all users once (performance optimization)
        users = repo.get_all_users()
        if not users:
            logger.debug("no_users_to_match", event_id=str(event_id))
            return
        
        # Preload existing links
        existing_links = repo.get_existing_user_driver_links()
        
        # Get all drivers for this event (via EventEntry)
        from ingestion.db.models import EventEntry, Driver
        event_entries_stmt = select(EventEntry).where(EventEntry.event_id == str(event_id))
        event_entries = list(repo.session.scalars(event_entries_stmt).all())
        driver_ids = {entry.driver_id for entry in event_entries}
        
        # Get drivers
        drivers = []
        for driver_id in driver_ids:
            driver_stmt = select(Driver).where(Driver.id == driver_id)
            driver = repo.session.scalar(driver_stmt)
            if driver:
                drivers.append(driver)
        
        if not drivers:
            logger.debug("no_drivers_to_match", event_id=str(event_id))
            return
        
        matched_at = datetime.utcnow()
        links_created = 0
        links_updated = 0
        event_links_created = 0
        
        for driver in drivers:
            match_result = DriverMatcher.find_user_matches_for_driver(
                driver=driver,
                users=users,
                existing_links=existing_links,
            )
            
            if not match_result:
                continue
            
            user, match_type, similarity_score, status = match_result
            
            # Determine status enum
            if status == 'confirmed':
                status_enum = UserDriverLinkStatus.CONFIRMED
                confirmed_at = matched_at
                rejected_at = None
            elif status == 'suggested':
                status_enum = UserDriverLinkStatus.SUGGESTED
                confirmed_at = None
                rejected_at = None
            else:
                status_enum = UserDriverLinkStatus.SUGGESTED
                confirmed_at = None
                rejected_at = None
            
            # Check for conflicts
            conflict_reason = None
            # Check if another user already linked to this driver
            if driver.id in existing_links:
                existing_link = existing_links[driver.id]
                if existing_link.user_id != user.id:
                    conflict_reason = f"Another user ({existing_link.user_id}) already linked to this driver"
                    status_enum = UserDriverLinkStatus.CONFLICT
                    rejected_at = matched_at
            
            # Upsert UserDriverLink
            user_driver_link = repo.upsert_user_driver_link(
                user_id=user.id,
                driver_id=driver.id,
                status=status_enum,
                similarity_score=similarity_score,
                match_type=match_type,
                matched_at=matched_at,
                confirmed_at=confirmed_at,
                rejected_at=rejected_at,
                conflict_reason=conflict_reason,
            )
            
            if driver.id in existing_links:
                links_updated += 1
            else:
                links_created += 1
                existing_links[driver.id] = user_driver_link
            
            # Determine match type enum
            if match_type == 'transponder':
                match_type_enum = EventDriverLinkMatchType.TRANSPONDER
            elif match_type == 'exact':
                match_type_enum = EventDriverLinkMatchType.EXACT
            else:
                match_type_enum = EventDriverLinkMatchType.FUZZY
            
            # Get transponder number with fallback: EventEntry -> Driver -> User
            transponder_number = None
            event_entry_stmt = select(EventEntry).where(
                and_(
                    EventEntry.event_id == str(event_id),
                    EventEntry.driver_id == driver.id,
                )
            ).limit(1)
            event_entry = repo.session.scalar(event_entry_stmt)
            if event_entry and event_entry.transponder_number:
                transponder_number = event_entry.transponder_number
            elif driver.transponder_number:
                transponder_number = driver.transponder_number
            elif user.transponder_number:
                transponder_number = user.transponder_number
            
            # Upsert EventDriverLink
            repo.upsert_event_driver_link(
                user_id=user.id,
                event_id=str(event_id),
                driver_id=driver.id,
                match_type=match_type_enum,
                similarity_score=similarity_score,
                transponder_number=transponder_number,
                matched_at=matched_at,
                user_driver_link_id=user_driver_link.id,
            )
            event_links_created += 1
        
        logger.info(
            "user_driver_matching_complete",
            event_id=str(event_id),
            links_created=links_created,
            links_updated=links_updated,
            event_links_created=event_links_created,
            drivers_processed=len(drivers),
        )
    
    async def ingest_event(
        self,
        event_id: UUID,
        depth: str = "laps_full",
    ) -> Dict[str, Any]:
        """Ingest event data from LiveRC while limiting lock scope."""
        logger.info("ingestion_start", event_id=str(event_id), depth=depth)

        event_context = self._load_event_context(event_id)

        self._set_stage("fetch_event_page", event_id)
        logger.info("connector_fetch_start", event_id=str(event_id), type="event_page")
        event_data = await self.connector.fetch_event_page(
            track_slug=event_context.track_slug,
            source_event_id=event_context.source_event_id,
        )
        logger.info("connector_fetch_end", event_id=str(event_id), type="event_page")

        self._set_stage("fetch_entry_list", event_id)
        logger.info("connector_fetch_start", event_id=str(event_id), type="entry_list")
        entry_list = await self.connector.fetch_entry_list(
            track_slug=event_context.track_slug,
            source_event_id=event_context.source_event_id,
        )
        logger.info("entry_list_fetched", event_id=str(event_id), class_count=len(entry_list.entries_by_class))

        if not entry_list.entries_by_class:
            raise ValidationError(
                f"Entry list is empty for event {event_context.source_event_id}",
                event_id=str(event_id),
            )

        event_data.races.sort(
            key=lambda r: (r.race_order is None, r.race_order if r.race_order is not None else 0)
        )
        Validator.validate_event(event_data, event_context.source_event_id)
        normalized_event = Normalizer.normalize_event(event_data)

        self._set_stage("await_event_lock", event_id)
        return await self._persist_with_lock(
            event_context=event_context,
            depth=depth,
            normalized_event=normalized_event,
            event_data=event_data,
            entry_list=entry_list,
        )

    async def _persist_with_lock(
        self,
        event_context: EventContext,
        depth: str,
        normalized_event: Dict[str, Any],
        event_data: ConnectorEventSummary,
        entry_list: ConnectorEntryList,
    ) -> Dict[str, Any]:
        """Acquire the advisory lock and persist the ingestion payload."""
        # Timeout is handled by _run_with_inactivity_timeout which uses
        # INACTIVITY_TIMEOUT_SECONDS and MAX_TOTAL_DURATION_SECONDS
        
        with db_session() as session:
            repo = Repository(session)
            if not repo.acquire_event_lock(event_context.event_id):
                raise IngestionInProgressError(str(event_context.event_id))
            lock_held = True

            ingestion_timer = metrics.IngestionDurationTracker(
                event_id=str(event_context.event_id),
                track_id=str(event_context.track_id),
            )

            try:
                self._set_stage("persist_event", event_context.event_id)
                return await self._run_with_inactivity_timeout(
                    self._persist_event_data(
                        repo=repo,
                        event_context=event_context,
                        normalized_event=normalized_event,
                        event_data=event_data,
                        entry_list=entry_list,
                        depth=depth,
                        ingestion_timer=ingestion_timer,
                    ),
                    event_context.event_id,
                    ingestion_timer,
                )
            except ConstraintViolationError as exc:
                if "race condition" in str(exc).lower():
                    if not hasattr(self, "_retry_events"):
                        self._retry_events = set()
                    if str(event_context.event_id) not in self._retry_events:
                        self._retry_events.add(str(event_context.event_id))
                        logger.warning(
                            "ingestion_race_condition_retry",
                            event_id=str(event_context.event_id),
                            error=str(exc),
                            message="Retrying ingestion once due to constraint violation",
                        )
                        repo.release_event_lock(event_context.event_id)
                        lock_held = False
                        await asyncio.sleep(1.0)
                        try:
                            result = await self.ingest_event(event_context.event_id, depth=depth)
                            return result
                        finally:
                            self._retry_events.discard(str(event_context.event_id))
                raise
            finally:
                if lock_held:
                    try:
                        repo.release_event_lock(event_context.event_id)
                    except Exception as exc:
                        logger.error(
                            "lock_release_failed",
                            event_id=str(event_context.event_id),
                            error=str(exc),
                            exc_info=True,
                        )

    async def _persist_event_data(
        self,
        repo: Repository,
        event_context: EventContext,
        normalized_event: Dict[str, Any],
        event_data: ConnectorEventSummary,
        entry_list: ConnectorEntryList,
        depth: str,
        ingestion_timer: metrics.IngestionDurationTracker,
    ) -> Dict[str, Any]:
        event_id = event_context.event_id
        try:
            event = repo.get_event_by_id(event_id)
            if not event:
                raise StateMachineError(
                    f"Event {event_id} not found",
                    event_id=str(event_id),
                )

            IngestionStateMachine.validate_transition(
                event.ingest_depth,
                depth,
                event_id=str(event_id),
            )

            already_at_depth = event.ingest_depth == IngestDepth(depth) and depth == "laps_full"
            event_entry_count = repo.session.scalar(
                select(func.count(EventEntry.id)).where(EventEntry.event_id == str(event_id))
            ) or 0

            if already_at_depth and event_entry_count > 0:
                logger.info("ingestion_already_complete", event_id=str(event_id))
                ingestion_timer.finish("already_complete")
                return {
                    "event_id": str(event_id),
                    "ingest_depth": depth,
                    "status": "already_complete",
                    "races_ingested": 0,
                    "results_ingested": 0,
                    "laps_ingested": 0,
                }

            # Update event metadata from normalized payload
            event.event_name = normalized_event["event_name"]
            event.event_date = normalized_event["event_date"]
            event.event_entries = normalized_event["event_entries"]
            event.event_drivers = normalized_event["event_drivers"]
            repo.session.flush()

            # Process entry list first for driver matching
            self._set_stage("persist_entry_list", event_id)
            entry_stats = self._process_entry_list(
                entry_list=entry_list,
                event_id=event_id,
                repo=repo,
            )
            repo.session.commit()
            logger.info(
                "entry_list_persisted",
                event_id=str(event_id),
                drivers_created=entry_stats.get("drivers_created"),
                drivers_updated=entry_stats.get("drivers_updated"),
                entries_created=entry_stats.get("entries_created"),
            )

            races_ingested = 0
            results_ingested = 0
            laps_ingested = 0

            if event.ingest_depth != IngestDepth.LAPS_FULL:
                self._set_stage("persist_races", event_id)
                races_ingested, results_ingested, laps_ingested = await self._process_races_parallel(
                    race_summaries=event_data.races,
                    event_id=event_id,
                    repo=repo,
                    depth=depth,
                )
                repo.session.commit()
            else:
                logger.info(
                    "skipping_race_processing",
                    event_id=str(event_id),
                    message="Event already at laps_full - only processed entry list",
                )

            self._set_stage("driver_matching", event_id)
            self._match_users_to_drivers_for_event(
                event_id=event_id,
                repo=repo,
            )
            repo.session.commit()

            check_and_confirm_links(repo)
            repo.session.commit()

            event.ingest_depth = IngestDepth(depth)
            event.last_ingested_at = datetime.utcnow()
            repo.session.commit()

            result_payload = {
                "event_id": str(event_id),
                "ingest_depth": depth,
                "last_ingested_at": event.last_ingested_at.isoformat(),
                "races_ingested": races_ingested,
                "results_ingested": results_ingested,
                "laps_ingested": laps_ingested,
                "status": "updated",
            }
            ingestion_timer.finish("success")
            return result_payload
        except Exception:
            ingestion_timer.finish("error")
            raise
    
    async def ingest_event_by_source_id(
        self,
        source_event_id: str,
        track_id: UUID,
        depth: str = "laps_full",
    ) -> Dict[str, Any]:
        """Ingest an event by discovering it from LiveRC and persisting it."""
        logger.info(
            "ingestion_by_source_id_start",
            source_event_id=source_event_id,
            track_id=str(track_id),
            depth=depth,
        )

        track_context = self._load_track_context(track_id)

        self._set_stage("fetch_event_page", None)
        logger.info(
            "connector_fetch_start",
            source_event_id=source_event_id,
            track_slug=track_context.source_track_slug,
            type="event_page",
        )
        event_data = await self.connector.fetch_event_page(
            track_slug=track_context.source_track_slug,
            source_event_id=source_event_id,
        )
        logger.info(
            "connector_fetch_end",
            source_event_id=source_event_id,
            track_slug=track_context.source_track_slug,
            type="event_page",
        )

        self._set_stage("fetch_entry_list", None)
        logger.info(
            "connector_fetch_start",
            source_event_id=source_event_id,
            track_slug=track_context.source_track_slug,
            type="entry_list",
        )
        entry_list = await self.connector.fetch_entry_list(
            track_slug=track_context.source_track_slug,
            source_event_id=source_event_id,
        )
        logger.info(
            "entry_list_fetched",
            source_event_id=source_event_id,
            class_count=len(entry_list.entries_by_class),
        )

        if not entry_list.entries_by_class:
            raise ValidationError(
                f"Entry list is empty for event {source_event_id}",
                event_id=source_event_id,
            )

        event_data.races.sort(key=lambda r: (r.race_order is None, r.race_order or 0))
        Validator.validate_event(event_data, source_event_id)
        normalized_event = Normalizer.normalize_event(event_data)
        event_url = build_event_url(track_context.source_track_slug, source_event_id)

        event_id = self._ensure_event_record(
            source_event_id=source_event_id,
            track_id=track_id,
            normalized_event=normalized_event,
            event_url=event_url,
        )

        event_context = EventContext(
            event_id=event_id,
            track_id=track_id,
            track_slug=track_context.source_track_slug,
            source_event_id=source_event_id,
        )

        return await self._persist_with_lock(
            event_context=event_context,
            depth=depth,
            normalized_event=normalized_event,
            event_data=event_data,
            entry_list=entry_list,
        )
