# @fileoverview Data validator for ingestion
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Validation rules for ingestion data quality
# 
# @purpose Enforces strict validation rules per ingestion validation
#          specification to ensure data quality and consistency.

from typing import List, Dict, Set, Optional
from urllib.parse import urlparse

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import (
    ConnectorEventSummary,
    ConnectorRaceSummary,
    ConnectorRaceResult,
    ConnectorLap,
)
from ingestion.ingestion.errors import ValidationError

logger = get_logger(__name__)


class Validator:
    """Validates connector data before ingestion."""
    
    @staticmethod
    def validate_event(event: ConnectorEventSummary, expected_event_id: str) -> None:
        """
        Validate event-level data.
        
        Args:
            event: Connector event summary
            expected_event_id: Expected event ID from URL
        
        Raises:
            ValidationError: If validation fails
        """
        # Validate source_event_id
        if not event.source_event_id or not isinstance(event.source_event_id, str):
            raise ValidationError(
                "source_event_id must be a non-empty string",
                field="source_event_id",
                event_id=event.source_event_id,
            )
        
        if event.source_event_id != expected_event_id:
            raise ValidationError(
                f"source_event_id mismatch: expected {expected_event_id}, got {event.source_event_id}",
                field="source_event_id",
                event_id=event.source_event_id,
            )
        
        # Validate event_name
        if not event.event_name or not event.event_name.strip():
            raise ValidationError(
                "event_name must be non-empty",
                field="event_name",
                event_id=event.source_event_id,
            )
        
        # Validate event_date
        if not event.event_date:
            raise ValidationError(
                "event_date must not be null",
                field="event_date",
                event_id=event.source_event_id,
            )
        
        # Validate event_entries
        if not isinstance(event.event_entries, int) or event.event_entries < 0:
            raise ValidationError(
                f"event_entries must be an integer >= 0, got {event.event_entries}",
                field="event_entries",
                event_id=event.source_event_id,
            )
        
        # Validate event_drivers
        if not isinstance(event.event_drivers, int) or event.event_drivers < 0:
            raise ValidationError(
                f"event_drivers must be an integer >= 0, got {event.event_drivers}",
                field="event_drivers",
                event_id=event.source_event_id,
            )
        
        # Validate race list is not empty
        if not event.races or len(event.races) == 0:
            raise ValidationError(
                "Race list must not be empty",
                field="races",
                event_id=event.source_event_id,
            )
        
        # Validate race ordering and uniqueness
        race_ids: Set[str] = set()
        previous_order: Optional[int] = None
        
        for race in event.races:
            # Check for duplicate source_race_id
            if race.source_race_id in race_ids:
                raise ValidationError(
                    f"Duplicate source_race_id: {race.source_race_id}",
                    field="source_race_id",
                    event_id=event.source_event_id,
                    race_id=race.source_race_id,
                )
            race_ids.add(race.source_race_id)
            
            # Check ordering is non-decreasing (allows equal values for same race_order across classes)
            # Note: Duplicate race_order values are allowed (e.g., multiple "Race 1" for different classes)
            if race.race_order is not None:
                if previous_order is not None and race.race_order < previous_order:
                    raise ValidationError(
                        f"Race ordering must be non-decreasing: {previous_order} -> {race.race_order}",
                        field="race_order",
                        event_id=event.source_event_id,
                        race_id=race.source_race_id,
                    )
                # Update previous_order (allows duplicates, so we track the highest order seen)
                previous_order = race.race_order
    
    @staticmethod
    def validate_race(race: ConnectorRaceSummary, event_id: str) -> None:
        """
        Validate race-level data.
        
        Args:
            race: Connector race summary
            event_id: Event ID for error context
        
        Raises:
            ValidationError: If validation fails
        """
        # Validate source_race_id
        if not race.source_race_id or not isinstance(race.source_race_id, str):
            raise ValidationError(
                "source_race_id must be a non-empty string",
                field="source_race_id",
                event_id=event_id,
                race_id=race.source_race_id,
            )
        
        # Validate class_name
        if not race.class_name or not race.class_name.strip():
            raise ValidationError(
                "class_name must be a non-empty string",
                field="class_name",
                event_id=event_id,
                race_id=race.source_race_id,
            )
        
        # Validate race_label
        if not race.race_label or not race.race_label.strip():
            raise ValidationError(
                "race_label must be a non-empty string",
                field="race_label",
                event_id=event_id,
                race_id=race.source_race_id,
            )
        
        # Validate race_order
        if race.race_order is not None and (not isinstance(race.race_order, int) or race.race_order <= 0):
            raise ValidationError(
                f"race_order must be a positive integer, got {race.race_order}",
                field="race_order",
                event_id=event_id,
                race_id=race.source_race_id,
            )
        
        # Validate race_url
        if not race.race_url or not isinstance(race.race_url, str):
            raise ValidationError(
                "race_url must be a non-empty string",
                field="race_url",
                event_id=event_id,
                race_id=race.source_race_id,
            )
        
        try:
            parsed = urlparse(race.race_url)
            if not parsed.scheme or not parsed.netloc:
                raise ValueError("Invalid URL")
        except Exception:
            raise ValidationError(
                f"race_url must be a valid URL: {race.race_url}",
                field="race_url",
                event_id=event_id,
                race_id=race.source_race_id,
            )
        
        # Validate start_time (optional)
        if race.start_time is not None and not isinstance(race.start_time, type(race.start_time)):
            raise ValidationError(
                f"start_time must be a valid datetime or None",
                field="start_time",
                event_id=event_id,
                race_id=race.source_race_id,
            )
        
        # Validate duration_seconds (optional)
        if race.duration_seconds is not None:
            if not isinstance(race.duration_seconds, int) or race.duration_seconds < 0:
                raise ValidationError(
                    f"duration_seconds must be an integer >= 0, got {race.duration_seconds}",
                    field="duration_seconds",
                    event_id=event_id,
                    race_id=race.source_race_id,
                )
    
    @staticmethod
    def validate_race_results(
        results: List[ConnectorRaceResult],
        event_id: str,
        race_id: str,
    ) -> None:
        """
        Validate race results consistency.
        
        Args:
            results: List of race results
            event_id: Event ID for error context
            race_id: Race ID for error context
        
        Raises:
            ValidationError: If validation fails
        """
        # Allow empty results - some races may not have been run yet or have no valid data
        # Log a warning but don't fail validation (race will be skipped during processing)
        if not results or len(results) == 0:
            logger.warning(
                "race_has_no_results",
                event_id=event_id,
                race_id=race_id,
                message="Race has no valid results (may not have been run yet or has empty data)",
            )
            return
        
        # Check for unique source_driver_id
        driver_ids: Set[str] = set()
        positions: Set[int] = set()
        
        for result in results:
            # Validate individual result
            Validator.validate_result(result, event_id, race_id)
            
            # Check duplicate driver IDs
            if result.source_driver_id in driver_ids:
                raise ValidationError(
                    f"Duplicate source_driver_id: {result.source_driver_id}",
                    field="source_driver_id",
                    event_id=event_id,
                    race_id=race_id,
                    driver_id=result.source_driver_id,
                )
            driver_ids.add(result.source_driver_id)
            
            # Track positions (allow duplicates for ties)
            positions.add(result.position_final)
        
        # Validate positions are reasonable
        # Allow duplicate positions (ties are valid in racing)
        # But ensure all positions are positive and within reasonable range
        min_position = min(positions) if positions else 0
        max_position = max(positions) if positions else 0
        
        if min_position < 1:
            raise ValidationError(
                f"position_final must be positive integers starting at 1, got minimum {min_position}",
                field="position_final",
                event_id=event_id,
                race_id=race_id,
            )
        
        # Max position should not exceed number of results by too much
        # (allowing for some gaps due to DNFs, but not excessive)
        if max_position > len(results) * 2:
            raise ValidationError(
                f"position_final maximum {max_position} is unreasonably high for {len(results)} results",
                field="position_final",
                event_id=event_id,
                race_id=race_id,
            )
    
    @staticmethod
    def validate_result(
        result: ConnectorRaceResult,
        event_id: str,
        race_id: str,
    ) -> None:
        """
        Validate individual race result.
        
        Args:
            result: Connector race result
            event_id: Event ID for error context
            race_id: Race ID for error context
        
        Raises:
            ValidationError: If validation fails
        """
        # Validate source_driver_id
        if not result.source_driver_id or not isinstance(result.source_driver_id, str):
            raise ValidationError(
                "source_driver_id must be a non-empty string",
                field="source_driver_id",
                event_id=event_id,
                race_id=race_id,
                driver_id=result.source_driver_id,
            )
        
        # Validate display_name
        if not result.display_name or not result.display_name.strip():
            raise ValidationError(
                "display_name must be a non-empty string",
                field="display_name",
                event_id=event_id,
                race_id=race_id,
                driver_id=result.source_driver_id,
            )
        
        # Validate position_final
        if not isinstance(result.position_final, int) or result.position_final <= 0:
            raise ValidationError(
                f"position_final must be a positive integer, got {result.position_final}",
                field="position_final",
                event_id=event_id,
                race_id=race_id,
                driver_id=result.source_driver_id,
            )
        
        # Validate laps_completed
        if not isinstance(result.laps_completed, int) or result.laps_completed < 0:
            raise ValidationError(
                f"laps_completed must be >= 0, got {result.laps_completed}",
                field="laps_completed",
                event_id=event_id,
                race_id=race_id,
                driver_id=result.source_driver_id,
            )
        
        # Validate total_time_seconds
        if result.total_time_seconds is not None:
            if not isinstance(result.total_time_seconds, (int, float)) or result.total_time_seconds < 0:
                raise ValidationError(
                    f"total_time_seconds must be a float >= 0, got {result.total_time_seconds}",
                    field="total_time_seconds",
                    event_id=event_id,
                    race_id=race_id,
                    driver_id=result.source_driver_id,
                )
        
        # Validate fast_lap_time
        if result.fast_lap_time is not None:
            if not isinstance(result.fast_lap_time, (int, float)) or result.fast_lap_time <= 0:
                raise ValidationError(
                    f"fast_lap_time must be a float > 0, got {result.fast_lap_time}",
                    field="fast_lap_time",
                    event_id=event_id,
                    race_id=race_id,
                    driver_id=result.source_driver_id,
                )
        
        # Validate avg_lap_time
        if result.avg_lap_time is not None:
            if not isinstance(result.avg_lap_time, (int, float)) or result.avg_lap_time <= 0:
                raise ValidationError(
                    f"avg_lap_time must be a float > 0, got {result.avg_lap_time}",
                    field="avg_lap_time",
                    event_id=event_id,
                    race_id=race_id,
                    driver_id=result.source_driver_id,
                )
        
        # Validate consistency
        # Handle invalid consistency values gracefully (set to None and log warning)
        # LiveRC sometimes provides invalid values > 100, which are invalid for percentages
        if result.consistency is not None:
            if not isinstance(result.consistency, (int, float)):
                logger.warning(
                    "invalid_consistency_type",
                    consistency=result.consistency,
                    event_id=event_id,
                    race_id=race_id,
                    driver_id=result.source_driver_id,
                )
                result.consistency = None
            elif result.consistency < 0:
                logger.warning(
                    "invalid_consistency_negative",
                    consistency=result.consistency,
                    event_id=event_id,
                    race_id=race_id,
                    driver_id=result.source_driver_id,
                )
                result.consistency = None
            elif result.consistency > 100:
                logger.warning(
                    "invalid_consistency_over_100",
                    consistency=result.consistency,
                    event_id=event_id,
                    race_id=race_id,
                    driver_id=result.source_driver_id,
                )
                result.consistency = None
    
    @staticmethod
    def validate_laps(
        laps: List[ConnectorLap],
        laps_completed: int,
        event_id: str,
        race_id: str,
        driver_id: str,
    ) -> None:
        """
        Validate lap data for a driver.
        
        Args:
            laps: List of lap data
            laps_completed: Expected number of laps from result
            event_id: Event ID for error context
            race_id: Race ID for error context
            driver_id: Driver ID for error context
        
        Raises:
            ValidationError: If validation fails
        """
        # Validate lap data based on laps_completed
        # Note: We allow len(laps) <= laps_completed because:
        # - Some laps may not be recorded (invalidated laps, warmup laps, etc.)
        # - Parsing may miss some laps due to data quality issues
        # - The laps_completed count may include laps not in detailed lap data
        #
        # Special cases:
        # - laps_completed = 0: Driver didn't start or crashed immediately (DNS/DNF)
        #   → No lap data required (correct behavior)
        # - laps_completed > 0 but <= 10: Driver DNF'd early or data incomplete
        #   → Missing lap data is acceptable (log warning only)
        # - laps_completed > 10: Driver completed significant laps
        #   → Lap data should exist (validation error if missing)
        if laps_completed > 10:
            if not laps or len(laps) == 0:
                raise ValidationError(
                    f"Lap series must exist when laps_completed > 10 (got {laps_completed})",
                    field="laps",
                    event_id=event_id,
                    race_id=race_id,
                    driver_id=driver_id,
                )
        elif laps_completed > 0 and (not laps or len(laps) == 0):
            # For low lap counts, log a warning but don't fail validation
            # This handles cases where drivers DNF early or data is incomplete
            logger.warning(
                "lap_data_missing_for_low_lap_count",
                event_id=event_id,
                race_id=race_id,
                driver_id=driver_id,
                laps_completed=laps_completed,
                message="Driver has laps_completed > 0 but no lap data (likely DNF or incomplete data)",
            )
            
            # Log data quality issue when parsed laps are less than completed
            if len(laps) < laps_completed:
                logger.warning(
                    "lap_count_mismatch",
                    event_id=event_id,
                    race_id=race_id,
                    driver_id=driver_id,
                    laps_completed=laps_completed,
                    laps_parsed=len(laps),
                    missing_laps=laps_completed - len(laps),
                    message="Some laps may not be recorded (invalidated, warmup, or parsing issues)",
                )
            
            # Allow parsed laps to be less than or equal to laps_completed
            # This handles cases where some laps aren't in the detailed lap data
            if len(laps) > laps_completed:
                raise ValidationError(
                    f"Lap count mismatch: parsed {len(laps)} laps but result shows {laps_completed} completed",
                    field="laps",
                    event_id=event_id,
                    race_id=race_id,
                    driver_id=driver_id,
                )
        
        # Validate each lap
        lap_numbers: Set[int] = set()
        previous_lap_number: Optional[int] = None
        
        for lap in laps:
            # Validate individual lap
            Validator.validate_lap(lap, event_id, race_id, driver_id)
            
            # Check for duplicate lap numbers
            if lap.lap_number in lap_numbers:
                raise ValidationError(
                    f"Duplicate lap_number: {lap.lap_number}",
                    field="lap_number",
                    event_id=event_id,
                    race_id=race_id,
                    driver_id=driver_id,
                )
            lap_numbers.add(lap.lap_number)
            
            # Check sequential ordering (starting at 1, or 0 for warmup)
            if previous_lap_number is not None:
                if lap.lap_number != previous_lap_number + 1:
                    raise ValidationError(
                        f"Lap numbers must be sequential: {previous_lap_number} -> {lap.lap_number}",
                        field="lap_number",
                        event_id=event_id,
                        race_id=race_id,
                        driver_id=driver_id,
                    )
            previous_lap_number = lap.lap_number
        
        # Validate lap numbers start at 1 (or 0 for warmup)
        if laps and len(laps) > 0:
            min_lap = min(lap_numbers)
            if min_lap not in {0, 1}:
                raise ValidationError(
                    f"Lap numbers must start at 1 (or 0 for warmup), got {min_lap}",
                    field="lap_number",
                    event_id=event_id,
                    race_id=race_id,
                    driver_id=driver_id,
                )
    
    @staticmethod
    def validate_lap(
        lap: ConnectorLap,
        event_id: str,
        race_id: str,
        driver_id: str,
    ) -> None:
        """
        Validate individual lap data.
        
        Args:
            lap: Connector lap
            event_id: Event ID for error context
            race_id: Race ID for error context
            driver_id: Driver ID for error context
        
        Raises:
            ValidationError: If validation fails
        """
        # Validate lap_number (>= 1, or 0 for warmup)
        if not isinstance(lap.lap_number, int) or lap.lap_number < 0:
            raise ValidationError(
                f"lap_number must be an integer >= 0, got {lap.lap_number}",
                field="lap_number",
                event_id=event_id,
                race_id=race_id,
                driver_id=driver_id,
            )
        
        # Validate position_on_lap
        if not isinstance(lap.position_on_lap, int) or lap.position_on_lap < 1:
            raise ValidationError(
                f"position_on_lap must be an integer >= 1, got {lap.position_on_lap}",
                field="position_on_lap",
                event_id=event_id,
                race_id=race_id,
                driver_id=driver_id,
            )
        
        # Validate lap_time_seconds
        if not isinstance(lap.lap_time_seconds, (int, float)) or lap.lap_time_seconds <= 0:
            raise ValidationError(
                f"lap_time_seconds must be a float > 0, got {lap.lap_time_seconds}",
                field="lap_time_seconds",
                event_id=event_id,
                race_id=race_id,
                driver_id=driver_id,
            )
        
        # Validate lap_time_raw
        if not lap.lap_time_raw or not isinstance(lap.lap_time_raw, str):
            raise ValidationError(
                "lap_time_raw must be a non-empty string",
                field="lap_time_raw",
                event_id=event_id,
                race_id=race_id,
                driver_id=driver_id,
            )
        
        # Validate pace_string (optional)
        if lap.pace_string is not None and (not isinstance(lap.pace_string, str) or not lap.pace_string.strip()):
            raise ValidationError(
                "pace_string must be non-empty if present",
                field="pace_string",
                event_id=event_id,
                race_id=race_id,
                driver_id=driver_id,
            )
        
        # Validate elapsed_race_time
        if not isinstance(lap.elapsed_race_time, (int, float)) or lap.elapsed_race_time < lap.lap_time_seconds:
            raise ValidationError(
                f"elapsed_race_time must be >= lap_time_seconds ({lap.lap_time_seconds}), got {lap.elapsed_race_time}",
                field="elapsed_race_time",
                event_id=event_id,
                race_id=race_id,
                driver_id=driver_id,
            )
        
        # Validate segments
        if not isinstance(lap.segments, list):
            raise ValidationError(
                "segments must be a list",
                field="segments",
                event_id=event_id,
                race_id=race_id,
                driver_id=driver_id,
            )
        
        for segment in lap.segments:
            if not isinstance(segment, str) or not segment.strip():
                raise ValidationError(
                    "Each segment must be a non-empty string",
                    field="segments",
                    event_id=event_id,
                    race_id=race_id,
                    driver_id=driver_id,
                )

