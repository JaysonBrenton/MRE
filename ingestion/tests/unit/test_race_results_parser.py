"""Unit tests for RaceResultsParser."""

import pytest
from pathlib import Path

from ingestion.connectors.liverc.parsers.race_results_parser import RaceResultsParser
from ingestion.connectors.liverc.models import ConnectorRaceResult
from ingestion.ingestion.errors import RacePageFormatError


@pytest.fixture
def parser():
    """Create RaceResultsParser instance."""
    return RaceResultsParser()


@pytest.fixture
def race_html():
    """Load race results HTML fixture."""
    fixture_path = Path(__file__).parent.parent / "fixtures" / "liverc" / "486677" / "race.6304829.html"
    return fixture_path.read_text(encoding="utf-8")


def test_parse_race_results_success(parser, race_html):
    """Test successful parsing of race results."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    results = parser.parse(race_html, url)
    
    assert len(results) > 0
    assert all(isinstance(result, ConnectorRaceResult) for result in results)
    
    # Check first result
    first_result = results[0]
    assert first_result.source_driver_id
    assert first_result.display_name
    assert first_result.position_final > 0
    assert first_result.laps_completed >= 0


def test_parse_race_results_extracts_driver_ids(parser, race_html):
    """Test that driver IDs are correctly extracted."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    results = parser.parse(race_html, url)
    
    # All driver IDs should be numeric strings
    for result in results:
        assert result.source_driver_id
        assert result.source_driver_id.isdigit()


def test_parse_race_results_matches_driver_names(parser, race_html):
    """Test that driver IDs are matched by name when data-driver-id is missing."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    results = parser.parse(race_html, url)
    
    # RILEY LANDER should be found (non-starting driver without data-driver-id)
    riley_lander = next((r for r in results if r.display_name == "RILEY LANDER"), None)
    assert riley_lander is not None
    assert riley_lander.source_driver_id == "731648"


def test_parse_race_results_handles_non_starting_drivers(parser, race_html):
    """Test that non-starting drivers are handled correctly."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    results = parser.parse(race_html, url)
    
    # Find RILEY LANDER (non-starting driver)
    riley_lander = next((r for r in results if r.display_name == "RILEY LANDER"), None)
    assert riley_lander is not None
    
    # Non-starting driver should have:
    assert riley_lander.laps_completed == 0
    assert riley_lander.total_time_raw is None
    assert riley_lander.fast_lap_time is None
    assert riley_lander.avg_lap_time is None
    assert riley_lander.consistency is None


def test_parse_race_results_parses_laps_time(parser, race_html):
    """Test that laps/time format is correctly parsed."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    results = parser.parse(race_html, url)
    
    # Find a result with laps completed
    result_with_laps = next((r for r in results if r.laps_completed > 0), None)
    assert result_with_laps is not None
    
    # Should have total_time_raw in format "47/30:31.382"
    if result_with_laps.total_time_raw:
        assert "/" in result_with_laps.total_time_raw
        assert result_with_laps.laps_completed > 0


def test_parse_race_results_extracts_times(parser, race_html):
    """Test that lap times are correctly extracted."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    results = parser.parse(race_html, url)
    
    # Find a result with times
    result_with_times = next((r for r in results if r.fast_lap_time is not None), None)
    assert result_with_times is not None
    
    assert result_with_times.fast_lap_time > 0
    if result_with_times.avg_lap_time:
        assert result_with_times.avg_lap_time > 0


def test_parse_race_results_extracts_consistency(parser, race_html):
    """Test that consistency percentage is correctly extracted."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    results = parser.parse(race_html, url)
    
    # Find a result with consistency
    result_with_consistency = next((r for r in results if r.consistency is not None), None)
    assert result_with_consistency is not None
    
    assert 0 <= result_with_consistency.consistency <= 100


def test_parse_race_results_invalid_html(parser):
    """Test parsing invalid HTML raises error."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    
    with pytest.raises(RacePageFormatError):
        parser.parse("<html><body>No results here</body></html>", url)

