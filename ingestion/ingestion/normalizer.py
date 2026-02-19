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

# Global constants for fuzzy matching
AUTO_CONFIRM_MIN = 0.95
SUGGEST_MIN = 0.85
MIN_EVENTS_FOR_AUTO_CONFIRM = 2
NAME_COMPATIBILITY_MIN = 0.85
MATCHER_ID = "jaro-winkler"
MATCHER_VERSION = "1.0.0"


class Normalizer:
    """Normalizes connector data to ingestion format."""
    
    @staticmethod
    def normalize_driver_name(name: str) -> str:
        """
        Strong normalization for driver names (for fuzzy matching).
        
        Normalization steps:
        1. Lowercase
        2. Trim whitespace
        3. Collapse multiple whitespace to single space
        4. Strip punctuation (except spaces)
        5. Replace & with and
        6. Remove common suffix noise tokens: rc, raceway, club, inc, team
        7. Token sorting for multi-word names (handle "Smith John" vs "John Smith")
        
        Args:
            name: Driver name to normalize
            
        Returns:
            Normalized name string
        """
        if not name:
            return ""
        
        # Step 1: Lowercase
        normalized = name.lower()
        
        # Step 2 & 3: Trim and collapse whitespace
        normalized = " ".join(normalized.split())
        
        # Step 4: Replace & with and (before stripping punctuation)
        normalized = normalized.replace('&', 'and')
        
        # Step 5: Strip punctuation (except spaces)
        normalized = re.sub(r'[^\w\s]', '', normalized)
        
        # Step 6: Remove common suffix noise tokens
        noise_tokens = ['rc', 'raceway', 'club', 'inc', 'team']
        tokens = normalized.split()
        # Remove noise tokens from end of name
        while tokens and tokens[-1] in noise_tokens:
            tokens.pop()
        normalized = " ".join(tokens)
        
        # Step 7: Remove duplicate tokens and handle concatenated duplicates
        # First, split concatenated duplicates (e.g., "jaysonjayson" -> "jayson jayson")
        tokens = normalized.split()
        expanded_tokens = []
        for token in tokens:
            # Check if token is a concatenated duplicate (e.g., "jaysonjayson", "brentonbrenton")
            # Split if token length is even and first half equals second half
            if len(token) >= 4 and len(token) % 2 == 0:
                half_len = len(token) // 2
                first_half = token[:half_len]
                second_half = token[half_len:]
                if first_half == second_half:
                    # It's a concatenated duplicate, add just one instance
                    expanded_tokens.append(first_half)
                    continue
            expanded_tokens.append(token)
        
        # Now remove duplicate tokens
        seen = set()
        unique_tokens = []
        for token in expanded_tokens:
            if token not in seen:
                seen.add(token)
                unique_tokens.append(token)
        tokens = unique_tokens
        
        # Step 8: Token sorting for multi-word names
        if len(tokens) > 1:
            # Sort tokens alphabetically to handle "Smith John" vs "John Smith"
            tokens.sort()
            normalized = " ".join(tokens)
        
        # Final trim
        return normalized.strip()
    
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
    def infer_session_type(race_label: str, race_url: str = "") -> Optional[str]:
        """
        Infer session type from race label and URL.
        
        Returns: "practice", "qualifying", "race", or None (defaults to "race" in pipeline)
        
        Note: Practice day sessions will have sessionType = "practiceday" set explicitly
        during practice day ingestion (not inferred).
        
        Args:
            race_label: Race label string
            race_url: Race URL string (optional)
        
        Returns:
            Inferred session type string or None
        """
        label_lower = race_label.lower()
        url_lower = race_url.lower() if race_url else ""
        
        # Practice sessions (within race events)
        if "practice" in label_lower or "/practice/" in url_lower:
            return "practice"
        
        # Qualifying sessions (q1, q2, q3, qualifier rounds - distinct from heats)
        if any(term in label_lower for term in ["qualifying", "qualify", "q1", "q2", "q3"]):
            # Use word boundaries to avoid false positives
            if re.search(r'\b(q1|q2|q3|qualifying|qualify)\b', label_lower):
                return "qualifying"

        # Main events (A-Main, B-Main, C1-Main, etc.) - the actual race finals
        if "main" in label_lower:
            return "main"

        # Qualifying heats (Heat 1/3, Heat 2/3, etc.) - set positions for mains
        if "heat" in label_lower:
            return "heat"

        # Default to race (or None, which will default to "race" in pipeline)
        return "race"
    
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
        
        # Infer session type from label and URL
        session_type = Normalizer.infer_session_type(race.race_label, race.race_url)
        
        return {
            "source_race_id": race.source_race_id,
            "class_name": Normalizer.normalize_string(race.class_name),
            "race_label": normalized_label,
            "race_order": race_order or race.race_order,
            "race_url": race.race_url,
            "start_time": race.start_time,
            "duration_seconds": race.duration_seconds,
            "session_type": session_type,
        }
    
    @staticmethod
    def normalize_result(result: ConnectorRaceResult) -> dict:
        """
        Normalize race result data.

        Derives total_time_seconds from total_time_raw when not already set (e.g. "58/30:03.149" -> seconds).
        """
        total_time_seconds = result.total_time_seconds
        if total_time_seconds is None and result.total_time_raw:
            try:
                total_time_seconds = Normalizer.parse_total_time(result.total_time_raw)
            except NormalisationError:
                total_time_seconds = None

        return {
            "source_driver_id": result.source_driver_id,
            "display_name": Normalizer.normalize_string(result.display_name),
            "position_final": result.position_final,
            "laps_completed": result.laps_completed,
            "total_time_raw": result.total_time_raw,
            "total_time_seconds": total_time_seconds,
            "fast_lap_time": result.fast_lap_time,
            "avg_lap_time": result.avg_lap_time,
            "consistency": result.consistency,
            "qualifying_position": result.qualifying_position,
            "seconds_behind": result.seconds_behind,
            "raw_fields_json": result.raw_fields_json,
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

