"""Parser for LiveRC event_overall_ranking page."""

from typing import List, Optional

from selectolax.parser import HTMLParser, Node

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import (
    ConnectorOverallFinalRankingEntry,
    ConnectorOverallFinalRankingResult,
)
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


def _safe_text(node: Optional[Node]) -> str:
    if node is None:
        return ""
    return node.text().strip()


def _parse_position(raw: str) -> Optional[int]:
    text = raw.strip()
    if not text:
        return None
    digits = []
    for ch in text:
        if ch.isdigit():
            digits.append(ch)
        elif digits:
            break
    if not digits:
        return None
    try:
        return int("".join(digits))
    except ValueError:
        return None


class OverallFinalRankingParser:
    """Parse class rows from LiveRC Overall Final Ranking."""

    def parse(
        self,
        html: str,
        url: str,
        source_overall_ranking_id: str,
        label: str,
    ) -> ConnectorOverallFinalRankingResult:
        logger.debug(
            "parse_overall_final_ranking_start",
            url=url,
            source_overall_ranking_id=source_overall_ranking_id,
        )

        try:
            tree = HTMLParser(html)
            entries: List[ConnectorOverallFinalRankingEntry] = []

            for table in tree.css("table"):
                class_name = _safe_text(table.css_first(".class_header"))
                if not class_name:
                    continue

                header_row = table.css_first("thead tr:last-child")
                if not header_row:
                    continue
                headers = [h.text().strip().lower() for h in header_row.css("th")]
                if "pos" not in headers or "driver" not in headers:
                    continue

                def idx(name: str) -> Optional[int]:
                    try:
                        return headers.index(name)
                    except ValueError:
                        return None

                pos_idx = idx("pos")
                driver_idx = idx("driver")
                race_idx = idx("race")
                result_idx = idx("result")
                if pos_idx is None or driver_idx is None:
                    continue

                for row in table.css("tbody tr"):
                    cells = row.css("td")
                    if not cells:
                        continue
                    if pos_idx >= len(cells) or driver_idx >= len(cells):
                        continue

                    position = _parse_position(_safe_text(cells[pos_idx]))
                    driver_name = _safe_text(cells[driver_idx])
                    if position is None or not driver_name:
                        continue

                    race_label = (
                        _safe_text(cells[race_idx])
                        if race_idx is not None and race_idx < len(cells)
                        else ""
                    )
                    result_raw = (
                        _safe_text(cells[result_idx])
                        if result_idx is not None and result_idx < len(cells)
                        else ""
                    )

                    entries.append(
                        ConnectorOverallFinalRankingEntry(
                            class_name=class_name,
                            position=position,
                            driver_name=driver_name,
                            race_label=race_label or None,
                            result_raw=result_raw or None,
                        )
                    )

            if not entries:
                raise EventPageFormatError(
                    "No Overall Final Ranking entries found",
                    url=url,
                )

            result = ConnectorOverallFinalRankingResult(
                source_overall_ranking_id=source_overall_ranking_id,
                label=label,
                entries=entries,
            )
            logger.debug(
                "parse_overall_final_ranking_success",
                url=url,
                entry_count=len(entries),
            )
            return result
        except EventPageFormatError:
            raise
        except Exception as e:
            logger.error("parse_overall_final_ranking_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to parse overall final ranking: {str(e)}",
                url=url,
            )
