# @fileoverview Rankings list parser for LiveRC
#
# @created 2026-03-06
# @description Parser for extracting view_points and view_round_ranking links from event page
#
# @purpose Extracts Qual Points and Round Rankings links from "Overall Results & Rankings" section

import re
from typing import List, Optional, Tuple
from urllib.parse import urlparse, parse_qs

from selectolax.parser import HTMLParser

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import (
    ConnectorQualPointsSummary,
    ConnectorRoundRankingSummary,
)
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


def _parse_qual_points_label(label: str) -> Tuple[Optional[int], Optional[int]]:
    """
    Parse "Qual Points (2 of 4)" or "Results (1 of 3)" to extract rounds_completed, total_rounds.
    Returns (rounds_completed, total_rounds) or (None, None).
    """
    # Match: "Qual Points (2 of 4)", "Results (1 of 3)", "Qual Points (best 2 of 4)"
    match = re.search(r"\((\d+)\s+of\s+(\d+)\)", label, re.IGNORECASE)
    if match:
        try:
            return (int(match.group(1)), int(match.group(2)))
        except ValueError:
            pass
    return (None, None)


class RankingsListParser:
    """Parser for Qual Points and Round Rankings links from event page."""

    def parse(
        self,
        html: str,
        url: str,
    ) -> Tuple[List[ConnectorQualPointsSummary], List[ConnectorRoundRankingSummary]]:
        """
        Parse Qual Points and Round Rankings links from HTML.

        Finds anchors in the "Overall Results & Rankings" section:
        - view_points: "Qual Points (2 of 4)", "Results (1 of 3)"
        - view_round_ranking: "Qualifier Round 1 Rankings", "Practice Round 1 Rankings"

        Args:
            html: HTML content from event detail page
            url: Source URL for error reporting

        Returns:
            Tuple of (qual_points_summaries, round_ranking_summaries)
        """
        logger.debug("parse_rankings_list_start", url=url)

        try:
            tree = HTMLParser(html)
            qual_points: List[ConnectorQualPointsSummary] = []
            round_rankings: List[ConnectorRoundRankingSummary] = []

            # Qual Points: view_points
            for link in tree.css('a[href*="view_points"]'):
                href = link.attributes.get("href", "")
                if not href:
                    continue

                parsed = urlparse(href)
                query_params = parse_qs(parsed.query)
                points_id = query_params.get("id", [None])[0]
                if not points_id:
                    continue

                label = link.text().strip()
                if not label:
                    continue

                rounds_completed, total_rounds = _parse_qual_points_label(label)
                qual_points.append(
                    ConnectorQualPointsSummary(
                        source_points_id=str(points_id),
                        label=label,
                        rounds_completed=rounds_completed,
                        total_rounds=total_rounds,
                    )
                )

            # Round Rankings: view_round_ranking
            for link in tree.css('a[href*="view_round_ranking"]'):
                href = link.attributes.get("href", "")
                if not href:
                    continue

                parsed = urlparse(href)
                query_params = parse_qs(parsed.query)
                round_id = query_params.get("id", [None])[0]
                if not round_id:
                    continue

                # order_type from query param: o=laps_time, o=top_3_consecutive
                order_type = query_params.get("o", [None])[0]

                label = link.text().strip()
                if not label:
                    continue

                round_rankings.append(
                    ConnectorRoundRankingSummary(
                        source_round_id=str(round_id),
                        label=label,
                        order_type=order_type,
                    )
                )

            logger.debug(
                "parse_rankings_list_success",
                qual_points_count=len(qual_points),
                round_rankings_count=len(round_rankings),
                url=url,
            )
            return (qual_points, round_rankings)

        except Exception as e:
            logger.error("parse_rankings_list_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to parse rankings list: {str(e)}",
                url=url,
            )
