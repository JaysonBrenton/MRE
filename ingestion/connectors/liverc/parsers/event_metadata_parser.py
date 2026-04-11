# @fileoverview Event metadata parser for LiveRC
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Parser for event detail page metadata
# 
# @purpose Extracts high-level event metadata from event detail page

import re
from datetime import datetime
from typing import Optional

from selectolax.parser import HTMLParser

from ingestion.common.logging import get_logger
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


def _normalize_header_text_from_element(elem) -> str:
    """Strip leading icon span text from a LiveRC page-header element."""
    text = elem.text().strip()
    for span in elem.css("span"):
        span_text = span.text()
        if span_text:
            text = text.replace(span_text, "", 1)
    return text.strip()


def _token_set(s: str) -> set[str]:
    """Alphanumeric tokens of length >= 2 for overlap heuristics."""
    return {t.lower() for t in re.findall(r"[A-Za-z0-9]+", s) if len(t) >= 2}


def _year_tokens(s: str) -> set[str]:
    return set(re.findall(r"\b(?:19|20)\d{2}\b", s))


def pick_canonical_event_name(h1_text: str, h3_text: str) -> str:
    """
    Choose the display name from LiveRC breadcrumb headers.

    LiveRC uses two layouts:
    - Club/track page: h1 is the venue/club; h3 is the specific meet name (use h3).
    - Series page: h1 is the primary series title; h3 may be a dated round label
      that disagrees with h1 on year (use h1).

    When h1 and h3 share most tokens but list different years, prefer h1.
    When they describe different events (low token overlap), prefer h3.
    """
    h1n = (h1_text or "").strip()
    h3n = (h3_text or "").strip()
    if not h3n:
        return h1n
    if not h1n:
        return h3n
    if h1n.lower() == h3n.lower():
        return h1n

    t1 = _token_set(h1n)
    t3 = _token_set(h3n)
    if not t1 or not t3:
        return h3n

    overlap = len(t1 & t3)
    smaller = min(len(t1), len(t3))
    ratio = overlap / smaller if smaller else 0.0
    if ratio < 0.5:
        return h3n

    years_h1 = _year_tokens(h1n)
    years_h3 = _year_tokens(h3n)
    year_mismatch = bool(years_h1 and years_h3 and years_h1 != years_h3)
    if year_mismatch:
        return h1n
    return h3n


class EventMetadata:
    """Event metadata from detail page."""
    def __init__(
        self,
        source_event_id: str,
        event_name: str,
        event_date: datetime,
        event_entries: int,
        event_drivers: int,
        event_date_end: Optional[datetime] = None,
        total_race_laps: Optional[int] = None,
    ):
        self.source_event_id = source_event_id
        self.event_name = event_name
        self.event_date = event_date
        self.event_entries = event_entries
        self.event_drivers = event_drivers
        self.event_date_end = event_date_end
        self.total_race_laps = total_race_laps


class EventMetadataParser:
    """Parser for LiveRC event detail page."""
    
    def parse(self, html: str, url: str) -> EventMetadata:
        """
        Parse event metadata from HTML.
        
        CSS Selectors:
        - Event name: h1.page-header and h3.page-header (see pick_canonical_event_name)
        - Event date: h5.page-header (text after icon, format: "Nov 16, 2025")
        - Event ID: Extract from URL ?p=view_event&id={id}
        - Entries: table.table-sm tbody tr containing "Entries: {number}"
        - Drivers: table.table-sm tbody tr containing "Drivers: {number}"
        
        HTML Structure:
        Event name and date are in page header elements with Font Awesome icons.
        Event stats are in a card with a table containing entries and drivers
        in the same cell, separated by <br /> tags.
        
        Example:
        <h3 class="page-header">
          <span class="fa fa-list-ol"></span> Event Name
        </h3>
        <h5 class="page-header">
          <span class="fa fa-calendar"></span> Nov 16, 2025
        </h5>
        <table class="table table-sm">
          <tr>
            <td>Entries: 71<br />Drivers: 60</td>
          </tr>
        </table>
        
        Args:
            html: HTML content from event detail page
            url: Source URL for error reporting
        
        Returns:
            Event metadata
        
        Raises:
            EventPageFormatError: If page structure is unexpected
        """
        logger.debug("parse_event_metadata_start", url=url)
        
        try:
            tree = HTMLParser(html)
            
            # Extract event ID from URL
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(url)
            query_params = parse_qs(parsed.query)
            event_id = query_params.get("id", [None])[0]
            
            if not event_id:
                raise EventPageFormatError(
                    f"Could not extract event ID from URL: {url}",
                    url=url,
                )
            
            # Event title: LiveRC puts either the club (h1) + meet (h3) or series (h1) + round (h3).
            h1_elem = tree.css_first("h1.page-header")
            h3_elem = tree.css_first("h3.page-header")
            h1_text = _normalize_header_text_from_element(h1_elem) if h1_elem else ""
            h3_text = _normalize_header_text_from_element(h3_elem) if h3_elem else ""
            event_name = pick_canonical_event_name(h1_text, h3_text)
            if not event_name:
                raise EventPageFormatError(
                    "Event name header (h1.page-header / h3.page-header) not found or empty",
                    url=url,
                )
            
            # Extract event date from h5.page-header
            event_date_elem = tree.css_first("h5.page-header")
            event_date = None
            event_date_end = None
            if event_date_elem:
                date_text = event_date_elem.text().strip()
                # Remove icon text if present
                spans = event_date_elem.css("span")
                if spans:
                    for span in spans:
                        span_text = span.text()
                        if span_text:
                            date_text = date_text.replace(span_text, "", 1)
                
                date_text = date_text.strip()
                if date_text:
                    try:
                        # Handle date ranges like "Mar 5, 2026 to Mar 8, 2026" or "Nov 6, 2024 to Nov 9, 2024"
                        if " to " in date_text.lower():
                            parts = date_text.split(" to ", 1)
                            start_text = parts[0].strip()
                            end_text = parts[1].strip() if len(parts) > 1 else None
                            event_date = datetime.strptime(start_text, "%b %d, %Y")
                            if end_text:
                                try:
                                    event_date_end = datetime.strptime(end_text, "%b %d, %Y")
                                except ValueError:
                                    logger.warning("event_date_end_parse_error", end_text=end_text, event_id=event_id, url=url)
                        else:
                            # Single date: "Nov 16, 2025"
                            event_date = datetime.strptime(date_text, "%b %d, %Y")
                    except ValueError as e:
                        logger.warning("event_date_parse_error", date_text=date_text, event_id=event_id, url=url)
            
            if not event_date:
                raise EventPageFormatError(
                    "Could not parse event date",
                    url=url,
                )
            
            # Extract entries, drivers, and total race laps from Event Stats table
            entries = 0
            drivers = 0
            total_race_laps = None
            
            stats_rows = tree.css("table.table-sm tbody tr")
            for row in stats_rows:
                row_text = row.text()
                # Entries and Drivers are in the same cell, separated by <br />
                if "Entries:" in row_text and "Drivers:" in row_text:
                    entries_match = re.search(r"Entries:\s*(\d+)", row_text)
                    drivers_match = re.search(r"Drivers:\s*(\d+)", row_text)
                    
                    if entries_match:
                        try:
                            entries = int(entries_match.group(1))
                        except ValueError:
                            logger.warning("event_entries_parse_error", row_text=row_text, event_id=event_id, url=url)
                    
                    if drivers_match:
                        try:
                            drivers = int(drivers_match.group(1))
                        except ValueError:
                            logger.warning("event_drivers_parse_error", row_text=row_text, event_id=event_id, url=url)
                
                # Total Race Laps in separate row: <th>Total Race Laps</th><td>4,129</td>
                th_elem = row.css_first("th")
                if th_elem and "total race laps" in (th_elem.text() or "").lower():
                    td = row.css_first("td")
                    if td:
                        laps_text = td.text().strip().replace(",", "")
                        if laps_text and laps_text.replace(".", "").isdigit():
                            try:
                                total_race_laps = int(float(laps_text))
                            except (ValueError, TypeError):
                                logger.warning("total_race_laps_parse_error", laps_text=laps_text, event_id=event_id, url=url)
            
            if entries == 0 and drivers == 0:
                logger.warning("event_stats_not_found", event_id=event_id, url=url)
            
            metadata = EventMetadata(
                source_event_id=str(event_id),
                event_name=event_name,
                event_date=event_date,
                event_entries=entries,
                event_drivers=drivers,
                event_date_end=event_date_end,
                total_race_laps=total_race_laps,
            )
            
            logger.debug("parse_event_metadata_success", event_id=event_id, url=url)
            return metadata
        
        except EventPageFormatError:
            raise
        
        except Exception as e:
            logger.error("parse_event_metadata_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to parse event metadata: {str(e)}",
                url=url,
            )

