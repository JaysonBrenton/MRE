# @fileoverview Race lap data parser for LiveRC
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Parser for embedded JavaScript lap data (racerLaps)
# 
# @purpose Extracts lap time series from embedded JavaScript data blocks

import json
import re
from typing import Dict, List
from selectolax.parser import HTMLParser

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import ConnectorLap
from ingestion.ingestion.errors import LapTableMissingError, RacePageFormatError

logger = get_logger(__name__)


class RaceLapParser:
    """Parser for embedded JavaScript lap data."""
    
    def _extract_driver_laps_data(self, html: str, source_driver_id: str) -> dict:
        """
        Extract lap data for a specific driver from racerLaps JavaScript.
        
        The JavaScript structure is:
        racerLaps[346997] = {
            'driverName': 'FELIX KOEGLER',
            'laps': [
                { 'lapNum': '1', 'pos': '1', 'time': '38.17', 'pace': '48/30:32.160', 'segments': [] },
                ...
            ]
        }
        
        Args:
            html: HTML content containing racerLaps JavaScript
            source_driver_id: Driver ID to extract
        
        Returns:
            Dictionary with 'laps' key containing list of lap dictionaries
        """
        # Find the start of the assignment: racerLaps[ID] = {
        start_pattern = rf'racerLaps\[{re.escape(str(source_driver_id))}\]\s*=\s*(\{{)'
        start_match = re.search(start_pattern, html)
        
        if not start_match:
            return None
        
        # Find the matching closing brace by counting braces
        # This handles nested objects and arrays correctly
        start_pos = start_match.end(1) - 1  # Position of opening brace
        brace_count = 0
        bracket_count = 0  # Track array brackets too
        pos = start_pos
        end_pos = None
        
        while pos < len(html):
            char = html[pos]
            
            # Track braces for objects
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0 and bracket_count == 0:
                    # Found matching closing brace
                    end_pos = pos + 1
                    break
            
            # Track brackets for arrays
            elif char == '[':
                bracket_count += 1
            elif char == ']':
                bracket_count -= 1
            
            pos += 1
        
        if end_pos is None:
            logger.warning("lap_data_no_matching_brace", driver_id=source_driver_id)
            return None
        
        js_block = html[start_pos:end_pos]
        
        # Convert JavaScript object to Python dict
        # Replace single quotes with double quotes for JSON compatibility
        # But be careful - we need to handle nested quotes
        js_block_clean = js_block.replace("'", '"')
        
        try:
            # Try JSON parsing first
            driver_data = json.loads(js_block_clean)
        except json.JSONDecodeError:
            # Fallback: use ast.literal_eval with single quotes
            import ast
            try:
                # Convert back to single quotes for ast.literal_eval
                js_block_single = js_block.replace('"', "'")
                driver_data = ast.literal_eval(js_block_single)
            except (ValueError, SyntaxError) as e:
                logger.warning("lap_data_parse_error", driver_id=source_driver_id, error=str(e))
                return None
        
        return driver_data
    
    def parse(self, html: str, url: str, source_driver_id: str) -> List[ConnectorLap]:
        """
        Parse lap data for a specific driver from embedded JS.
        
        JavaScript Structure:
        var racerLaps = {};
        racerLaps[346997] = {
            'driverName': 'FELIX KOEGLER',
            'fastLap': '37.234',
            'avgLap': '38.983',
            'laps': [
                { 'lapNum': '0', 'pos': '1', 'time': '0', 'pace': '0', 'segments': [] },
                { 'lapNum': '1', 'pos': '1', 'time': '38.17', 'pace': '48/30:32.160', 'segments': [] },
                ...
            ]
        };
        
        Field Mapping:
        - lapNum -> lap_number (lap 0 is skipped)
        - pos -> position_on_lap
        - time -> lap_time_seconds (float) and lap_time_raw (string)
        - pace -> pace_string
        - elapsed_race_time is calculated as cumulative sum of lap times
        - segments -> segments (list)
        
        Edge Cases:
        - Empty laps arrays (non-starting drivers) return empty list
        - Lap 0 (start line) is skipped
        - Missing fields use defaults (0 for numbers, None for strings)
        
        Args:
            html: HTML content from race result page
            url: Source URL for error reporting
            source_driver_id: Driver ID to extract laps for
        
        Returns:
            List of lap data
        
        Raises:
            LapTableMissingError: If lap data cannot be found
            RacePageFormatError: If page structure is unexpected
        """
        logger.debug("parse_lap_data_start", url=url, driver_id=source_driver_id)
        
        try:
            # Extract driver's lap data block
            driver_data = self._extract_driver_laps_data(html, source_driver_id)
            
            if not driver_data:
                raise LapTableMissingError(
                    f"Driver {source_driver_id} not found in racerLaps data",
                    driver_id=source_driver_id,
                    race_id=None,
                )
            
            # Extract laps array
            laps_array = driver_data.get("laps", [])
            
            # Handle empty laps array (non-starting drivers)
            if not laps_array:
                logger.debug("driver_no_laps", driver_id=source_driver_id, url=url)
                return []
            
            laps = []
            elapsed_race_time = 0.0
            
            # Convert to ConnectorLap objects
            for lap_info in laps_array:
                try:
                    # Extract lap number (lapNum field)
                    lap_num_str = lap_info.get("lapNum", "0")
                    try:
                        lap_number = int(lap_num_str)
                    except (ValueError, TypeError):
                        lap_number = 0
                    
                    # Extract position (pos field)
                    pos_str = lap_info.get("pos", "1")
                    try:
                        position_on_lap = int(pos_str)
                    except (ValueError, TypeError):
                        position_on_lap = 1
                    
                    # Extract lap time (time field)
                    time_str = lap_info.get("time", "0")
                    lap_time_raw = str(time_str)
                    try:
                        lap_time_seconds = float(time_str)
                    except (ValueError, TypeError):
                        lap_time_seconds = 0.0
                    
                    # Skip lap 0 (start line)
                    if lap_number == 0:
                        continue
                    
                    # Calculate elapsed race time (cumulative sum)
                    elapsed_race_time += lap_time_seconds
                    
                    # Extract pace (pace field)
                    pace_string = lap_info.get("pace")
                    if pace_string:
                        pace_string = str(pace_string)
                    else:
                        pace_string = None
                    
                    # Extract segments (segments field)
                    segments = lap_info.get("segments", [])
                    if not isinstance(segments, list):
                        segments = []
                    
                    lap = ConnectorLap(
                        lap_number=lap_number,
                        position_on_lap=position_on_lap,
                        lap_time_seconds=lap_time_seconds,
                        lap_time_raw=lap_time_raw,
                        pace_string=pace_string,
                        elapsed_race_time=elapsed_race_time,
                        segments=segments,
                    )
                    laps.append(lap)
                    
                except Exception as e:
                    logger.warning("lap_parse_error", error=str(e), driver_id=source_driver_id, url=url)
                    continue
            
            logger.debug("parse_lap_data_success", driver_id=source_driver_id, lap_count=len(laps))
            return laps
        
        except (LapTableMissingError, RacePageFormatError):
            raise
        
        except Exception as e:
            logger.error("parse_lap_data_error", url=url, driver_id=source_driver_id, error=str(e))
            raise LapTableMissingError(
                f"Failed to parse lap data: {str(e)}",
                driver_id=source_driver_id,
                race_id=None,
            )
    
    def parse_all_drivers(self, html: str, url: str) -> Dict[str, List[ConnectorLap]]:
        """
        Parse lap data for all drivers from embedded JS.
        
        Args:
            html: HTML content from race result page
            url: Source URL for error reporting
        
        Returns:
            Dictionary keyed by source_driver_id -> list of ConnectorLap
        
        Raises:
            RacePageFormatError: If page structure is unexpected
        """
        logger.debug("parse_all_lap_data_start", url=url)
        
        try:
            # Find all racerLaps[ID] assignments by finding start patterns
            # Then extract each one using brace matching
            start_pattern = r'racerLaps\[(\d+)\]\s*=\s*(\{)'
            start_matches = list(re.finditer(start_pattern, html))
            
            all_laps = {}
            
            for start_match in start_matches:
                driver_id = start_match.group(1)
                
                # Find matching closing brace by counting braces and brackets
                start_pos = start_match.end(2) - 1  # Position of opening brace
                brace_count = 0
                bracket_count = 0  # Track array brackets
                pos = start_pos
                end_pos = None
                
                while pos < len(html):
                    char = html[pos]
                    
                    # Track braces for objects
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0 and bracket_count == 0:
                            end_pos = pos + 1
                            break
                    
                    # Track brackets for arrays
                    elif char == '[':
                        bracket_count += 1
                    elif char == ']':
                        bracket_count -= 1
                    
                    pos += 1
                
                if end_pos is None:
                    logger.warning("lap_data_no_matching_brace_all", driver_id=driver_id)
                    continue
                
                js_block = html[start_pos:end_pos]
                
                try:
                    # Parse JavaScript object
                    js_block_clean = js_block.replace("'", '"')
                    
                    try:
                        driver_data = json.loads(js_block_clean)
                    except json.JSONDecodeError:
                        import ast
                        js_block_single = js_block.replace('"', "'")
                        driver_data = ast.literal_eval(js_block_single)
                    
                    # Extract laps array
                    laps_array = driver_data.get("laps", [])
                    
                    # Handle empty laps array
                    if not laps_array:
                        all_laps[str(driver_id)] = []
                        continue
                    
                    laps = []
                    elapsed_race_time = 0.0
                    
                    for lap_info in laps_array:
                        try:
                            # Extract fields
                            lap_num_str = lap_info.get("lapNum", "0")
                            try:
                                lap_number = int(lap_num_str)
                            except (ValueError, TypeError):
                                lap_number = 0
                            
                            # Skip lap 0
                            if lap_number == 0:
                                continue
                            
                            pos_str = lap_info.get("pos", "1")
                            try:
                                position_on_lap = int(pos_str)
                            except (ValueError, TypeError):
                                position_on_lap = 1
                            
                            time_str = lap_info.get("time", "0")
                            lap_time_raw = str(time_str)
                            try:
                                lap_time_seconds = float(time_str)
                            except (ValueError, TypeError):
                                lap_time_seconds = 0.0
                            
                            # Calculate elapsed time
                            elapsed_race_time += lap_time_seconds
                            
                            pace_string = lap_info.get("pace")
                            if pace_string:
                                pace_string = str(pace_string)
                            else:
                                pace_string = None
                            
                            segments = lap_info.get("segments", [])
                            if not isinstance(segments, list):
                                segments = []
                            
                            lap = ConnectorLap(
                                lap_number=lap_number,
                                position_on_lap=position_on_lap,
                                lap_time_seconds=lap_time_seconds,
                                lap_time_raw=lap_time_raw,
                                pace_string=pace_string,
                                elapsed_race_time=elapsed_race_time,
                                segments=segments,
                            )
                            laps.append(lap)
                            
                        except Exception as e:
                            logger.warning("lap_parse_error_all", error=str(e), driver_id=driver_id, url=url)
                            continue
                    
                    all_laps[str(driver_id)] = laps
                    
                except Exception as e:
                    logger.warning("driver_laps_parse_error", error=str(e), driver_id=driver_id, url=url)
                    continue
            
            if not all_laps:
                raise RacePageFormatError(
                    "No driver lap data found in racerLaps",
                    url=url,
                )
            
            logger.debug("parse_all_lap_data_success", driver_count=len(all_laps))
            return all_laps
        
        except RacePageFormatError:
            raise
        
        except Exception as e:
            logger.error("parse_all_lap_data_error", url=url, error=str(e))
            raise RacePageFormatError(
                f"Failed to parse lap data for all drivers: {str(e)}",
                url=url,
            )

