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

from datetime import datetime
from typing import List, Optional, Tuple, Dict
from uuid import UUID

from rapidfuzz.distance import JaroWinkler

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import ConnectorEntryDriver, ConnectorRaceResult
from ingestion.db.models import EventEntry, Driver, User, UserDriverLink, EventDriverLink, UserDriverLinkStatus, EventDriverLinkMatchType
from ingestion.ingestion.normalizer import Normalizer, AUTO_CONFIRM_MIN, SUGGEST_MIN, MATCHER_ID, MATCHER_VERSION

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
        
        normalized_race_name = Normalizer.normalize_driver_name(race_result.display_name)
        
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
            normalized_entry_name = Normalizer.normalize_driver_name(entry_driver.driver_name)
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
        
        normalized_race_name = Normalizer.normalize_driver_name(race_result.display_name)
        
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
            normalized_driver_name = Normalizer.normalize_driver_name(event_entry.driver.display_name)
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
    
    @staticmethod
    def normalize_driver_name(name: str) -> str:
        """
        Normalize driver name using strong normalization.
        
        Args:
            name: Driver name to normalize
            
        Returns:
            Normalized name string
        """
        return Normalizer.normalize_driver_name(name)
    
    @staticmethod
    def fuzzy_match_user_to_driver(
        user: User,
        driver: Driver,
    ) -> Optional[Tuple[str, float, str]]:
        """
        Match User to Driver using fuzzy matching.
        
        Matching priority:
        1. Transponder number match (if both exist)
        2. Exact normalized name match
        3. Fuzzy name match (Jaro-Winkler ≥ SUGGEST_MIN)
        
        Args:
            user: User model instance
            driver: Driver model instance
            
        Returns:
            Tuple of (match_type, similarity_score, status) or None if no match
            match_type: 'transponder', 'exact', or 'fuzzy'
            similarity_score: 0.0-1.0
            status: 'confirmed' or 'suggested'
        """
        # Strategy 1: Transponder match (primary)
        if user.transponder_number and driver.transponder_number:
            if user.transponder_number == driver.transponder_number:
                # Transponder match - create suggested link (will be auto-confirmed if found across 2+ events)
                return ('transponder', 1.0, 'suggested')
        
        # Strategy 2: Exact normalized name match
        user_normalized = user.normalized_name or Normalizer.normalize_driver_name(user.driver_name)
        driver_normalized = driver.normalized_name or Normalizer.normalize_driver_name(driver.display_name)
        
        if user_normalized and driver_normalized:
            if user_normalized == driver_normalized:
                # Exact match - auto-confirm
                return ('exact', 1.0, 'confirmed')
            
            # Strategy 3: Fuzzy name match
            similarity = JaroWinkler.normalized_similarity(user_normalized, driver_normalized)
            
            if similarity >= AUTO_CONFIRM_MIN:
                # High similarity - auto-confirm
                return ('fuzzy', similarity, 'confirmed')
            elif similarity >= SUGGEST_MIN:
                # Medium similarity - suggest
                return ('fuzzy', similarity, 'suggested')
        
        return None
    
    @staticmethod
    def find_user_matches_for_driver(
        driver: Driver,
        users: List[User],
        existing_links: Dict[str, UserDriverLink],
    ) -> Optional[Tuple[User, str, float, str]]:
        """
        Find matching User for a Driver, considering existing links and conflicts.
        
        Args:
            driver: Driver to match
            users: List of all Users (preloaded)
            existing_links: Dict mapping driver_id to existing UserDriverLink
            
        Returns:
            Tuple of (User, match_type, similarity_score, status) or None if no match
        """
        # Skip if link already exists and is CONFIRMED (to avoid churn)
        # For other statuses (SUGGESTED, CONFLICT), allow re-processing to capture
        # new evidence and updated similarity scores
        if driver.id in existing_links:
            existing_link = existing_links[driver.id]
            # Skip if rejected (user explicitly rejected this link)
            if existing_link.status == UserDriverLinkStatus.REJECTED:
                return None
            # Skip if already confirmed (to avoid unnecessary re-processing)
            if existing_link.status == UserDriverLinkStatus.CONFIRMED:
                return None
            # For SUGGESTED, CONFLICT, or other statuses, continue to allow re-processing
        
        best_match = None
        best_score = 0.0
        
        # Narrow candidate set by first letter for performance
        driver_normalized = driver.normalized_name or Normalizer.normalize_driver_name(driver.display_name)
        if driver_normalized:
            first_letter = driver_normalized[0] if driver_normalized else None
        else:
            first_letter = None
        
        for user in users:
            # Narrow by first letter if available
            user_normalized = user.normalized_name or Normalizer.normalize_driver_name(user.driver_name)
            if first_letter and user_normalized:
                if len(user_normalized) > 0 and user_normalized[0] != first_letter:
                    continue
            
            # Check if user already has a link to a different driver (conflict)
            # This is handled by the one-to-one constraint on driver_id, but we check anyway
            user_has_conflict = False
            for link in existing_links.values():
                if link.user_id == user.id and link.driver_id != driver.id:
                    user_has_conflict = True
                    break
            
            if user_has_conflict:
                continue
            
            match_result = DriverMatcher.fuzzy_match_user_to_driver(user, driver)
            if match_result:
                match_type, score, status = match_result
                if score > best_score:
                    best_match = (user, match_type, score, status)
                    best_score = score
        
        return best_match

