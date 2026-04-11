"""Unit tests for RankingsListParser."""

import pytest
from pathlib import Path

from ingestion.connectors.liverc.parsers.rankings_list_parser import RankingsListParser


@pytest.fixture
def parser():
    """Create RankingsListParser instance."""
    return RankingsListParser()


@pytest.fixture
def event_html():
    """Load event detail HTML fixture (has Overall Results & Rankings section)."""
    fixture_path = Path(__file__).parent.parent / "fixtures" / "liverc" / "486677" / "event.html"
    return fixture_path.read_text(encoding="utf-8")


def test_parse_rankings_list_extracts_qual_points(parser, event_html):
    """Test that Qual Points links are extracted from Overall Results & Rankings."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    qual_points, round_rankings = parser.parse(event_html, url)

    # Fixture has "Results (1 of 3)" view_points link
    assert len(qual_points) >= 1
    first = qual_points[0]
    assert first.source_points_id
    assert first.label
    assert "1 of 3" in first.label
    assert first.rounds_completed == 1
    assert first.total_rounds == 3


def test_parse_rankings_list_extracts_round_rankings(parser, event_html):
    """Test that Round Ranking links are extracted."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    qual_points, round_rankings = parser.parse(event_html, url)

    # Fixture has Qualifier Round 1/2/3 Rankings
    assert len(round_rankings) >= 1
    first = round_rankings[0]
    assert first.source_round_id
    assert first.label
    assert "Rankings" in first.label or "ranking" in first.label.lower()
    assert first.order_type == "laps_time"
