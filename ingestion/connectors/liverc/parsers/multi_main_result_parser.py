# @fileoverview Multi-main result parser for LiveRC
#
# @created 2026-02-17
# @creator Implementation
# @lastModified 2026-02-17
#
# @description Parser for view_multi_main_result page
#
# @purpose Extracts overall standings from triple/double main results page

import re
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse, parse_qs

from selectolax.parser import HTMLParser

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import ConnectorMultiMainResult, ConnectorMultiMainEntry
from ingestion.ingestion.errors import RacePageFormatError

logger = get_logger(__name__)

# Parse "1st (1pts) : 16/10:01.133" or "8th (8pts) : 0/0.000"
MAIN_CELL_PATTERN = re.compile(
    r"(\d+)(?:st|nd|rd|th)\s*\((\d+)pts?\)\s*:\s*(.+)",
    re.IGNORECASE,
)


def _parse_main_cell(text: str) -> Optional[Dict[str, Any]]:
    """Parse a main result cell e.g. '1st (1pts) : 16/10:01.133'."""
    if not text or not text.strip():
        return None
    text = text.strip()
    match = MAIN_CELL_PATTERN.match(text)
    if not match:
        return None
    try:
        position = int(match.group(1))
        points = int(match.group(2))
        laps_time = match.group(3).strip()
        return {"position": position, "points": points, "laps_time": laps_time}
    except (ValueError, IndexError):
        return None


class MultiMainResultParser:
    """Parser for view_multi_main_result page."""

    def parse(
        self,
        html: str,
        url: str,
        source_multi_main_id: str,
        class_label: str,
    ) -> ConnectorMultiMainResult:
        """
        Parse multi-main result table from HTML.

        Table: table.multi_main
        Header row has Pos, Seeded, Driver, Points, then main columns (A1, A2, A3)
        Sub-header: "Tie Breaker: ... Completed: X of Y"

        Args:
            html: HTML content from view_multi_main_result page
            url: Source URL
            source_multi_main_id: ID from URL
            class_label: Class label (from event page link or panel heading)

        Returns:
            ConnectorMultiMainResult
        """
        logger.debug(
            "parse_multi_main_result_start",
            url=url,
            source_multi_main_id=source_multi_main_id,
        )

        try:
            tree = HTMLParser(html)

            # Find table.multi_main
            table = tree.css_first("table.multi_main")
            if not table:
                table = tree.css_first("table[class*='multi_main']")
            if not table:
                raise RacePageFormatError(
                    "Multi-main results table (table.multi_main) not found",
                    url=url,
                )

            # Parse tie breaker and completed from class_sub_header
            tie_breaker = None
            completed_mains = 0
            total_mains = 0
            sub_header = table.css_first("div.class_sub_header")
            if sub_header:
                sub_text = sub_header.text()
                tb_match = re.search(r"Tie Breaker:\s*(.+)", sub_text, re.IGNORECASE)
                if tb_match:
                    tie_breaker = tb_match.group(1).strip().split("\n")[0].strip()
                comp_match = re.search(r"Completed:\s*(\d+)\s+of\s+(\d+)", sub_text, re.IGNORECASE)
                if comp_match:
                    completed_mains = int(comp_match.group(1))
                    total_mains = int(comp_match.group(2))

            # Get main column labels from header (skip Pos, Seeded, Driver, Points)
            main_labels: List[str] = []
            header_row = table.css("thead tr")
            for row in header_row:
                ths = row.css("th")
                if len(ths) >= 5:
                    for th in ths[4:]:
                        label = th.text().strip()
                        if label and label not in ("Pos", "Seeded", "Driver", "Points"):
                            main_labels.append(label)
                    break

            if not main_labels and total_mains > 0:
                main_labels = [f"A{i + 1}" for i in range(total_mains)]
            elif not main_labels:
                main_labels = ["A1", "A2", "A3"]

            # Parse data rows
            entries: List[ConnectorMultiMainEntry] = []
            tbody_rows = table.css("tbody tr")
            for row in tbody_rows:
                tds = row.css("td")
                if len(tds) < 4:
                    continue
                try:
                    position = int(tds[0].text().strip())
                    seeded_text = tds[1].text().strip()
                    seeded_position = int(seeded_text) if seeded_text else None
                    driver_name = tds[2].text().strip()
                    points = int(tds[3].text().strip())
                except (ValueError, IndexError):
                    continue
                if not driver_name:
                    continue

                main_breakdown: Dict[str, Dict[str, Any]] = {}
                for i, label in enumerate(main_labels):
                    if i + 4 < len(tds):
                        cell_text = tds[i + 4].text()
                        parsed = _parse_main_cell(cell_text)
                        if parsed:
                            main_breakdown[label] = parsed

                entries.append(
                    ConnectorMultiMainEntry(
                        position=position,
                        seeded_position=seeded_position,
                        driver_name=driver_name,
                        points=points,
                        main_breakdown=main_breakdown,
                    )
                )

            if completed_mains == 0 and entries:
                completed_mains = len(main_labels)
            if total_mains == 0:
                total_mains = len(main_labels) or 3

            result = ConnectorMultiMainResult(
                source_multi_main_id=source_multi_main_id,
                class_label=class_label,
                tie_breaker=tie_breaker,
                completed_mains=completed_mains,
                total_mains=total_mains,
                entries=entries,
            )

            logger.debug(
                "parse_multi_main_result_success",
                url=url,
                entry_count=len(entries),
            )
            return result

        except RacePageFormatError:
            raise
        except Exception as e:
            logger.error("parse_multi_main_result_error", url=url, error=str(e))
            raise RacePageFormatError(
                f"Failed to parse multi-main result: {str(e)}",
                url=url,
            )
