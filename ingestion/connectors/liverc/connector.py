# @fileoverview LiveRC connector implementation
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Main connector interface for LiveRC data extraction
# 
# @purpose Provides the connector interface that orchestrates HTTPX/Playwright
#          clients and parsers to extract structured data from LiveRC pages.

import asyncio
from datetime import date
from typing import List, Optional, Dict

from ingestion.common.logging import get_logger
from ingestion.common import metrics
from ingestion.common.site_policy import SitePolicy
from ingestion.connectors.liverc.client.httpx_client import HTTPXClient
from ingestion.connectors.liverc.client.playwright_client import PlaywrightClient
from ingestion.connectors.liverc.models import (
    ConnectorEventSummary,
    ConnectorRacePackage,
    ConnectorRaceSummary,
    ConnectorLap,
    ConnectorEntryList,
)
from ingestion.connectors.liverc.parsers.track_list_parser import TrackListParser, TrackSummary
from ingestion.connectors.liverc.parsers.event_list_parser import EventListParser, EventSummary
from ingestion.connectors.liverc.parsers.event_metadata_parser import EventMetadataParser
from ingestion.connectors.liverc.parsers.race_list_parser import RaceListParser
from ingestion.connectors.liverc.parsers.race_results_parser import (
    RaceResultsParser,
    parse_race_duration_seconds,
)
from ingestion.connectors.liverc.parsers.race_lap_parser import RaceLapParser
from ingestion.connectors.liverc.parsers.entry_list_parser import EntryListParser
from ingestion.connectors.liverc.parsers.track_dashboard_parser import TrackDashboardParser, TrackDashboardData
from ingestion.connectors.liverc.parsers.practice_day_parser import PracticeDayParser
from ingestion.connectors.liverc.models import (
    PracticeDaySummary,
    PracticeSessionDetail,
)
from ingestion.connectors.liverc.utils import (
    build_event_url,
    build_events_url,
    build_race_url,
    build_entry_list_url,
    normalize_race_url,
    parse_track_slug_from_url,
    build_practice_month_url,
    build_practice_day_url,
    build_practice_session_url,
)
from ingestion.ingestion.errors import (
    ConnectorHTTPError,
    EventPageFormatError,
    RacePageFormatError,
    LapTableMissingError,
)

logger = get_logger(__name__)


class LiveRCConnector:
    """
    LiveRC connector for fetching and parsing race data.
    
    Per specification:
    - Try HTTPX first
    - Fall back to Playwright if dynamic content detected
    - Cache page type classification
    """
    
    def __init__(
        self,
        page_type_cache_size: int = 1000,
        playwright_concurrency: int = 2,
        site_policy: Optional[SitePolicy] = None,
    ):
        """
        Initialize connector.
        
        Args:
            page_type_cache_size: Maximum number of URLs to cache for page type detection.
                                  Default 1000. Set to 0 to disable caching.
        """
        self._page_type_cache: dict[str, bool] = {}  # URL -> requires_playwright
        self._page_type_cache_size = page_type_cache_size
        self._playwright_lock = asyncio.Semaphore(max(playwright_concurrency, 1))
        self._site_policy = site_policy or SitePolicy.shared()

    def _ensure_enabled(self) -> None:
        """Ensure scraping is allowed before issuing any requests."""
        self._site_policy.ensure_enabled("liverc")

    def _record_error(self, stage: str, error: Exception) -> None:
        """Report connector errors to metrics."""
        metrics.record_connector_error(stage, error.__class__.__name__)
    
    def _trim_page_type_cache(self) -> None:
        """
        Trim page type cache if it exceeds the maximum size.
        
        Uses a simple FIFO approach: removes oldest entries when cache is full.
        """
        if self._page_type_cache_size > 0 and len(self._page_type_cache) > self._page_type_cache_size:
            # Remove oldest entries (first N entries)
            excess = len(self._page_type_cache) - self._page_type_cache_size
            keys_to_remove = list(self._page_type_cache.keys())[:excess]
            for key in keys_to_remove:
                del self._page_type_cache[key]
            logger.debug(
                "page_type_cache_trimmed",
                removed=excess,
                remaining=len(self._page_type_cache),
            )
    
    async def list_tracks(self) -> List[TrackSummary]:
        """
        Fetch and parse track catalogue from LiveRC.
        
        Returns:
            List of track summaries
        
        Raises:
            ConnectorHTTPError: On network/HTTP errors
            EventPageFormatError: On parsing errors
        """
        self._ensure_enabled()
        url = "https://live.liverc.com"
        logger.info("list_tracks_start", url=url)
        
        try:
            async with HTTPXClient(self._site_policy) as client:
                response = await client.get(url)
                html = response.text
                
                parser = TrackListParser()
                tracks = parser.parse(html, url)
                
                logger.info("list_tracks_success", url=url, count=len(tracks))
                return tracks
        
        except (ConnectorHTTPError, EventPageFormatError) as err:
            self._record_error("list_tracks", err)
            raise

        except Exception as e:
            self._record_error("list_tracks", e)
            logger.error("list_tracks_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Unexpected error listing tracks: {str(e)}",
                url=url,
            )
    
    async def list_events_for_track(self, track_slug: str) -> List[EventSummary]:
        """
        Fetch and parse events for a track.
        
        Args:
            track_slug: Track subdomain slug
        
        Returns:
            List of event summaries
        
        Raises:
            ConnectorHTTPError: On network/HTTP errors
            EventPageFormatError: On parsing errors
        """
        self._ensure_enabled()
        url = build_events_url(track_slug)
        logger.info("list_events_for_track_start", url=url, track_slug=track_slug)
        
        # Check cache for page type
        requires_playwright = self._page_type_cache.get(url, False)
        
        html = None
        
        # Try HTTPX first (unless we know it requires Playwright)
        if not requires_playwright:
            try:
                async with HTTPXClient(self._site_policy) as client:
                    response = await client.get(url)
                    html = response.text
                    
                    # Try parsing to see if we have valid content
                    parser = EventListParser()
                    try:
                        events = parser.parse(html, url, track_slug)
                        # If we got events, HTTPX worked
                        logger.info("list_events_for_track_success", url=url, count=len(events))
                        return events
                    except EventPageFormatError as parse_error:
                        # Parsing failed - likely needs JavaScript execution
                        logger.debug("events_page_requires_playwright", url=url, error=str(parse_error))
                        requires_playwright = True
                        self._page_type_cache[url] = True
                        self._trim_page_type_cache()
                        html = None
            
            except ConnectorHTTPError as err:
                self._record_error("fetch_race_page", err)
                # If HTTPX fails, try Playwright
                requires_playwright = True
                self._page_type_cache[url] = True
                self._trim_page_type_cache()
        
        # Use Playwright if needed (for DataTables that load via JavaScript)
        if requires_playwright or html is None:
            try:
                async with PlaywrightClient(self._site_policy) as playwright:
                    html = await playwright.fetch_page(
                        url,
                        wait_for_selector="table#events tbody tr",  # Wait for event rows to load
                    )
            except Exception as e:
                logger.error("playwright_fetch_error", url=url, error=str(e))
                raise EventPageFormatError(
                    f"Failed to fetch events page with Playwright: {str(e)}",
                    url=url,
                )
        
        # Parse the HTML (from either HTTPX or Playwright)
        try:
            parser = EventListParser()
            events = parser.parse(html, url, track_slug)
            
            logger.info("list_events_for_track_success", url=url, count=len(events))
            return events
        
        except EventPageFormatError as err:
            self._record_error("list_events_for_track", err)
            raise

        except Exception as e:
            self._record_error("list_events_for_track", e)
            logger.error("list_events_for_track_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Unexpected error listing events: {str(e)}",
                url=url,
            )
    
    def _build_event_url(self, track_slug: str, source_event_id: str) -> str:
        """Build event detail URL."""
        return build_event_url(track_slug, source_event_id)
    
    def _build_race_url(self, race_url: str, track_slug: Optional[str] = None) -> str:
        """
        Build race result URL (may already be full URL).
        
        Args:
            race_url: Race URL (absolute or relative)
            track_slug: Track slug if URL is relative
        
        Returns:
            Full absolute URL
        """
        if race_url.startswith("http"):
            return race_url
        
        # If relative, need track_slug
        if not track_slug:
            # Try to extract from race_url if it contains domain info
            track_slug = parse_track_slug_from_url(race_url)
            if not track_slug:
                raise ValueError(f"Cannot determine track_slug for relative URL: {race_url}")
        
        return normalize_race_url(race_url, track_slug)

    async def _fetch_with_playwright(
        self,
        url: str,
        wait_for_selector: Optional[str] = None,
    ) -> str:
        """Fetch a page using Playwright with concurrency control."""
        async with self._playwright_lock:
            async with PlaywrightClient(self._site_policy) as playwright:
                return await playwright.fetch_page(url, wait_for_selector=wait_for_selector)

    def _parse_event_page(self, html: str, url: str, source_event_id: str) -> ConnectorEventSummary:
        """Parse metadata and race list from event HTML."""
        metadata_parser = EventMetadataParser()
        race_list_parser = RaceListParser()
        metadata = metadata_parser.parse(html, url)
        races = race_list_parser.parse(html, url)
        return ConnectorEventSummary(
            source_event_id=source_event_id,
            event_name=metadata.event_name,
            event_date=metadata.event_date,
            event_entries=metadata.event_entries,
            event_drivers=metadata.event_drivers,
            races=races,
        )
    
    async def fetch_event_page(
        self,
        track_slug: str,
        source_event_id: str,
    ) -> ConnectorEventSummary:
        """
        Fetch and parse event page.
        
        Args:
            track_slug: Track subdomain slug
            source_event_id: Event ID from LiveRC
        
        Returns:
            ConnectorEventSummary with event metadata and race list
        
        Raises:
            ConnectorHTTPError: On network/HTTP errors
            EventPageFormatError: On parsing errors
        """
        self._ensure_enabled()
        url = self._build_event_url(track_slug, source_event_id)
        logger.info("fetch_event_page_start", url=url, track_slug=track_slug, event_id=source_event_id)
        
        requires_playwright = self._page_type_cache.get(url, False)
        html: Optional[str] = None

        if not requires_playwright:
            try:
                async with HTTPXClient(self._site_policy) as client:
                    response = await client.get(url)
                    html = response.text
                    return self._parse_event_page(html, url, source_event_id)
            except ConnectorHTTPError as err:
                self._record_error("fetch_event_page", err)
                requires_playwright = True
                self._page_type_cache[url] = True
                self._trim_page_type_cache()
            except EventPageFormatError as err:
                # HTML likely requires JS execution. Escalate to Playwright.
                requires_playwright = True
                self._page_type_cache[url] = True
                self._trim_page_type_cache()
                self._record_error("fetch_event_page", err)
            except Exception as e:
                self._record_error("fetch_event_page", e)
                logger.error("fetch_event_page_error", url=url, error=str(e))
                raise EventPageFormatError(
                    f"Unexpected error fetching event page: {str(e)}",
                    url=url,
                )

        # Playwright fallback path
        try:
            html = await self._fetch_with_playwright(
                url,
                wait_for_selector="table.entry_list_data",
            )
            return self._parse_event_page(html, url, source_event_id)
        except EventPageFormatError as err:
            self._record_error("fetch_event_page", err)
            raise
        except Exception as e:
            self._record_error("fetch_event_page", e)
            logger.error("fetch_event_page_playwright_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to fetch event page with Playwright: {str(e)}",
                url=url,
            )
    
    async def fetch_race_page(
        self,
        race_summary: ConnectorRaceSummary,
        shared_client: Optional[HTTPXClient] = None,
    ) -> ConnectorRacePackage:
        """
        Fetch and parse race result page with all driver data.
        
        Args:
            race_summary: Race summary with URL and metadata
            shared_client: Optional HTTPXClient instance to reuse (must already be entered as context manager)
        
        Returns:
            ConnectorRacePackage with race summary, results, and lap data
        
        Raises:
            ConnectorHTTPError: On network/HTTP errors
            RacePageFormatError: On parsing errors
        """
        self._ensure_enabled()
        # Extract track_slug from race_url if needed
        track_slug = parse_track_slug_from_url(race_summary.race_url)
        url = self._build_race_url(race_summary.race_url, track_slug)
        logger.info("fetch_race_page_start", url=url, race_id=race_summary.source_race_id)
        
        # Check cache for page type
        requires_playwright = self._page_type_cache.get(url, False)
        
        html = None
        fetch_method = "httpx"
        
        # Try HTTPX first (unless we know it requires Playwright)
        if not requires_playwright:
            try:
                # Use shared client if provided, otherwise create new one
                if shared_client is not None:
                    response = await shared_client.get(url)
                    html = response.text
                else:
                    async with HTTPXClient(self._site_policy) as client:
                        response = await client.get(url)
                        html = response.text
                
                # Check if we have the required content
                # If not, mark as requiring Playwright and retry
                if html and ("racerLaps" not in html or "table" not in html.lower()):
                    logger.debug("race_page_requires_playwright", url=url)
                    requires_playwright = True
                    self._page_type_cache[url] = True
                    self._trim_page_type_cache()
                    html = None
            
            except ConnectorHTTPError:
                # If HTTPX fails, try Playwright
                requires_playwright = True
                self._page_type_cache[url] = True
                self._trim_page_type_cache()
        
        # Use Playwright if needed
        if requires_playwright or html is None:
            try:
                html = await self._fetch_with_playwright(
                    url,
                    wait_for_selector="table.table-striped",
                )
                fetch_method = "playwright"
            except Exception as e:
                self._record_error("fetch_race_page", e)
                logger.error("playwright_fetch_error", url=url, error=str(e))
                raise RacePageFormatError(
                    f"Failed to fetch race page with Playwright: {str(e)}",
                    url=url,
                    race_id=race_summary.source_race_id,
                )
        
        # Parse results and lap data
        try:
            results_parser = RaceResultsParser()
            lap_parser = RaceLapParser()

            results = results_parser.parse(html, url)
            all_laps = lap_parser.parse_all_drivers(html, url)

            # Parse race duration from page (e.g. "Length: 30:00 Timed") and enrich race_summary
            duration_seconds = parse_race_duration_seconds(html)
            if duration_seconds is not None:
                race_summary = race_summary.model_copy(update={"duration_seconds": duration_seconds})

            return ConnectorRacePackage(
                race_summary=race_summary,
                results=results,
                laps_by_driver=all_laps,
                fetch_method=fetch_method,
            )
        
        except (RacePageFormatError, LapTableMissingError) as err:
            self._record_error("fetch_race_page", err)
            raise
        
        except Exception as e:
            self._record_error("fetch_race_page", e)
            logger.error("parse_race_page_error", url=url, error=str(e))
            raise RacePageFormatError(
                f"Failed to parse race page: {str(e)}",
                url=url,
                race_id=race_summary.source_race_id,
            )
    
    async def fetch_lap_series(
        self,
        race_summary: ConnectorRaceSummary,
        source_driver_id: str,
    ) -> List[ConnectorLap]:
        """
        Fetch lap series for a specific driver.
        
        Note: In V1, this SHOULD NOT be called directly by ingestion layer.
        The pipeline will rely on fetch_race_page, which handles all drivers.
        
        Args:
            race_summary: Race summary with URL
            source_driver_id: Driver ID to extract laps for
        
        Returns:
            List of lap data for the driver
        
        Raises:
            ConnectorHTTPError: On network/HTTP errors
            LapTableMissingError: If lap data cannot be found
        """
        # Extract track_slug from race_url if needed
        track_slug = parse_track_slug_from_url(race_summary.race_url)
        url = self._build_race_url(race_summary.race_url, track_slug)
        logger.debug("fetch_lap_series_start", url=url, driver_id=source_driver_id)
        
        # Fetch page (same logic as fetch_race_page)
        requires_playwright = self._page_type_cache.get(url, False)
        html = None
        
        if not requires_playwright:
            try:
                async with HTTPXClient(self._site_policy) as client:
                    response = await client.get(url)
                    html = response.text
                    if "racerLaps" not in html:
                        requires_playwright = True
                        html = None
            except ConnectorHTTPError as err:
                self._record_error("fetch_lap_series", err)
                requires_playwright = True
        
        if requires_playwright or html is None:
            html = await self._fetch_with_playwright(url)

        # Parse lap data for this driver
        lap_parser = RaceLapParser()
        try:
            return lap_parser.parse(html, url, source_driver_id)
        except Exception as err:
            self._record_error("fetch_lap_series", err)
            raise
    
    async def fetch_entry_list(
        self,
        track_slug: str,
        source_event_id: str,
    ) -> ConnectorEntryList:
        """
        Fetch and parse entry list page.
        
        Args:
            track_slug: Track subdomain slug
            source_event_id: Event ID from LiveRC
        
        Returns:
            ConnectorEntryList with all entries grouped by class
        
        Raises:
            ConnectorHTTPError: On network errors
            EventPageFormatError: On parsing errors
        """
        self._ensure_enabled()
        url = build_entry_list_url(track_slug, source_event_id)
        logger.info("fetch_entry_list_start", url=url, track_slug=track_slug, event_id=source_event_id)
        
        # Check cache for page type
        requires_playwright = self._page_type_cache.get(url, False)
        html: Optional[str] = None
        
        # Try HTTPX first (unless we know it requires Playwright)
        if not requires_playwright:
            try:
                async with HTTPXClient(self._site_policy) as client:
                    response = await client.get(url)
                    html = response.text
                    
                    # Try parsing to see if we have valid content
                    parser = EntryListParser()
                    try:
                        entry_list = parser.parse(html, url, source_event_id)
                        # If we got an entry list, HTTPX worked
                        logger.info("fetch_entry_list_success", url=url, class_count=len(entry_list.entries_by_class))
                        return entry_list
                    except EventPageFormatError as parse_error:
                        # Parsing failed - likely needs JavaScript execution
                        logger.debug("entry_list_page_requires_playwright", url=url, error=str(parse_error))
                        requires_playwright = True
                        self._page_type_cache[url] = True
                        self._trim_page_type_cache()
                        html = None
            
            except ConnectorHTTPError as err:
                self._record_error("fetch_entry_list", err)
                # If HTTPX fails, try Playwright
                requires_playwright = True
                self._page_type_cache[url] = True
                self._trim_page_type_cache()
        
        # Use Playwright if needed (for dynamic content)
        if requires_playwright or html is None:
            try:
                html = await self._fetch_with_playwright(
                    url,
                    wait_for_selector="div.tab-pane table.table-striped",  # Wait for tab content and entry tables to load
                )
            except Exception as e:
                logger.error("playwright_fetch_error", url=url, error=str(e))
                raise EventPageFormatError(
                    f"Failed to fetch entry list page with Playwright: {str(e)}",
                    url=url,
                )
        
        # Parse the HTML (from either HTTPX or Playwright)
        try:
            parser = EntryListParser()
            entry_list = parser.parse(html, url, source_event_id)
            
            logger.info("fetch_entry_list_success", url=url, class_count=len(entry_list.entries_by_class))
            return entry_list
        
        except EventPageFormatError as err:
            self._record_error("fetch_entry_list", err)
            raise
        
        except Exception as e:
            self._record_error("fetch_entry_list", e)
            logger.error("fetch_entry_list_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Unexpected error fetching entry list: {str(e)}",
                url=url,
            )
    
    async def fetch_track_dashboard(self, track_slug: str) -> str:
        """
        Fetch track dashboard page HTML.
        
        Args:
            track_slug: Track subdomain slug
        
        Returns:
            HTML content from dashboard page
        
        Raises:
            ConnectorHTTPError: On network/HTTP errors
        """
        self._ensure_enabled()
        url = f"https://{track_slug}.liverc.com/"
        logger.debug("fetch_track_dashboard_start", url=url, track_slug=track_slug)
        
        try:
            async with HTTPXClient(self._site_policy) as client:
                response = await client.get(url)
                html = response.text
                
                logger.debug("fetch_track_dashboard_success", url=url)
                return html
        
        except ConnectorHTTPError as err:
            self._record_error("fetch_track_dashboard", err)
            raise
        
        except Exception as e:
            self._record_error("fetch_track_dashboard", e)
            logger.error("fetch_track_dashboard_error", url=url, error=str(e))
            raise ConnectorHTTPError(
                f"Failed to fetch track dashboard: {str(e)}",
                url=url,
            )
    
    async def fetch_track_metadata(self, track_slug: str) -> Optional[TrackDashboardData]:
        """
        Fetch and parse track dashboard metadata.
        
        Args:
            track_slug: Track subdomain slug
        
        Returns:
            TrackDashboardData with extracted metadata, or None if fetch/parse fails
        """
        self._ensure_enabled()
        url = f"https://{track_slug}.liverc.com/"
        logger.debug("fetch_track_metadata_start", url=url, track_slug=track_slug)
        
        try:
            html = await self.fetch_track_dashboard(track_slug)
            parser = TrackDashboardParser()
            metadata = parser.parse(html, url)
            
            logger.debug("fetch_track_metadata_success", url=url)
            return metadata
        
        except Exception as e:
            # Log error but don't fail - graceful degradation
            logger.warning("fetch_track_metadata_error", url=url, track_slug=track_slug, error=str(e))
            return None
    
    async def fetch_practice_month_view(
        self,
        track_slug: str,
        year: int,
        month: int,
    ) -> List[date]:
        """
        Fetch and parse practice month view to get list of dates with practice days.
        
        Args:
            track_slug: Track subdomain slug
            year: Year (e.g., 2025)
            month: Month (1-12)
        
        Returns:
            List of date objects for dates that have practice days
        
        Raises:
            EventPageFormatError: If page structure is unexpected
        """
        self._ensure_enabled()
        url = build_practice_month_url(track_slug, year, month)
        logger.debug("fetch_practice_month_view_start", url=url, track_slug=track_slug, year=year, month=month)
        
        try:
            # Try HTTPX first
            async with HTTPXClient(self._site_policy) as client:
                response = await client.get(url)
                html = response.text
                
                parser = PracticeDayParser()
                dates = parser.parse_practice_month_view(html, track_slug, year, month)
                
                logger.info("fetch_practice_month_view_success", url=url, date_count=len(dates))
                return dates
        
        except EventPageFormatError as err:
            self._record_error("fetch_practice_month_view", err)
            raise
        
        except ConnectorHTTPError as err:
            self._record_error("fetch_practice_month_view", err)
            raise
        
        except Exception as e:
            self._record_error("fetch_practice_month_view", e)
            logger.error("fetch_practice_month_view_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to fetch practice month view: {str(e)}",
                url=url,
            )
    
    async def fetch_practice_day_overview(
        self,
        track_slug: str,
        practice_date: date,
    ) -> PracticeDaySummary:
        """
        Fetch and parse practice day overview page.
        
        Args:
            track_slug: Track subdomain slug
            practice_date: Date of practice day
        
        Returns:
            PracticeDaySummary object
        
        Raises:
            EventPageFormatError: If page structure is unexpected
        """
        self._ensure_enabled()
        url = build_practice_day_url(track_slug, practice_date)
        logger.debug("fetch_practice_day_overview_start", url=url, track_slug=track_slug, date=practice_date)
        
        try:
            # Try HTTPX first
            async with HTTPXClient(self._site_policy) as client:
                response = await client.get(url)
                html = response.text
                
                parser = PracticeDayParser()
                summary = parser.parse_practice_day_overview(html, track_slug, practice_date)
                
                logger.info("fetch_practice_day_overview_success", url=url, session_count=summary.session_count)
                return summary
        
        except EventPageFormatError as err:
            self._record_error("fetch_practice_day_overview", err)
            raise
        
        except ConnectorHTTPError as err:
            self._record_error("fetch_practice_day_overview", err)
            raise
        
        except Exception as e:
            self._record_error("fetch_practice_day_overview", e)
            logger.error("fetch_practice_day_overview_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to fetch practice day overview: {str(e)}",
                url=url,
            )
    
    async def fetch_practice_session_detail(
        self,
        track_slug: str,
        session_id: str,
    ) -> PracticeSessionDetail:
        """
        Fetch and parse individual practice session detail page.
        
        Args:
            track_slug: Track subdomain slug
            session_id: Practice session ID
        
        Returns:
            PracticeSessionDetail object
        
        Raises:
            EventPageFormatError: If page structure is unexpected
        """
        self._ensure_enabled()
        url = build_practice_session_url(track_slug, session_id)
        logger.debug("fetch_practice_session_detail_start", url=url, session_id=session_id)
        
        try:
            # Try HTTPX first
            async with HTTPXClient(self._site_policy) as client:
                response = await client.get(url)
                html = response.text
                
                parser = PracticeDayParser()
                detail = parser.parse_practice_session_detail(html, session_id)
                
                logger.info("fetch_practice_session_detail_success", url=url, session_id=session_id)
                return detail
        
        except EventPageFormatError as err:
            self._record_error("fetch_practice_session_detail", err)
            raise
        
        except ConnectorHTTPError as err:
            self._record_error("fetch_practice_session_detail", err)
            raise
        
        except Exception as e:
            self._record_error("fetch_practice_session_detail", e)
            logger.error("fetch_practice_session_detail_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to fetch practice session detail: {str(e)}",
                url=url,
            )
