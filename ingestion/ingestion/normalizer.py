# @fileoverview Data normalizer for ingestion
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Converts connector models to ingestion models
# 
# @purpose Normalizes and converts connector output to canonical ingestion
#          format with proper types, cleaned strings, and parsed values.

import re
import unicodedata
from datetime import datetime
from typing import Optional

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import (
    ConnectorEventSummary,
    ConnectorRaceSummary,
    ConnectorRaceResult,
    ConnectorLap,
)
from ingestion.ingestion.errors import NormalisationError

logger = get_logger(__name__)


class Normalizer:
    """Normalizes connector data to ingestion format."""
    
    @staticmethod
    def normalize_string(value: str) -> str:
        """
        Normalize string values.
        
        Rules:
        - Strip whitespace
        - Collapse multiple spaces into one
        - Normalize Unicode
        - Replace non-breaking spaces
        
        Args:
            value: Raw string value
        
        Returns:
            Normalized string
        """
        if not value:
            return ""
        
        # Normalize Unicode (NFKC form)
        value = unicodedata.normalize("NFKC", value)
        
        # Replace non-breaking spaces
        value = value.replace("\u00A0", " ")
        
        # Strip and collapse whitespace
        value = " ".join(value.split())
        
        return value.strip()
    
    @staticmethod
    def parse_lap_time(lap_time_str: str) -> float:
        """
        Parse lap time string to seconds.
        
        Examples: "38.17" -> 38.17, "1:23.45" -> 83.45
        
        Args:
            lap_time_str: Lap time string
        
        Returns:
            Lap time in seconds
        
        Raises:
            NormalisationError: If parsing fails
        """
        try:
            # Simple decimal format: "38.17"
            if ":" not in lap_time_str:
                return float(lap_time_str)
            
            # MM:SS.mmm format: "1:23.45"
            parts = lap_time_str.split(":")
            if len(parts) == 2:
                minutes = int(parts[0])
                seconds = float(parts[1])
                return minutes * 60 + seconds
            
            # HH:MM:SS.mmm format: "1:23:45.67"
            if len(parts) == 3:
                hours = int(parts[0])
                minutes = int(parts[1])
                seconds = float(parts[2])
                return hours * 3600 + minutes * 60 + seconds
            
            raise ValueError(f"Unsupported lap time format: {lap_time_str}")
        
        except (ValueError, TypeError) as e:
            raise NormalisationError(
                f"Failed to parse lap time: {lap_time_str}",
                field="lap_time",
                value=lap_time_str,
            ) from e
    
    @staticmethod
    def parse_total_time(total_time_str: str) -> float:
        """
        Parse total race time string to seconds.
        
        Examples: "30:32.160" -> 1832.16, "47/30:31.382" -> 1831.382
        
        Args:
            total_time_str: Total time string
        
        Returns:
            Total time in seconds
        
        Raises:
            NormalisationError: If parsing fails
        """
        try:
            # Remove lap count prefix if present: "47/30:31.382" -> "30:31.382"
            if "/" in total_time_str:
                total_time_str = total_time_str.split("/", 1)[1]
            
            # Parse MM:SS.mmm format
            parts = total_time_str.split(":")
            if len(parts) == 2:
                minutes = int(parts[0])
                seconds = float(parts[1])
                return minutes * 60 + seconds
            
            raise ValueError(f"Unsupported total time format: {total_time_str}")
        
        except (ValueError, TypeError) as e:
            raise NormalisationError(
                f"Failed to parse total time: {total_time_str}",
                field="total_time",
                value=total_time_str,
            ) from e
    
    @staticmethod
    def parse_datetime(dt_str: str, url: Optional[str] = None) -> datetime:
        """
        Parse datetime string to UTC datetime.
        
        Args:
            dt_str: Datetime string from LiveRC
            url: Source URL for error context
        
        Returns:
            UTC datetime
        
        Raises:
            NormalisationError: If parsing fails
        """
        # Try common formats
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S%z",
            "%B %d, %Y at %I:%M%p",
            "%b %d, %Y at %I:%M%p",
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(dt_str, fmt)
                # Convert to UTC if timezone-aware
                if dt.tzinfo:
                    # Convert to UTC timezone, then remove timezone info
                    from datetime import timezone
                    dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
                return dt
            except ValueError:
                continue
        
        raise NormalisationError(
            f"Failed to parse datetime: {dt_str}",
            field="datetime",
            value=dt_str,
        )
    
    @staticmethod
    def parse_race_label(race_label: str) -> tuple[str, Optional[int]]:
        """
        Parse race label to extract components.
        
        Examples:
        - "A-Main" -> ("A-Main", None)
        - "Heat 3" -> ("Heat 3", 3)
        - "Race 14" -> ("Race 14", 14)
        
        Args:
            race_label: Race label string
        
        Returns:
            Tuple of (normalized_label, race_order)
        """
        normalized = Normalizer.normalize_string(race_label)
        
        # Extract numeric order if present
        race_order = None
        match = re.search(r'\d+', normalized)
        if match:
            try:
                race_order = int(match.group())
            except ValueError:
                pass
        
        return normalized, race_order
    
    @staticmethod
    def normalize_event(event: ConnectorEventSummary) -> dict:
        """
        Normalize event data.
        
        Args:
            event: Connector event summary
        
        Returns:
            Normalized event data dictionary
        """
        return {
            "source_event_id": event.source_event_id,
            "event_name": Normalizer.normalize_string(event.event_name),
            "event_date": event.event_date,  # Already datetime
            "event_entries": event.event_entries,
            "event_drivers": event.event_drivers,
        }
    
    @staticmethod
    def normalize_race(race: ConnectorRaceSummary) -> dict:
        """
        Normalize race data.
        
        Args:
            race: Connector race summary
        
        Returns:
            Normalized race data dictionary
        """
        normalized_label, race_order = Normalizer.parse_race_label(race.race_label)
        
        return {
            "source_race_id": race.source_race_id,
            "class_name": Normalizer.normalize_string(race.class_name),
            "race_label": normalized_label,
            "race_order": race_order or race.race_order,
            "race_url": race.race_url,
            "start_time": race.start_time,
            "duration_seconds": race.duration_seconds,
        }
    
    @staticmethod
    def normalize_result(result: ConnectorRaceResult) -> dict:
        """
        Normalize race result data.
        
        Args:
            result: Connector race result
        
        Returns:
            Normalized result data dictionary
        """
        return {
            "source_driver_id": result.source_driver_id,
            "display_name": Normalizer.normalize_string(result.display_name),
            "position_final": result.position_final,
            "laps_completed": result.laps_completed,
            "total_time_raw": result.total_time_raw,
            "total_time_seconds": result.total_time_seconds,
            "fast_lap_time": result.fast_lap_time,
            "avg_lap_time": result.avg_lap_time,
            "consistency": result.consistency,
        }
    
    @staticmethod
    def normalize_lap(lap: ConnectorLap) -> dict:
        """
        Normalize lap data.
        
        Args:
            lap: Connector lap
        
        Returns:
            Normalized lap data dictionary
        """
        return {
            "lap_number": lap.lap_number,
            "position_on_lap": lap.position_on_lap,
            "lap_time_raw": lap.lap_time_raw,
            "lap_time_seconds": lap.lap_time_seconds,
            "pace_string": lap.pace_string if lap.pace_string else None,
            "elapsed_race_time": lap.elapsed_race_time,
            "segments": lap.segments,
        }

