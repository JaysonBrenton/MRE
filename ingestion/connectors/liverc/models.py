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

from datetime import datetime
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


# Update forward references
ConnectorEventSummary.model_rebuild()
