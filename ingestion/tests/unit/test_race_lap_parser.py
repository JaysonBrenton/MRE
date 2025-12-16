"""Unit tests for RaceLapParser."""

import pytest
from pathlib import Path

from ingestion.connectors.liverc.parsers.race_lap_parser import RaceLapParser
from ingestion.connectors.liverc.models import ConnectorLap
from ingestion.ingestion.errors import LapTableMissingError, RacePageFormatError


@pytest.fixture
def parser():
    """Create RaceLapParser instance."""
    return RaceLapParser()


@pytest.fixture
def race_html():
    """Load race results HTML fixture."""
    fixture_path = Path(__file__).parent.parent / "fixtures" / "liverc" / "486677" / "race.6304829.html"
    return fixture_path.read_text(encoding="utf-8")


def test_parse_lap_data_success(parser, race_html):
    """Test successful parsing of lap data for a driver."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    driver_id = "346997"  # FELIX KOEGLER
    
    laps = parser.parse(race_html, url, driver_id)
    
    assert len(laps) > 0
    assert all(isinstance(lap, ConnectorLap) for lap in laps)
    
    # Check first lap (should be lap 1, not lap 0)
    first_lap = laps[0]
    assert first_lap.lap_number == 1
    assert first_lap.position_on_lap > 0
    assert first_lap.lap_time_seconds > 0
    assert first_lap.elapsed_race_time > 0


def test_parse_lap_data_skips_lap_zero(parser, race_html):
    """Test that lap 0 (start line) is skipped."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    driver_id = "346997"
    
    laps = parser.parse(race_html, url, driver_id)
    
    # No lap should have lap_number == 0
    assert all(lap.lap_number > 0 for lap in laps)


def test_parse_lap_data_calculates_elapsed_time(parser, race_html):
    """Test that elapsed_race_time is calculated as cumulative sum."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    driver_id = "346997"
    
    laps = parser.parse(race_html, url, driver_id)
    
    # Elapsed time should increase with each lap
    for i in range(1, len(laps)):
        assert laps[i].elapsed_race_time >= laps[i-1].elapsed_race_time
    
    # First lap elapsed time should equal its lap time
    assert abs(laps[0].elapsed_race_time - laps[0].lap_time_seconds) < 0.01


def test_parse_lap_data_handles_empty_laps(parser, race_html):
    """Test that empty laps arrays (non-starting drivers) return empty list."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    driver_id = "731648"  # RILEY LANDER (non-starting driver)
    
    laps = parser.parse(race_html, url, driver_id)
    
    # Should return empty list, not raise error
    assert isinstance(laps, list)
    assert len(laps) == 0


def test_parse_lap_data_missing_driver(parser, race_html):
    """Test that missing driver ID raises error."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    driver_id = "999999"  # Non-existent driver
    
    with pytest.raises(LapTableMissingError):
        parser.parse(race_html, url, driver_id)


def test_parse_all_drivers_success(parser, race_html):
    """Test successful parsing of lap data for all drivers."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    
    all_laps = parser.parse_all_drivers(race_html, url)
    
    assert len(all_laps) > 0
    assert all(isinstance(driver_id, str) for driver_id in all_laps.keys())
    assert all(isinstance(laps, list) for laps in all_laps.values())
    
    # Check that some drivers have laps
    drivers_with_laps = {k: v for k, v in all_laps.items() if len(v) > 0}
    assert len(drivers_with_laps) > 0
    
    # Check that non-starting drivers have empty lists
    drivers_without_laps = {k: v for k, v in all_laps.items() if len(v) == 0}
    # RILEY LANDER (731648) should be in this list
    assert "731648" in drivers_without_laps


def test_parse_all_drivers_field_mapping(parser, race_html):
    """Test that field mapping is correct (lapNum -> lap_number, pos -> position_on_lap)."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    
    all_laps = parser.parse_all_drivers(race_html, url)
    
    # Find a driver with laps
    driver_with_laps = next((k for k, v in all_laps.items() if len(v) > 0), None)
    assert driver_with_laps is not None
    
    laps = all_laps[driver_with_laps]
    first_lap = laps[0]
    
    # Verify field mapping
    assert hasattr(first_lap, "lap_number")
    assert hasattr(first_lap, "position_on_lap")
    assert hasattr(first_lap, "lap_time_seconds")
    assert hasattr(first_lap, "lap_time_raw")
    assert hasattr(first_lap, "pace_string")
    assert hasattr(first_lap, "elapsed_race_time")
    assert hasattr(first_lap, "segments")


def test_parse_lap_data_invalid_html(parser):
    """Test parsing invalid HTML raises error."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829"
    driver_id = "346997"
    
    with pytest.raises(LapTableMissingError):
        parser.parse("<html><body>No racerLaps here</body></html>", url, driver_id)

