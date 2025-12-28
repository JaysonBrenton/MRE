# @fileoverview Auto-confirmation logic for user-driver links
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Auto-confirms user-driver links when strong evidence is found
# 
# @purpose Automatically confirms suggested links when transponder matches
#          across 2+ events with name compatibility

from datetime import datetime
from typing import Dict, List, Tuple
from collections import defaultdict

from rapidfuzz.distance import JaroWinkler
from sqlalchemy import select, and_

from ingestion.common.logging import get_logger
from ingestion.db.models import (
    EventDriverLink,
    UserDriverLink,
    UserDriverLinkStatus,
    EventDriverLinkMatchType,
    User,
    Driver,
)
from ingestion.db.repository import Repository
from ingestion.ingestion.normalizer import (
    Normalizer,
    NAME_COMPATIBILITY_MIN,
    MIN_EVENTS_FOR_AUTO_CONFIRM,
)

logger = get_logger(__name__)


def check_and_confirm_links(repo: Repository) -> Dict[str, int]:
    """
    Check for multi-event transponder matches and auto-confirm links.
    
    Process:
    1. Query all EventDriverLink records with matchType="transponder"
    2. Group by (userId, driverId, transponderNumber)
    3. Count events per group
    4. For groups with count >= 2:
       - Get UserDriverLink (status="suggested")
       - Check name compatibility (fuzzy match >= 0.85)
       - Check for conflicts (multiple users, name mismatch)
       - If no conflict and name compatible, auto-confirm
       - If conflict detected, set status to "rejected" or "conflict"
    
    Args:
        repo: Repository instance
        
    Returns:
        Dict with statistics: links_confirmed, links_rejected, links_conflicted
    """
    # Query all transponder matches
    stmt = select(EventDriverLink).where(
        EventDriverLink.match_type == EventDriverLinkMatchType.TRANSPONDER
    )
    transponder_links = list(repo.session.scalars(stmt).all())
    
    if not transponder_links:
        logger.debug("no_transponder_links_to_check")
        return {
            "links_confirmed": 0,
            "links_rejected": 0,
            "links_conflicted": 0,
        }
    
    # Group by (userId, driverId) - transponder matches should be grouped together
    # regardless of whether transponder_number is present in EventDriverLink
    groups: Dict[Tuple[str, str], List[EventDriverLink]] = defaultdict(list)
    for link in transponder_links:
        key = (link.user_id, link.driver_id)
        groups[key].append(link)
    
    links_confirmed = 0
    links_rejected = 0
    links_conflicted = 0
    
    # Process groups with 2+ events
    for (user_id, driver_id), event_links in groups.items():
        if len(event_links) < MIN_EVENTS_FOR_AUTO_CONFIRM:
            continue
        
        # Extract transponder number from event links for logging (use first available)
        transponder_number = None
        for link in event_links:
            if link.transponder_number:
                transponder_number = link.transponder_number
                break
        
        # Get UserDriverLink
        user_driver_link_stmt = select(UserDriverLink).where(
            and_(
                UserDriverLink.user_id == user_id,
                UserDriverLink.driver_id == driver_id,
            )
        )
        user_driver_link = repo.session.scalar(user_driver_link_stmt)
        
        if not user_driver_link:
            logger.warning(
                "user_driver_link_not_found_for_auto_confirm",
                user_id=user_id,
                driver_id=driver_id,
                transponder_number=transponder_number,
                event_count=len(event_links),
            )
            continue
        
        # Skip if already confirmed
        if user_driver_link.status == UserDriverLinkStatus.CONFIRMED:
            continue
        
        # Skip if rejected
        if user_driver_link.status == UserDriverLinkStatus.REJECTED:
            continue
        
        # Get User and Driver for name compatibility check
        user = repo.session.get(User, user_id)
        driver = repo.session.get(Driver, driver_id)
        
        if not user or not driver:
            logger.warning(
                "user_or_driver_not_found_for_auto_confirm",
                user_id=user_id,
                driver_id=driver_id,
            )
            continue
        
        # Check name compatibility
        user_normalized = user.normalized_name or Normalizer.normalize_driver_name(user.driver_name)
        driver_normalized = driver.normalized_name or Normalizer.normalize_driver_name(driver.display_name)
        
        name_compatible = False
        similarity = 0.0
        if user_normalized and driver_normalized:
            similarity = JaroWinkler.normalized_similarity(user_normalized, driver_normalized)
            name_compatible = similarity >= NAME_COMPATIBILITY_MIN
        
        # Check for conflicts
        conflict_reason = None
        conflict_detected = False
        
        # Check if another user already linked to this driver
        other_link_stmt = select(UserDriverLink).where(
            and_(
                UserDriverLink.driver_id == driver_id,
                UserDriverLink.user_id != user_id,
            )
        )
        other_link = repo.session.scalar(other_link_stmt)
        if other_link:
            conflict_reason = f"Another user ({other_link.user_id}) already linked to this driver"
            conflict_detected = True
        
        # Check name mismatch
        if not name_compatible:
            conflict_reason = f"Name similarity ({similarity:.2f}) below threshold ({NAME_COMPATIBILITY_MIN})"
            conflict_detected = True
        
        # Update link status
        if conflict_detected:
            if conflict_reason and "Another user" in conflict_reason:
                # Multiple users - set to conflict
                user_driver_link.status = UserDriverLinkStatus.CONFLICT
                links_conflicted += 1
            else:
                # Name mismatch - set to rejected
                user_driver_link.status = UserDriverLinkStatus.REJECTED
                user_driver_link.rejected_at = datetime.utcnow()
                links_rejected += 1
            user_driver_link.conflict_reason = conflict_reason
            user_driver_link.updated_at = datetime.utcnow()
            logger.info(
                "user_driver_link_conflict_detected",
                user_id=user_id,
                driver_id=driver_id,
                conflict_reason=conflict_reason,
            )
        else:
            # Auto-confirm
            user_driver_link.status = UserDriverLinkStatus.CONFIRMED
            user_driver_link.confirmed_at = datetime.utcnow()
            user_driver_link.updated_at = datetime.utcnow()
            links_confirmed += 1
            logger.info(
                "user_driver_link_auto_confirmed",
                user_id=user_id,
                driver_id=driver_id,
                transponder_number=transponder_number,
                event_count=len(event_links),
            )
    
    logger.info(
        "auto_confirm_links_complete",
        links_confirmed=links_confirmed,
        links_rejected=links_rejected,
        links_conflicted=links_conflicted,
    )
    
    return {
        "links_confirmed": links_confirmed,
        "links_rejected": links_rejected,
        "links_conflicted": links_conflicted,
    }

