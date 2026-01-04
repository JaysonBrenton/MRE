# @fileoverview SQLAlchemy models for LiveRC ingestion
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Database models matching Prisma schema for ingestion service
# 
# @purpose Provides SQLAlchemy ORM models that mirror the Prisma schema,
#          allowing Python service to interact with PostgreSQL database.

from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    TypeDecorator,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, ENUM as PG_ENUM
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class IngestDepth(PyEnum):
    """Ingestion depth levels for events.
    
    V1 supports only two states:
    - NONE: Event metadata exists, no races/results/laps ingested
    - LAPS_FULL: Full ingestion including races, results, and lap data
    """
    NONE = "none"
    LAPS_FULL = "laps_full"


class UserDriverLinkStatus(PyEnum):
    """Status of user-driver link."""
    SUGGESTED = "suggested"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    CONFLICT = "conflict"


class EventDriverLinkMatchType(PyEnum):
    """Type of match for event-driver link."""
    TRANSPONDER = "transponder"
    EXACT = "exact"
    FUZZY = "fuzzy"


class IngestDepthType(TypeDecorator):
    """Type decorator to ensure enum values are used instead of names."""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, IngestDepth):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return IngestDepth(value)


class Track(Base):
    """Track model representing LiveRC subdomains."""
    __tablename__ = "tracks"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    source = Column(String, nullable=False)
    source_track_slug = Column("source_track_slug", String, nullable=False)
    track_name = Column("track_name", String, nullable=False)
    track_url = Column("track_url", String, nullable=False)
    events_url = Column("events_url", String, nullable=False)
    liverc_track_last_updated = Column("liverc_track_last_updated", String, nullable=True)
    last_seen_at = Column("last_seen_at", DateTime(timezone=True), nullable=True)
    is_active = Column("is_active", Boolean, default=True, nullable=False)
    is_followed = Column("is_followed", Boolean, default=False, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    country = Column(String, nullable=True)
    postal_code = Column("postal_code", String, nullable=True)
    phone = Column(String, nullable=True)
    website = Column(String, nullable=True)
    email = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    logo_url = Column("logo_url", String, nullable=True)
    facebook_url = Column("facebook_url", String, nullable=True)
    total_laps = Column("total_laps", Integer, nullable=True, default=0)
    total_races = Column("total_races", Integer, nullable=True, default=0)
    total_events = Column("total_events", Integer, nullable=True, default=0)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    events = relationship("Event", back_populates="track", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("source", "source_track_slug", name="tracks_source_source_track_slug_key"),
        Index("tracks_source_source_track_slug_idx", "source", "source_track_slug"),
        Index("tracks_is_active_is_followed_idx", "is_active", "is_followed"),
    )


class Event(Base):
    """Event model representing high-level race meetings."""
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    source = Column(String, nullable=False)
    source_event_id = Column("source_event_id", String, nullable=False)
    track_id = Column("track_id", String, ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False)
    event_name = Column("event_name", String, nullable=False)
    event_date = Column("event_date", DateTime(timezone=True), nullable=False)
    event_entries = Column("event_entries", Integer, nullable=False)
    event_drivers = Column("event_drivers", Integer, nullable=False)
    event_url = Column("event_url", String, nullable=False)
    ingest_depth = Column("ingest_depth", IngestDepthType(), default=IngestDepth.NONE, nullable=False)
    last_ingested_at = Column("last_ingested_at", DateTime(timezone=True), nullable=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    track = relationship("Track", back_populates="events")
    races = relationship("Race", back_populates="event", cascade="all, delete-orphan")
    entries = relationship("EventEntry", back_populates="event", cascade="all, delete-orphan")
    driver_links = relationship("EventDriverLink", back_populates="event", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("source", "source_event_id", name="events_source_source_event_id_key"),
        Index("events_source_source_event_id_idx", "source", "source_event_id"),
        Index("events_track_id_idx", "track_id"),
        Index("events_event_date_idx", "event_date"),
        Index("events_ingest_depth_idx", "ingest_depth"),
    )


class EventEntry(Base):
    """EventEntry model representing driver entries in classes for an event."""
    __tablename__ = "event_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    event_id = Column("event_id", String, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    driver_id = Column("driver_id", String, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False)
    class_name = Column("class_name", String, nullable=False)
    transponder_number = Column("transponder_number", String, nullable=True)
    car_number = Column("car_number", String, nullable=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    event = relationship("Event", back_populates="entries")
    driver = relationship("Driver", back_populates="event_entries")

    __table_args__ = (
        UniqueConstraint("event_id", "driver_id", "class_name", name="event_entries_event_id_driver_id_class_name_key"),
        Index("event_entries_event_id_idx", "event_id"),
        Index("event_entries_driver_id_idx", "driver_id"),
        Index("event_entries_class_name_idx", "class_name"),
    )


class Race(Base):
    """Race model representing individual race sessions."""
    __tablename__ = "races"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    event_id = Column("event_id", String, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    source = Column(String, nullable=False)
    source_race_id = Column("source_race_id", String, nullable=False)
    class_name = Column("class_name", String, nullable=False)
    race_label = Column("race_label", String, nullable=False)
    race_order = Column("race_order", Integer, nullable=True)
    race_url = Column("race_url", String, nullable=False)
    start_time = Column("start_time", DateTime(timezone=True), nullable=True)
    duration_seconds = Column("duration_seconds", Integer, nullable=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    event = relationship("Event", back_populates="races")
    drivers = relationship("RaceDriver", back_populates="race", cascade="all, delete-orphan")
    results = relationship("RaceResult", back_populates="race", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("event_id", "source_race_id", name="races_event_id_source_race_id_key"),
        Index("races_event_id_source_race_id_idx", "event_id", "source_race_id"),
        Index("races_event_id_idx", "event_id"),
        Index("races_race_order_idx", "race_order"),
    )


class Driver(Base):
    """Driver model representing normalized driver identity across all races/events."""
    __tablename__ = "drivers"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    source = Column(String, nullable=False)
    source_driver_id = Column("source_driver_id", String, nullable=False)
    display_name = Column("display_name", String, nullable=False)
    normalized_name = Column("normalized_name", String, nullable=True)
    transponder_number = Column("transponder_number", String, nullable=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    race_drivers = relationship("RaceDriver", back_populates="driver", cascade="all, delete-orphan")
    event_entries = relationship("EventEntry", back_populates="driver", cascade="all, delete-orphan")
    user_driver_link = relationship("UserDriverLink", back_populates="driver", uselist=False)
    event_driver_links = relationship("EventDriverLink", back_populates="driver", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("source", "source_driver_id", name="drivers_source_source_driver_id_key"),
        Index("drivers_source_source_driver_id_idx", "source", "source_driver_id"),
        Index("drivers_display_name_idx", "display_name"),
        Index("drivers_normalized_name_idx", "normalized_name"),
    )


class RaceDriver(Base):
    """RaceDriver model representing driver identity within a specific race."""
    __tablename__ = "race_drivers"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    race_id = Column("race_id", String, ForeignKey("races.id", ondelete="CASCADE"), nullable=False)
    driver_id = Column("driver_id", String, ForeignKey("drivers.id", ondelete="RESTRICT"), nullable=False)
    source = Column(String, nullable=False)  # Denormalized for query performance
    source_driver_id = Column("source_driver_id", String, nullable=False)  # Denormalized for query performance
    display_name = Column("display_name", String, nullable=False)  # Denormalized for query performance
    transponder_number = Column("transponder_number", String, nullable=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    race = relationship("Race", back_populates="drivers")
    driver = relationship("Driver", back_populates="race_drivers")
    results = relationship("RaceResult", back_populates="race_driver", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("race_id", "source_driver_id", name="race_drivers_race_id_source_driver_id_key"),
        Index("race_drivers_race_id_source_driver_id_idx", "race_id", "source_driver_id"),
        Index("race_drivers_race_id_idx", "race_id"),
        Index("race_drivers_driver_id_idx", "driver_id"),
    )


class RaceResult(Base):
    """RaceResult model representing a driver's result in a race."""
    __tablename__ = "race_results"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    race_id = Column("race_id", String, ForeignKey("races.id", ondelete="CASCADE"), nullable=False)
    race_driver_id = Column("race_driver_id", String, ForeignKey("race_drivers.id", ondelete="CASCADE"), nullable=False)
    position_final = Column("position_final", Integer, nullable=False)
    laps_completed = Column("laps_completed", Integer, nullable=False)
    total_time_raw = Column("total_time_raw", String, nullable=True)
    total_time_seconds = Column("total_time_seconds", Float, nullable=True)
    fast_lap_time = Column("fast_lap_time", Float, nullable=True)
    avg_lap_time = Column("avg_lap_time", Float, nullable=True)
    consistency = Column("consistency", Float, nullable=True)
    raw_fields_json = Column("raw_fields_json", JSONB, nullable=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    race = relationship("Race", back_populates="results")
    race_driver = relationship("RaceDriver", back_populates="results")
    laps = relationship("Lap", back_populates="race_result", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("race_id", "race_driver_id", name="race_results_race_id_race_driver_id_key"),
        Index("race_results_race_id_race_driver_id_idx", "race_id", "race_driver_id"),
        Index("race_results_race_id_idx", "race_id"),
        Index("race_results_race_driver_id_idx", "race_driver_id"),
        Index("race_results_position_final_idx", "position_final"),
    )


class Lap(Base):
    """Lap model representing normalized lap data for a race result."""
    __tablename__ = "laps"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    race_result_id = Column("race_result_id", String, ForeignKey("race_results.id", ondelete="CASCADE"), nullable=False)
    lap_number = Column("lap_number", Integer, nullable=False)
    position_on_lap = Column("position_on_lap", Integer, nullable=False)
    lap_time_raw = Column("lap_time_raw", String, nullable=False)
    lap_time_seconds = Column("lap_time_seconds", Float, nullable=False)
    pace_string = Column("pace_string", String, nullable=True)
    elapsed_race_time = Column("elapsed_race_time", Float, nullable=False)
    segments_json = Column("segments_json", JSONB, nullable=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    race_result = relationship("RaceResult", back_populates="laps")

    __table_args__ = (
        UniqueConstraint("race_result_id", "lap_number", name="laps_race_result_id_lap_number_key"),
        Index("laps_race_result_id_lap_number_idx", "race_result_id", "lap_number"),
        Index("laps_race_result_id_idx", "race_result_id"),
        Index("laps_lap_number_idx", "lap_number"),
    )


class User(Base):
    """User model for authentication and user-driver linking."""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    email = Column(String, unique=True, nullable=False)
    password_hash = Column("passwordHash", String, nullable=False)
    driver_name = Column("driverName", String, nullable=False)
    normalized_name = Column("normalized_name", String, nullable=True)
    transponder_number = Column("transponder_number", String, nullable=True)
    team_name = Column("teamName", String, nullable=True)
    is_admin = Column("isAdmin", Boolean, default=False, nullable=False)
    created_at = Column("createdAt", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column("updatedAt", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    driver_links = relationship("UserDriverLink", back_populates="user", cascade="all, delete-orphan")
    event_driver_links = relationship("EventDriverLink", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index("users_normalized_name_idx", "normalized_name"),
        Index("users_transponder_number_idx", "transponder_number"),
    )


class UserDriverLinkStatusType(TypeDecorator):
    """Type decorator for UserDriverLinkStatus enum."""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, UserDriverLinkStatus):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return UserDriverLinkStatus(value)


class EventDriverLinkMatchTypeType(TypeDecorator):
    """Type decorator for EventDriverLinkMatchType enum."""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, EventDriverLinkMatchType):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return EventDriverLinkMatchType(value)


class UserDriverLink(Base):
    """UserDriverLink model representing link between User and Driver."""
    __tablename__ = "user_driver_links"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column("user_id", String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    driver_id = Column("driver_id", String, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False, unique=True)
    status = Column(UserDriverLinkStatusType(), nullable=False)
    similarity_score = Column("similarity_score", Float, nullable=False)
    matched_at = Column("matched_at", DateTime(timezone=True), nullable=False)
    confirmed_at = Column("confirmed_at", DateTime(timezone=True), nullable=True)
    rejected_at = Column("rejected_at", DateTime(timezone=True), nullable=True)
    matcher_id = Column("matcher_id", String, nullable=False)
    matcher_version = Column("matcher_version", String, nullable=False)
    conflict_reason = Column("conflict_reason", String, nullable=True)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="driver_links")
    driver = relationship("Driver", back_populates="user_driver_link")
    events = relationship("EventDriverLink", back_populates="user_driver_link", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("user_id", "driver_id", name="user_driver_links_user_id_driver_id_key"),
        Index("user_driver_links_user_id_idx", "user_id"),
        Index("user_driver_links_driver_id_idx", "driver_id"),
        Index("user_driver_links_status_idx", "status"),
    )


class EventDriverLink(Base):
    """EventDriverLink model tracking all events where matches found."""
    __tablename__ = "event_driver_links"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column("user_id", String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_id = Column("event_id", String, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    driver_id = Column("driver_id", String, ForeignKey("drivers.id", ondelete="CASCADE"), nullable=False)
    user_driver_link_id = Column("user_driver_link_id", String, ForeignKey("user_driver_links.id", ondelete="SET NULL"), nullable=True)
    match_type = Column(EventDriverLinkMatchTypeType(), nullable=False)
    similarity_score = Column("similarity_score", Float, nullable=False)
    transponder_number = Column("transponder_number", String, nullable=True)
    matched_at = Column("matched_at", DateTime(timezone=True), nullable=False)
    created_at = Column("created_at", DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column("updated_at", DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="event_driver_links")
    event = relationship("Event", back_populates="driver_links")
    driver = relationship("Driver", back_populates="event_driver_links")
    user_driver_link = relationship("UserDriverLink", back_populates="events")

    __table_args__ = (
        UniqueConstraint("user_id", "event_id", "driver_id", name="event_driver_links_user_id_event_id_driver_id_key"),
        Index("event_driver_links_user_id_driver_id_transponder_number_idx", "user_id", "driver_id", "transponder_number"),
        Index("event_driver_links_event_id_driver_id_idx", "event_id", "driver_id"),
        Index("event_driver_links_user_driver_link_id_idx", "user_driver_link_id"),
    )

