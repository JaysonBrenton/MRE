# @fileoverview Event metadata parser for LiveRC
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Parser for event detail page metadata
# 
# @purpose Extracts high-level event metadata from event detail page

from datetime import datetime
from selectolax.parser import HTMLParser

from ingestion.common.logging import get_logger
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


class EventMetadata:
    """Event metadata from detail page."""
    def __init__(
        self,
        source_event_id: str,
        event_name: str,
        event_date: datetime,
        event_entries: int,
        event_drivers: int,
    ):
        self.source_event_id = source_event_id
        self.event_name = event_name
        self.event_date = event_date
        self.event_entries = event_entries
        self.event_drivers = event_drivers


class EventMetadataParser:
    """Parser for LiveRC event detail page."""
    
    def parse(self, html: str, url: str) -> EventMetadata:
        """
        Parse event metadata from HTML.
        
        CSS Selectors:
        - Event name: h3.page-header (text after icon span)
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
            
            # Extract event name from h3.page-header
            event_name_elem = tree.css_first("h3.page-header")
            if not event_name_elem:
                raise EventPageFormatError(
                    "Event name header (h3.page-header) not found",
                    url=url,
                )
            
            # Get text after icon span
            event_name = event_name_elem.text().strip()
            # Remove icon text if present (usually starts with icon character)
            # The actual name comes after the icon span
            spans = event_name_elem.css("span")
            if spans:
                # Remove icon span text
                for span in spans:
                    span_text = span.text()
                    if span_text:
                        event_name = event_name.replace(span_text, "", 1)
            
            event_name = event_name.strip()
            if not event_name:
                raise EventPageFormatError(
                    "Event name is empty after parsing",
                    url=url,
                )
            
            # Extract event date from h5.page-header
            event_date_elem = tree.css_first("h5.page-header")
            event_date = None
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
                        # Handle date ranges like "Nov 6, 2024 to Nov 9, 2024"
                        # Extract the start date (first date in the range)
                        if " to " in date_text.lower():
                            date_text = date_text.split(" to ", 1)[0].strip()
                        
                        # Parse format: "Nov 16, 2025" (date only, no time)
                        event_date = datetime.strptime(date_text, "%b %d, %Y")
                    except ValueError as e:
                        logger.warning("event_date_parse_error", date_text=date_text, event_id=event_id, url=url)
            
            if not event_date:
                raise EventPageFormatError(
                    "Could not parse event date",
                    url=url,
                )
            
            # Extract entries and drivers from Event Stats table
            entries = 0
            drivers = 0
            
            stats_rows = tree.css("table.table-sm tbody tr")
            for row in stats_rows:
                row_text = row.text()
                # Entries and Drivers are in the same cell, separated by <br />
                if "Entries:" in row_text and "Drivers:" in row_text:
                    # Extract both numbers
                    import re
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
            
            if entries == 0 and drivers == 0:
                logger.warning("event_stats_not_found", event_id=event_id, url=url)
            
            metadata = EventMetadata(
                source_event_id=str(event_id),
                event_name=event_name,
                event_date=event_date,
                event_entries=entries,
                event_drivers=drivers,
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

