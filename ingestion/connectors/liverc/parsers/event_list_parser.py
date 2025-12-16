# @fileoverview Event list parser for LiveRC
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Parser for track events page
# 
# @purpose Extracts event summaries from track events listing page

from typing import List
from datetime import datetime
from selectolax.parser import HTMLParser

from ingestion.common.logging import get_logger
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


class EventSummary:
    """Event summary from events list."""
    def __init__(
        self,
        source: str,
        source_event_id: str,
        track_slug: str,
        event_name: str,
        event_date: datetime,
        event_entries: int,
        event_drivers: int,
        event_url: str,
    ):
        self.source = source
        self.source_event_id = source_event_id
        self.track_slug = track_slug
        self.event_name = event_name
        self.event_date = event_date
        self.event_entries = event_entries
        self.event_drivers = event_drivers
        self.event_url = event_url


class EventListParser:
    """Parser for LiveRC track events page."""
    
    def parse(self, html: str, url: str, track_slug: str) -> List[EventSummary]:
        """
        Parse event list from HTML.
        
        CSS Selectors:
        - Event rows: table#events tbody tr (skip header rows)
        - Event link: td:first-child a[href] (format: /results/?p=view_event&id={id})
        - Event name: Link text content
        - Event date: td:nth-child(2) span.hidden (format: 2025-11-16 08:30:00)
        - Entries: td:nth-child(3)
        - Drivers: td:nth-child(4)
        
        HTML Structure:
        The events list is displayed in a DataTable with id 'events'.
        Each row contains an event link, date (with hidden ISO format),
        entry count, and driver count.
        
        Example:
        <tr>
          <td><a href="/results/?p=view_event&id=486677">Event Name</a></td>
          <td><span class="hidden">2025-11-16 08:30:00</span>Nov 16, 2025</td>
          <td>71</td>
          <td>60</td>
        </tr>
        
        Args:
            html: HTML content from track events page
            url: Source URL for error reporting
            track_slug: Track slug for constructing URLs
        
        Returns:
            List of event summaries
        
        Raises:
            EventPageFormatError: If page structure is unexpected
        """
        logger.debug("parse_event_list_start", url=url, track_slug=track_slug)
        
        try:
            tree = HTMLParser(html)
            events = []
            
            # Find all event rows (skip header rows)
            event_rows = tree.css("table#events tbody tr")
            
            if not event_rows:
                raise EventPageFormatError(
                    "No event rows found in events table",
                    url=url,
                )
            
            for row in event_rows:
                try:
                    # Skip header rows (they have <th> elements)
                    if row.css("th"):
                        continue
                    
                    # Extract event link
                    event_link_elem = row.css_first("td:first-child a[href]")
                    if not event_link_elem:
                        logger.warning("event_row_missing_link", url=url)
                        continue
                    
                    event_href = event_link_elem.attributes.get("href", "")
                    if not event_href:
                        logger.warning("event_row_empty_href", url=url)
                        continue
                    
                    # Extract event ID from URL (format: /results/?p=view_event&id={id})
                    from urllib.parse import urlparse, parse_qs
                    parsed = urlparse(event_href)
                    query_params = parse_qs(parsed.query)
                    event_id = query_params.get("id", [None])[0]
                    
                    if not event_id:
                        logger.warning("event_row_missing_id", href=event_href, url=url)
                        continue
                    
                    # Extract event name
                    event_name = event_link_elem.text().strip()
                    if not event_name:
                        logger.warning("event_row_empty_name", event_id=event_id, url=url)
                        continue
                    
                    # Extract event date
                    date_elem = row.css_first("td:nth-child(2) span.hidden")
                    event_date = None
                    if date_elem:
                        date_str = date_elem.text().strip()
                        if date_str:
                            try:
                                # Parse format: "2025-11-16 08:30:00"
                                event_date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
                            except ValueError:
                                logger.warning("event_row_invalid_date", date_str=date_str, event_id=event_id, url=url)
                    
                    if not event_date:
                        logger.warning("event_row_missing_date", event_id=event_id, url=url)
                        continue
                    
                    # Extract entries
                    entries_elem = row.css_first("td:nth-child(3)")
                    entries = 0
                    if entries_elem:
                        try:
                            entries = int(entries_elem.text().strip())
                        except (ValueError, AttributeError):
                            logger.warning("event_row_invalid_entries", event_id=event_id, url=url)
                    
                    # Extract drivers
                    drivers_elem = row.css_first("td:nth-child(4)")
                    drivers = 0
                    if drivers_elem:
                        try:
                            drivers = int(drivers_elem.text().strip())
                        except (ValueError, AttributeError):
                            logger.warning("event_row_invalid_drivers", event_id=event_id, url=url)
                    
                    # Build full event URL
                    event_url = f"https://{track_slug}.liverc.com{event_href}"
                    
                    event = EventSummary(
                        source="liverc",
                        source_event_id=str(event_id),
                        track_slug=track_slug,
                        event_name=event_name,
                        event_date=event_date,
                        event_entries=entries,
                        event_drivers=drivers,
                        event_url=event_url,
                    )
                    events.append(event)
                    
                except Exception as e:
                    logger.warning("event_row_parse_error", error=str(e), url=url)
                    continue
            
            if not events:
                raise EventPageFormatError(
                    "No valid events extracted from event list",
                    url=url,
                )
            
            logger.debug("parse_event_list_success", event_count=len(events), url=url)
            return events
        
        except EventPageFormatError:
            raise
        
        except Exception as e:
            logger.error("parse_event_list_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to parse event list: {str(e)}",
                url=url,
            )

