# @fileoverview Track list parser for LiveRC
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Parser for live.liverc.com track catalogue
# 
# @purpose Extracts track list from LiveRC global track index page

from typing import List
from selectolax.parser import HTMLParser

from ingestion.common.logging import get_logger
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


class TrackSummary:
    """Track summary from track list."""
    def __init__(
        self,
        source: str,
        source_track_slug: str,
        track_name: str,
        track_url: str,
        events_url: str,
        liverc_track_last_updated: str,
    ):
        self.source = source
        self.source_track_slug = source_track_slug
        self.track_name = track_name
        self.track_url = track_url
        self.events_url = events_url
        self.liverc_track_last_updated = liverc_track_last_updated


class TrackListParser:
    """Parser for LiveRC track catalogue page."""
    
    def parse(self, html: str, url: str) -> List[TrackSummary]:
        """
        Parse track list from HTML.
        
        CSS Selectors:
        - Track rows: table.track_list tbody tr.clickable-row
        - Track link: td a[href] (format: //{slug}.liverc.com/)
        - Track name: td a strong
        - Last updated: td:first-child small small
        
        Args:
            html: HTML content from live.liverc.com
            url: Source URL for error reporting
        
        Returns:
            List of track summaries
        
        Raises:
            EventPageFormatError: If page structure is unexpected
        """
        logger.debug("parse_track_list_start", url=url)
        
        try:
            tree = HTMLParser(html)
            tracks = []
            
            # Find all track rows
            track_rows = tree.css("table.track_list tbody tr.clickable-row")
            
            if not track_rows:
                raise EventPageFormatError(
                    "No track rows found in track list table",
                    url=url,
                )
            
            for row in track_rows:
                try:
                    # Extract track link
                    track_link_elem = row.css_first("td a[href]")
                    if not track_link_elem:
                        logger.warning("track_row_missing_link", url=url)
                        continue
                    
                    track_href = track_link_elem.attributes.get("href", "")
                    if not track_href:
                        logger.warning("track_row_empty_href", url=url)
                        continue
                    
                    # Extract track slug from URL (format: //{slug}.liverc.com/)
                    # Handle both //{slug}.liverc.com/ and https://{slug}.liverc.com/
                    track_slug = None
                    if track_href.startswith("//"):
                        # Format: //{slug}.liverc.com/
                        parts = track_href.replace("//", "").split(".")
                        if parts:
                            track_slug = parts[0]
                    elif "liverc.com" in track_href:
                        # Format: https://{slug}.liverc.com/
                        from urllib.parse import urlparse
                        parsed = urlparse(track_href if track_href.startswith("http") else f"https:{track_href}")
                        hostname = parsed.hostname or ""
                        if hostname:
                            parts = hostname.split(".")
                            if parts:
                                track_slug = parts[0]
                    
                    if not track_slug:
                        logger.warning("track_row_invalid_slug", href=track_href, url=url)
                        continue
                    
                    # Extract track name
                    track_name_elem = row.css_first("td a strong")
                    if not track_name_elem:
                        logger.warning("track_row_missing_name", slug=track_slug, url=url)
                        continue
                    
                    track_name = track_name_elem.text().strip()
                    if not track_name:
                        logger.warning("track_row_empty_name", slug=track_slug, url=url)
                        continue
                    
                    # Extract last updated
                    last_updated_elem = row.css_first("td:first-child small small")
                    last_updated = ""
                    if last_updated_elem:
                        last_updated = last_updated_elem.text().strip()
                    
                    # Build URLs
                    track_url = f"https://{track_slug}.liverc.com/"
                    events_url = f"https://{track_slug}.liverc.com/events"
                    
                    track = TrackSummary(
                        source="liverc",
                        source_track_slug=track_slug,
                        track_name=track_name,
                        track_url=track_url,
                        events_url=events_url,
                        liverc_track_last_updated=last_updated,
                    )
                    tracks.append(track)
                    
                except Exception as e:
                    logger.warning("track_row_parse_error", error=str(e), url=url)
                    continue
            
            if not tracks:
                raise EventPageFormatError(
                    "No valid tracks extracted from track list",
                    url=url,
                )
            
            logger.debug("parse_track_list_success", track_count=len(tracks), url=url)
            return tracks
        
        except EventPageFormatError:
            raise
        
        except Exception as e:
            logger.error("parse_track_list_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to parse track list: {str(e)}",
                url=url,
            )

