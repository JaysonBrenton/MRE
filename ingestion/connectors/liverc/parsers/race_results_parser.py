# @fileoverview Race results parser for LiveRC
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Parser for race results table
# 
# @purpose Extracts driver results from race result page

import re
import hashlib
from urllib.parse import urlparse
from typing import List, Dict, Optional, Any
from selectolax.parser import HTMLParser

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import ConnectorRaceResult
from ingestion.ingestion.errors import RacePageFormatError

logger = get_logger(__name__)

# "Length: 1:00:00 Timed" (hours) — match before two-segment pattern
RACE_DURATION_HMS_PATTERN = re.compile(
    r"Length:\s*(\d+):(\d{2}):(\d{2})\s*(?:Timed)?",
    re.IGNORECASE,
)
# "Length: 30:00 Timed" or "Length: 10:00 Timed" (minutes:seconds)
RACE_DURATION_MS_PATTERN = re.compile(
    r"Length:\s*(\d+):(\d{2})\s*(?:Timed)?",
    re.IGNORECASE,
)

# Default 1-based column indices (thead row: Pos, Driver, Qual, Laps/Time, Behind, …)
_DEFAULT_RESULT_COLS: Dict[str, int] = {
    "qual": 3,
    "laps_time": 4,
    "behind": 5,
    "fastest": 6,
    "avg_lap": 7,
    "avg_top_5": 8,
    "avg_top_10": 9,
    "avg_top_15": 10,
    "top_3_consecutive": 11,
    "std_deviation": 12,
    "consistency": 13,
}
_BEHIND_LAP_TEXT_PATTERN = re.compile(r"^\s*(\d+)\s*Laps?\s*$", re.IGNORECASE)


def _normalize_th_label(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip()).lower()


def _thead_has_pos_and_behind(table) -> bool:
    """True if a thead row looks like the LiveRC results grid (Pos … Behind …)."""
    for tr in table.css("thead tr"):
        ths = tr.css("th")
        if len(ths) < 5:
            continue
        labels = [_normalize_th_label(th.text()) for th in ths]
        if labels and labels[0] == "pos" and "behind" in labels:
            return True
    return False


def _find_race_results_table(tree: HTMLParser):
    """
    Locate the results table. LiveRC historically used `table.race_result`; newer layouts
    wrap DataTables output as `table#DataTables_Table_0` (no race_result class on the
    visible table). Prefer the first table whose thead matches Pos/Behind and tbody has
    driver rows.
    """
    for table in tree.css("table"):
        if not _thead_has_pos_and_behind(table):
            continue
        for row in table.css("tbody tr"):
            if row.css_first("span.driver_name"):
                return table
    # Legacy markup / unit-test snippets: `table.race_result` with tbody only (no thead)
    legacy = tree.css_first("table.race_result")
    if legacy and legacy.css("tbody tr"):
        for row in legacy.css("tbody tr"):
            if row.css_first("span.driver_name"):
                return legacy
    return None


def _build_race_result_column_map(table) -> Dict[str, int]:
    """
    Map LiveRC table headers to 1-based td indices (survives new columns in the grid).
    Falls back to _DEFAULT_RESULT_COLS when no matching header row is found.
    """
    cols = dict(_DEFAULT_RESULT_COLS)
    for tr in table.css("thead tr"):
        ths = tr.css("th")
        if len(ths) < 10:
            continue
        labels = [_normalize_th_label(th.text()) for th in ths]
        if not labels or labels[0] != "pos":
            continue
        found: Dict[str, int] = {}
        for i, lab in enumerate(labels, start=1):
            if lab == "qual":
                found["qual"] = i
            elif "laps" in lab and "time" in lab:
                found["laps_time"] = i
            elif lab == "behind":
                found["behind"] = i
            elif "fastest" in lab and "lap" in lab:
                found["fastest"] = i
            elif lab.startswith("avg lap"):
                found["avg_lap"] = i
            elif "avg top 5" in lab:
                found["avg_top_5"] = i
            elif "avg top 10" in lab:
                found["avg_top_10"] = i
            elif "avg top 15" in lab:
                found["avg_top_15"] = i
            elif "top 3 consecutive" in lab:
                found["top_3_consecutive"] = i
            elif "std" in lab and "dev" in lab:
                found["std_deviation"] = i
            elif "consistency" in lab:
                found["consistency"] = i
        if "behind" in found and "laps_time" in found:
            cols.update(found)
            break
    return cols


def _split_behind_cell(text: str) -> tuple[Optional[float], Optional[str]]:
    """Parse Behind cell: seconds, lap-gap text (e.g. '1 Lap'), or suffixed times like '12.052s'."""
    raw = text.strip()
    if not raw:
        return None, None
    try:
        return float(raw), None
    except ValueError:
        pass
    if _BEHIND_LAP_TEXT_PATTERN.match(raw) or "lap" in raw.lower():
        return None, raw
    m = re.search(r"[-+]?\d+(?:\.\d+)?", raw.replace(",", "."))
    if m:
        try:
            return float(m.group(0)), None
        except ValueError:
            pass
    return None, raw


def parse_race_duration_seconds(html: str) -> Optional[int]:
    """
    Parse race duration in seconds from race result page HTML.
    Supports "Length: H:MM:SS Timed" and "Length: MM:SS Timed" (LiveRC source of truth).
    """
    hms = RACE_DURATION_HMS_PATTERN.search(html)
    if hms:
        try:
            h, m, s = int(hms.group(1)), int(hms.group(2)), int(hms.group(3))
            return h * 3600 + m * 60 + s
        except (ValueError, IndexError):
            return None
    match = RACE_DURATION_MS_PATTERN.search(html)
    if not match:
        return None
    try:
        minutes = int(match.group(1))
        seconds = int(match.group(2))
        return minutes * 60 + seconds
    except (ValueError, IndexError):
        return None


def _parse_float_from_cell(elem) -> Optional[float]:
    """Extract a float from a cell (prefer div.hidden, else strip text)."""
    if not elem:
        return None
    hidden = elem.css_first("div.hidden")
    text = (hidden.text() if hidden else elem.text()).strip() if elem else ""
    if not text:
        return None
    match = re.search(r"([\d.]+)", text)
    return float(match.group(1)) if match else None


class RaceResultsParser:
    """Parser for race results table."""
    
    def _extract_racer_laps_mapping(self, html: str) -> Dict[str, str]:
        """
        Extract driver name -> driver ID mapping from racerLaps JavaScript.
        
        Args:
            html: HTML content containing racerLaps JavaScript
        
        Returns:
            Dictionary mapping driver name (uppercase) -> driver ID (string)
        """
        driver_name_to_id = {}
        
        # Extract racerLaps JavaScript variable
        pattern = r'racerLaps\[(\d+)\]\s*=\s*\{[^}]*\'driverName\'\s*:\s*\'([^\']+)\''
        matches = re.finditer(pattern, html, re.MULTILINE | re.DOTALL)
        
        for match in matches:
            driver_id = match.group(1)
            driver_name = match.group(2).strip().upper()
            if driver_name:
                driver_name_to_id[driver_name] = driver_id
        
        return driver_name_to_id
    
    def parse(self, html: str, url: str) -> List[ConnectorRaceResult]:
        """
        Parse race results from HTML.
        
        CSS Selectors:
        - Results rows: main results table tbody tr (table.race_result or DataTables `DataTables_Table_*`)
        - Position: td:first-child
        - Driver name: td:nth-child(2) span.driver_name
        - Driver ID: td:nth-child(2) a.driver_laps[data-driver-id] (if present)
        - Laps/Time: td:nth-child(4) (format: "47/30:31.382" or "0")
        - Fastest lap: td:nth-child(6) (extract number before <sup>)
        - Avg lap: td:nth-child(7) div.hidden
        - Consistency: td:nth-child(13) (extract number before "%")
        
        HTML Structure:
        Results are displayed in a DataTable (`table.race_result` or `id="DataTables_Table_0"`).
        Each row contains position, driver info, laps/time, and statistics.
        Non-starting drivers have "0" in laps/time column and no data-driver-id.
        Driver IDs are matched from racerLaps JavaScript if not in table.
        
        Example:
        <tr>
          <td>1</td>
          <td>
            <span class="driver_name">FELIX KOEGLER</span>
            <a href="#" data-driver-id="346997" class="driver_laps">View Laps</a>
          </td>
          <td>47/30:31.382</td>
          <td>37.234<sup>10</sup></td>
          <td><div class="hidden">38.983</div>38.983</td>
          <td>92.82%</td>
        </tr>
        
        Args:
            html: HTML content from race result page
            url: Source URL for error reporting
        
        Returns:
            List of race results
        
        Raises:
            RacePageFormatError: If page structure is unexpected
        """
        logger.debug("parse_race_results_start", url=url)
        
        try:
            tree = HTMLParser(html)
            results = []

            results_table = _find_race_results_table(tree)
            if not results_table:
                raise RacePageFormatError(
                    "No race results table found (expected Pos/Behind headers and driver rows)",
                    url=url,
                )
            cols = _build_race_result_column_map(results_table)

            # Extract driver name -> ID mapping from racerLaps JavaScript
            driver_name_to_id = self._extract_racer_laps_mapping(html)
            
            # Find all result rows
            result_rows = results_table.css("tbody tr")
            
            if not result_rows:
                raise RacePageFormatError(
                    "No result rows found in race results table",
                    url=url,
                )
            
            for row in result_rows:
                try:
                    # Extract position
                    position_elem = row.css_first("td:first-child")
                    if not position_elem:
                        continue
                    
                    try:
                        position_final = int(position_elem.text().strip())
                    except (ValueError, AttributeError):
                        logger.warning("result_row_invalid_position", url=url)
                        continue
                    
                    # Extract driver name
                    driver_name_elem = row.css_first("td:nth-child(2) span.driver_name")
                    if not driver_name_elem:
                        logger.warning("result_row_missing_driver_name", position=position_final, url=url)
                        continue
                    
                    display_name = driver_name_elem.text().strip()
                    if not display_name:
                        logger.warning("result_row_empty_driver_name", position=position_final, url=url)
                        continue
                    # LiveRC sometimes includes qual number in the Driver cell (e.g. "1 AUSTIN MCMAHON").
                    # Strip leading "digits + space" so we store and match on the actual driver name only.
                    display_name = re.sub(r"^\d+\s+", "", display_name).strip() or display_name
                    if not display_name:
                        logger.warning("result_row_empty_driver_name_after_strip", position=position_final, url=url)
                        continue

                    # Extract driver ID (primary: data-driver-id, fallback: match by name)
                    source_driver_id = None
                    
                    # Try data-driver-id attribute first
                    driver_laps_elem = row.css_first("td:nth-child(2) a.driver_laps[data-driver-id]")
                    if driver_laps_elem:
                        source_driver_id = driver_laps_elem.attributes.get("data-driver-id")
                    
                    # Fallback: match by driver name to racerLaps keys (display_name already has qual stripped)
                    if not source_driver_id:
                        driver_name_upper = display_name.strip().upper()
                        source_driver_id = driver_name_to_id.get(driver_name_upper)
                        if source_driver_id:
                            logger.debug("driver_id_matched_by_name", driver_name=display_name, driver_id=source_driver_id, url=url)
                    
                    if not source_driver_id:
                        # As a last resort, generate a deterministic synthetic driver ID instead of
                        # dropping the row completely. LiveRC occasionally omits data-driver-id
                        # attributes or exposes driver names in racerLaps with formatting that
                        # does not exactly match the table's display_name. Previously this caused
                        # us to skip the entire result row (and therefore lose that driver's
                        # position from race_results), which surfaced as missing positions in
                        # downstream event analysis (e.g. no recorded P2 despite LiveRC showing it).
                        #
                        # To guarantee that *every* visible row on the results page produces a
                        # RaceResult record, we synthesize a stable ID based on the track host
                        # and the driver's display name. This preserves complete standings for
                        # each race even if cross-event identity for that driver is imperfect.
                        parsed_url = urlparse(url)
                        host = parsed_url.netloc or "unknown-host"
                        key = f"{host}|{display_name.strip().upper()}"
                        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]
                        synthetic_id = f"synthetic-{digest}"

                        logger.warning(
                            "result_row_no_driver_id_synthetic",
                            driver_name=display_name,
                            position=position_final,
                            url=url,
                            synthetic_driver_id=synthetic_id,
                        )

                        source_driver_id = synthetic_id
                    
                    # Extract Qual (qualifying position)
                    qualifying_position = None
                    qual_elem = row.css_first(f"td:nth-child({cols['qual']})")
                    if qual_elem:
                        qual_text = qual_elem.text().strip()
                        if qual_text and qual_text.isdigit():
                            qualifying_position = int(qual_text)

                    # Extract laps/time
                    laps_time_elem = row.css_first(f"td:nth-child({cols['laps_time']})")
                    laps_completed = 0
                    total_time_raw = None
                    total_time_seconds = None

                    if laps_time_elem:
                        laps_time_text = laps_time_elem.text().strip()
                        if laps_time_text:
                            # Parse format: "47/30:31.382" or "0"
                            if "/" in laps_time_text:
                                # Format: "47/30:31.382"
                                parts = laps_time_text.split("/", 1)
                                try:
                                    laps_completed = int(parts[0].strip())
                                    # Preserve full original format in total_time_raw
                                    total_time_raw = laps_time_text.strip()
                                    # Parse time part to seconds (MM:SS.mmm)
                                    time_part = parts[1].strip()
                                    if ":" in time_part:
                                        m, s = time_part.split(":", 1)
                                        total_time_seconds = int(m) * 60 + float(s)
                                except (ValueError, TypeError):
                                    logger.warning("result_row_invalid_laps_time", text=laps_time_text, driver_id=source_driver_id, url=url)
                            else:
                                # Format: "0" (non-starting driver)
                                try:
                                    laps_completed = int(laps_time_text)
                                    total_time_raw = None
                                except ValueError:
                                    logger.warning("result_row_invalid_laps", text=laps_time_text, driver_id=source_driver_id, url=url)

                    # Extract Behind (seconds behind winner, or lap gap text)
                    seconds_behind = None
                    behind_display = None
                    behind_elem = row.css_first(f"td:nth-child({cols['behind']})")
                    if behind_elem:
                        behind_text = behind_elem.text().strip()
                        if behind_text:
                            seconds_behind, behind_display = _split_behind_cell(behind_text)

                    # Extract fastest lap
                    fast_lap_elem = row.css_first(f"td:nth-child({cols['fastest']})")
                    fast_lap_time = None
                    if fast_lap_elem:
                        fast_lap_text = fast_lap_elem.text().strip()
                        if fast_lap_text:
                            # Extract number before <sup> if present
                            fast_lap_match = re.search(r"([\d.]+)", fast_lap_text)
                            if fast_lap_match:
                                try:
                                    fast_lap_time = float(fast_lap_match.group(1))
                                except ValueError:
                                    logger.warning("result_row_invalid_fast_lap", text=fast_lap_text, driver_id=source_driver_id, url=url)
                    
                    # Extract avg lap (from hidden div)
                    avg_lap_elem = row.css_first(f"td:nth-child({cols['avg_lap']}) div.hidden")
                    avg_lap_time = None
                    if avg_lap_elem:
                        avg_lap_text = avg_lap_elem.text().strip()
                        if avg_lap_text:
                            try:
                                avg_lap_time = float(avg_lap_text)
                            except ValueError:
                                logger.warning("result_row_invalid_avg_lap", text=avg_lap_text, driver_id=source_driver_id, url=url)
                    
                    # Extract consistency
                    consistency_elem = row.css_first(f"td:nth-child({cols['consistency']})")
                    consistency = None
                    if consistency_elem:
                        consistency_text = consistency_elem.text().strip()
                        if consistency_text:
                            # Extract number before "%"
                            consistency_match = re.search(r"([\d.]+)", consistency_text)
                            if consistency_match:
                                try:
                                    consistency = float(consistency_match.group(1))
                                except ValueError:
                                    logger.warning("result_row_invalid_consistency", text=consistency_text, driver_id=source_driver_id, url=url)

                    # Extra stats (Avg Top 5, Avg Top 10, Avg Top 15, Top 3 Consecutive, Std. Deviation)
                    raw_fields_json: Optional[Dict[str, Any]] = None
                    avg_top_5 = _parse_float_from_cell(row.css_first(f"td:nth-child({cols['avg_top_5']})"))
                    avg_top_10 = _parse_float_from_cell(row.css_first(f"td:nth-child({cols['avg_top_10']})"))
                    avg_top_15 = _parse_float_from_cell(row.css_first(f"td:nth-child({cols['avg_top_15']})"))
                    top_3_consecutive = _parse_float_from_cell(
                        row.css_first(f"td:nth-child({cols['top_3_consecutive']})")
                    )
                    std_deviation = _parse_float_from_cell(row.css_first(f"td:nth-child({cols['std_deviation']})"))
                    if any(x is not None for x in (avg_top_5, avg_top_10, avg_top_15, top_3_consecutive, std_deviation)):
                        raw_fields_json = {}
                        if avg_top_5 is not None:
                            raw_fields_json["avg_top_5"] = avg_top_5
                        if avg_top_10 is not None:
                            raw_fields_json["avg_top_10"] = avg_top_10
                        if avg_top_15 is not None:
                            raw_fields_json["avg_top_15"] = avg_top_15
                        if top_3_consecutive is not None:
                            raw_fields_json["top_3_consecutive"] = top_3_consecutive
                        if std_deviation is not None:
                            raw_fields_json["std_deviation"] = std_deviation

                    # Handle non-starting drivers (laps_completed = 0)
                    if laps_completed == 0:
                        total_time_raw = None
                        total_time_seconds = None
                        # fast_lap_time, avg_lap_time, consistency already None if not found

                    result = ConnectorRaceResult(
                        source_driver_id=str(source_driver_id),
                        display_name=display_name,
                        position_final=position_final,
                        laps_completed=laps_completed,
                        total_time_raw=total_time_raw,
                        total_time_seconds=total_time_seconds,
                        fast_lap_time=fast_lap_time,
                        avg_lap_time=avg_lap_time,
                        consistency=consistency,
                        qualifying_position=qualifying_position,
                        seconds_behind=seconds_behind,
                        behind_display=behind_display,
                        raw_fields_json=raw_fields_json,
                    )
                    results.append(result)
                    
                except Exception as e:
                    logger.warning("result_row_parse_error", error=str(e), url=url)
                    continue
            
            # If no valid results were extracted, return empty list (race may not have been run yet)
            # Don't raise an error - let validation handle empty results gracefully
            if not results:
                logger.warning(
                    "parse_race_results_no_valid_results",
                    url=url,
                    message="No valid results extracted from race results table (race may not have been run yet)",
                )
            
            logger.debug("parse_race_results_success", result_count=len(results), url=url)
            return results
        
        except RacePageFormatError:
            raise
        
        except Exception as e:
            logger.error("parse_race_results_error", url=url, error=str(e))
            raise RacePageFormatError(
                f"Failed to parse race results: {str(e)}",
                url=url,
            )

