# @fileoverview Entry list parser for LiveRC
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Parser for entry list page
# 
# @purpose Extracts driver entries with transponder numbers from entry list page

from typing import List, Dict, Optional
from selectolax.parser import HTMLParser

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import ConnectorEntryDriver, ConnectorEntryList
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


class EntryListParser:
    """Parser for entry list page."""
    
    def parse(self, html: str, url: str, source_event_id: str) -> ConnectorEntryList:
        """
        Parse entry list from HTML.
        
        CSS Selectors:
        - Entry tables: Tables with class headers (format: "{class_name} Entries: {count}")
        - Class name: Extracted from table header (e.g., "1/8 Electric Buggy")
        - Entry rows: tbody tr within each table
        - Car number: td:first-child (text content)
        - Driver name: td:nth-child(2) (text content, may contain multiple lines)
        - Transponder number: td:nth-child(3) (text content, may be empty)
        
        HTML Structure:
        Entry list pages contain multiple tables, one per racing class.
        Each table has a header row with class name and entry count.
        Each data row contains car number, driver name, and transponder number.
        
        Example:
        <table>
          <thead>
            <tr>
              <th colspan="3">1/8 Electric Buggy Entries: 14</th>
            </tr>
            <tr>
              <th>#</th>
              <th>Driver</th>
              <th>Transponder #</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>BRIGUGLIO, MICHAEL<br>MICHAEL BRIGUGLIO</td>
              <td>3071066</td>
            </tr>
          </tbody>
        </table>
        
        Args:
            html: HTML content from entry list page
            url: Source URL for error reporting
            source_event_id: Event ID for validation
        
        Returns:
            ConnectorEntryList with entries grouped by class
        
        Raises:
            EventPageFormatError: If page structure is unexpected
        """
        logger.debug("parse_entry_list_start", url=url, event_id=source_event_id)
        
        try:
            tree = HTMLParser(html)
            entries_by_class: Dict[str, List[ConnectorEntryDriver]] = {}
            
            # Find all tables on the page
            tables = tree.css("table")
            
            if not tables:
                logger.warning("entry_list_no_tables", url=url, event_id=source_event_id)
                # Return empty entry list - not an error, some events may not have entry lists
                return ConnectorEntryList(
                    source_event_id=source_event_id,
                    entries_by_class={},
                )
            
            for table in tables:
                try:
                    # Extract class name from header
                    # Look for div.class_header containing class name
                    # Structure: <th colspan="3"><div class="class_header">1/8 Electric Buggy</div><div class="class_sub_header">Entries: 14</div></th>
                    header_rows = table.css("thead tr")
                    if not header_rows:
                        continue
                    
                    # First header row contains class name in div.class_header
                    first_header_row = header_rows[0]
                    class_header_div = first_header_row.css_first("div.class_header")
                    
                    if not class_header_div:
                        # Fallback: try to extract from th text (old format)
                        class_header_th = first_header_row.css_first("th")
                        if class_header_th:
                            class_header_text = class_header_th.text().strip()
                            if "Entries:" in class_header_text:
                                class_name = class_header_text.split("Entries:")[0].strip()
                            else:
                                continue
                        else:
                            continue
                    else:
                        class_name = class_header_div.text().strip()
                    
                    if not class_name:
                        continue
                    
                    # Normalize class name
                    from ingestion.ingestion.normalizer import Normalizer
                    class_name = Normalizer.normalize_string(class_name)
                    
                    # Find entry rows in tbody
                    entry_rows = table.css("tbody tr")
                    if not entry_rows:
                        logger.debug("entry_list_no_rows_for_class", class_name=class_name, url=url)
                        continue
                    
                    entries = []
                    for row in entry_rows:
                        try:
                            # Extract car number (first column)
                            car_number_elem = row.css_first("td:first-child")
                            car_number = None
                            if car_number_elem:
                                car_number_text = car_number_elem.text().strip()
                                if car_number_text:
                                    car_number = car_number_text
                            
                            # Extract driver name (second column)
                            driver_name_elem = row.css_first("td:nth-child(2)")
                            if not driver_name_elem:
                                logger.warning("entry_list_row_missing_driver_name", class_name=class_name, url=url)
                                continue
                            
                            driver_name_text = driver_name_elem.text().strip()
                            if not driver_name_text:
                                logger.warning("entry_list_row_empty_driver_name", class_name=class_name, url=url)
                                continue
                            
                            # Clean up driver name (may contain multiple lines, take first line or join)
                            driver_name_lines = [line.strip() for line in driver_name_text.split("\n") if line.strip()]
                            driver_name = driver_name_lines[0] if driver_name_lines else driver_name_text.strip()
                            
                            # Extract transponder number (third column)
                            transponder_elem = row.css_first("td:nth-child(3)")
                            transponder_number = None
                            if transponder_elem:
                                transponder_text = transponder_elem.text().strip()
                                if transponder_text:
                                    transponder_number = transponder_text
                            
                            # Driver ID is not typically available in entry list HTML
                            # It would need to be matched later from race results
                            entry = ConnectorEntryDriver(
                                driver_name=driver_name,
                                car_number=car_number,
                                transponder_number=transponder_number,
                                source_driver_id=None,  # Not available in entry list HTML
                                class_name=class_name,
                            )
                            entries.append(entry)
                            
                        except Exception as e:
                            logger.warning("entry_list_row_parse_error", class_name=class_name, error=str(e), url=url)
                            continue
                    
                    if entries:
                        entries_by_class[class_name] = entries
                        logger.debug(
                            "entry_list_class_parsed",
                            class_name=class_name,
                            entry_count=len(entries),
                            url=url,
                        )
                
                except Exception as e:
                    logger.warning("entry_list_table_parse_error", error=str(e), url=url)
                    continue
            
            logger.debug("parse_entry_list_success", class_count=len(entries_by_class), url=url)
            return ConnectorEntryList(
                source_event_id=source_event_id,
                entries_by_class=entries_by_class,
            )
        
        except Exception as e:
            logger.error("parse_entry_list_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to parse entry list: {str(e)}",
                url=url,
            )

