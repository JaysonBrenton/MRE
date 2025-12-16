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
from datetime import datetime
from typing import Dict, Any, List, Tuple
from uuid import UUID

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.connector import LiveRCConnector
from ingestion.connectors.liverc.models import (
    ConnectorEventSummary,
    ConnectorRacePackage,
    ConnectorRaceSummary,
)
from ingestion.connectors.liverc.utils import build_event_url
from ingestion.db.models import IngestDepth
from ingestion.db.repository import Repository
from ingestion.db.session import db_session
from ingestion.ingestion.errors import (
    IngestionInProgressError,
    StateMachineError,
    ValidationError,
)
from ingestion.ingestion.normalizer import Normalizer
from ingestion.ingestion.state_machine import IngestionStateMachine
from ingestion.ingestion.validator import Validator

logger = get_logger(__name__)


class IngestionPipeline:
    """Main ingestion pipeline orchestrator."""
    
    # Maximum number of concurrent race page fetches
    # This prevents overwhelming the LiveRC API while significantly speeding up imports
    RACE_FETCH_CONCURRENCY = 15
    
    def __init__(self):
        """Initialize pipeline."""
        self.connector = LiveRCConnector()
    
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
        
        # Fetch race page
        logger.info("connector_fetch_start", event_id=str(event_id), race_id=race_summary.source_race_id, type="race_page")
        race_package = await self.connector.fetch_race_page(race_summary)
        logger.info("connector_fetch_end", event_id=str(event_id), race_id=race_summary.source_race_id, type="race_page")
        
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
        
        # Fetch all races in parallel
        race_packages = await asyncio.gather(*tasks)
        
        # Return as tuples maintaining order
        return list(zip(race_summaries, race_packages))
    
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
        
        Returns:
            Tuple of (races_ingested, results_ingested, laps_ingested)
        """
        races_ingested = 0
        results_ingested = 0
        laps_ingested = 0
        
        # Process races in batches to limit concurrent requests
        batch_size = self.RACE_FETCH_CONCURRENCY
        for batch_start in range(0, len(race_summaries), batch_size):
            batch = race_summaries[batch_start:batch_start + batch_size]
            
            # Fetch this batch in parallel
            race_data_pairs = await self._process_races_batch(batch, event_id)
            
            # Process fetched races sequentially for database consistency
            for race_summary, race_package in race_data_pairs:
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
                
                # Collect all race laps for bulk upsert
                race_laps = []
                
                # Process results sequentially
                for result in race_package.results:
                    # Validate result
                    Validator.validate_result(result, str(event_id), race_summary.source_race_id)
                    
                    # Normalize result
                    normalized_result = Normalizer.normalize_result(result)
                    
                    # Upsert driver
                    driver = repo.upsert_race_driver(
                        race_id=race.id,
                        source="liverc",
                        source_driver_id=normalized_result["source_driver_id"],
                        display_name=normalized_result["display_name"],
                    )
                    
                    # Upsert result
                    race_result = repo.upsert_race_result(
                        race_id=race.id,
                        race_driver_id=driver.id,
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
                
                # Bulk upsert all laps for this race
                if race_laps:
                    repo.bulk_upsert_laps(race_laps)
                    laps_ingested += len(race_laps)
        
        return races_ingested, results_ingested, laps_ingested
    
    async def ingest_event(
        self,
        event_id: UUID,
        depth: str = "laps_full",
    ) -> Dict[str, Any]:
        """
        Ingest event data from LiveRC.
        
        Args:
            event_id: Event ID from database
            depth: Ingestion depth (must be "laps_full" for V1)
        
        Returns:
            Ingestion summary dictionary
        
        Raises:
            IngestionInProgressError: If ingestion already running
            StateMachineError: If invalid state transition
            ValidationError: If data validation fails
        """
        logger.info("ingestion_start", event_id=str(event_id), depth=depth)
        
        with db_session() as session:
            repo = Repository(session)
            
            # Acquire lock early, before any database operations
            # This prevents race conditions and ensures we fail fast
            if not repo.acquire_event_lock(event_id):
                # Lock acquisition failed - no rollback needed as no work was done
                raise IngestionInProgressError(str(event_id))
            
            try:
                # Get event
                event = repo.get_event_by_id(event_id)
                if not event:
                    raise StateMachineError(
                        f"Event {event_id} not found",
                        event_id=str(event_id),
                    )
                
                # Validate state transition
                IngestionStateMachine.validate_transition(
                    event.ingest_depth,
                    depth,
                    event_id=str(event_id),
                )
                
                # Check if already at requested depth
                if event.ingest_depth == IngestDepth(depth) and depth == "laps_full":
                    logger.info("ingestion_already_complete", event_id=str(event_id))
                    return {
                        "event_id": str(event_id),
                        "ingest_depth": depth,
                        "status": "already_complete",
                        "races_ingested": 0,
                        "results_ingested": 0,
                        "laps_ingested": 0,
                    }
            
                # Fetch event page
                logger.info("connector_fetch_start", event_id=str(event_id), type="event_page")
                event_data = await self.connector.fetch_event_page(
                    track_slug=event.track.source_track_slug,
                    source_event_id=event.source_event_id,
                )
                logger.info("connector_fetch_end", event_id=str(event_id), type="event_page")
                
                # Sort races by race_order before validation
                # Sorting logic:
                # - Races with race_order=None are sorted to the end (treated as highest priority for "None" group)
                # - Races with numeric race_order are sorted in ascending order
                # - This ensures numbered races (1, 2, 3...) come before unnumbered races
                # - Within the None group, order is preserved (stable sort)
                event_data.races.sort(key=lambda r: (r.race_order is None, r.race_order if r.race_order is not None else 0))
                
                # Validate event data
                Validator.validate_event(event_data, event.source_event_id)
                
                # Normalize event data
                normalized_event = Normalizer.normalize_event(event_data)
                
                # Update event metadata
                event.event_name = normalized_event["event_name"]
                event.event_date = normalized_event["event_date"]
                event.event_entries = normalized_event["event_entries"]
                event.event_drivers = normalized_event["event_drivers"]
                
                # Process races in parallel batches
                races_ingested, results_ingested, laps_ingested = await self._process_races_parallel(
                    race_summaries=event_data.races,
                    event_id=event_id,
                    repo=repo,
                    depth=depth,
                )
                
                # Update event ingest_depth and timestamp
                event.ingest_depth = IngestDepth(depth)
                event.last_ingested_at = datetime.utcnow()
                
                logger.info(
                    "ingestion_complete",
                    event_id=str(event_id),
                    races_ingested=races_ingested,
                    results_ingested=results_ingested,
                    laps_ingested=laps_ingested,
                )
                
                return {
                    "event_id": str(event_id),
                    "ingest_depth": depth,
                    "last_ingested_at": event.last_ingested_at.isoformat(),
                    "races_ingested": races_ingested,
                    "results_ingested": results_ingested,
                    "laps_ingested": laps_ingested,
                    "status": "updated",
                }
            
            finally:
                # Release lock - wrap in try-except to ensure we don't fail silently
                try:
                    repo.release_event_lock(event_id)
                except Exception as e:
                    logger.error(
                        "lock_release_failed",
                        event_id=str(event_id),
                        error=str(e),
                        exc_info=True,
                    )
    
    async def ingest_event_by_source_id(
        self,
        source_event_id: str,
        track_id: UUID,
        depth: str = "laps_full",
    ) -> Dict[str, Any]:
        """
        Ingest event by source_event_id and track_id, creating Event if missing.
        
        This method fetches full event metadata from LiveRC and upserts
        the Event row if it doesn't exist, then proceeds with normal ingestion.
        
        Args:
            source_event_id: Event ID from LiveRC
            track_id: Track ID from database
            depth: Ingestion depth (must be "laps_full" for V1)
        
        Returns:
            Ingestion summary dictionary
        
        Raises:
            IngestionInProgressError: If ingestion already running
            StateMachineError: If invalid state transition
            ValidationError: If data validation fails
        """
        logger.info(
            "ingestion_by_source_id_start",
            source_event_id=source_event_id,
            track_id=str(track_id),
            depth=depth,
        )
        
        with db_session() as session:
            repo = Repository(session)
            
            # Get track to extract track_slug
            from ingestion.db.models import Track
            # Convert UUID to string since tracks.id is TEXT in database
            track_id_str = str(track_id)
            track = session.get(Track, track_id_str)
            if not track:
                raise StateMachineError(
                    f"Track {track_id} not found",
                    track_id=track_id_str,
                )
            
            # Check if event already exists
            from ingestion.db.models import Event
            existing_event = session.query(Event).filter(
                Event.source == "liverc",
                Event.source_event_id == source_event_id,
            ).first()
            
            if existing_event:
                # Event exists, use normal ingestion flow
                logger.info(
                    "ingestion_by_source_id_event_exists",
                    event_id=str(existing_event.id),
                    source_event_id=source_event_id,
                )
                return await self.ingest_event(
                    event_id=existing_event.id,
                    depth=depth,
                )
            
            # Event doesn't exist - fetch full metadata from LiveRC and create it
            logger.info(
                "ingestion_by_source_id_fetching_metadata",
                source_event_id=source_event_id,
                track_slug=track.source_track_slug,
            )
            
            # Fetch event page to get full metadata
            try:
                event_data = await self.connector.fetch_event_page(
                    track_slug=track.source_track_slug,
                    source_event_id=source_event_id,
                )
                logger.info(
                    "ingestion_by_source_id_event_page_fetched",
                    source_event_id=source_event_id,
                )
            except Exception as e:
                logger.error(
                    "ingestion_by_source_id_fetch_event_page_error",
                    source_event_id=source_event_id,
                    track_slug=track.source_track_slug,
                    error=str(e),
                    error_type=type(e).__name__,
                    exc_info=True,
                )
                raise
            
            # Normalize event data
            try:
                normalized_event = Normalizer.normalize_event(event_data)
                logger.info(
                    "ingestion_by_source_id_event_normalized",
                    source_event_id=source_event_id,
                )
            except Exception as e:
                logger.error(
                    "ingestion_by_source_id_normalize_event_error",
                    source_event_id=source_event_id,
                    error=str(e),
                    error_type=type(e).__name__,
                    exc_info=True,
                )
                raise
            
            # Build event URL
            event_url = build_event_url(track.source_track_slug, source_event_id)
            
            # Upsert event (will create new one)
            event = repo.upsert_event(
                source="liverc",
                source_event_id=source_event_id,
                track_id=track_id,  # Pass UUID - repository converts to string
                event_name=normalized_event["event_name"],
                event_date=normalized_event["event_date"],
                event_entries=normalized_event["event_entries"],
                event_drivers=normalized_event["event_drivers"],
                event_url=event_url,
            )
            
            # Flush to ensure event.id is available without committing
            # This keeps everything in the same transaction to avoid race conditions
            session.flush()
            
            logger.info(
                "ingestion_by_source_id_event_created",
                event_id=str(event.id),
                source_event_id=source_event_id,
            )
            
            # Continue with ingestion in the same session to avoid race conditions
            # Reuse the same repo and session for consistency
            event_id = event.id
            
            # Acquire lock early
            if not repo.acquire_event_lock(event_id):
                raise IngestionInProgressError(str(event_id))
            
            try:
                # Fetch event page
                logger.info("connector_fetch_start", event_id=str(event_id), type="event_page")
                event_data = await self.connector.fetch_event_page(
                    track_slug=track.source_track_slug,
                    source_event_id=source_event_id,
                )
                logger.info("connector_fetch_end", event_id=str(event_id), type="event_page")
                
                # Sort races by race_order before validation
                event_data.races.sort(key=lambda r: (r.race_order is None, r.race_order or 0))
                
                # Validate event data
                Validator.validate_event(event_data, source_event_id)
                
                # Update event metadata
                event.event_name = normalized_event["event_name"]
                event.event_date = normalized_event["event_date"]
                event.event_entries = normalized_event["event_entries"]
                event.event_drivers = normalized_event["event_drivers"]
                
                # Process races in parallel batches (same logic as ingest_event)
                races_ingested, results_ingested, laps_ingested = await self._process_races_parallel(
                    race_summaries=event_data.races,
                    event_id=event_id,
                    repo=repo,
                    depth=depth,
                )
                
                # Update event ingest_depth and timestamp
                event.ingest_depth = IngestDepth(depth)
                event.last_ingested_at = datetime.utcnow()
                
                logger.info(
                    "ingestion_complete",
                    event_id=str(event_id),
                    races_ingested=races_ingested,
                    results_ingested=results_ingested,
                    laps_ingested=laps_ingested,
                )
                
                return {
                    "event_id": str(event_id),
                    "ingest_depth": depth,
                    "last_ingested_at": event.last_ingested_at.isoformat(),
                    "races_ingested": races_ingested,
                    "results_ingested": results_ingested,
                    "laps_ingested": laps_ingested,
                    "status": "updated",
                }
            
            finally:
                # Release lock - wrap in try-except to ensure we don't fail silently
                try:
                    repo.release_event_lock(event_id)
                except Exception as e:
                    logger.error(
                        "lock_release_failed",
                        event_id=str(event_id),
                        error=str(e),
                        exc_info=True,
                    )

