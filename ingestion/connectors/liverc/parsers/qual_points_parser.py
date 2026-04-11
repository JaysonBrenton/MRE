# @fileoverview Qual Points parser for LiveRC
#
# @created 2026-03-06
# @description Parser for view_points page (Qual Points best X of Y)
#
# @purpose Extracts driver positions, points, and round breakdown from Qual Points page

import re
from typing import List, Optional, Dict, Any

from selectolax.parser import HTMLParser

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import (
    ConnectorQualPointsResult,
    ConnectorQualPointsEntry,
)
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


def _parse_round_cell(text: str) -> Optional[Dict[str, Any]]:
    """Parse round cell e.g. '2 : 16/10:18.631' or '0 : 17/10:34.713'."""
    if not text or not text.strip():
        return None
    text = text.strip()
    # Format: "position : laps/time" or "position : laps/time (DNF)"
    if " : " in text:
        parts = text.split(" : ", 1)
        try:
            pos = int(parts[0].strip())
            value = parts[1].strip() if len(parts) > 1 else ""
            return {"position": pos, "value": value}
        except (ValueError, IndexError):
            pass
    return None


class QualPointsParser:
    """Parser for view_points (Qual Points) page."""

    def parse(
        self,
        html: str,
        url: str,
        source_points_id: str,
        label: str,
        rounds_completed: Optional[int] = None,
        total_rounds: Optional[int] = None,
    ) -> ConnectorQualPointsResult:
        """
        Parse Qual Points tables from HTML.

        Page has multiple class tables (Buggy, EP Buggy, etc.). Each table has:
        # | Driver | Result | Tie Breaker | Round 1 | Round 2 | Round 3 | Round 4

        Args:
            html: HTML content from view_points page
            url: Source URL
            source_points_id: ID from URL
            label: Label (e.g. "Qual Points (2 of 4)")
            rounds_completed: Parsed from label if present
            total_rounds: Parsed from label if present

        Returns:
            ConnectorQualPointsResult
        """
        logger.debug(
            "parse_qual_points_start",
            url=url,
            source_points_id=source_points_id,
        )

        try:
            tree = HTMLParser(html)
            entries: List[ConnectorQualPointsEntry] = []

            # Find all tables - Qual Points page has one table per class
            tables = tree.css("table")
            for table in tables:
                # Check for Qual Points table structure (has Driver, Result columns)
                header = table.css("thead tr th") or table.css("tr:first-child th") or table.css("tr th")
                header_texts = [h.text().strip().lower() for h in header] if header else []
                if "driver" not in header_texts or "result" not in header_texts:
                    continue

                # Find column indices
                col_idx = {}
                for i, h in enumerate(header):
                    t = h.text().strip().lower()
                    if t == "#" or t == "pos":
                        col_idx["position"] = i
                    elif t == "driver":
                        col_idx["driver"] = i
                    elif t == "result":
                        col_idx["result"] = i
                    elif t.startswith("round"):
                        if "rounds" not in col_idx:
                            col_idx["rounds"] = []
                        col_idx["rounds"].append(i)

                if "position" not in col_idx or "driver" not in col_idx or "result" not in col_idx:
                    continue

                # Get class name from preceding element (e.g. "Buggy Tie Breaker" -> Buggy)
                class_name = "Unknown"
                prev = table.prev
                while prev:
                    if hasattr(prev, "text"):
                        prev_text = prev.text()
                        if prev_text and "tie breaker" in prev_text.lower():
                            # Extract class: "Buggy Tie Breaker: IFMAR" -> Buggy
                            match = re.match(r"^([^Tt]+)\s+Tie\s+Breaker", prev_text.strip())
                            if match:
                                class_name = match.group(1).strip()
                            break
                    prev = getattr(prev, "prev", None) or getattr(prev, "parent", None)
                    if prev is None:
                        break

                # Parse data rows
                rows = table.css("tbody tr") if table.css("tbody tr") else table.css("tr")[1:]
                for row in rows:
                    tds = row.css("td")
                    if len(tds) < 3:
                        continue
                    try:
                        pos_idx = col_idx.get("position", 0)
                        driver_idx = col_idx.get("driver", 1)
                        result_idx = col_idx.get("result", 2)
                        if max(pos_idx, driver_idx, result_idx) >= len(tds):
                            continue
                        position = int(tds[pos_idx].text().strip())
                        driver_name = tds[driver_idx].text().strip()
                        points = int(tds[result_idx].text().strip())
                    except (ValueError, IndexError):
                        continue
                    if not driver_name:
                        continue

                    round_breakdown: Dict[str, Any] = {}
                    for i, round_idx in enumerate(col_idx.get("rounds", [])):
                        if round_idx < len(tds):
                            parsed = _parse_round_cell(tds[round_idx].text())
                            if parsed:
                                round_breakdown[f"round_{i + 1}"] = parsed

                    entries.append(
                        ConnectorQualPointsEntry(
                            class_name=class_name,
                            position=position,
                            driver_name=driver_name,
                            points=points,
                            round_breakdown=round_breakdown,
                        )
                    )

            result = ConnectorQualPointsResult(
                source_points_id=source_points_id,
                label=label,
                rounds_completed=rounds_completed,
                total_rounds=total_rounds,
                entries=entries,
            )

            logger.debug(
                "parse_qual_points_success",
                url=url,
                entry_count=len(entries),
            )
            return result

        except Exception as e:
            logger.error("parse_qual_points_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to parse Qual Points: {str(e)}",
                url=url,
            )
