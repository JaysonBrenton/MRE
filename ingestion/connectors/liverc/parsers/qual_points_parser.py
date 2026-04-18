# @fileoverview Qual Points parser for LiveRC
#
# @created 2026-03-06
# @description Parser for view_points page (Qual Points best X of Y)
#
# @purpose Extracts driver positions, points, and round breakdown from Qual Points page

import re
from typing import Any, Dict, List, Optional

from selectolax.parser import HTMLParser

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import (
    ConnectorQualPointsResult,
    ConnectorQualPointsEntry,
)
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


def _find_qual_points_column_header_row(table) -> tuple:
    """
    LiveRC Qual Points tables use either:
    - Legacy: one thead row with # | Driver | Result | ...
    - Current: first thead row is class title (often one colspan th); second row is columns.

    Column indices for tbody td must come from the row that actually matches data columns.
    Returns (list of th nodes, class_name_hint) or ([], "Unknown").
    """
    thead = table.css("thead")
    if not thead:
        return [], "Unknown"

    class_name = "Unknown"
    rows = thead[0].css("tr")
    if not rows:
        return [], class_name

    # Class label: first row often has span.class_header inside a colspan th
    first_tr = rows[0]
    span = first_tr.css_first("span.class_header")
    if span is not None and span.text().strip():
        class_name = span.text().strip()
    else:
        first_th = first_tr.css_first("th")
        if first_th is not None:
            colspan = first_th.attributes.get("colspan", "") or ""
            try:
                wide = colspan and int(colspan) > 1
            except ValueError:
                wide = False
            if wide:
                raw = first_th.text().strip().splitlines()[0].strip()
                if raw and "tie breaker" not in raw.lower():
                    class_name = raw

    column_row_ths = []
    for tr in rows:
        ths = tr.css("th")
        if not ths:
            continue
        texts = [h.text().strip().lower() for h in ths]
        if "driver" in texts and "result" in texts and ("#" in texts or "pos" in texts):
            column_row_ths = ths
            break

    return column_row_ths, class_name


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


def _parse_result_column_to_points(raw: str) -> int:
    """
    LiveRC Qual Points "Result" column is either integer championship points,
    or an aggregate laps/time string (e.g. "11/5:09.946") when standings use total time.
    """
    text = (raw or "").strip()
    if not text:
        return 0
    try:
        return int(text)
    except ValueError:
        return 0


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
                header, class_from_thead = _find_qual_points_column_header_row(table)
                if not header:
                    continue
                header_texts = [h.text().strip().lower() for h in header]
                if "driver" not in header_texts or "result" not in header_texts:
                    continue

                # Column indices align with tbody td columns (0-based)
                col_idx: Dict[str, Any] = {}
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

                class_name = class_from_thead if class_from_thead != "Unknown" else "Unknown"
                if class_name == "Unknown":
                    # Legacy: class before table e.g. "Buggy Tie Breaker"
                    prev = table.prev
                    while prev:
                        if hasattr(prev, "text"):
                            prev_text = prev.text()
                            if prev_text and "tie breaker" in prev_text.lower():
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
                        points = _parse_result_column_to_points(tds[result_idx].text())
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
