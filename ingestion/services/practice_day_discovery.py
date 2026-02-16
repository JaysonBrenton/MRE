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
from typing import Dict, List, Optional, Tuple
from uuid import UUID

import os
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

# Short-lived cache for discovered practice days per (track_slug, year, month)
# TTL in seconds (default 10 minutes); set PRACTICE_DISCOVER_CACHE_TTL_SECONDS to override.
_PRACTICE_DISCOVER_CACHE: Dict[Tuple[str, int, int], Tuple[List[PracticeDaySummary], float]] = {}
_PRACTICE_DISCOVER_CACHE_TTL = max(0, int(os.getenv("PRACTICE_DISCOVER_CACHE_TTL_SECONDS", "600")))

# Timeouts so one slow request doesn't dominate (seconds)
_PRACTICE_MONTH_VIEW_TIMEOUT = float(os.getenv("PRACTICE_DISCOVER_MONTH_VIEW_TIMEOUT_SECONDS", "15"))
_PRACTICE_DAY_OVERVIEW_TIMEOUT = float(os.getenv("PRACTICE_DISCOVER_DAY_OVERVIEW_TIMEOUT_SECONDS", "25"))


def _get_cached_practice_days(track_slug: str, year: int, month: int) -> Optional[List[PracticeDaySummary]]:
    key = (track_slug, year, month)
    entry = _PRACTICE_DISCOVER_CACHE.get(key)
    if not entry:
        return None
    results, expiry = entry
    if time.time() > expiry:
        del _PRACTICE_DISCOVER_CACHE[key]
        return None
    return results


def _set_cached_practice_days(
    track_slug: str, year: int, month: int, practice_days: List[PracticeDaySummary]
) -> None:
    key = (track_slug, year, month)
    _PRACTICE_DISCOVER_CACHE[key] = (practice_days, time.time() + _PRACTICE_DISCOVER_CACHE_TTL)


def get_cached_practice_days(
    track_slug: str, year: int, month: int, start_date: date, end_date: date
) -> Optional[List[PracticeDaySummary]]:
    """
    Return cached practice days for (track_slug, year, month) if valid and in range.
    Used by the API route to return immediately on cache hit without calling discover_practice_days.
    """
    cached = _get_cached_practice_days(track_slug, year, month)
    if cached is None:
        return None
    in_range = [s for s in cached if start_date <= s.date <= end_date]
    return in_range


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
            # Check cache first (per month)
            cached = _get_cached_practice_days(track_slug, year, month)
            if cached is not None:
                in_range = [s for s in cached if start_date <= s.date <= end_date]
                practice_days.extend(in_range)
                if in_range:
                    month_view_working = True
            else:
                # Fetch practice month view (with timeout so one slow month doesn't block)
                try:
                    dates_with_practice = await asyncio.wait_for(
                        connector.fetch_practice_month_view(
                            track_slug=track_slug,
                            year=year,
                            month=month,
                        ),
                        timeout=_PRACTICE_MONTH_VIEW_TIMEOUT,
                    )
                except asyncio.TimeoutError:
                    logger.warning(
                        "practice_month_view_timeout",
                        track_slug=track_slug,
                        year=year,
                        month=month,
                        timeout_seconds=_PRACTICE_MONTH_VIEW_TIMEOUT,
                    )
                    dates_with_practice = []

                if len(dates_with_practice) > 0:
                    month_view_working = True

                # Filter dates within range and fetch day overviews in parallel (bounded concurrency + per-day timeout)
                dates_in_range = [d for d in dates_with_practice if start_date <= d <= end_date]
                month_summaries: List[PracticeDaySummary] = []
                if dates_in_range:
                    semaphore = asyncio.Semaphore(10)

                    async def fetch_one(practice_date: date) -> Optional[PracticeDaySummary]:
                        try:
                            async with semaphore:
                                return await asyncio.wait_for(
                                    connector.fetch_practice_day_overview(
                                        track_slug=track_slug,
                                        practice_date=practice_date,
                                    ),
                                    timeout=_PRACTICE_DAY_OVERVIEW_TIMEOUT,
                                )
                        except asyncio.TimeoutError:
                            logger.warning(
                                "practice_day_overview_timeout",
                                track_slug=track_slug,
                                date=practice_date.isoformat(),
                                timeout_seconds=_PRACTICE_DAY_OVERVIEW_TIMEOUT,
                            )
                            return None
                        except Exception as e:
                            logger.warning(
                                "practice_day_overview_fetch_error",
                                track_slug=track_slug,
                                date=practice_date.isoformat(),
                                error=str(e),
                            )
                            return None

                    results = await asyncio.gather(
                        *(fetch_one(d) for d in dates_in_range),
                        return_exceptions=False,
                    )
                    for summary in results:
                        if summary is not None:
                            month_summaries.append(summary)
                            practice_days.append(summary)

                _set_cached_practice_days(track_slug, year, month, month_summaries)
        
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
            message="Month view returned no dates, probing dates directly",
        )

        max_checks = 30  # Limit to avoid too many requests and timeouts
        candidate_dates: List[date] = []
        added: set[date] = set()

        check_date = start_date
        while check_date <= end_date and len(candidate_dates) < max_checks:
            if check_date.weekday() in [5, 6]:  # Weekend
                candidate_dates.append(check_date)
                added.add(check_date)
            check_date += timedelta(days=1)

        # Add a handful of weekdays if we still have capacity
        check_date = start_date
        while check_date <= end_date and len(candidate_dates) < max_checks:
            if check_date.weekday() in [1, 3] and check_date not in added:  # Tuesday/Thursday
                candidate_dates.append(check_date)
                added.add(check_date)
            check_date += timedelta(days=1)

        semaphore = asyncio.Semaphore(4)

        async def _probe_date(practice_date: date) -> None:
            try:
                async with semaphore:
                    summary = await asyncio.wait_for(
                        connector.fetch_practice_day_overview(
                            track_slug=track_slug,
                            practice_date=practice_date,
                        ),
                        timeout=8.0,
                    )
            except asyncio.TimeoutError:
                logger.warning(
                    "practice_day_fallback_timeout",
                    track_slug=track_slug,
                    date=practice_date.isoformat(),
                )
                return
            except EventPageFormatError as e:
                error_msg = str(e).lower()
                if not (
                    "no practice sessions" in error_msg
                    or "no sessions available" in error_msg
                    or "no practice session table found" in error_msg
                ):
                    logger.warning(
                        "practice_day_parse_error_fallback",
                        track_slug=track_slug,
                        date=practice_date.isoformat(),
                        error=str(e),
                    )
                return
            except (ConnectorHTTPError, Exception) as e:
                logger.warning(
                    "practice_day_fallback_check_error",
                    track_slug=track_slug,
                    date=practice_date.isoformat(),
                    error=str(e),
                    error_type=type(e).__name__,
                )
                return

            if summary.session_count > 0:
                practice_days.append(summary)
                logger.info(
                    "practice_day_found_via_fallback",
                    track_slug=track_slug,
                    date=practice_date.isoformat(),
                    session_count=summary.session_count,
                )

        await asyncio.gather(*(_probe_date(practice_date) for practice_date in candidate_dates))
    
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
