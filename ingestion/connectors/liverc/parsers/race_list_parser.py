# @fileoverview Race list parser for LiveRC
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Parser for race list from event page
# 
# @purpose Extracts race summaries from event detail page

import re
from typing import List, Optional
from datetime import datetime
from selectolax.parser import HTMLParser
from urllib.parse import urlparse, parse_qs

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import ConnectorRaceSummary
from ingestion.connectors.liverc.utils import parse_track_slug_from_url, build_race_url
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


class RaceListParser:
    """Parser for race list from event page."""
    
    def parse(self, html: str, url: str) -> List[ConnectorRaceSummary]:
        """
        Parse race list from HTML.
        
        CSS Selectors:
        - Race rows: table.entry_list_data tbody tr (skip header rows with <th>)
        - Race link: td a[href*="view_race_result"] (format: /results/?p=view_race_result&id={id})
        - Race full label: Link text (e.g., "Race 14: 1/8 Nitro Buggy (1/8 Nitro Buggy A-Main)")
        - Race time: td:nth-child(2) (format: "Nov 16, 2025 at 5:30pm")
        
        HTML Structure:
        Races are grouped by round (Main Events, Qualifier Round 3, etc.) with
        header rows containing <th> elements. Race links contain the full label
        with race number, class name, and race label in parentheses.
        
        Example:
        <tr><th>Main Events</th><th>Time Completed</th></tr>
        <tr>
          <td>
            <a href="/results/?p=view_race_result&id=6304829">
              Race 14: 1/8 Nitro Buggy (1/8 Nitro Buggy A-Main)
            </a>
          </td>
          <td>Nov 16, 2025 at 5:30pm</td>
        </tr>
        
        Args:
            html: HTML content from event detail page
            url: Source URL for error reporting
        
        Returns:
            List of race summaries
        
        Raises:
            EventPageFormatError: If page structure is unexpected
        """
        logger.debug("parse_race_list_start", url=url)
        
        try:
            tree = HTMLParser(html)
            races = []
            
            # Extract track slug from URL
            track_slug = parse_track_slug_from_url(url)
            if not track_slug:
                raise EventPageFormatError(
                    f"Could not extract track slug from URL: {url}",
                    url=url,
                )
            
            # Find all race rows (skip header rows)
            race_rows = tree.css("table.entry_list_data tbody tr")
            
            if not race_rows:
                raise EventPageFormatError(
                    "No race rows found in race list table",
                    url=url,
                )
            
            for row in race_rows:
                try:
                    # Skip header rows (they have <th> elements)
                    if row.css("th"):
                        continue
                    
                    # Find race link
                    race_link_elem = row.css_first('td a[href*="view_race_result"]')
                    if not race_link_elem:
                        continue
                    
                    race_href = race_link_elem.attributes.get("href", "")
                    if not race_href:
                        logger.warning("race_row_empty_href", url=url)
                        continue
                    
                    # Extract race ID from URL
                    parsed = urlparse(race_href)
                    query_params = parse_qs(parsed.query)
                    race_id = query_params.get("id", [None])[0]
                    
                    if not race_id:
                        logger.warning("race_row_missing_id", href=race_href, url=url)
                        continue
                    
                    # Extract race full label from link text
                    # Remove icon if present (usually <i class="fa fa-trophy"></i>)
                    race_full_label = race_link_elem.text().strip()
                    if not race_full_label:
                        logger.warning("race_row_empty_label", race_id=race_id, url=url)
                        continue
                    
                    # Extract race number from label (e.g., "Race 14" -> 14)
                    race_order = None
                    race_num_match = re.search(r"Race\s+(\d+)", race_full_label, re.IGNORECASE)
                    if race_num_match:
                        try:
                            race_order = int(race_num_match.group(1))
                        except ValueError:
                            logger.warning("race_order_parse_error", label=race_full_label, race_id=race_id, url=url)
                    
                    # Extract class name and race label from full label
                    # Format: "Race 14: 1/8 Nitro Buggy (1/8 Nitro Buggy A-Main)"
                    # or: "Race 9: Junior (Junior A-Main)"
                    class_name = ""
                    race_label = ""
                    
                    # Remove "Race X: " prefix if present
                    label_without_prefix = re.sub(r"^Race\s+\d+:\s*", "", race_full_label, flags=re.IGNORECASE).strip()
                    
                    # Check for parentheses
                    paren_match = re.search(r"^(.+?)\s*\((.+?)\)\s*$", label_without_prefix)
                    if paren_match:
                        class_name = paren_match.group(1).strip()
                        race_label = paren_match.group(2).strip()
                    else:
                        # No parentheses - use entire label as class_name
                        class_name = label_without_prefix
                        race_label = label_without_prefix
                    
                    # Extract race time
                    time_elem = row.css_first("td:nth-child(2)")
                    start_time = None
                    if time_elem:
                        time_text = time_elem.text().strip()
                        if time_text:
                            try:
                                # Parse format: "Nov 16, 2025 at 5:30pm"
                                # Try multiple formats
                                time_formats = [
                                    "%b %d, %Y at %I:%M%p",
                                    "%b %d, %Y at %I%p",
                                    "%b %d, %Y",
                                ]
                                
                                for fmt in time_formats:
                                    try:
                                        start_time = datetime.strptime(time_text, fmt)
                                        break
                                    except ValueError:
                                        continue
                                
                                if not start_time:
                                    logger.warning("race_time_parse_error", time_text=time_text, race_id=race_id, url=url)
                            except Exception as e:
                                logger.warning("race_time_parse_exception", error=str(e), race_id=race_id, url=url)
                    
                    # Build full race URL
                    race_url = build_race_url(track_slug, str(race_id))
                    
                    race = ConnectorRaceSummary(
                        source_race_id=str(race_id),
                        race_full_label=race_full_label,
                        class_name=class_name,
                        race_label=race_label,
                        race_order=race_order,
                        race_url=race_url,
                        start_time=start_time,
                        duration_seconds=None,  # Not available in race list
                    )
                    races.append(race)
                    
                except Exception as e:
                    logger.warning("race_row_parse_error", error=str(e), url=url)
                    continue
            
            # Allow empty race lists - some events may not have races yet or may have no valid races
            # Log a warning but don't fail the import (event metadata can still be useful)
            if not races:
                logger.warning(
                    "parse_race_list_no_valid_races",
                    url=url,
                    message="No valid races extracted from race list - event will be imported without races",
                )
            
            logger.debug("parse_race_list_success", race_count=len(races), url=url)
            return races
        
        except EventPageFormatError:
            raise
        
        except Exception as e:
            logger.error("parse_race_list_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to parse race list: {str(e)}",
                url=url,
            )

