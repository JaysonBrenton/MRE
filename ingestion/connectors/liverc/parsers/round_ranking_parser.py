# @fileoverview Round Ranking parser for LiveRC
#
# @created 2026-03-06
# @description Parser for view_round_ranking page (Practice/Qualifier round rankings)
#
# @purpose Extracts driver positions and ranking values from round ranking page

import re
from typing import List, Optional, Tuple

from selectolax.parser import HTMLParser

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import (
    ConnectorRoundRankingResult,
    ConnectorRoundRankingEntry,
)
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


def _parse_laps_time(value: str) -> Tuple[Optional[int], Optional[float]]:
    """Parse '16/10:32.136' to (laps, total_time_seconds)."""
    if not value or not value.strip():
        return (None, None)
    value = value.strip()
    # Format: "laps/mm:ss.mmm" or "laps/m:ss.mmm"
    if "/" in value:
        parts = value.split("/", 1)
        try:
            laps = int(parts[0].strip())
            time_str = parts[1].strip() if len(parts) > 1 else ""
            if ":" in time_str:
                time_parts = time_str.split(":")
                if len(time_parts) == 2:
                    minutes = int(time_parts[0])
                    seconds = float(time_parts[1])
                    total_seconds = minutes * 60 + seconds
                    return (laps, total_seconds)
            return (laps, None)
        except (ValueError, IndexError):
            pass
    return (None, None)


class RoundRankingParser:
    """Parser for view_round_ranking page."""

    def parse(
        self,
        html: str,
        url: str,
        source_round_id: str,
        label: str,
        order_type: Optional[str] = None,
    ) -> ConnectorRoundRankingResult:
        """
        Parse Round Ranking tables from HTML.

        Page has tables per class with position, driver, and ranking metrics
        (laps/time, top 2 consecutive, etc.).

        Args:
            html: HTML content from view_round_ranking page
            url: Source URL
            source_round_id: ID from URL
            label: Label (e.g. "Qualifier Round 1 Rankings")
            order_type: Order type from URL (e.g. "laps_time", "top_3_consecutive")

        Returns:
            ConnectorRoundRankingResult
        """
        logger.debug(
            "parse_round_ranking_start",
            url=url,
            source_round_id=source_round_id,
        )

        try:
            tree = HTMLParser(html)
            entries: List[ConnectorRoundRankingEntry] = []

            # Find tables - each class has a table
            tables = tree.css("table")
            for table in tables:
                rows = table.css("tbody tr") if table.css("tbody tr") else table.css("tr")[1:]
                if not rows:
                    continue

                # Infer class from preceding heading or use first data row
                class_name = "Unknown"
                prev = table.prev
                for _ in range(5):  # Check up to 5 ancestors/siblings
                    if prev is None:
                        break
                    if hasattr(prev, "text"):
                        t = prev.text()
                        if t and len(t.strip()) < 50 and "ranking" not in t.lower():
                            class_name = t.strip()
                            break
                    prev = getattr(prev, "prev", None) or getattr(prev, "parent", None)

                for row in rows:
                    tds = row.css("td")
                    if len(tds) < 2:
                        continue
                    try:
                        position = int(tds[0].text().strip())
                        driver_name = tds[1].text().strip() if len(tds) > 1 else ""
                    except (ValueError, IndexError):
                        continue
                    if not driver_name:
                        continue

                    laps, total_time_seconds = None, None
                    ranking_value_raw = None
                    if len(tds) >= 3:
                        val = tds[2].text().strip()
                        ranking_value_raw = val
                        laps, total_time_seconds = _parse_laps_time(val)

                    entries.append(
                        ConnectorRoundRankingEntry(
                            class_name=class_name,
                            position=position,
                            driver_name=driver_name,
                            laps=laps,
                            total_time_seconds=total_time_seconds,
                            ranking_value_raw=ranking_value_raw,
                        )
                    )

            result = ConnectorRoundRankingResult(
                source_round_id=source_round_id,
                label=label,
                order_type=order_type,
                entries=entries,
            )

            logger.debug(
                "parse_round_ranking_success",
                url=url,
                entry_count=len(entries),
            )
            return result

        except Exception as e:
            logger.error("parse_round_ranking_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to parse Round Ranking: {str(e)}",
                url=url,
            )
