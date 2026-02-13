# @fileoverview Connector domain models for LiveRC
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Pydantic models for connector output
# 
# @purpose Defines the canonical data structures returned by the LiveRC
#          connector, forming the contract between connector and ingestion layers.

from datetime import datetime, date
from typing import List, Optional, Dict

from pydantic import BaseModel, Field


class ConnectorEventSummary(BaseModel):
    """High-level event metadata from event page."""
    source_event_id: str
    event_name: str
    event_date: datetime
    event_entries: int
    event_drivers: int
    races: List["ConnectorRaceSummary"]


class ConnectorRaceSummary(BaseModel):
    """Race metadata from event page."""
    source_race_id: str
    race_full_label: str
    class_name: str
    race_label: str
    race_order: Optional[int] = None
    race_url: str
    start_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None


class ConnectorRaceResult(BaseModel):
    """Driver result in a race."""
    source_driver_id: str
    display_name: str
    position_final: int
    laps_completed: int
    total_time_raw: Optional[str] = None
    total_time_seconds: Optional[float] = None
    fast_lap_time: Optional[float] = None
    avg_lap_time: Optional[float] = None
    consistency: Optional[float] = None
    qualifying_position: Optional[int] = None
    seconds_behind: Optional[float] = None
    raw_fields_json: Optional[dict] = None


class ConnectorLap(BaseModel):
    """Single lap data."""
    lap_number: int
    position_on_lap: int
    lap_time_seconds: float
    lap_time_raw: str
    pace_string: Optional[str] = None
    elapsed_race_time: float
    segments: List[str] = Field(default_factory=list)


class ConnectorRacePackage(BaseModel):
    """Complete race data package."""
    race_summary: ConnectorRaceSummary
    results: List[ConnectorRaceResult]
    laps_by_driver: dict[str, List[ConnectorLap]] = Field(
        default_factory=dict,
        description="Dictionary keyed by source_driver_id -> list of ConnectorLap"
    )
    fetch_method: str = "httpx"


class ConnectorEntryDriver(BaseModel):
    """Driver entry from entry list."""
    driver_name: str
    car_number: Optional[str] = None
    transponder_number: Optional[str] = None
    source_driver_id: Optional[str] = None  # If available in entry list
    class_name: str  # Racing class this entry belongs to


class ConnectorEntryList(BaseModel):
    """Complete entry list for an event."""
    source_event_id: str
    entries_by_class: Dict[str, List[ConnectorEntryDriver]] = Field(
        default_factory=dict,
        description="Dictionary keyed by class_name -> list of ConnectorEntryDriver"
    )


# Practice Day Models
class PracticeSessionSummary(BaseModel):
    """Practice session summary from practice day overview."""
    session_id: str
    driver_name: str
    class_name: str
    transponder_number: Optional[str] = None
    start_time: datetime
    duration_seconds: int
    lap_count: int
    fastest_lap: Optional[float] = None
    average_lap: Optional[float] = None
    session_url: str


class PracticeDaySummary(BaseModel):
    """Practice day overview with session summaries and statistics."""
    date: date  # Date of practice day
    track_slug: str
    session_count: int
    total_laps: int
    total_track_time_seconds: int
    unique_drivers: int
    unique_classes: int
    time_range_start: Optional[datetime] = None
    time_range_end: Optional[datetime] = None
    sessions: List[PracticeSessionSummary] = Field(default_factory=list)


class PracticeSessionDetail(BaseModel):
    """Complete practice session detail with lap data."""
    session_id: str
    driver_name: str
    class_name: str
    transponder_number: Optional[str] = None
    date: date
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: int
    lap_count: int
    fastest_lap: Optional[float] = None
    top_3_consecutive: Optional[float] = None
    average_lap: Optional[float] = None
    avg_top_5: Optional[float] = None
    avg_top_10: Optional[float] = None
    avg_top_15: Optional[float] = None
    std_deviation: Optional[float] = None
    consistency: Optional[float] = None
    valid_lap_range: Optional[tuple[int, int]] = None
    laps: List[ConnectorLap] = Field(default_factory=list)


# Update forward references
ConnectorEventSummary.model_rebuild()
