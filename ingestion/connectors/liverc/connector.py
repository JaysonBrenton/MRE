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

from typing import List, Optional

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.client.httpx_client import HTTPXClient
from ingestion.connectors.liverc.client.playwright_client import PlaywrightClient
from ingestion.connectors.liverc.models import (
    ConnectorEventSummary,
    ConnectorRacePackage,
    ConnectorRaceSummary,
    ConnectorLap,
)
from ingestion.connectors.liverc.parsers.track_list_parser import TrackListParser, TrackSummary
from ingestion.connectors.liverc.parsers.event_list_parser import EventListParser, EventSummary
from ingestion.connectors.liverc.parsers.event_metadata_parser import EventMetadataParser
from ingestion.connectors.liverc.parsers.race_list_parser import RaceListParser
from ingestion.connectors.liverc.parsers.race_results_parser import RaceResultsParser
from ingestion.connectors.liverc.parsers.race_lap_parser import RaceLapParser
from ingestion.connectors.liverc.utils import (
    build_event_url,
    build_events_url,
    build_race_url,
    normalize_race_url,
    parse_track_slug_from_url,
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
    
    def __init__(self, page_type_cache_size: int = 1000):
        """
        Initialize connector.
        
        Args:
            page_type_cache_size: Maximum number of URLs to cache for page type detection.
                                  Default 1000. Set to 0 to disable caching.
        """
        self._page_type_cache: dict[str, bool] = {}  # URL -> requires_playwright
        self._page_type_cache_size = page_type_cache_size
    
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
        url = "https://live.liverc.com"
        logger.info("list_tracks_start", url=url)
        
        try:
            async with HTTPXClient() as client:
                response = await client.get(url)
                html = response.text
                
                parser = TrackListParser()
                tracks = parser.parse(html, url)
                
                logger.info("list_tracks_success", url=url, count=len(tracks))
                return tracks
        
        except (ConnectorHTTPError, EventPageFormatError):
            raise
        
        except Exception as e:
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
        url = build_events_url(track_slug)
        logger.info("list_events_for_track_start", url=url, track_slug=track_slug)
        
        # Check cache for page type
        requires_playwright = self._page_type_cache.get(url, False)
        
        html = None
        
        # Try HTTPX first (unless we know it requires Playwright)
        if not requires_playwright:
            try:
                async with HTTPXClient() as client:
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
            
            except ConnectorHTTPError:
                # If HTTPX fails, try Playwright
                requires_playwright = True
                self._page_type_cache[url] = True
                self._trim_page_type_cache()
        
        # Use Playwright if needed (for DataTables that load via JavaScript)
        if requires_playwright or html is None:
            try:
                async with PlaywrightClient() as playwright:
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
        
        except EventPageFormatError:
            raise
        
        except Exception as e:
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
        url = self._build_event_url(track_slug, source_event_id)
        logger.info("fetch_event_page_start", url=url, track_slug=track_slug, event_id=source_event_id)
        
        # Try HTTPX first
        try:
            async with HTTPXClient() as client:
                response = await client.get(url)
                html = response.text
                
                # Parse event metadata and race list
                metadata_parser = EventMetadataParser()
                race_list_parser = RaceListParser()
                
                # For now, parsers will raise errors indicating they need implementation
                # Once implemented, this will work correctly
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
        
        except (ConnectorHTTPError, EventPageFormatError):
            raise
        
        except Exception as e:
            logger.error("fetch_event_page_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Unexpected error fetching event page: {str(e)}",
                url=url,
            )
    
    async def fetch_race_page(
        self,
        race_summary: ConnectorRaceSummary,
    ) -> ConnectorRacePackage:
        """
        Fetch and parse race result page with all driver data.
        
        Args:
            race_summary: Race summary with URL and metadata
        
        Returns:
            ConnectorRacePackage with race summary, results, and lap data
        
        Raises:
            ConnectorHTTPError: On network/HTTP errors
            RacePageFormatError: On parsing errors
        """
        # Extract track_slug from race_url if needed
        track_slug = parse_track_slug_from_url(race_summary.race_url)
        url = self._build_race_url(race_summary.race_url, track_slug)
        logger.info("fetch_race_page_start", url=url, race_id=race_summary.source_race_id)
        
        # Check cache for page type
        requires_playwright = self._page_type_cache.get(url, False)
        
        html = None
        
        # Try HTTPX first (unless we know it requires Playwright)
        if not requires_playwright:
            try:
                async with HTTPXClient() as client:
                    response = await client.get(url)
                    html = response.text
                    
                    # Check if we have the required content
                    # If not, mark as requiring Playwright and retry
                    if "racerLaps" not in html or "table" not in html.lower():
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
                async with PlaywrightClient() as playwright:
                    html = await playwright.fetch_page(
                        url,
                        wait_for_selector="table.table-striped",  # Common LiveRC table selector
                    )
            except Exception as e:
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
            
            return ConnectorRacePackage(
                race_summary=race_summary,
                results=results,
                laps_by_driver=all_laps,
            )
        
        except (RacePageFormatError, LapTableMissingError):
            raise
        
        except Exception as e:
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
                async with HTTPXClient() as client:
                    response = await client.get(url)
                    html = response.text
                    if "racerLaps" not in html:
                        requires_playwright = True
                        html = None
            except ConnectorHTTPError:
                requires_playwright = True
        
        if requires_playwright or html is None:
            async with PlaywrightClient() as playwright:
                html = await playwright.fetch_page(url)
        
        # Parse lap data for this driver
        lap_parser = RaceLapParser()
        return lap_parser.parse(html, url, source_driver_id)

