# @fileoverview Multi-main list parser for LiveRC
#
# @created 2026-02-17
# @creator Implementation
# @lastModified 2026-02-17
#
# @description Parser for extracting view_multi_main_result links from event page
#
# @purpose Extracts multi-main result links from event detail page for triple/double main classes

import re
from typing import List
from urllib.parse import urlparse, parse_qs

from selectolax.parser import HTMLParser

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.models import ConnectorMultiMainSummary
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


class MultiMainListParser:
    """Parser for multi-main result links from event page."""

    def parse(self, html: str, url: str) -> List[ConnectorMultiMainSummary]:
        """
        Parse multi-main result links from HTML.

        Finds all anchors with href containing view_multi_main_result.
        Link text format: "1/8 Electric Buggy Triple A-Main Results"

        Args:
            html: HTML content from event detail page
            url: Source URL for error reporting

        Returns:
            List of multi-main summaries (source_multi_main_id, class_label)
        """
        logger.debug("parse_multi_main_list_start", url=url)

        try:
            tree = HTMLParser(html)
            results = []

            for link in tree.css('a[href*="view_multi_main_result"]'):
                href = link.attributes.get("href", "")
                if not href:
                    continue

                parsed = urlparse(href)
                query_params = parse_qs(parsed.query)
                multi_main_id = query_params.get("id", [None])[0]
                if not multi_main_id:
                    continue

                # Extract class label from link text
                # Format: "1/8 Electric Buggy Triple A-Main Results" or with icon
                class_label = link.text().strip()
                # Remove "Results" suffix if present
                if class_label.lower().endswith(" results"):
                    class_label = class_label[:-8].strip()
                if not class_label:
                    continue

                results.append(
                    ConnectorMultiMainSummary(
                        source_multi_main_id=str(multi_main_id),
                        class_label=class_label,
                    )
                )

            logger.debug("parse_multi_main_list_success", count=len(results), url=url)
            return results

        except Exception as e:
            logger.error("parse_multi_main_list_error", url=url, error=str(e))
            raise EventPageFormatError(
                f"Failed to parse multi-main list: {str(e)}",
                url=url,
            )
