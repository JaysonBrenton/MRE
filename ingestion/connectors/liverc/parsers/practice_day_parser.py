# @fileoverview Practice day parser for LiveRC
# 
# @created 2026-01-XX
# @creator System
# @lastModified 2026-01-XX
# 
# @description Parser for practice day pages
# 
# @purpose Extracts practice day summaries and session details from LiveRC practice pages

from typing import Any, List, Optional
from datetime import datetime, date
from bs4 import BeautifulSoup
from urllib.parse import urlparse, parse_qs
import json
import re

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import (
    PracticeSessionSummary,
    PracticeDaySummary,
    PracticeSessionDetail,
    ConnectorLap,
)
from ingestion.connectors.liverc.parsers.race_lap_parser import RaceLapParser
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


class PracticeDayParser:
    """Parser for LiveRC practice day pages."""
    
    def parse_practice_month_view(
        self,
        html: str,
        track_slug: str,
        year: int,
        month: int,
    ) -> List[date]:
        """
        Parse practice month view to extract list of dates with practice days.
        
        Uses all session_list links on the page (href containing d=YYYY-MM-DD) so the
        correct calendar is found even when the page has multiple tables (e.g. a
        "no sessions" table for another date appearing before the month calendar).
        
        Args:
            html: HTML content from practice month view page
            track_slug: Track slug
            year: Year
            month: Month (1-12)
        
        Returns:
            List of date objects for dates that have practice days
        
        Raises:
            EventPageFormatError: If page structure is unexpected
        """
        logger.debug("parse_practice_month_view_start", track_slug=track_slug, year=year, month=month)
        
        try:
            soup = BeautifulSoup(html, 'html.parser')
            dates: List[date] = []
            seen: set = set()  # dedupe by date
            
            # LiveRC page can have multiple tables with class "table" (e.g. "no sessions" for
            # another date above the calendar). Use all session_list date links on the page
            # so we get the calendar for the requested month regardless of table order.
            date_link_re = re.compile(r"d=(\d{4}-\d{2}-\d{2})")
            for a in soup.find_all("a", href=True):
                href = a.get("href", "")
                href_lower = href.lower()
                if "session_list" not in href_lower and "session%5flist" not in href_lower:
                    continue
                match = date_link_re.search(href)
                if not match:
                    continue
                date_str = match.group(1)
                try:
                    practice_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                    if practice_date.year != year or practice_date.month != month:
                        continue
                    if practice_date not in seen:
                        seen.add(practice_date)
                        dates.append(practice_date)
                except ValueError as e:
                    logger.warning("practice_month_view_invalid_date", date_str=date_str, error=str(e))
                    continue
            
            dates.sort()
            logger.debug("parse_practice_month_view_success", date_count=len(dates), track_slug=track_slug, year=year, month=month)
            return dates
        
        except EventPageFormatError:
            raise
        
        except Exception as e:
            logger.error("parse_practice_month_view_error", error=str(e), track_slug=track_slug)
            raise EventPageFormatError(
                f"Failed to parse practice month view: {str(e)}",
                url=f"practice month view for {track_slug}",
            )
    
    def parse_practice_day_overview(
        self,
        html: str,
        track_slug: str,
        practice_date: date,
    ) -> PracticeDaySummary:
        """
        Parse practice day overview page to extract session summaries and stats.
        
        CSS Selectors (based on reference material):
        - Session table: table.practice_session_list tbody tr
        - Driver name: td:first-child a (link text)
        - Class name: td:first-child small (format: "Class Name (transponder)")
        - Start time: td:nth-child(2) div.hidden (format: "2025-10-25 16:36:38")
        - Lap count and duration: td:nth-child(3) (format: "9<br />8:28")
        - Fastest and average lap: td:nth-child(4) (format: "Fast: 34.746<br />Avg: 56.437")
        - Session link: td:first-child a[href] (format: "/practice/?p=view_session&id=21290331")
        
        Args:
            html: HTML content from practice day overview page
            track_slug: Track slug
            practice_date: Date of practice day
        
        Returns:
            PracticeDaySummary object
        
        Raises:
            EventPageFormatError: If page structure is unexpected
        """
        logger.debug("parse_practice_day_overview_start", track_slug=track_slug, date=practice_date)
        
        try:
            # Parse HTML using BeautifulSoup (more stable than selectolax)
            if not html or len(html) == 0:
                raise EventPageFormatError(
                    "Empty HTML response",
                    url=f"practice day overview for {track_slug} on {practice_date}",
                )
            
            soup = BeautifulSoup(html, 'html.parser')
            sessions: List[PracticeSessionSummary] = []
            
            # Find practice session table
            session_table = soup.find('table', class_='practice_session_list')
            if not session_table:
                # Check if there's a "no sessions" message
                no_sessions_msg = soup.find(string=re.compile('no practice sessions', re.I))
                if no_sessions_msg:
                    logger.info("no_practice_sessions_for_date", date=practice_date, track_slug=track_slug)
                    return PracticeDaySummary(
                        date=practice_date,
                        track_slug=track_slug,
                        session_count=0,
                        total_laps=0,
                        total_track_time_seconds=0,
                        unique_drivers=0,
                        unique_classes=0,
                        sessions=[],
                    )
                else:
                    raise EventPageFormatError(
                        "No practice session table found",
                        url=f"practice day overview for {track_slug} on {practice_date}",
                    )
            
            tbody = session_table.find('tbody')
            if not tbody:
                raise EventPageFormatError(
                    "Practice session table has no tbody",
                    url=f"practice day overview for {track_slug} on {practice_date}",
                )
            
            session_rows = tbody.find_all('tr')
            
            if not session_rows:
                logger.info("no_practice_sessions_for_date", date=practice_date, track_slug=track_slug)
                return PracticeDaySummary(
                    date=practice_date,
                    track_slug=track_slug,
                    session_count=0,
                    total_laps=0,
                    total_track_time_seconds=0,
                    unique_drivers=0,
                    unique_classes=0,
                    sessions=[],
                )
            
            # Track statistics
            total_laps = 0
            total_track_time_seconds = 0
            unique_drivers = set()
            unique_classes = set()
            time_range_start: Optional[datetime] = None
            time_range_end: Optional[datetime] = None
            
            for row in session_rows:
                try:
                    # Extract session link from first cell
                    first_cell = row.find('td')
                    if not first_cell:
                        logger.warning("practice_session_row_missing_first_cell", date=practice_date)
                        continue
                    
                    session_link = first_cell.find('a', href=True)
                    if not session_link:
                        logger.warning("practice_session_row_missing_link", date=practice_date)
                        continue
                    
                    session_href = session_link.get('href', '')
                    if not session_href:
                        logger.warning("practice_session_row_empty_href", date=practice_date)
                        continue
                    
                    # Extract session ID from URL
                    parsed = urlparse(session_href)
                    query_params = parse_qs(parsed.query)
                    session_id = query_params.get("id", [None])[0]
                    
                    if not session_id:
                        logger.warning("practice_session_row_missing_id", href=session_href, date=practice_date)
                        continue
                    
                    # Extract driver name
                    driver_name = session_link.get_text(strip=True)
                    if not driver_name:
                        logger.warning("practice_session_row_empty_driver", session_id=session_id, date=practice_date)
                        continue
                    
                    # Extract class name and transponder from small text
                    class_elem = first_cell.find('small')
                    class_name = "Unknown Class"
                    transponder_number = None
                    if class_elem:
                        class_text = class_elem.get_text(strip=True)
                        # Format: "Class Name (transponder)" or "Unknown Class (transponder)"
                        if "(" in class_text and ")" in class_text:
                            class_name = class_text.split("(")[0].strip()
                            transponder_number = class_text.split("(")[1].rstrip(")").strip()
                        else:
                            class_name = class_text
                    
                    unique_classes.add(class_name)
                    
                    # Extract start time from second cell
                    cells = row.find_all('td')
                    start_time = None
                    if len(cells) >= 2:
                        time_cell = cells[1]
                        time_elem = time_cell.find('div', class_='hidden')
                        if time_elem:
                            time_str = time_elem.get_text(strip=True)
                            if time_str:
                                try:
                                    # Parse format: "2025-10-25 16:36:38"
                                    start_time = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
                                    if time_range_start is None or start_time < time_range_start:
                                        time_range_start = start_time
                                    if time_range_end is None or start_time > time_range_end:
                                        time_range_end = start_time
                                except ValueError:
                                    logger.warning("practice_session_row_invalid_time", time_str=time_str, session_id=session_id, date=practice_date)
                    
                    if not start_time:
                        logger.warning("practice_session_row_missing_time", session_id=session_id, date=practice_date)
                        continue
                    
                    # Extract lap count and duration from third cell
                    lap_count = 0
                    duration_seconds = 0
                    if len(cells) >= 3:
                        laps_duration_cell = cells[2]
                        # Check data-sort attribute first
                        data_sort = laps_duration_cell.get('data-sort')
                        if data_sort:
                            try:
                                lap_count = int(data_sort)
                            except ValueError:
                                pass
                        
                        # Get text content (handles both \n and <br />)
                        laps_text = laps_duration_cell.get_text(separator='\n', strip=True)
                        
                        # Parse from text if data-sort not available
                        if lap_count == 0:
                            lines = laps_text.split("\n")
                            if len(lines) >= 1:
                                try:
                                    lap_count = int(lines[0].strip())
                                except ValueError:
                                    pass
                        
                        # Parse duration from text (format: "M:SS" or "MM:SS")
                        # Duration is typically on the second line or after the lap count
                        if "\n" in laps_text:
                            parts = laps_text.split("\n")
                            if len(parts) >= 2:
                                duration_str = parts[1].strip()
                                # Parse M:SS or MM:SS format
                                if ":" in duration_str:
                                    try:
                                        time_parts = duration_str.split(":")
                                        if len(time_parts) == 2:
                                            minutes = int(time_parts[0])
                                            seconds = float(time_parts[1])
                                            duration_seconds = int(minutes * 60 + seconds)
                                    except (ValueError, IndexError):
                                        pass
                    
                    # Extract fastest and average lap from fourth cell
                    fastest_lap = None
                    average_lap = None
                    if len(cells) >= 4:
                        times_cell = cells[3]
                        times_text = times_cell.get_text(separator='\n', strip=True)
                        # Format: "Fast: 34.746\nAvg: 56.437"
                        if "Fast:" in times_text:
                            try:
                                fast_part = times_text.split("Fast:")[1].split()[0]
                                fastest_lap = float(fast_part)
                            except (ValueError, IndexError):
                                pass
                        if "Avg:" in times_text:
                            try:
                                avg_part = times_text.split("Avg:")[1].split()[0]
                                average_lap = float(avg_part)
                            except (ValueError, IndexError):
                                pass
                    
                    # Build session URL
                    session_url = f"https://{track_slug}.liverc.com{session_href}"
                    
                    session = PracticeSessionSummary(
                        session_id=session_id,
                        driver_name=driver_name,
                        class_name=class_name,
                        transponder_number=transponder_number,
                        start_time=start_time,
                        duration_seconds=duration_seconds,
                        lap_count=lap_count,
                        fastest_lap=fastest_lap,
                        average_lap=average_lap,
                        session_url=session_url,
                    )
                    sessions.append(session)
                    
                    # Update statistics
                    total_laps += lap_count
                    total_track_time_seconds += duration_seconds
                    unique_drivers.add(driver_name)
                    
                except Exception as e:
                    logger.warning("practice_session_row_parse_error", error=str(e), date=practice_date)
                    continue
            
            summary = PracticeDaySummary(
                date=practice_date,
                track_slug=track_slug,
                session_count=len(sessions),
                total_laps=total_laps,
                total_track_time_seconds=total_track_time_seconds,
                unique_drivers=len(unique_drivers),
                unique_classes=len(unique_classes),
                time_range_start=time_range_start,
                time_range_end=time_range_end,
                sessions=sessions,
            )
            
            logger.debug("parse_practice_day_overview_success", session_count=len(sessions), date=practice_date)
            return summary
        
        except EventPageFormatError:
            raise
        
        except Exception as e:
            logger.error("parse_practice_day_overview_error", error=str(e), date=practice_date, track_slug=track_slug)
            raise EventPageFormatError(
                f"Failed to parse practice day overview: {str(e)}",
                url=f"practice day overview for {track_slug} on {practice_date}",
            )

    def _extract_laps_from_lapsobj(self, html: str, session_id: str) -> List[ConnectorLap]:
        """
        Extract lap list from practice session detail page JavaScript.
        Practice view_session pages use: var lapsObj = [{"x":"1","lap_time":"44.564",...}, ...];
        (not racerLaps[transponder] which is used on race pages).
        """
        laps: List[ConnectorLap] = []
        match = re.search(r"var\s+lapsObj\s*=\s*\[", html)
        if not match:
            return laps
        start_pos = match.end() - 1  # position of [
        bracket_count = 0
        pos = start_pos
        end_pos = None
        while pos < len(html):
            ch = html[pos]
            if ch == "[":
                bracket_count += 1
            elif ch == "]":
                bracket_count -= 1
                if bracket_count == 0:
                    end_pos = pos + 1
                    break
            pos += 1
        if end_pos is None:
            return laps
        js_array_str = html[start_pos:end_pos]
        try:
            raw = json.loads(js_array_str)
        except json.JSONDecodeError:
            try:
                js_array_str_clean = js_array_str.replace("'", '"')
                raw = json.loads(js_array_str_clean)
            except json.JSONDecodeError:
                logger.warning("practice_lapsobj_json_error", session_id=session_id)
                return laps
        if not isinstance(raw, list):
            return laps
        for item in raw:
            if not isinstance(item, dict):
                continue
            try:
                x = item.get("x", item.get("lapNum", 0))
                lap_num = int(x) if isinstance(x, (int, float)) else int(str(x).strip())
                lap_time_str = str(item.get("lap_time", item.get("time", ""))).strip()
                lap_time_sec = float(lap_time_str) if lap_time_str else 0.0
                laps.append(
                    ConnectorLap(
                        lap_number=lap_num,
                        position_on_lap=1,
                        lap_time_seconds=lap_time_sec,
                        lap_time_raw=lap_time_str,
                        pace_string=None,
                        elapsed_race_time=0.0,
                        segments=[],
                    )
                )
            except (ValueError, TypeError) as e:
                logger.warning("practice_lapsobj_lap_error", session_id=session_id, error=str(e))
                continue
        return laps

    def parse_practice_session_detail(
        self,
        html: str,
        session_id: str,
        transponder_from_list: Optional[str] = None,
    ) -> PracticeSessionDetail:
        """
        Parse individual practice session page for complete lap data.
        
        Lap data: practice view_session pages use lapsObj = [{x, lap_time, ...}]; we
        parse that first. If absent, we fall back to racerLaps[transponder] (transponder
        from session list or from detail page table).
        
        CSS Selectors (based on reference material):
        - Driver name: table.table tbody tr:first-child td (or from title)
        - Class: table.table tbody tr:nth-child(2) td
        - Transponder: table.table tbody tr:nth-child(3) td
        - Session Time: table.table tbody tr:nth-child(4) td (contains Date, Start, End, Length)
        - Num Laps: table.table tbody tr:nth-child(5) td
        - Fastest Lap: table.table tbody tr:nth-child(6) td
        - Averages: table.table tbody tr:nth-child(7) td (contains Avg, Top 5, Top 10, Top 15, Std Deviation, Consistency)
        - Valid Lap Range: table.table tbody tr:nth-child(8) td
        - Lap times: div.laps_list div span (format: "Lap 1: 42.996")
        - Lap data in JavaScript: var lapsObj = [{...}]
        
        Args:
            html: HTML content from practice session detail page
            session_id: Session ID
        
        Returns:
            PracticeSessionDetail object
        
        Raises:
            EventPageFormatError: If page structure is unexpected
        """
        logger.debug("parse_practice_session_detail_start", session_id=session_id)
        
        try:
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract driver name, class, transponder from table
            driver_name = None
            class_name = None
            transponder_number = None
            
            table = soup.find('table', class_='table')
            table_rows = []
            if table:
                tbody = table.find('tbody')
                if tbody:
                    table_rows = tbody.find_all('tr')
            
            if table_rows:
                # Driver name (first row)
                if len(table_rows) > 0:
                    driver_cell = table_rows[0].find('td')
                    if driver_cell:
                        driver_name = driver_cell.get_text(strip=True)
                
                # Class (second row)
                if len(table_rows) > 1:
                    class_cell = table_rows[1].find('td')
                    if class_cell:
                        class_name = class_cell.get_text(strip=True)
                
                # Transponder (third row)
                if len(table_rows) > 2:
                    transponder_cell = table_rows[2].find('td')
                    if transponder_cell:
                        transponder_number = transponder_cell.get_text(strip=True)
            
            # Extract session time information
            session_date = None
            start_time = None
            end_time = None
            duration_seconds = 0
            
            if len(table_rows) > 3:
                session_time_cell = table_rows[3].find('td')
                if session_time_cell:
                    session_time_text = session_time_cell.get_text(separator='\n')
                    # Parse "Date: October 25, 2025 (Saturday)\nStart: 2:43:27pm\nEnd: 2:50:17pm\nLength of Session: 3:49"
                    lines = session_time_text.split("\n")
                    for line in lines:
                        line = line.strip()
                        if line.startswith("Date:"):
                            # Extract date from "Date: October 25, 2025 (Saturday)"
                            date_part = line.replace("Date:", "").strip().split("(")[0].strip()
                            try:
                                from datetime import datetime
                                session_date = datetime.strptime(date_part, "%B %d, %Y").date()
                            except ValueError:
                                pass
                        elif line.startswith("Start:"):
                            # Extract start time
                            time_part = line.replace("Start:", "").strip()
                            # Combine with date if available
                            if session_date and time_part:
                                try:
                                    # Parse "2:43:27pm" format
                                    start_time = datetime.strptime(
                                        f"{session_date} {time_part}",
                                        "%Y-%m-%d %I:%M:%S%p"
                                    )
                                except ValueError:
                                    pass
                        elif line.startswith("End:"):
                            # Extract end time
                            time_part = line.replace("End:", "").strip()
                            if session_date and time_part:
                                try:
                                    end_time = datetime.strptime(
                                        f"{session_date} {time_part}",
                                        "%Y-%m-%d %I:%M:%S%p"
                                    )
                                except ValueError:
                                    pass
                        elif "Length of Session:" in line:
                            # Extract duration "3:49" format
                            duration_str = line.split("Length of Session:")[1].strip()
                            if ":" in duration_str:
                                try:
                                    parts = duration_str.split(":")
                                    minutes = int(parts[0])
                                    seconds = int(parts[1])
                                    duration_seconds = minutes * 60 + seconds
                                except (ValueError, IndexError):
                                    pass
            
            # Map rows by header so we stay correct if LiveRC order changes (Driver, Class, Transponder,
            # Session Time, Num Laps, Fastest Lap, Top 3 Consec, Averages, Valid Lap Range).
            def _cell_for_header(rows: list, header_substr: str) -> Optional[Any]:
                for row in rows:
                    th = row.find("th")
                    if th and header_substr.lower() in th.get_text(strip=True).lower():
                        td = row.find("td")
                        return td.get_text(separator="\n", strip=True) if td else None
                return None

            # Extract lap count (row "Num Laps")
            lap_count = 0
            num_laps_text = _cell_for_header(table_rows, "Num Laps")
            if num_laps_text:
                try:
                    lap_count = int(num_laps_text.strip())
                except ValueError:
                    pass

            # Extract fastest lap
            fastest_lap = None
            fast_text = _cell_for_header(table_rows, "Fastest Lap")
            if fast_text:
                try:
                    fastest_lap = float(fast_text.strip())
                except ValueError:
                    pass

            # Extract Top 3 Consecutive
            top_3_consecutive = None
            top3_text = _cell_for_header(table_rows, "Top 3")
            if top3_text:
                try:
                    top_3_consecutive = float(top3_text.strip())
                except ValueError:
                    pass

            # Extract averages and metrics (row "Averages")
            average_lap = None
            avg_top_5 = None
            avg_top_10 = None
            avg_top_15 = None
            std_deviation = None
            consistency = None
            averages_text = _cell_for_header(table_rows, "Averages")
            if averages_text:
                for line in averages_text.split("\n"):
                    line = line.strip()
                    if line.startswith("Avg:"):
                        try:
                            average_lap = float(line.replace("Avg:", "").strip())
                        except ValueError:
                            pass
                    elif line.startswith("Top 5:"):
                        try:
                            avg_top_5 = float(line.replace("Top 5:", "").strip())
                        except ValueError:
                            pass
                    elif line.startswith("Top 10:"):
                        try:
                            value = line.replace("Top 10:", "").strip()
                            if value:
                                avg_top_10 = float(value)
                        except ValueError:
                            pass
                    elif line.startswith("Top 15:"):
                        try:
                            value = line.replace("Top 15:", "").strip()
                            if value:
                                avg_top_15 = float(value)
                        except ValueError:
                            pass
                    elif line.startswith("Std Deviation:"):
                        try:
                            std_deviation = float(line.replace("Std Deviation:", "").strip())
                        except ValueError:
                            pass
                    elif line.startswith("Consistency:"):
                        try:
                            consistency_str = line.replace("Consistency:", "").strip().rstrip("%")
                            consistency = float(consistency_str)
                        except ValueError:
                            pass

            # Extract valid lap range (row "Valid Lap Range")
            valid_lap_range = None
            range_text = _cell_for_header(table_rows, "Valid Lap Range")
            if range_text and "to" in range_text:
                try:
                    parts = range_text.split("to")
                    min_str = parts[0].strip()
                    max_str = parts[1].strip().split("\n")[0].strip()
                    min_seconds = float(min_str)
                    if ":" in max_str:
                        max_parts = max_str.split(":")
                        max_seconds = int(max_parts[0]) * 60 + float(max_parts[1])
                    else:
                        max_seconds = float(max_str)
                    valid_lap_range = (int(min_seconds), int(max_seconds))
                except (ValueError, IndexError):
                    pass
            
            # Extract lap data: practice view_session pages use lapsObj = [{x, lap_time, ...}], not racerLaps[id]
            laps: List[ConnectorLap] = []
            # 1) Try lapsObj (practice session detail page structure)
            laps_from_lapsobj = self._extract_laps_from_lapsobj(html, session_id)
            if laps_from_lapsobj:
                laps = laps_from_lapsobj
            else:
                # 2) Fallback: racerLaps[transponder] (race-style structure, if present)
                lap_transponder = (transponder_from_list or transponder_number or "").strip() or None
                if lap_transponder:
                    lap_parser = RaceLapParser()
                    try:
                        driver_laps_data = lap_parser._extract_driver_laps_data(html, lap_transponder)
                        if driver_laps_data and "laps" in driver_laps_data:
                            for lap_dict in driver_laps_data["laps"]:
                                try:
                                    lap = ConnectorLap(
                                        lap_number=int(lap_dict.get("lapNum", 0)),
                                        position_on_lap=int(lap_dict.get("pos", 0)),
                                        lap_time_seconds=float(lap_dict.get("time", 0)),
                                        lap_time_raw=lap_dict.get("time", ""),
                                        pace_string=lap_dict.get("pace"),
                                        elapsed_race_time=0.0,
                                        segments=lap_dict.get("segments", []),
                                    )
                                    laps.append(lap)
                                except (ValueError, KeyError) as e:
                                    logger.warning("practice_lap_parse_error", error=str(e), session_id=session_id)
                                    continue
                    except Exception as e:
                        logger.warning("practice_lap_extraction_error", error=str(e), session_id=session_id)
            
            if not session_date:
                # Fallback: try to extract from page title or other sources
                from datetime import date as date_class
                session_date = date_class.today()  # Default to today if not found
            
            detail = PracticeSessionDetail(
                session_id=session_id,
                driver_name=driver_name or "Unknown",
                class_name=class_name or "Unknown Class",
                transponder_number=transponder_number,
                date=session_date,
                start_time=start_time or datetime.now(),
                end_time=end_time,
                duration_seconds=duration_seconds,
                lap_count=lap_count,
                fastest_lap=fastest_lap,
                top_3_consecutive=top_3_consecutive,
                average_lap=average_lap,
                avg_top_5=avg_top_5,
                avg_top_10=avg_top_10,
                avg_top_15=avg_top_15,
                std_deviation=std_deviation,
                consistency=consistency,
                valid_lap_range=valid_lap_range,
                laps=laps,
            )
            
            logger.debug("parse_practice_session_detail_success", session_id=session_id, lap_count=len(laps))
            return detail
        
        except EventPageFormatError:
            raise
        
        except Exception as e:
            logger.error("parse_practice_session_detail_error", error=str(e), session_id=session_id)
            raise EventPageFormatError(
                f"Failed to parse practice session detail: {str(e)}",
                url=f"practice session {session_id}",
            )
