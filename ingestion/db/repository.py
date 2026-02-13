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
from typing import Optional, Dict, Any, Union, List, Tuple
from uuid import UUID

from sqlalchemy import select, and_, func, text, tuple_, delete
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
    EventRaceClass,
    Race,
    Driver,
    RaceDriver,
    RaceResult,
    Lap,
    LapAnnotation,
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
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        address: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        country: Optional[str] = None,
        postal_code: Optional[str] = None,
        phone: Optional[str] = None,
        website: Optional[str] = None,
        email: Optional[str] = None,
        description: Optional[str] = None,
        logo_url: Optional[str] = None,
        facebook_url: Optional[str] = None,
        total_laps: Optional[int] = None,
        total_races: Optional[int] = None,
        total_events: Optional[int] = None,
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
            latitude: Track latitude coordinate
            longitude: Track longitude coordinate
            address: Full address string
            city: City name
            state: State/province name
            country: Country name
            postal_code: Postal/ZIP code
            phone: Phone number
            website: Website URL
            email: Email address
            description: Track description/amenities
            logo_url: Track logo image URL
            facebook_url: Facebook page URL
            total_laps: Total lifetime laps
            total_races: Total lifetime races
            total_events: Total lifetime events
        
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
            
            # Update metadata fields only if provided (preserve existing data if None)
            if latitude is not None:
                track.latitude = latitude
            if longitude is not None:
                track.longitude = longitude
            if address is not None:
                track.address = address
            if city is not None:
                track.city = city
            if state is not None:
                track.state = state
            if country is not None:
                track.country = country
            if postal_code is not None:
                track.postal_code = postal_code
            if phone is not None:
                track.phone = phone
            if website is not None:
                track.website = website
            if email is not None:
                track.email = email
            if description is not None:
                track.description = description
            if logo_url is not None:
                track.logo_url = logo_url
            if facebook_url is not None:
                track.facebook_url = facebook_url
            if total_laps is not None:
                track.total_laps = total_laps
            if total_races is not None:
                track.total_races = total_races
            if total_events is not None:
                track.total_events = total_events
            
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
                latitude=latitude,
                longitude=longitude,
                address=address,
                city=city,
                state=state,
                country=country,
                postal_code=postal_code,
                phone=phone,
                website=website,
                email=email,
                description=description,
                logo_url=logo_url,
                facebook_url=facebook_url,
                total_laps=total_laps or 0,
                total_races=total_races or 0,
                total_events=total_events or 0,
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
        
        # Fallback to Driver.display_name if display_name is empty or whitespace
        # This ensures RaceDriver always has a valid display name
        effective_display_name = display_name.strip() if display_name else ""
        if not effective_display_name:
            effective_display_name = driver.display_name.strip() if driver.display_name else "Unknown Driver"
        
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
            race_driver.display_name = effective_display_name
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
                display_name=effective_display_name,  # Denormalized for query performance (with fallback)
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
    
    def upsert_event_race_class(
        self,
        event_id: UUID,
        class_name: str,
        vehicle_type: Optional[str] = None,
        vehicle_type_needs_review: bool = True,
    ) -> EventRaceClass:
        """
        Upsert event race class by natural key (event_id, class_name).
        
        Args:
            event_id: Event ID
            class_name: Race class name
            vehicle_type: Inferred vehicle type (optional)
            vehicle_type_needs_review: Whether vehicle type needs review (default: True)
        
        Returns:
            EventRaceClass model instance
        """
        stmt = select(EventRaceClass).where(
            and_(
                EventRaceClass.event_id == _uuid_to_str(event_id),
                EventRaceClass.class_name == class_name,
            )
        )
        event_race_class = self.session.scalar(stmt)
        
        if event_race_class:
            # Update existing
            if vehicle_type is not None:
                event_race_class.vehicle_type = vehicle_type
            event_race_class.vehicle_type_needs_review = vehicle_type_needs_review
            event_race_class.updated_at = datetime.utcnow()
            logger.debug("event_race_class_updated", event_race_class_id=str(event_race_class.id), event_id=str(event_id), class_name=class_name)
            metrics.record_db_update("event_race_classes")
        else:
            # Insert new
            now = datetime.utcnow()
            event_race_class = EventRaceClass(
                event_id=_uuid_to_str(event_id),
                class_name=class_name,
                vehicle_type=vehicle_type,
                vehicle_type_needs_review=vehicle_type_needs_review,
            )
            event_race_class.created_at = now
            event_race_class.updated_at = now
            self.session.add(event_race_class)
            self.session.flush()
            logger.debug("event_race_class_created", event_id=str(event_id), class_name=class_name, vehicle_type=vehicle_type)
            metrics.record_db_insert("event_race_classes")
        
        return event_race_class
    
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
        qualifying_position: Optional[int] = None,
        seconds_behind: Optional[float] = None,
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
            result.qualifying_position = qualifying_position
            result.seconds_behind = seconds_behind
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
                qualifying_position=qualifying_position,
                seconds_behind=seconds_behind,
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
    
    def bulk_upsert_races(
        self,
        races_data: List[Dict[str, Any]],
    ) -> Dict[str, Race]:
        """
        Bulk upsert races using PostgreSQL ON CONFLICT.
        
        Returns a mapping of source_race_id -> Race instance for use in subsequent operations.
        
        Args:
            races_data: List of race dictionaries with fields:
                - event_id: UUID
                - source: str
                - source_race_id: str
                - class_name: str
                - race_label: str
                - race_order: Optional[int]
                - race_url: str
                - start_time: Optional[datetime]
                - duration_seconds: Optional[int]
                - session_type: Optional[str] (values: "race", "practice", "qualifying", "practiceday")
        
        Returns:
            Dictionary mapping source_race_id to Race instance
        """
        if not races_data:
            return {}
        
        now = datetime.utcnow()
        
        # Import SessionType enum for conversion
        from ingestion.db.models import SessionType
        
        # Prepare batch data
        batch_data = []
        for race_data in races_data:
            # Convert session_type string to enum if provided
            session_type_value = race_data.get("session_type")
            session_type_enum = None
            if session_type_value:
                # If already a SessionType enum, use it directly
                if isinstance(session_type_value, SessionType):
                    session_type_enum = session_type_value
                elif isinstance(session_type_value, str):
                    # Normalize to lowercase since enum values are lowercase
                    session_type_normalized = session_type_value.lower()
                    try:
                        session_type_enum = SessionType(session_type_normalized)
                    except (ValueError, TypeError) as e:
                        # Invalid session type, log and skip
                        logger.warning(
                            "invalid_session_type",
                            session_type=session_type_value,
                            normalized=session_type_normalized,
                            source_race_id=race_data.get("source_race_id"),
                            error=str(e),
                        )
                        session_type_enum = None
                else:
                    # Non-string, non-enum value - log and skip
                    logger.warning(
                        "invalid_session_type_type",
                        session_type=session_type_value,
                        session_type_type=type(session_type_value).__name__,
                        source_race_id=race_data.get("source_race_id"),
                    )
                    session_type_enum = None
            
            race_dict = {
                "event_id": _uuid_to_str(race_data["event_id"]),
                "source": race_data["source"],
                "source_race_id": race_data["source_race_id"],
                "class_name": race_data["class_name"],
                "race_label": race_data["race_label"],
                "race_order": race_data.get("race_order"),
                "race_url": race_data["race_url"],
                "start_time": race_data.get("start_time"),
                "duration_seconds": race_data.get("duration_seconds"),
                # Store enum object - TypeDecorator will handle conversion to value
                "session_type": session_type_enum,
                "created_at": now,
                "updated_at": now,
            }
            batch_data.append(race_dict)
        
        # Use PostgreSQL dialect insert with ON CONFLICT
        # Unique constraint is (event_id, source_race_id) - use index_elements for unique index
        stmt = pg_insert(Race).values(batch_data)
        
        # Build update set - update session_type only if provided (don't overwrite existing with None)
        update_set = {
            "class_name": stmt.excluded.class_name,
            "race_label": stmt.excluded.race_label,
            "race_order": stmt.excluded.race_order,
            "race_url": stmt.excluded.race_url,
            "start_time": stmt.excluded.start_time,
            "duration_seconds": stmt.excluded.duration_seconds,
            "updated_at": now,
        }
        # Only update session_type if a value is provided (not None)
        # Check if any race_data has session_type set
        has_session_type = any(r.get("session_type") for r in races_data)
        if has_session_type:
            from sqlalchemy import case
            update_set["session_type"] = case(
                (stmt.excluded.session_type.isnot(None), stmt.excluded.session_type),
                else_=Race.session_type,
            )
        
        stmt = stmt.on_conflict_do_update(
            index_elements=["event_id", "source_race_id"],
            set_=update_set,
        )
        
        self.session.execute(stmt)
        self.session.flush()  # Ensure IDs are populated
        
        # Fetch the races to return them with their IDs
        source_race_ids = [r["source_race_id"] for r in races_data]
        event_id_str = _uuid_to_str(races_data[0]["event_id"])
        races_stmt = select(Race).where(
            and_(
                Race.event_id == event_id_str,
                Race.source_race_id.in_(source_race_ids),
            )
        )
        races = {race.source_race_id: race for race in self.session.scalars(races_stmt).all()}
        
        metrics.record_db_insert("races", len(races_data))
        logger.debug("bulk_upsert_races_complete", count=len(races_data))
        
        return races
    
    def bulk_upsert_race_drivers(
        self,
        race_drivers_data: List[Dict[str, Any]],
    ) -> Dict[Tuple[str, str], RaceDriver]:
        """
        Bulk upsert race drivers using PostgreSQL ON CONFLICT.
        
        Note: Assumes drivers already exist (call upsert_driver first if needed).
        
        Args:
            race_drivers_data: List of race driver dictionaries with fields:
                - race_id: UUID (string)
                - driver_id: UUID (string)
                - source: str
                - source_driver_id: str
                - display_name: str
                - transponder_number: Optional[str]
        
        Returns:
            Dictionary mapping (race_id, source_driver_id) tuple to RaceDriver instance
        """
        if not race_drivers_data:
            return {}
        
        now = datetime.utcnow()
        
        # Prepare batch data
        batch_data = []
        for rd_data in race_drivers_data:
            rd_dict = {
                "race_id": rd_data["race_id"],
                "driver_id": rd_data["driver_id"],
                "source": rd_data["source"],
                "source_driver_id": rd_data["source_driver_id"],
                "display_name": rd_data["display_name"],
                "transponder_number": rd_data.get("transponder_number"),
                "created_at": now,
                "updated_at": now,
            }
            batch_data.append(rd_dict)
        
        # Use PostgreSQL dialect insert with ON CONFLICT
        # Unique constraint is (race_id, source_driver_id) - use index_elements for unique index
        stmt = pg_insert(RaceDriver).values(batch_data)
        stmt = stmt.on_conflict_do_update(
            index_elements=["race_id", "source_driver_id"],
            set_={
                "display_name": stmt.excluded.display_name,
                "transponder_number": stmt.excluded.transponder_number,
                "updated_at": now,
            },
        )
        
        self.session.execute(stmt)
        self.session.flush()  # Ensure IDs are populated
        
        # Fetch the race drivers to return them with their IDs
        race_id_source_pairs = [(rd["race_id"], rd["source_driver_id"]) for rd in race_drivers_data]
        race_drivers_stmt = select(RaceDriver).where(
            tuple_(RaceDriver.race_id, RaceDriver.source_driver_id).in_(race_id_source_pairs)
        )
        race_drivers = {
            (rd.race_id, rd.source_driver_id): rd
            for rd in self.session.scalars(race_drivers_stmt).all()
        }
        
        metrics.record_db_insert("race_drivers", len(race_drivers_data))
        logger.debug("bulk_upsert_race_drivers_complete", count=len(race_drivers_data))
        
        # Fix empty display_names by falling back to Driver.display_name
        self._fix_empty_race_driver_display_names(race_drivers_data)
        
        return race_drivers
    
    def _fix_empty_race_driver_display_names(
        self,
        race_drivers_data: List[Dict[str, Any]],
    ) -> int:
        """
        Fix empty or whitespace-only display_names in RaceDriver records
        by falling back to the related Driver.display_name.
        
        Args:
            race_drivers_data: List of race driver data dictionaries
            
        Returns:
            Number of records updated
        """
        if not race_drivers_data:
            return 0
        
        # Use SQL to update empty display_names with Driver.display_name
        stmt = text("""
            UPDATE race_drivers rd
            SET 
                display_name = COALESCE(
                    NULLIF(TRIM(d.display_name), ''),
                    'Unknown Driver'
                ),
                updated_at = NOW()
            FROM drivers d
            WHERE 
                rd.driver_id = d.id
                AND (
                    rd.display_name IS NULL 
                    OR TRIM(rd.display_name) = ''
                )
                AND (
                    d.display_name IS NOT NULL 
                    AND TRIM(d.display_name) != ''
                )
        """)
        
        result = self.session.execute(stmt)
        updated_count = result.rowcount
        
        if updated_count > 0:
            logger.info(
                "race_driver_display_names_fixed",
                updated_count=updated_count,
            )
            metrics.record_db_update("race_drivers", updated_count)
        
        return updated_count
    
    def bulk_upsert_race_results(
        self,
        race_results_data: List[Dict[str, Any]],
    ) -> Dict[Tuple[str, str], RaceResult]:
        """
        Bulk upsert race results using PostgreSQL ON CONFLICT.

        Args:
            race_results_data: List of race result dictionaries with fields:
                - race_id: UUID (string)
                - race_driver_id: UUID (string)
                - position_final: int
                - laps_completed: int
                - total_time_raw: Optional[str]
                - total_time_seconds: Optional[float]
                - fast_lap_time: Optional[float]
                - avg_lap_time: Optional[float]
                - consistency: Optional[float]
                - qualifying_position: Optional[int]
                - seconds_behind: Optional[float]
                - raw_fields_json: Optional[Dict[str, Any]]
        
        Returns:
            Dictionary mapping (race_id, race_driver_id) tuple to RaceResult instance
        """
        if not race_results_data:
            return {}
        
        now = datetime.utcnow()
        
        # Prepare batch data
        batch_data = []
        for rr_data in race_results_data:
            rr_dict = {
                "race_id": rr_data["race_id"],
                "race_driver_id": rr_data["race_driver_id"],
                "position_final": rr_data["position_final"],
                "laps_completed": rr_data["laps_completed"],
                "total_time_raw": rr_data.get("total_time_raw"),
                "total_time_seconds": rr_data.get("total_time_seconds"),
                "fast_lap_time": rr_data.get("fast_lap_time"),
                "avg_lap_time": rr_data.get("avg_lap_time"),
                "consistency": rr_data.get("consistency"),
                "qualifying_position": rr_data.get("qualifying_position"),
                "seconds_behind": rr_data.get("seconds_behind"),
                "raw_fields_json": rr_data.get("raw_fields_json"),
                "created_at": now,
                "updated_at": now,
            }
            batch_data.append(rr_dict)
        
        # Use PostgreSQL dialect insert with ON CONFLICT
        # Unique constraint is (race_id, race_driver_id) - use index_elements for unique index
        stmt = pg_insert(RaceResult).values(batch_data)
        stmt = stmt.on_conflict_do_update(
            index_elements=["race_id", "race_driver_id"],
            set_={
                "position_final": stmt.excluded.position_final,
                "laps_completed": stmt.excluded.laps_completed,
                "total_time_raw": stmt.excluded.total_time_raw,
                "total_time_seconds": stmt.excluded.total_time_seconds,
                "fast_lap_time": stmt.excluded.fast_lap_time,
                "avg_lap_time": stmt.excluded.avg_lap_time,
                "consistency": stmt.excluded.consistency,
                "qualifying_position": stmt.excluded.qualifying_position,
                "seconds_behind": stmt.excluded.seconds_behind,
                "raw_fields_json": stmt.excluded.raw_fields_json,
                "updated_at": now,
            },
        )
        
        self.session.execute(stmt)
        self.session.flush()  # Ensure IDs are populated
        
        # Fetch the race results to return them with their IDs
        race_id_driver_pairs = [(rr["race_id"], rr["race_driver_id"]) for rr in race_results_data]
        race_results_stmt = select(RaceResult).where(
            tuple_(RaceResult.race_id, RaceResult.race_driver_id).in_(race_id_driver_pairs)
        )
        race_results = {
            (rr.race_id, rr.race_driver_id): rr
            for rr in self.session.scalars(race_results_stmt).all()
        }
        
        metrics.record_db_insert("race_results", len(race_results_data))
        logger.debug("bulk_upsert_race_results_complete", count=len(race_results_data))
        
        return race_results
    
    def calculate_and_update_race_durations(
        self,
        race_ids: List[UUID],
    ) -> int:
        """
        Calculate race duration from race results and update race records.
        
        For each race, calculates duration as the maximum total_time_seconds
        from all race results. Only updates races where duration_seconds is null
        and valid total_time_seconds exist in results.
        
        Args:
            race_ids: List of race IDs to update
            
        Returns:
            Number of races updated
        """
        if not race_ids:
            return 0
        
        # Convert UUIDs to strings for query
        race_id_strs = [_uuid_to_str(rid) for rid in race_ids]
        
        # Query to get max total_time_seconds for each race
        # Only consider results with valid (non-null, positive) total_time_seconds
        stmt = text("""
            WITH race_durations AS (
                SELECT 
                    rr.race_id,
                    MAX(rr.total_time_seconds)::INTEGER AS calculated_duration
                FROM race_results rr
                WHERE 
                    rr.race_id = ANY(:race_ids)
                    AND rr.total_time_seconds IS NOT NULL
                    AND rr.total_time_seconds > 0
                GROUP BY rr.race_id
            )
            UPDATE races r
            SET 
                duration_seconds = rd.calculated_duration,
                updated_at = NOW()
            FROM race_durations rd
            WHERE 
                r.id = rd.race_id
                AND r.duration_seconds IS NULL
            RETURNING r.id
        """)
        
        result = self.session.execute(stmt, {"race_ids": race_id_strs})
        updated_count = result.rowcount
        
        if updated_count > 0:
            logger.info(
                "race_durations_calculated",
                race_count=updated_count,
                total_races=len(race_ids),
            )
            metrics.record_db_update("races", updated_count)
        
        return updated_count
    
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
    
    def get_race_with_results_laps_for_derivation(
        self,
        race_id: Union[UUID, str],
    ) -> Optional[Dict[str, Any]]:
        """
        Load race with results and laps (ordered by lap_number) and vehicle_type for derivation.
        
        Args:
            race_id: Race ID (UUID or string)
        
        Returns:
            Dict with keys: race (id, event_id, class_name, duration_seconds),
            results (list of dicts: id, laps_completed, fast_lap_time, avg_lap_time, laps),
            vehicle_type (str | None from EventRaceClass). None if race not found.
        """
        race_id_str = _uuid_to_str(race_id) if isinstance(race_id, UUID) else str(race_id)
        race = self.session.get(Race, race_id_str)
        if not race:
            return None
        # Load EventRaceClass for vehicle_type
        erc_stmt = select(EventRaceClass).where(
            and_(
                EventRaceClass.event_id == race.event_id,
                EventRaceClass.class_name == race.class_name,
            )
        )
        event_race_class = self.session.scalar(erc_stmt)
        vehicle_type = event_race_class.vehicle_type if event_race_class else None
        # Load results with laps ordered by lap_number
        results_stmt = (
            select(RaceResult)
            .where(RaceResult.race_id == race_id_str)
            .order_by(RaceResult.position_final)
        )
        results_objs = list(self.session.scalars(results_stmt).all())
        results = []
        for rr in results_objs:
            laps_stmt = (
                select(Lap)
                .where(Lap.race_result_id == rr.id)
                .order_by(Lap.lap_number)
            )
            laps = list(self.session.scalars(laps_stmt).all())
            results.append({
                "id": rr.id,
                "laps_completed": rr.laps_completed,
                "fast_lap_time": rr.fast_lap_time,
                "avg_lap_time": rr.avg_lap_time,
                "laps": [
                    {
                        "id": lap.id,
                        "lap_number": lap.lap_number,
                        "lap_time_seconds": lap.lap_time_seconds,
                        "elapsed_race_time": lap.elapsed_race_time,
                    }
                    for lap in laps
                ],
            })
        return {
            "race": {
                "id": race.id,
                "event_id": race.event_id,
                "class_name": race.class_name,
                "duration_seconds": race.duration_seconds,
            },
            "results": results,
            "vehicle_type": vehicle_type,
        }
    
    def bulk_upsert_lap_annotations(
        self,
        annotations: List[Dict[str, Any]],
        batch_size: int = 1000,
    ) -> int:
        """
        Bulk upsert lap annotations by natural key (race_result_id, lap_number).
        
        Args:
            annotations: List of dicts with keys:
                - race_result_id: str
                - lap_number: int
                - invalid_reason: Optional[str]
                - incident_type: Optional[str]
                - confidence: Optional[float]
                - metadata: Optional[Dict]
            batch_size: Rows per batch (default 1000)
        
        Returns:
            Number of annotations upserted
        """
        if not annotations:
            return 0
        now = datetime.utcnow()
        total = 0
        for i in range(0, len(annotations), batch_size):
            batch = annotations[i : i + batch_size]
            batch_data = []
            for ann in batch:
                batch_data.append({
                    "race_result_id": ann["race_result_id"],
                    "lap_number": ann["lap_number"],
                    "invalid_reason": ann.get("invalid_reason"),
                    "incident_type": ann.get("incident_type"),
                    "confidence": ann.get("confidence"),
                    "annotation_metadata": ann.get("metadata"),  # Python attr (DB column is 'metadata')
                    "created_at": now,
                    "updated_at": now,
                })
            stmt = pg_insert(LapAnnotation).values(batch_data)
            # excluded uses table column names; 'metadata' is the column name (Python attr is annotation_metadata)
            excl = stmt.excluded
            stmt = stmt.on_conflict_do_update(
                index_elements=["race_result_id", "lap_number"],
                set_={
                    "invalid_reason": excl.invalid_reason,
                    "incident_type": excl.incident_type,
                    "confidence": excl.confidence,
                    "metadata": excl["metadata"],  # table column name
                    "updated_at": now,
                },
            )
            self.session.execute(stmt)
            total += len(batch)
        logger.debug("bulk_upsert_lap_annotations", total=total)
        metrics.record_db_insert("lap_annotations", total)
        return total
    
    def delete_lap_annotations_for_race(self, race_id: Union[UUID, str]) -> int:
        """
        Delete all lap annotations for race results belonging to the given race.
        Call before re-deriving annotations for a race so old annotations are replaced.
        
        Args:
            race_id: Race ID (UUID or string)
        
        Returns:
            Number of annotation rows deleted
        """
        race_id_str = _uuid_to_str(race_id) if isinstance(race_id, UUID) else str(race_id)
        subq = select(RaceResult.id).where(RaceResult.race_id == race_id_str)
        stmt = delete(LapAnnotation).where(LapAnnotation.race_result_id.in_(subq))
        result = self.session.execute(stmt)
        deleted = result.rowcount if result.rowcount is not None else 0
        if deleted:
            logger.debug("delete_lap_annotations_for_race", race_id=race_id_str, deleted=deleted)
        return deleted
    
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
