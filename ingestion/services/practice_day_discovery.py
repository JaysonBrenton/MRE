# @fileoverview Practice day discovery service
# 
# @created 2026-01-XX
# @creator System
# @lastModified 2026-01-XX
# 
# @description Service for discovering practice days from LiveRC
# 
# @purpose Orchestrates practice day discovery from LiveRC track practice pages

from datetime import date, timedelta
from typing import List, Optional
from uuid import UUID

import time
import asyncio
from ingestion.common.logging import get_logger
from ingestion.common import metrics
from ingestion.connectors.liverc.connector import LiveRCConnector
from ingestion.connectors.liverc.models import PracticeDaySummary
from ingestion.db.repository import Repository
from ingestion.db.models import Event, Track
from ingestion.db.session import db_session
from ingestion.ingestion.errors import EventPageFormatError
from ingestion.connectors.liverc.client.httpx_client import ConnectorHTTPError
from sqlalchemy import select, and_

logger = get_logger(__name__)


async def discover_practice_days(
    track_slug: str,
    start_date: date,
    end_date: date,
) -> List[PracticeDaySummary]:
    """
    Discover all practice days in date range from LiveRC.
    
    Args:
        track_slug: Track subdomain slug
        start_date: Start date (inclusive)
        end_date: End date (inclusive)
    
    Returns:
        List of PracticeDaySummary objects
    
    Raises:
        ValueError: If date range is invalid or exceeds maximum (3 months)
    """
    # Validate date range
    if start_date > end_date:
        raise ValueError("start_date must be before or equal to end_date")
    
    # Maximum 3 months
    max_days = 90
    days_diff = (end_date - start_date).days
    if days_diff > max_days:
        raise ValueError(f"Date range cannot exceed {max_days} days (3 months)")
    
    logger.info(
        "discover_practice_days_start",
        track_slug=track_slug,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
    )
    
    start_time = time.time()
    connector = LiveRCConnector()
    practice_days: List[PracticeDaySummary] = []
    success = False
    
    # Iterate through months in range
    current_date = start_date.replace(day=1)  # Start of month
    end_month = end_date.replace(day=1)
    
    # Track if month view parsing is working
    month_view_working = False
    
    while current_date <= end_month:
        year = current_date.year
        month = current_date.month
        
        try:
            # Fetch practice month view
            dates_with_practice = await connector.fetch_practice_month_view(
                track_slug=track_slug,
                year=year,
                month=month,
            )
            
            if len(dates_with_practice) > 0:
                month_view_working = True
            
            # Filter dates within range
            for practice_date in dates_with_practice:
                if start_date <= practice_date <= end_date:
                    try:
                        # Fetch practice day overview
                        summary = await connector.fetch_practice_day_overview(
                            track_slug=track_slug,
                            practice_date=practice_date,
                        )
                        practice_days.append(summary)
                    except Exception as e:
                        logger.warning(
                            "practice_day_overview_fetch_error",
                            track_slug=track_slug,
                            date=practice_date.isoformat(),
                            error=str(e),
                        )
                        continue
        
        except Exception as e:
            logger.warning(
                "practice_month_view_fetch_error",
                track_slug=track_slug,
                year=year,
                month=month,
                error=str(e),
            )
            # Continue with next month
        
        # Move to next month
        if month == 12:
            current_date = date(year + 1, 1, 1)
        else:
            current_date = date(year, month + 1, 1)
    
    # Fallback: If month view didn't find any dates, try checking dates directly
    # This handles cases where month view is JavaScript-rendered or not working
    # We'll check weekends (Saturday/Sunday) as practice days are more common then
    if not month_view_working and len(practice_days) == 0:
        logger.info(
            "practice_day_discovery_fallback",
            track_slug=track_slug,
            message="Month view returned no dates, trying weekend date checks",
        )
        
        # Check weekends (Saturday=5, Sunday=6) as practice days are more common
        # Also check a few weekdays to catch practice days that might occur on other days
        check_date = start_date
        checked_count = 0
        max_checks = 30  # Limit to avoid too many requests and timeouts
        
        while check_date <= end_date and checked_count < max_checks:
            # Check if it's a weekend (Saturday or Sunday)
            weekday = check_date.weekday()  # Monday=0, Sunday=6
            is_weekend = weekday in [5, 6]  # Saturday or Sunday
            
            if is_weekend:
                try:
                    # Try fetching practice day overview directly with timeout
                    # Use a shorter timeout to prevent long hangs if parser crashes
                    summary = await asyncio.wait_for(
                        connector.fetch_practice_day_overview(
                            track_slug=track_slug,
                            practice_date=check_date,
                        ),
                        timeout=8.0  # 8 second timeout per date check (reduced from 10)
                    )
                    # If we get here without exception, there are practice sessions
                    if summary.session_count > 0:
                        practice_days.append(summary)
                        logger.info(
                            "practice_day_found_via_fallback",
                            track_slug=track_slug,
                            date=check_date.isoformat(),
                            session_count=summary.session_count,
                        )
                    checked_count += 1
                except asyncio.TimeoutError:
                    logger.warning(
                        "practice_day_fallback_timeout",
                        track_slug=track_slug,
                        date=check_date.isoformat(),
                    )
                    checked_count += 1
                except EventPageFormatError as e:
                    # No practice sessions for this date or parsing error - skip silently
                    # Check if it's a "no sessions" error vs a real parsing error
                    error_msg = str(e).lower()
                    if "no practice sessions" in error_msg or "no sessions available" in error_msg or "no practice session table found" in error_msg:
                        # Expected - no sessions on this date
                        pass
                    else:
                        # Real parsing error - log it but don't crash
                        logger.warning(
                            "practice_day_parse_error_fallback",
                            track_slug=track_slug,
                            date=check_date.isoformat(),
                            error=str(e),
                        )
                    checked_count += 1
                except (ConnectorHTTPError, Exception) as e:
                    # Other errors - log and continue (including potential segfaults that might manifest as other errors)
                    logger.warning(
                        "practice_day_fallback_check_error",
                        track_slug=track_slug,
                        date=check_date.isoformat(),
                        error=str(e),
                        error_type=type(e).__name__,
                    )
                    checked_count += 1
            
            # Move to next day
            try:
                check_date = check_date + timedelta(days=1)
            except:
                break
    
    success = True
    duration = time.time() - start_time
    
    logger.info(
        "discover_practice_days_success",
        track_slug=track_slug,
        practice_day_count=len(practice_days),
        duration_seconds=duration,
    )
    
    metrics.record_practice_day_discovery(track_slug, duration, success)
    
    return practice_days


async def search_practice_days(
    track_id: UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> List[Event]:
    """
    Search for already-ingested practice days in database.
    
    Practice days are identified by sourceEventId pattern: {track-slug}-practice-{YYYY-MM-DD}
    
    Args:
        track_id: Track UUID
        start_date: Optional start date filter
        end_date: Optional end date filter
    
    Returns:
        List of Event objects representing practice days
    """
    logger.debug(
        "search_practice_days_start",
        track_id=str(track_id),
        start_date=start_date.isoformat() if start_date else None,
        end_date=end_date.isoformat() if end_date else None,
    )
    
    with db_session() as session:
        repo = Repository(session)
        
        # Build query for practice day events
        # Practice days have sourceEventId pattern: {track-slug}-practice-{YYYY-MM-DD}
        stmt = select(Event).where(
            and_(
                Event.track_id == str(track_id),
                Event.source_event_id.like("%-practice-%"),
            )
        )
        
        # Apply date filters if provided
        if start_date:
            stmt = stmt.where(Event.event_date >= start_date)
        if end_date:
            # Add one day to make it inclusive
            end_date_inclusive = end_date + timedelta(days=1)
            stmt = stmt.where(Event.event_date < end_date_inclusive)
        
        stmt = stmt.order_by(Event.event_date.desc())
        
        events = list(session.scalars(stmt).all())
        
        logger.debug(
            "search_practice_days_success",
            track_id=str(track_id),
            event_count=len(events),
        )
        
        return events
