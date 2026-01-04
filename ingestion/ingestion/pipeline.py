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
import math
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional
from uuid import UUID

from ingestion.common.logging import get_logger
from ingestion.common import metrics
from ingestion.common.tracing import TraceSpan
from ingestion.connectors.liverc.connector import LiveRCConnector
from ingestion.connectors.liverc.client.httpx_client import HTTPXClient
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
    
    # Race fetch concurrency - adaptive, starts conservative and adjusts based on performance
    # Initial value: 8 (conservative to avoid rate limiting)
    # Will increase if network is fast and no errors, decrease if rate limited
    RACE_FETCH_CONCURRENCY = 8
    # Minimum concurrency (safety floor)
    MIN_CONCURRENCY = 4
    # Maximum concurrency (safety ceiling)
    MAX_CONCURRENCY = 16
    # Inactivity timeout - only triggers if no progress is made for this duration
    INACTIVITY_TIMEOUT_SECONDS = 5 * 60  # 5 minutes of inactivity
    # Maximum total duration - safety limit to prevent runaway processes
    MAX_TOTAL_DURATION_SECONDS = 60 * 60  # 1 hour maximum total duration
    # Percentile thresholds for adaptive concurrency adjustments
    CONCURRENCY_INCREASE_THRESHOLD_SECONDS = 2.5
    CONCURRENCY_DECREASE_THRESHOLD_SECONDS = 8.0
    
    def __init__(self):
        """Initialize pipeline."""
        self.connector = LiveRCConnector()
        self._current_stage: str = "idle"
        self._last_activity_time: Optional[float] = None
        # Adaptive concurrency tracking
        self._observed_latencies: List[float] = []  # Track last N fetch latencies
        self._rate_limit_errors: int = 0  # Count of 429 errors
        self._concurrency_adjustment_window = 8  # Adjust after fewer observations for faster reaction

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
        shared_client: Optional[HTTPXClient] = None,
    ) -> Tuple[ConnectorRacePackage, float]:
        """
        Fetch and validate a single race page.
        
        Args:
            race_summary: Race summary to fetch
            event_id: Event ID for logging/validation
            shared_client: Optional HTTPXClient instance to reuse
        
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
            race_package = await self.connector.fetch_race_page(race_summary, shared_client=shared_client)
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
        
        return race_package, duration
    
    def _adjust_concurrency(self) -> None:
        """
        Adjust concurrency based on observed performance.
        
        Increases concurrency if latencies are low and no rate limiting.
        Decreases concurrency if rate limiting occurs or latencies are high.
        """
        if len(self._observed_latencies) < self._concurrency_adjustment_window:
            return  # Not enough data yet
        
        recent_latencies = self._observed_latencies[-self._concurrency_adjustment_window:]
        p75_latency = self._calculate_percentile(recent_latencies, 0.75)
        p90_latency = self._calculate_percentile(recent_latencies, 0.9)
        
        # Check for rate limiting
        if self._rate_limit_errors > 0:
            # Rate limited - decrease concurrency aggressively
            old_concurrency = self.RACE_FETCH_CONCURRENCY
            self.RACE_FETCH_CONCURRENCY = max(
                self.MIN_CONCURRENCY,
                self.RACE_FETCH_CONCURRENCY - 2
            )
            logger.info(
                "concurrency_decreased_due_to_rate_limit",
                old_concurrency=old_concurrency,
                new_concurrency=self.RACE_FETCH_CONCURRENCY,
                rate_limit_errors=self._rate_limit_errors,
            )
            # Reset rate limit counter after adjustment
            self._rate_limit_errors = 0
            self._observed_latencies = self._observed_latencies[-self._concurrency_adjustment_window:]
        elif (
            p75_latency < self.CONCURRENCY_INCREASE_THRESHOLD_SECONDS
            and self.RACE_FETCH_CONCURRENCY < self.MAX_CONCURRENCY
        ):
            old_concurrency = self.RACE_FETCH_CONCURRENCY
            self.RACE_FETCH_CONCURRENCY = min(
                self.MAX_CONCURRENCY,
                self.RACE_FETCH_CONCURRENCY + 1
            )
            if old_concurrency != self.RACE_FETCH_CONCURRENCY:
                logger.info(
                    "concurrency_increased",
                    old_concurrency=old_concurrency,
                    new_concurrency=self.RACE_FETCH_CONCURRENCY,
                    p75_latency=p75_latency,
                )
                self._observed_latencies = self._observed_latencies[-self._concurrency_adjustment_window:]
        elif (
            p90_latency > self.CONCURRENCY_DECREASE_THRESHOLD_SECONDS
            and self.RACE_FETCH_CONCURRENCY > self.MIN_CONCURRENCY
        ):
            old_concurrency = self.RACE_FETCH_CONCURRENCY
            self.RACE_FETCH_CONCURRENCY = max(
                self.MIN_CONCURRENCY,
                self.RACE_FETCH_CONCURRENCY - 1
            )
            if old_concurrency != self.RACE_FETCH_CONCURRENCY:
                logger.info(
                    "concurrency_decreased_due_to_latency",
                    old_concurrency=old_concurrency,
                    new_concurrency=self.RACE_FETCH_CONCURRENCY,
                    p90_latency=p90_latency,
                )
                self._observed_latencies = self._observed_latencies[-self._concurrency_adjustment_window:]

    @staticmethod
    def _calculate_percentile(observations: List[float], percentile: float) -> float:
        if not observations:
            return 0.0
        sorted_values = sorted(observations)
        if len(sorted_values) == 1:
            return sorted_values[0]
        k = (len(sorted_values) - 1) * max(0.0, min(1.0, percentile))
        lower_index = math.floor(k)
        upper_index = math.ceil(k)
        lower_value = sorted_values[lower_index]
        upper_value = sorted_values[upper_index]
        if lower_index == upper_index:
            return lower_value
        weight = k - lower_index
        return lower_value + (upper_value - lower_value) * weight
    
    async def _process_races_batch(
        self,
        race_summaries: List[ConnectorRaceSummary],
        event_id: UUID,
        shared_client: Optional[HTTPXClient] = None,
    ) -> List[Tuple[ConnectorRaceSummary, ConnectorRacePackage]]:
        """
        Fetch multiple race pages in parallel with shared HTTPXClient.
        
        Tracks performance metrics for adaptive concurrency adjustment.
        
        Args:
            race_summaries: List of race summaries to fetch
            event_id: Event ID for logging/validation
            shared_client: Optional pre-created HTTPXClient to reuse (for connection pooling)
        
        Returns:
            List of tuples (race_summary, race_package) in the same order as input
        """
        # Track per-request latencies for adaptive concurrency decisions

        # Use provided client or create new one (backward compatibility)
        if shared_client is not None:
            tasks = [
                self._fetch_race_page_with_validation(race_summary, event_id, shared_client)
                for race_summary in race_summaries
            ]
            race_fetch_results = await asyncio.gather(*tasks, return_exceptions=True)
        else:
            async with HTTPXClient(self.connector._site_policy) as client:
                tasks = [
                    self._fetch_race_page_with_validation(race_summary, event_id, client)
                    for race_summary in race_summaries
                ]
                race_fetch_results = await asyncio.gather(*tasks, return_exceptions=True)

        per_race_latencies: List[float] = []
        
        # Filter out exceptions and log them, but continue processing valid races
        valid_pairs = []
        rate_limited = False
        for race_summary, race_result in zip(race_summaries, race_fetch_results):
            if isinstance(race_result, Exception):
                # Check if it's a rate limit error (429)
                error_str = str(race_result).lower()
                if '429' in error_str or 'rate limit' in error_str or 'too many requests' in error_str:
                    rate_limited = True
                    self._rate_limit_errors += 1
                
                logger.warning(
                    "race_fetch_failed",
                    event_id=str(event_id),
                    race_id=race_summary.source_race_id,
                    error_type=type(race_result).__name__,
                    error_message=str(race_result),
                    message="Skipping failed race and continuing with others",
                )
                continue
            race_package, race_latency = race_result
            per_race_latencies.append(race_latency)
            valid_pairs.append((race_summary, race_package))

        if per_race_latencies:
            self._observed_latencies.extend(per_race_latencies)
            # Keep only recent observations (last 200 requests)
            if len(self._observed_latencies) > 200:
                self._observed_latencies = self._observed_latencies[-200:]

        # Adjust concurrency based on observed performance
        self._adjust_concurrency()
        
        return valid_pairs
    
    def _process_race_cpu_sync(
        self,
        race_summary: ConnectorRaceSummary,
        race_package: ConnectorRacePackage,
        event_id: UUID,
        event_entries_cache: Dict[str, List[EventEntry]],
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Process CPU-bound operations for a single race (synchronous, runs in thread pool).
        
        This function performs all CPU-intensive work (normalization, validation, matching)
        without accessing the database. Database writes happen separately in the main thread.
        
        Args:
            race_summary: Race summary
            race_package: Race package with results and laps
            event_id: Event ID for validation
            event_entries_cache: Cached event entries by class name
        
        Returns:
            Tuple of (normalized_race, processed_results, race_laps)
            - normalized_race: Normalized race data dict
            - processed_results: List of dicts with result, normalized_result, matched_event_entry info
            - race_laps: List of normalized lap dicts (without race_result_id)
        """
        # Normalize race data (CPU-bound)
        normalized_race = Normalizer.normalize_race(race_package.race_summary)
        
        processed_results = []
        race_laps = []
        
        # Process results (CPU-bound)
        for result in race_package.results:
            # Validate result (CPU-bound)
            Validator.validate_result(result, str(event_id), race_summary.source_race_id)
            
            # Normalize result (CPU-bound)
            normalized_result = Normalizer.normalize_result(result)
            
            # Match race result driver to EventEntry record (CPU-bound, uses cached entries)
            class_name = normalized_race["class_name"]
            event_entries = event_entries_cache.get(class_name, [])
            
            matched_event_entry = None
            if event_entries:
                matched_event_entry = DriverMatcher.match_race_result_to_event_entry(
                    event_entries=event_entries,
                    race_result=result,
                    class_name=class_name,
                )
            
            # Process laps (CPU-bound)
            driver_laps = race_package.laps_by_driver.get(
                normalized_result["source_driver_id"], []
            )
            
            # Validate and normalize laps
            driver_race_laps = []
            try:
                Validator.validate_laps(
                    driver_laps,
                    normalized_result["laps_completed"],
                    str(event_id),
                    race_summary.source_race_id,
                    normalized_result["source_driver_id"],
                )
                
                # Collect normalized laps
                for lap in driver_laps:
                    normalized_lap = Normalizer.normalize_lap(lap)
                    driver_race_laps.append({
                        "lap_number": normalized_lap["lap_number"],
                        "position_on_lap": normalized_lap["position_on_lap"],
                        "lap_time_raw": normalized_lap["lap_time_raw"],
                        "lap_time_seconds": normalized_lap["lap_time_seconds"],
                        "pace_string": normalized_lap.get("pace_string"),
                        "elapsed_race_time": normalized_lap["elapsed_race_time"],
                        "segments_json": normalized_lap.get("segments"),
                        # race_result_id will be added after DB write
                        "source_driver_id": normalized_result["source_driver_id"],  # For matching later
                    })
            except ValidationError:
                # Log but continue - result is still saved, just without lap data
                pass
            
            processed_results.append({
                "result": result,
                "normalized_result": normalized_result,
                "matched_event_entry": matched_event_entry,
            })
            race_laps.extend(driver_race_laps)
        
        return (normalized_race, processed_results, race_laps)
    
    async def _process_race_cpu(
        self,
        race_summary: ConnectorRaceSummary,
        race_package: ConnectorRacePackage,
        event_id: UUID,
        event_entries_cache: Dict[str, List[EventEntry]],
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Process CPU-bound operations for a single race (async wrapper for thread pool).
        
        Args:
            race_summary: Race summary
            race_package: Race package with results and laps
            event_id: Event ID for validation
            event_entries_cache: Cached event entries by class name
        
        Returns:
            Tuple of (normalized_race, processed_results, race_laps)
        """
        # Run CPU-bound work in thread pool to bypass GIL
        return await asyncio.to_thread(
            self._process_race_cpu_sync,
            race_summary,
            race_package,
            event_id,
            event_entries_cache,
        )
    
    def _batch_write_races_data(
        self,
        repo: Repository,
        event_id: UUID,
        batch_races_data: List[Dict[str, Any]],
        event_entries_cache: Dict[str, List[EventEntry]],
    ) -> Tuple[int, int, int]:
        """
        Batch write multiple races' data to the database.
        
        This method:
        1. Processes driver updates (must happen before race_drivers)
        2. Bulk writes all races
        3. Bulk writes all race_drivers
        4. Bulk writes all race_results
        5. Returns accumulated laps for later bulk write
        
        Args:
            repo: Repository instance
            event_id: Event ID
            batch_races_data: List of race data dictionaries, each containing:
                - race_summary: ConnectorRaceSummary
                - race_package: ConnectorRacePackage
                - normalized_race: Dict
                - processed_results: List[Dict]
                - race_laps: List[Dict]
            event_entries_cache: Cached event entries by class name
        
        Returns:
            Tuple of (races_ingested, results_ingested, laps_ingested, accumulated_laps)
        """
        races_ingested = 0
        results_ingested = 0
        laps_ingested = 0
        accumulated_laps: List[Dict[str, Any]] = []
        
        # Step 1: Process driver updates first (these must happen before race_drivers)
        # Collect all drivers that need to be updated/created
        drivers_to_upsert: List[Dict[str, Any]] = []
        driver_update_map: Dict[str, Dict[str, Any]] = {}  # source_driver_id -> update info
        
        races_to_write: List[Dict[str, Any]] = []
        race_drivers_to_write: List[Dict[str, Any]] = []
        race_results_to_write: List[Dict[str, Any]] = []
        
        # Mapping structures to track relationships
        race_id_map: Dict[str, str] = {}  # source_race_id -> race.id
        race_driver_id_map: Dict[Tuple[str, str], str] = {}  # (race_id, source_driver_id) -> race_driver.id
        
        for race_data in batch_races_data:
            race_summary = race_data["race_summary"]
            normalized_race = race_data["normalized_race"]
            processed_results = race_data["processed_results"]
            race_laps = race_data["race_laps"]
            
            # Handle empty races (no results)
            race_package = race_data.get("race_package")
            if not race_package or not race_package.results or len(processed_results) == 0:
                # Still write the race record for empty races
                races_to_write.append({
                    "event_id": event_id,
                    "source": "liverc",
                    "source_race_id": normalized_race["source_race_id"],
                    "class_name": normalized_race["class_name"],
                    "race_label": normalized_race["race_label"],
                    "race_order": normalized_race["race_order"],
                    "race_url": normalized_race["race_url"],
                    "start_time": normalized_race["start_time"],
                    "duration_seconds": normalized_race["duration_seconds"],
                })
                continue
            
            # Collect race data
            races_to_write.append({
                "event_id": event_id,
                "source": "liverc",
                "source_race_id": normalized_race["source_race_id"],
                "class_name": normalized_race["class_name"],
                "race_label": normalized_race["race_label"],
                "race_order": normalized_race["race_order"],
                "race_url": normalized_race["race_url"],
                "start_time": normalized_race["start_time"],
                "duration_seconds": normalized_race["duration_seconds"],
            })
            
            # Process results to collect driver and race_driver/result data
            class_name = normalized_race["class_name"]
            event_entries = event_entries_cache.get(class_name, [])
            
            for processed in processed_results:
                result = processed["result"]
                normalized_result = processed["normalized_result"]
                matched_event_entry = processed["matched_event_entry"]
                
                # Track cache usage
                metrics.record_event_entry_cache_lookup(str(event_id))
                if event_entries:
                    metrics.record_event_entry_cache_hit(str(event_id))
                
                # Handle driver updates
                driver_id = None
                if matched_event_entry:
                    driver = matched_event_entry.driver
                    if driver.source_driver_id.startswith("entry_"):
                        # Check if a driver with the real source_driver_id already exists
                        from ingestion.db.models import Driver as DriverModel
                        existing_driver_stmt = select(DriverModel).where(
                            and_(
                                DriverModel.source == "liverc",
                                DriverModel.source_driver_id == normalized_result["source_driver_id"],
                            )
                        ).limit(1)
                        existing_driver = repo.session.scalar(existing_driver_stmt)
                        
                        if existing_driver and existing_driver.id != driver.id:
                            matched_event_entry.driver_id = existing_driver.id
                            matched_event_entry.updated_at = datetime.utcnow()
                            driver_id = existing_driver.id
                        else:
                            # Update driver with actual source_driver_id
                            driver.source_driver_id = normalized_result["source_driver_id"]
                            driver.updated_at = datetime.utcnow()
                            driver_id = driver.id
                    else:
                        driver_id = driver.id
                else:
                    # Create driver from race result (fallback)
                    driver = repo.upsert_driver(
                        source="liverc",
                        source_driver_id=normalized_result["source_driver_id"],
                        display_name=normalized_result["display_name"],
                        transponder_number=None,
                    )
                    driver_id = driver.id
                
                # Collect race_driver data (will write after races)
                race_drivers_to_write.append({
                    "race_id": None,  # Will be filled after races are written
                    "driver_id": str(driver_id),
                    "source": "liverc",
                    "source_driver_id": normalized_result["source_driver_id"],
                    "display_name": normalized_result["display_name"],
                    "transponder_number": None,
                    "_source_race_id": normalized_race["source_race_id"],  # Temporary for mapping
                })
                
                # Collect race_result data (will write after race_drivers)
                race_results_to_write.append({
                    "race_id": None,  # Will be filled after races are written
                    "race_driver_id": None,  # Will be filled after race_drivers are written
                    "position_final": normalized_result["position_final"],
                    "laps_completed": normalized_result["laps_completed"],
                    "total_time_raw": normalized_result.get("total_time_raw"),
                    "total_time_seconds": normalized_result["total_time_seconds"],
                    "fast_lap_time": normalized_result["fast_lap_time"],
                    "avg_lap_time": normalized_result["avg_lap_time"],
                    "consistency": normalized_result["consistency"],
                    "_source_race_id": normalized_race["source_race_id"],  # Temporary for mapping
                    "_source_driver_id": normalized_result["source_driver_id"],  # Temporary for mapping
                })
                
                # Collect laps (will write after race_results)
                driver_source_id = normalized_result["source_driver_id"]
                driver_laps = [lap for lap in race_laps if lap.get("source_driver_id") == driver_source_id]
                for lap in driver_laps:
                    lap_copy = {k: v for k, v in lap.items() if k != "source_driver_id"}
                    lap_copy["_source_race_id"] = normalized_race["source_race_id"]
                    lap_copy["_source_driver_id"] = driver_source_id
                    accumulated_laps.append(lap_copy)
        
        # Step 2: Bulk write races
        if races_to_write:
            races = repo.bulk_upsert_races(races_to_write)
            races_ingested = len(races)
            # Build mapping
            for race in races.values():
                race_id_map[race.source_race_id] = race.id
        
        # Step 3: Update race_drivers with race IDs and bulk write
        if race_drivers_to_write:
            for rd_data in race_drivers_to_write:
                rd_data["race_id"] = race_id_map[rd_data.pop("_source_race_id")]
            race_drivers = repo.bulk_upsert_race_drivers(race_drivers_to_write)
            # Build mapping
            for (race_id, source_driver_id), rd in race_drivers.items():
                race_driver_id_map[(race_id, source_driver_id)] = rd.id
        
        # Step 4: Update race_results with race and race_driver IDs and bulk write
        if race_results_to_write:
            for rr_data in race_results_to_write:
                source_race_id = rr_data.pop("_source_race_id")
                source_driver_id = rr_data.pop("_source_driver_id")
                race_id = race_id_map[source_race_id]
                rr_data["race_id"] = race_id
                rr_data["race_driver_id"] = race_driver_id_map[(race_id, source_driver_id)]
            race_results = repo.bulk_upsert_race_results(race_results_to_write)
            results_ingested = len(race_results)
            
            # Step 5: Update laps with race_result IDs
            for lap in accumulated_laps:
                source_race_id = lap.pop("_source_race_id")
                source_driver_id = lap.pop("_source_driver_id")
                race_id = race_id_map[source_race_id]
                race_driver_id = race_driver_id_map[(race_id, source_driver_id)]
                race_result_id = race_results[(race_id, race_driver_id)].id
                lap["race_result_id"] = str(race_result_id)
            
            laps_ingested = len(accumulated_laps)
        
        return races_ingested, results_ingested, laps_ingested, accumulated_laps
    
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
        # Commit in batches to reduce transaction overhead (every 35 races, increased from 20)
        COMMIT_BATCH_SIZE = 35
        races_since_commit = 0
        
        # Accumulate laps across races within commit batches for better batching efficiency
        # This reduces function call overhead and allows larger, more efficient batches
        accumulated_laps: List[Dict[str, Any]] = []
        
        total_batches = (len(race_summaries) + batch_size - 1) // batch_size  # Ceiling division
        
        # Create ONE shared HTTPXClient for ALL batches to enable connection pooling
        # This significantly improves performance by reusing TCP connections across batches
        async with HTTPXClient(self.connector._site_policy) as shared_client:
            # Pipeline optimization: Start fetching next batch while processing current batch
            # This overlaps network I/O with CPU/DB work for better throughput
            next_batch_fetch_task: Optional[asyncio.Task] = None
            
            for batch_num, batch_start in enumerate(range(0, len(race_summaries), batch_size)):
                batch = race_summaries[batch_start:batch_start + batch_size]
                
                # If we have a prefetched batch from previous iteration, use it
                if next_batch_fetch_task is not None:
                    # Wait for the prefetched batch to complete
                    race_data_pairs = await next_batch_fetch_task
                    next_batch_fetch_task = None
                else:
                    # First batch - fetch it now
                    race_data_pairs = await self._process_races_batch(batch, event_id, shared_client)
                
                # Start fetching next batch in parallel (if there is one)
                # This allows network I/O to happen while we process current batch
                if batch_num + 1 < total_batches:
                    next_batch = race_summaries[(batch_num + 1) * batch_size:(batch_num + 2) * batch_size]
                    next_batch_fetch_task = asyncio.create_task(
                        self._process_races_batch(next_batch, event_id, shared_client)
                    )
                
                # Process CPU-bound work in parallel (normalization, validation, matching)
                cpu_tasks = [
                    self._process_race_cpu(race_summary, race_package, event_id, event_entries_cache)
                    for race_summary, race_package in race_data_pairs
                ]
                processed_races = await asyncio.gather(*cpu_tasks, return_exceptions=True)
                
                # Collect valid race data for batch writing
                batch_races_data: List[Dict[str, Any]] = []
                for (race_summary, race_package), processed_data in zip(race_data_pairs, processed_races):
                    # Handle exceptions from CPU processing
                    if isinstance(processed_data, Exception):
                        logger.warning(
                            "race_cpu_processing_failed",
                            event_id=str(event_id),
                            race_id=race_summary.source_race_id,
                            error_type=type(processed_data).__name__,
                            error_message=str(processed_data),
                            message="Skipping race due to CPU processing error",
                        )
                        continue
                    
                    normalized_race, processed_results, race_laps = processed_data
                    batch_races_data.append({
                        "race_summary": race_summary,
                        "race_package": race_package,
                        "normalized_race": normalized_race,
                        "processed_results": processed_results,
                        "race_laps": race_laps,
                    })
                
                # Batch write all races in this batch
                if batch_races_data:
                    batch_races, batch_results, batch_laps, batch_accumulated_laps = self._batch_write_races_data(
                        repo=repo,
                        event_id=event_id,
                        batch_races_data=batch_races_data,
                        event_entries_cache=event_entries_cache,
                    )
                    races_ingested += batch_races
                    results_ingested += batch_results
                    laps_ingested += batch_laps
                    accumulated_laps.extend(batch_accumulated_laps)
                    races_since_commit += batch_races
                    self._record_activity()  # Record progress
                    
                    # Commit in batches
                    is_last_batch = (batch_num + 1) == total_batches
                    if races_since_commit >= COMMIT_BATCH_SIZE or is_last_batch:
                        if accumulated_laps:
                            repo.bulk_upsert_laps(accumulated_laps)
                            accumulated_laps = []  # Clear for next commit batch
                        repo.session.commit()
                        races_since_commit = 0
                        self._record_activity()  # Record progress after commit
            
            # Final bulk upsert for any remaining accumulated laps (safety check)
            # This is inside the HTTPXClient context to ensure all fetches are complete
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
            logger.warning(
                "entry_list_empty",
                event_id=str(event_id),
                source_event_id=event_context.source_event_id,
                message="Entry list is empty - event may not have entries published yet on LiveRC",
            )
            raise ValidationError(
                f"Entry list is empty for event {event_context.source_event_id}. "
                f"This event may not have entries published yet on LiveRC, or entries may not be available. "
                f"Please check the event on LiveRC and try again later if entries are not yet published.",
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
            logger.warning(
                "entry_list_empty",
                source_event_id=source_event_id,
                message="Entry list is empty - event may not have entries published yet on LiveRC",
            )
            raise ValidationError(
                f"Entry list is empty for event {source_event_id}. "
                f"This event may not have entries published yet on LiveRC, or entries may not be available. "
                f"Please check the event on LiveRC and try again later if entries are not yet published.",
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
