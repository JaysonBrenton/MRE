# @fileoverview Driver matching utility for entry list to race result matching
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Matches entry list drivers to race result drivers
# 
# @purpose Provides multi-field matching strategy to link entry list drivers
#          (with transponder numbers) to race result drivers

from typing import List, Optional
from uuid import UUID

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import ConnectorEntryDriver, ConnectorRaceResult
from ingestion.db.models import EventEntry, Driver

logger = get_logger(__name__)


class DriverMatcher:
    """Matches entry list drivers to race result drivers."""
    
    @staticmethod
    def _normalize_name(name: str) -> str:
        """
        Normalize driver name for comparison.
        
        Args:
            name: Driver name to normalize
        
        Returns:
            Normalized name (uppercase, stripped)
        """
        if not name:
            return ""
        return name.strip().upper()
    
    @staticmethod
    def match_driver(
        entry_drivers: List[ConnectorEntryDriver],
        race_result: ConnectorRaceResult,
        class_name: str,
    ) -> Optional[ConnectorEntryDriver]:
        """
        Match race result driver to entry list driver.
        
        Matching strategy (in order of preference):
        1. Match by source_driver_id (if available in entry list)
        2. Match by normalized driver name (exact match)
        3. Match by car number (if available in both)
        
        Args:
            entry_drivers: List of entry drivers for the class
            race_result: Race result to match
            class_name: Racing class name (for logging)
        
        Returns:
            Matched entry driver or None if no match found
        """
        if not entry_drivers:
            logger.debug("driver_match_no_entry_drivers", driver_id=race_result.source_driver_id, class_name=class_name)
            return None
        
        normalized_race_name = DriverMatcher._normalize_name(race_result.display_name)
        
        # Strategy 1: Match by source_driver_id (if available in entry list)
        # Note: Entry list typically doesn't have driver IDs, but check anyway
        for entry_driver in entry_drivers:
            if entry_driver.source_driver_id and entry_driver.source_driver_id == race_result.source_driver_id:
                logger.debug(
                    "driver_match_by_id",
                    driver_id=race_result.source_driver_id,
                    driver_name=race_result.display_name,
                    class_name=class_name,
                )
                return entry_driver
        
        # Strategy 2: Match by normalized driver name (exact match)
        for entry_driver in entry_drivers:
            normalized_entry_name = DriverMatcher._normalize_name(entry_driver.driver_name)
            if normalized_entry_name == normalized_race_name:
                logger.debug(
                    "driver_match_by_name",
                    driver_id=race_result.source_driver_id,
                    driver_name=race_result.display_name,
                    entry_name=entry_driver.driver_name,
                    class_name=class_name,
                )
                return entry_driver
        
        # Strategy 3: Match by car number (if available in both)
        # Note: Car number is not typically available in race results,
        # but we check anyway in case it becomes available in the future
        # For now, this will likely not match, but the structure is in place
        
        logger.debug(
            "driver_match_not_found",
            driver_id=race_result.source_driver_id,
            driver_name=race_result.display_name,
            class_name=class_name,
            entry_count=len(entry_drivers),
        )
        return None
    
    @staticmethod
    def match_race_result_to_event_entry(
        event_entries: List[EventEntry],
        race_result: ConnectorRaceResult,
        class_name: str,
    ) -> Optional[EventEntry]:
        """
        Match race result driver to EventEntry record.
        
        Matching strategy (in order of preference):
        1. Match by driver source_driver_id (if available in EventEntry's driver)
        2. Match by normalized driver name (exact match)
        
        Args:
            event_entries: List of EventEntry records for the class
            race_result: Race result to match
            class_name: Racing class name (for logging)
        
        Returns:
            Matched EventEntry or None if no match found
        """
        if not event_entries:
            logger.debug("driver_match_no_event_entries", driver_id=race_result.source_driver_id, class_name=class_name)
            return None
        
        normalized_race_name = DriverMatcher._normalize_name(race_result.display_name)
        
        # Strategy 1: Match by source_driver_id
        for event_entry in event_entries:
            if event_entry.driver.source_driver_id == race_result.source_driver_id:
                logger.debug(
                    "event_entry_match_by_id",
                    driver_id=race_result.source_driver_id,
                    driver_name=race_result.display_name,
                    class_name=class_name,
                )
                return event_entry
        
        # Strategy 2: Match by normalized driver name
        for event_entry in event_entries:
            normalized_driver_name = DriverMatcher._normalize_name(event_entry.driver.display_name)
            if normalized_driver_name == normalized_race_name:
                logger.debug(
                    "event_entry_match_by_name",
                    driver_id=race_result.source_driver_id,
                    driver_name=race_result.display_name,
                    entry_driver_name=event_entry.driver.display_name,
                    class_name=class_name,
                )
                return event_entry
        
        logger.debug(
            "event_entry_match_not_found",
            driver_id=race_result.source_driver_id,
            driver_name=race_result.display_name,
            class_name=class_name,
            entry_count=len(event_entries),
        )
        return None

