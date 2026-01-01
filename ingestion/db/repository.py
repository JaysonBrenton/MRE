# @fileoverview Database repository layer for ingestion
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Idempotent database operations for ingestion
# 
# @purpose Provides repository methods with idempotent upsert operations
#          per idempotency design specification.

import hashlib
from datetime import datetime
from typing import Optional, Dict, Any, Union, List
from uuid import UUID

from sqlalchemy import select, and_, func, text, tuple_
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
import psycopg2.errors

from ingestion.common.logging import get_logger
from ingestion.common import metrics
from ingestion.db.models import (
    Track,
    Event,
    EventEntry,
    Race,
    Driver,
    RaceDriver,
    RaceResult,
    Lap,
    IngestDepth,
    User,
    UserDriverLink,
    EventDriverLink,
    UserDriverLinkStatus,
    EventDriverLinkMatchType,
)
from ingestion.ingestion.errors import PersistenceError, ConstraintViolationError
from ingestion.ingestion.normalizer import Normalizer, MATCHER_ID, MATCHER_VERSION

logger = get_logger(__name__)


def _uuid_to_str(value: Union[UUID, str, None]) -> Optional[str]:
    """
    Safely convert UUID to string, handling None values.
    
    Args:
        value: UUID, string, or None
        
    Returns:
        String representation or None (for SQL NULL)
    """
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return str(value)


class Repository:
    """Repository for idempotent database operations."""
    
    def __init__(self, session: Session):
        """
        Initialize repository.
        
        Args:
            session: SQLAlchemy database session
        """
        self.session = session
    
    def upsert_track(
        self,
        source: str,
        source_track_slug: str,
        track_name: str,
        track_url: str,
        events_url: str,
        liverc_track_last_updated: Optional[str] = None,
        is_active: bool = True,
    ) -> Track:
        """
        Upsert track by natural key (source, source_track_slug).
        
        Args:
            source: Track source (e.g., "liverc")
            source_track_slug: Track slug
            track_name: Track name
            track_url: Track URL
            events_url: Events URL
            liverc_track_last_updated: Last updated string from LiveRC
            is_active: Whether track is active
        
        Returns:
            Track model instance
        """
        stmt = select(Track).where(
            and_(
                Track.source == source,
                Track.source_track_slug == source_track_slug,
            )
        )
        track = self.session.scalar(stmt)
        
        if track:
            # Update existing
            track.track_name = track_name
            track.track_url = track_url
            track.events_url = events_url
            track.liverc_track_last_updated = liverc_track_last_updated
            track.last_seen_at = datetime.utcnow()
            track.is_active = is_active
            logger.debug("track_updated", track_id=str(track.id), slug=source_track_slug)
            metrics.record_db_update("tracks")
        else:
            # Insert new
            now = datetime.utcnow()
            track = Track(
                source=source,
                source_track_slug=source_track_slug,
                track_name=track_name,
                track_url=track_url,
                events_url=events_url,
                liverc_track_last_updated=liverc_track_last_updated,
                last_seen_at=now,
                is_active=is_active,
            )
            # Set timestamps explicitly for new records
            track.created_at = now
            track.updated_at = now
            self.session.add(track)
            logger.debug("track_created", slug=source_track_slug)
            metrics.record_db_insert("tracks")

        return track
    
    def upsert_event(
        self,
        source: str,
        source_event_id: str,
        track_id: UUID,
        event_name: str,
        event_date: datetime,
        event_entries: int,
        event_drivers: int,
        event_url: str,
    ) -> Event:
        """
        Upsert event by natural key (source, source_event_id).
        
        Args:
            source: Event source (e.g., "liverc")
            source_event_id: Event ID from LiveRC
            track_id: Track ID
            event_name: Event name
            event_date: Event date
            event_entries: Number of entries
            event_drivers: Number of drivers
            event_url: Event URL
        
        Returns:
            Event model instance
        """
        stmt = select(Event).where(
            and_(
                Event.source == source,
                Event.source_event_id == source_event_id,
            )
        )
        event = self.session.scalar(stmt)
        
        if event:
            # Update existing (but preserve ingest_depth)
            # Convert UUID to string since the database column is String
            event.track_id = _uuid_to_str(track_id)
            event.event_name = event_name
            event.event_date = event_date
            event.event_entries = event_entries
            event.event_drivers = event_drivers
            event.event_url = event_url
            logger.debug("event_updated", event_id=str(event.id), source_event_id=source_event_id)
            metrics.record_db_update("events")
        else:
            # Insert new
            now = datetime.utcnow()
            event = Event(
                source=source,
                source_event_id=source_event_id,
                track_id=_uuid_to_str(track_id),  # Convert UUID to string since the database column is String
                event_name=event_name,
                event_date=event_date,
                event_entries=event_entries,
                event_drivers=event_drivers,
                event_url=event_url,
                ingest_depth=IngestDepth.NONE,
            )
            # Set timestamps explicitly for new records
            event.created_at = now
            event.updated_at = now
            self.session.add(event)
            logger.debug("event_created", source_event_id=source_event_id)
            metrics.record_db_insert("events")

        return event
    
    def upsert_race(
        self,
        event_id: UUID,
        source: str,
        source_race_id: str,
        class_name: str,
        race_label: str,
        race_order: Optional[int],
        race_url: str,
        start_time: Optional[datetime] = None,
        duration_seconds: Optional[int] = None,
    ) -> Race:
        """
        Upsert race by natural key (event_id, source_race_id).
        
        Args:
            event_id: Event ID
            source: Race source (e.g., "liverc")
            source_race_id: Race ID from LiveRC
            class_name: Class name
            race_label: Race label
            race_order: Race order
            race_url: Race URL
            start_time: Start time
            duration_seconds: Duration in seconds
        
        Returns:
            Race model instance
        """
        stmt = select(Race).where(
            and_(
                Race.event_id == _uuid_to_str(event_id),  # Convert UUID to string since the database column is String
                Race.source_race_id == source_race_id,
            )
        )
        race = self.session.scalar(stmt)
        
        if race:
            # Update existing
            race.class_name = class_name
            race.race_label = race_label
            race.race_order = race_order
            race.race_url = race_url
            race.start_time = start_time
            race.duration_seconds = duration_seconds
            logger.debug("race_updated", race_id=str(race.id), source_race_id=source_race_id)
            metrics.record_db_update("races")
        else:
            # Insert new
            now = datetime.utcnow()
            race = Race(
                event_id=_uuid_to_str(event_id),  # Convert UUID to string since the database column is String
                source=source,
                source_race_id=source_race_id,
                class_name=class_name,
                race_label=race_label,
                race_order=race_order,
                race_url=race_url,
                start_time=start_time,
                duration_seconds=duration_seconds,
            )
            # Set timestamps explicitly for new records
            race.created_at = now
            race.updated_at = now
            self.session.add(race)
            # Flush to ensure race.id is populated before it's used
            self.session.flush()
            logger.debug("race_created", source_race_id=source_race_id)
            metrics.record_db_insert("races")

        return race
    
    def upsert_driver(
        self,
        source: str,
        source_driver_id: str,
        display_name: str,
        transponder_number: Optional[str] = None,
    ) -> Driver:
        """
        Upsert normalized driver by natural key (source, source_driver_id).
        
        Args:
            source: Driver source (e.g., "liverc")
            source_driver_id: Driver ID from LiveRC
            display_name: Driver display name
            transponder_number: Optional transponder number (set if not already set, or if new value provided)
        
        Returns:
            Driver model instance
        """
        # Compute normalized name for fuzzy matching
        normalized_name = Normalizer.normalize_driver_name(display_name)
        
        # Check if driver exists - use WITH (NOWAIT) to avoid blocking
        stmt = select(Driver).where(
            and_(
                Driver.source == source,
                Driver.source_driver_id == source_driver_id,
            )
        )
        driver = self.session.scalar(stmt)
        
        if driver:
            # Update existing (update display_name and normalized_name if it changed)
            # Update transponder_number if provided and not already set, or if new value provided
            if transponder_number is not None:
                if driver.transponder_number is None or driver.transponder_number != transponder_number:
                    driver.transponder_number = transponder_number
                    logger.debug("driver_transponder_updated", driver_id=str(driver.id), transponder=transponder_number)
            if driver.display_name != display_name:
                driver.display_name = display_name
                driver.normalized_name = normalized_name
                driver.updated_at = datetime.utcnow()
                logger.debug("driver_updated", driver_id=str(driver.id), source_driver_id=source_driver_id, display_name=display_name)
                metrics.record_db_update("drivers")
            elif driver.normalized_name != normalized_name or driver.normalized_name is None:
                # Update normalized_name even if display_name hasn't changed (normalization logic may have changed)
                # Also update if normalized_name is None (backfill for existing drivers)
                driver.normalized_name = normalized_name
                driver.updated_at = datetime.utcnow()
                if driver.normalized_name is None:
                    logger.debug("driver_normalized_name_backfilled", driver_id=str(driver.id), normalized_name=normalized_name)
                metrics.record_db_update("drivers")
        else:
            # Insert new - handle race condition by catching IntegrityError
            # Use a savepoint to allow partial rollback without affecting the entire transaction
            from sqlalchemy import event
            savepoint = None
            try:
                # Create a savepoint before attempting insert
                savepoint = self.session.begin_nested()
                
                now = datetime.utcnow()
                driver = Driver(
                    source=source,
                    source_driver_id=source_driver_id,
                    display_name=display_name,
                    normalized_name=normalized_name,
                    transponder_number=transponder_number,
                )
                # Set timestamps explicitly for new records
                driver.created_at = now
                driver.updated_at = now
                self.session.add(driver)
                
                # Flush to ensure driver.id is populated before it's used
                self.session.flush()
                savepoint.commit()  # Commit the savepoint
                logger.debug("driver_created", source_driver_id=source_driver_id, display_name=display_name)
                metrics.record_db_insert("drivers")
            except IntegrityError as e:
                # Race condition: another part of the transaction inserted the same driver
                # Check if this is actually a unique violation for drivers
                error_str = str(e)
                is_driver_unique_violation = (
                    'drivers_source_source_driver_id_key' in error_str or 
                    ('duplicate key value violates unique constraint' in error_str and 'drivers' in error_str.lower())
                )
                
                if not is_driver_unique_violation:
                    # Not the error we're handling, rollback savepoint and re-raise
                    if savepoint:
                        savepoint.rollback()
                    raise
                
                # Rollback only the savepoint (not the entire transaction)
                if savepoint:
                    savepoint.rollback()
                
                logger.debug(
                    "driver_insert_race_condition",
                    source_driver_id=source_driver_id,
                    display_name=display_name,
                )
                
                # Query for the driver that was inserted by another part of the transaction
                # Since we're in the same transaction, we should be able to see it
                self.session.expire_all()
                driver = self.session.scalar(stmt)
                
                # If driver still not found, it means it was inserted in a different transaction
                # This shouldn't happen with sequential processing, but handle it gracefully
                if not driver:
                    logger.warning(
                        "driver_not_found_after_race_condition",
                        source_driver_id=source_driver_id,
                        display_name=display_name,
                        message="Driver not found after IntegrityError - may need retry"
                    )
                    # Raise retryable exception
                    error_msg = f"Driver {source_driver_id} race condition - driver not visible after savepoint rollback. Operation should be retried."
                    raise ConstraintViolationError(error_msg, constraint="drivers_source_source_driver_id_key")
                
                # Driver found - update with any new information
                if transponder_number is not None and (driver.transponder_number is None or driver.transponder_number != transponder_number):
                    driver.transponder_number = transponder_number
                    driver.updated_at = datetime.utcnow()
                    logger.debug("driver_transponder_updated", driver_id=str(driver.id), transponder=transponder_number)
                if driver.normalized_name != normalized_name or driver.normalized_name is None:
                    driver.normalized_name = normalized_name
                    driver.updated_at = datetime.utcnow()
                    metrics.record_db_update("drivers")

        return driver
    
    def upsert_race_driver(
        self,
        race_id: UUID,
        source: str,
        source_driver_id: str,
        display_name: str,
        transponder_number: Optional[str] = None,
    ) -> RaceDriver:
        """
        Upsert race driver by natural key (race_id, source_driver_id).
        
        First ensures the normalized Driver exists, then creates/updates the RaceDriver.
        
        Args:
            race_id: Race ID
            source: Driver source (e.g., "liverc")
            source_driver_id: Driver ID from LiveRC
            display_name: Driver display name
            transponder_number: Optional transponder number (race-specific override)
        
        Returns:
            RaceDriver model instance
        """
        # First, ensure the normalized Driver exists
        driver = self.upsert_driver(source, source_driver_id, display_name)
        
        # Now upsert the RaceDriver
        stmt = select(RaceDriver).where(
            and_(
                RaceDriver.race_id == _uuid_to_str(race_id),  # Convert UUID to string since the database column is String
                RaceDriver.source_driver_id == source_driver_id,
            )
        )
        race_driver = self.session.scalar(stmt)
        
        if race_driver:
            # Update existing (denormalized fields)
            race_driver.display_name = display_name
            # Update transponder_number if provided (race-specific override always takes precedence)
            if transponder_number is not None:
                race_driver.transponder_number = transponder_number
                logger.debug("race_driver_transponder_updated", race_driver_id=str(race_driver.id), transponder=transponder_number)
            race_driver.updated_at = datetime.utcnow()
            logger.debug("race_driver_updated", race_driver_id=str(race_driver.id), source_driver_id=source_driver_id)
            metrics.record_db_update("race_drivers")
        else:
            # Insert new
            now = datetime.utcnow()
            race_driver = RaceDriver(
                race_id=_uuid_to_str(race_id),  # Convert UUID to string since the database column is String
                driver_id=_uuid_to_str(driver.id),  # Link to normalized Driver
                source=source,  # Denormalized for query performance
                source_driver_id=source_driver_id,  # Denormalized for query performance
                display_name=display_name,  # Denormalized for query performance
                transponder_number=transponder_number,
            )
            # Set timestamps explicitly for new records
            race_driver.created_at = now
            race_driver.updated_at = now
            self.session.add(race_driver)
            # Flush to ensure race_driver.id is populated before it's used
            self.session.flush()
            logger.debug("race_driver_created", source_driver_id=source_driver_id, driver_id=str(driver.id))
            metrics.record_db_insert("race_drivers")

        return race_driver
    
    def upsert_event_entry(
        self,
        event_id: UUID,
        driver_id: UUID,
        class_name: str,
        transponder_number: Optional[str] = None,
        car_number: Optional[str] = None,
    ) -> EventEntry:
        """
        Upsert event entry by natural key (event_id, driver_id, class_name).
        
        Args:
            event_id: Event ID
            driver_id: Driver ID
            class_name: Racing class name
            transponder_number: Optional transponder number
            car_number: Optional car number
        
        Returns:
            EventEntry model instance
        """
        stmt = select(EventEntry).where(
            and_(
                EventEntry.event_id == _uuid_to_str(event_id),
                EventEntry.driver_id == _uuid_to_str(driver_id),
                EventEntry.class_name == class_name,
            )
        )
        event_entry = self.session.scalar(stmt)
        
        if event_entry:
            # Update existing
            if transponder_number is not None:
                event_entry.transponder_number = transponder_number
            if car_number is not None:
                event_entry.car_number = car_number
            event_entry.updated_at = datetime.utcnow()
            logger.debug("event_entry_updated", event_entry_id=str(event_entry.id), event_id=str(event_id), driver_id=str(driver_id), class_name=class_name)
            metrics.record_db_update("event_entries")
        else:
            # Insert new
            now = datetime.utcnow()
            event_entry = EventEntry(
                event_id=_uuid_to_str(event_id),
                driver_id=_uuid_to_str(driver_id),
                class_name=class_name,
                transponder_number=transponder_number,
                car_number=car_number,
            )
            event_entry.created_at = now
            event_entry.updated_at = now
            self.session.add(event_entry)
            self.session.flush()
            logger.debug("event_entry_created", event_id=str(event_id), driver_id=str(driver_id), class_name=class_name)
            metrics.record_db_insert("event_entries")
        
        return event_entry
    
    def get_event_entries_by_event(
        self,
        event_id: UUID,
    ) -> List[EventEntry]:
        """
        Get all event entries for an event (all classes).
        
        Args:
            event_id: Event ID
        
        Returns:
            List of EventEntry instances with driver relationship loaded
        """
        from sqlalchemy.orm import joinedload
        stmt = select(EventEntry).options(
            joinedload(EventEntry.driver)
        ).where(
            EventEntry.event_id == _uuid_to_str(event_id)
        )
        return list(self.session.scalars(stmt).unique().all())
    
    def get_event_entries_by_class(
        self,
        event_id: UUID,
        class_name: str,
    ) -> List[EventEntry]:
        """
        Get all event entries for a specific class in an event.
        
        Args:
            event_id: Event ID
            class_name: Racing class name
        
        Returns:
            List of EventEntry instances with driver relationship loaded
        """
        from sqlalchemy.orm import joinedload
        stmt = select(EventEntry).options(
            joinedload(EventEntry.driver)
        ).where(
            and_(
                EventEntry.event_id == _uuid_to_str(event_id),
                EventEntry.class_name == class_name,
            )
        )
        return list(self.session.scalars(stmt).unique().all())
    
    def get_event_entries_by_driver(
        self,
        event_id: UUID,
        driver_id: UUID,
    ) -> List[EventEntry]:
        """
        Get all event entries for a specific driver in an event.
        
        Args:
            event_id: Event ID
            driver_id: Driver ID
        
        Returns:
            List of EventEntry instances
        """
        stmt = select(EventEntry).where(
            and_(
                EventEntry.event_id == _uuid_to_str(event_id),
                EventEntry.driver_id == _uuid_to_str(driver_id),
            )
        )
        return list(self.session.scalars(stmt).all())
    
    def upsert_race_result(
        self,
        race_id: UUID,
        race_driver_id: UUID,
        position_final: int,
        laps_completed: int,
        total_time_raw: Optional[str],
        total_time_seconds: Optional[float],
        fast_lap_time: Optional[float],
        avg_lap_time: Optional[float],
        consistency: Optional[float],
        raw_fields_json: Optional[Dict[str, Any]] = None,
    ) -> RaceResult:
        """
        Upsert race result by natural key (race_id, race_driver_id).
        
        Args:
            race_id: Race ID
            race_driver_id: Race driver ID
            position_final: Final position
            laps_completed: Laps completed
            total_time_raw: Raw total time string
            total_time_seconds: Total time in seconds
            fast_lap_time: Fastest lap time
            avg_lap_time: Average lap time
            consistency: Consistency percentage
            raw_fields_json: Additional raw fields
        
        Returns:
            RaceResult model instance
        """
        stmt = select(RaceResult).where(
            and_(
                RaceResult.race_id == _uuid_to_str(race_id),  # Convert UUID to string since the database column is String
                RaceResult.race_driver_id == _uuid_to_str(race_driver_id),  # Convert UUID to string since the database column is String
            )
        )
        result = self.session.scalar(stmt)
        
        if result:
            # Update existing
            result.position_final = position_final
            result.laps_completed = laps_completed
            result.total_time_raw = total_time_raw
            result.total_time_seconds = total_time_seconds
            result.fast_lap_time = fast_lap_time
            result.avg_lap_time = avg_lap_time
            result.consistency = consistency
            result.raw_fields_json = raw_fields_json
            logger.debug("result_updated", result_id=str(result.id))
            metrics.record_db_update("race_results")
        else:
            # Insert new
            now = datetime.utcnow()
            result = RaceResult(
                race_id=_uuid_to_str(race_id),  # Convert UUID to string since the database column is String
                race_driver_id=_uuid_to_str(race_driver_id),  # Convert UUID to string since the database column is String
                position_final=position_final,
                laps_completed=laps_completed,
                total_time_raw=total_time_raw,
                total_time_seconds=total_time_seconds,
                fast_lap_time=fast_lap_time,
                avg_lap_time=avg_lap_time,
                consistency=consistency,
                raw_fields_json=raw_fields_json,
            )
            # Set timestamps explicitly for new records
            result.created_at = now
            result.updated_at = now
            self.session.add(result)
            # Flush to ensure result.id is populated before it's used
            self.session.flush()
            logger.debug("result_created", race_id=str(race_id), driver_id=str(race_driver_id))
            metrics.record_db_insert("race_results")

        return result
    
    def upsert_lap(
        self,
        race_result_id: UUID,
        lap_number: int,
        position_on_lap: int,
        lap_time_raw: str,
        lap_time_seconds: float,
        pace_string: Optional[str],
        elapsed_race_time: float,
        segments_json: Optional[Dict[str, Any]] = None,
    ) -> Lap:
        """
        Upsert lap by natural key (race_result_id, lap_number).
        
        Args:
            race_result_id: Race result ID
            lap_number: Lap number
            position_on_lap: Position on lap
            lap_time_raw: Raw lap time string
            lap_time_seconds: Lap time in seconds
            pace_string: Pace string
            elapsed_race_time: Elapsed race time
            segments_json: Segments JSON
        
        Returns:
            Lap model instance
        """
        stmt = select(Lap).where(
            and_(
                Lap.race_result_id == _uuid_to_str(race_result_id),  # Convert UUID to string since the database column is String
                Lap.lap_number == lap_number,
            )
        )
        lap = self.session.scalar(stmt)
        
        if lap:
            # Update existing
            lap.position_on_lap = position_on_lap
            lap.lap_time_raw = lap_time_raw
            lap.lap_time_seconds = lap_time_seconds
            lap.pace_string = pace_string
            lap.elapsed_race_time = elapsed_race_time
            lap.segments_json = segments_json
            logger.debug("lap_updated", lap_id=str(lap.id), lap_number=lap_number)
            metrics.record_db_update("laps")
        else:
            # Insert new
            now = datetime.utcnow()
            lap = Lap(
                race_result_id=_uuid_to_str(race_result_id),  # Convert UUID to string since the database column is String
                lap_number=lap_number,
                position_on_lap=position_on_lap,
                lap_time_raw=lap_time_raw,
                lap_time_seconds=lap_time_seconds,
                pace_string=pace_string,
                elapsed_race_time=elapsed_race_time,
                segments_json=segments_json,
            )
            # Set timestamps explicitly for new records
            lap.created_at = now
            lap.updated_at = now
            self.session.add(lap)
            logger.debug("lap_created", race_result_id=str(race_result_id), lap_number=lap_number)
            metrics.record_db_insert("laps")

        return lap
    
    def bulk_upsert_laps(
        self,
        laps: List[Dict[str, Any]],
        batch_size: int = 5000,
    ) -> int:
        """
        Bulk upsert laps using PostgreSQL ON CONFLICT.
        
        Uses PostgreSQL dialect insert with on_conflict_do_update for
        proper upsert semantics. Chunks input into batches to avoid
        parameter limit issues. The entire operation is performed within
        the current transaction context.
        
        Performance optimization: Removed unnecessary SELECT query before insert.
        PostgreSQL's ON CONFLICT clause automatically handles conflict detection.
        
        Conflict resolution:
        - Natural key: (race_result_id, lap_number)
        - On conflict: preserve created_at, update updated_at to NOW(),
          overwrite all other mutable lap fields
        
        Args:
            laps: List of normalized lap dictionaries with all required fields:
                  - race_result_id: str (UUID string)
                  - lap_number: int
                  - position_on_lap: int
                  - lap_time_raw: str
                  - lap_time_seconds: float
                  - pace_string: Optional[str]
                  - elapsed_race_time: float
                  - segments_json: Optional[Dict[str, Any]]
            batch_size: Number of rows per batch (default 5000, increased from 1000)
        
        Returns:
            Number of laps processed
        
        Raises:
            PersistenceError: If bulk operation fails
        """
        if not laps:
            return 0
        
        now = datetime.utcnow()

        try:
            # Process laps in batches - all within the same transaction
            # If any batch fails, the entire transaction will rollback
            # Removed unnecessary SELECT query - PostgreSQL ON CONFLICT handles conflict detection
            for i in range(0, len(laps), batch_size):
                batch = laps[i:i + batch_size]
                
                # Prepare batch data with all required fields
                batch_data = []
                for lap in batch:
                    lap_dict = {
                        "race_result_id": lap["race_result_id"],
                        "lap_number": lap["lap_number"],
                        "position_on_lap": lap["position_on_lap"],
                        "lap_time_raw": lap["lap_time_raw"],
                        "lap_time_seconds": lap["lap_time_seconds"],
                        "pace_string": lap.get("pace_string"),
                        "elapsed_race_time": lap["elapsed_race_time"],
                        "segments_json": lap.get("segments_json"),
                        "created_at": now,  # For new inserts
                        "updated_at": now,  # For new inserts
                    }
                    batch_data.append(lap_dict)
                
                # Use PostgreSQL dialect insert with ON CONFLICT
                # No SELECT needed - PostgreSQL automatically detects conflicts
                stmt = pg_insert(Lap).values(batch_data)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["race_result_id", "lap_number"],
                    set_={
                        "position_on_lap": stmt.excluded.position_on_lap,
                        "lap_time_raw": stmt.excluded.lap_time_raw,
                        "lap_time_seconds": stmt.excluded.lap_time_seconds,
                        "pace_string": stmt.excluded.pace_string,
                        "elapsed_race_time": stmt.excluded.elapsed_race_time,
                        "segments_json": stmt.excluded.segments_json,
                        "updated_at": now,
                        # created_at is NOT in SET clause - preserve existing value on conflict
                    },
                )
                
                self.session.execute(stmt)
                logger.debug(
                    "bulk_upsert_laps_batch",
                    batch_size=len(batch),
                    batch_number=(i // batch_size) + 1,
                    total_batches=(len(laps) + batch_size - 1) // batch_size,
                )
            
            # Record metrics as total upserts (inserts + updates combined)
            # Note: We no longer distinguish inserts from updates to avoid the SELECT query overhead
            # If insert/update distinction is needed for observability, consider using
            # PostgreSQL RETURNING clause with xmax or a separate lightweight query
            total_upserted = len(laps)
            logger.info("bulk_upsert_laps_complete", total_laps=total_upserted)
            metrics.record_db_insert("laps", total_upserted)
            # Record as update as well for backward compatibility with metrics
            metrics.record_db_update("laps", 0)  # Set to 0 since we're tracking combined upserts
            return total_upserted
        
        except Exception as e:
            logger.error(
                "bulk_upsert_laps_failed",
                total_laps=len(laps),
                error=str(e),
                exc_info=True,
            )
            raise PersistenceError(
                f"Bulk upsert laps failed: {str(e)}",
                operation="bulk_upsert_laps",
            ) from e
    
    def get_event_by_id(self, event_id: UUID) -> Optional[Event]:
        """
        Get event by ID.
        
        Args:
            event_id: Event ID
        
        Returns:
            Event model instance or None
        """
        # Convert UUID to string since the database column is String, not UUID
        return self.session.get(Event, _uuid_to_str(event_id))
    
    def upsert_lap(
        self,
        race_result_id: UUID,
        lap_number: int,
        position_on_lap: int,
        lap_time_raw: str,
        lap_time_seconds: float,
        pace_string: Optional[str],
        elapsed_race_time: float,
        segments_json: Optional[Dict[str, Any]] = None,
    ) -> Lap:
        """
        Upsert lap by natural key (race_result_id, lap_number).
        
        .. deprecated:: V1
           This method is deprecated in favor of bulk_upsert_laps() for better performance.
           Use bulk_upsert_laps() when processing multiple laps. This method is kept
           for backwards compatibility and single-lap edge cases.
        
        Args:
            race_result_id: Race result ID
            lap_number: Lap number
            position_on_lap: Position on lap
            lap_time_raw: Raw lap time string
            lap_time_seconds: Lap time in seconds
            pace_string: Pace string
            elapsed_race_time: Elapsed race time
            segments_json: Segments JSON
        
        Returns:
            Lap model instance
        """
        stmt = select(Lap).where(
            and_(
                Lap.race_result_id == _uuid_to_str(race_result_id),
                Lap.lap_number == lap_number,
            )
        )
        lap = self.session.scalar(stmt)
        
        if lap:
            # Update existing
            lap.position_on_lap = position_on_lap
            lap.lap_time_raw = lap_time_raw
            lap.lap_time_seconds = lap_time_seconds
            lap.pace_string = pace_string
            lap.elapsed_race_time = elapsed_race_time
            lap.segments_json = segments_json
            logger.debug("lap_updated", lap_id=str(lap.id), lap_number=lap_number)
            metrics.record_db_update("laps")
        else:
            # Insert new
            now = datetime.utcnow()
            lap = Lap(
                race_result_id=_uuid_to_str(race_result_id),
                lap_number=lap_number,
                position_on_lap=position_on_lap,
                lap_time_raw=lap_time_raw,
                lap_time_seconds=lap_time_seconds,
                pace_string=pace_string,
                elapsed_race_time=elapsed_race_time,
                segments_json=segments_json,
            )
            # Set timestamps explicitly for new records
            lap.created_at = now
            lap.updated_at = now
            self.session.add(lap)
            logger.debug("lap_created", race_result_id=str(race_result_id), lap_number=lap_number)
            metrics.record_db_insert("laps")

        return lap
    
    def _compute_lock_id(self, key: str) -> int:
        """Compute a deterministic advisory lock ID from a string key."""
        hash_bytes = hashlib.sha256(key.encode('utf-8')).digest()
        return int.from_bytes(hash_bytes[:8], byteorder='big') % (2**31)

    def acquire_event_lock(self, event_id: UUID) -> bool:
        """Acquire advisory lock scoped to a specific event."""
        lock_id = self._compute_lock_id(f"event:{event_id}")
        result = self.session.execute(
            text("SELECT pg_try_advisory_lock(:lock_id)").bindparams(lock_id=lock_id)
        ).scalar()
        return bool(result)

    def release_event_lock(self, event_id: UUID) -> None:
        """Release the event-scoped advisory lock."""
        lock_id = self._compute_lock_id(f"event:{event_id}")
        self.session.execute(
            text("SELECT pg_advisory_unlock(:lock_id)").bindparams(lock_id=lock_id)
        )

    def acquire_source_event_lock(self, source_event_id: str) -> bool:
        """Acquire advisory lock scoped to a source_event_id (pre-event creation)."""
        lock_id = self._compute_lock_id(f"source_event:{source_event_id}")
        result = self.session.execute(
            text("SELECT pg_try_advisory_lock(:lock_id)").bindparams(lock_id=lock_id)
        ).scalar()
        return bool(result)

    def release_source_event_lock(self, source_event_id: str) -> None:
        """Release the advisory lock for a source_event_id."""
        lock_id = self._compute_lock_id(f"source_event:{source_event_id}")
        self.session.execute(
            text("SELECT pg_advisory_unlock(:lock_id)").bindparams(lock_id=lock_id)
        )
    
    def get_all_users(self) -> List[User]:
        """
        Get all users (for user-driver matching).
        
        Returns:
            List of User model instances
        """
        stmt = select(User)
        return list(self.session.scalars(stmt).all())
    
    def get_existing_user_driver_links(self) -> Dict[str, UserDriverLink]:
        """
        Get all existing UserDriverLink records, indexed by driver_id.
        
        Returns:
            Dict mapping driver_id to UserDriverLink
        """
        stmt = select(UserDriverLink)
        links = self.session.scalars(stmt).all()
        return {link.driver_id: link for link in links}

    def get_event_by_source_event_id(self, source: str, source_event_id: str) -> Optional[Event]:
        """Fetch an event by its source + source_event_id natural key."""
        stmt = select(Event).where(
            and_(
                Event.source == source,
                Event.source_event_id == source_event_id,
            )
        )
        return self.session.scalar(stmt)
    
    def upsert_user_driver_link(
        self,
        user_id: str,
        driver_id: str,
        status: UserDriverLinkStatus,
        similarity_score: float,
        match_type: str,
        matched_at: datetime,
        confirmed_at: Optional[datetime] = None,
        rejected_at: Optional[datetime] = None,
        conflict_reason: Optional[str] = None,
    ) -> UserDriverLink:
        """
        Upsert UserDriverLink record.
        
        Args:
            user_id: User ID
            driver_id: Driver ID
            status: Link status
            similarity_score: Similarity score (0.0-1.0)
            match_type: Match type ('transponder', 'exact', 'fuzzy')
            matched_at: When match was found
            confirmed_at: When confirmed (nullable)
            rejected_at: When rejected (nullable)
            conflict_reason: Reason for conflict/rejection (nullable)
            
        Returns:
            UserDriverLink model instance
        """
        stmt = select(UserDriverLink).where(
            and_(
                UserDriverLink.user_id == user_id,
                UserDriverLink.driver_id == driver_id,
            )
        )
        link = self.session.scalar(stmt)
        
        if link:
            # Update existing
            link.status = status
            link.similarity_score = similarity_score
            if confirmed_at:
                link.confirmed_at = confirmed_at
            if rejected_at:
                link.rejected_at = rejected_at
            if conflict_reason:
                link.conflict_reason = conflict_reason
            link.updated_at = datetime.utcnow()
            logger.debug("user_driver_link_updated", user_id=user_id, driver_id=driver_id, status=status.value)
            metrics.record_db_update("user_driver_links")
        else:
            # Insert new
            now = datetime.utcnow()
            link = UserDriverLink(
                user_id=user_id,
                driver_id=driver_id,
                status=status,
                similarity_score=similarity_score,
                matched_at=matched_at,
                confirmed_at=confirmed_at,
                rejected_at=rejected_at,
                matcher_id=MATCHER_ID,
                matcher_version=MATCHER_VERSION,
                conflict_reason=conflict_reason,
            )
            link.created_at = now
            link.updated_at = now
            self.session.add(link)
            self.session.flush()
            logger.debug("user_driver_link_created", user_id=user_id, driver_id=driver_id, status=status.value)
            metrics.record_db_insert("user_driver_links")
        
        return link
    
    def upsert_event_driver_link(
        self,
        user_id: str,
        event_id: str,
        driver_id: str,
        match_type: EventDriverLinkMatchType,
        similarity_score: float,
        transponder_number: Optional[str],
        matched_at: datetime,
        user_driver_link_id: Optional[str] = None,
    ) -> EventDriverLink:
        """
        Upsert EventDriverLink record.
        
        Args:
            user_id: User ID
            event_id: Event ID
            driver_id: Driver ID
            match_type: Match type
            similarity_score: Similarity score (0.0-1.0)
            transponder_number: Transponder number used for match (nullable)
            matched_at: When match was found
            user_driver_link_id: Associated UserDriverLink ID (nullable)
            
        Returns:
            EventDriverLink model instance
        """
        stmt = select(EventDriverLink).where(
            and_(
                EventDriverLink.user_id == user_id,
                EventDriverLink.event_id == event_id,
                EventDriverLink.driver_id == driver_id,
            )
        )
        link = self.session.scalar(stmt)
        
        if link:
            # Update existing
            link.match_type = match_type
            link.similarity_score = similarity_score
            link.transponder_number = transponder_number
            if user_driver_link_id:
                link.user_driver_link_id = user_driver_link_id
            link.updated_at = datetime.utcnow()
            logger.debug("event_driver_link_updated", user_id=user_id, event_id=event_id, driver_id=driver_id)
            metrics.record_db_update("event_driver_links")
        else:
            # Insert new
            now = datetime.utcnow()
            link = EventDriverLink(
                user_id=user_id,
                event_id=event_id,
                driver_id=driver_id,
                match_type=match_type,
                similarity_score=similarity_score,
                transponder_number=transponder_number,
                matched_at=matched_at,
                user_driver_link_id=user_driver_link_id,
            )
            link.created_at = now
            link.updated_at = now
            self.session.add(link)
            self.session.flush()
            logger.debug("event_driver_link_created", user_id=user_id, event_id=event_id, driver_id=driver_id)
            metrics.record_db_insert("event_driver_links")
        
        return link
