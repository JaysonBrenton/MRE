"""Unit tests for RaceListParser."""

import pytest
from pathlib import Path
from datetime import datetime

from ingestion.connectors.liverc.parsers.race_list_parser import RaceListParser
from ingestion.connectors.liverc.models import ConnectorRaceSummary
from ingestion.ingestion.errors import EventPageFormatError


@pytest.fixture
def parser():
    """Create RaceListParser instance."""
    return RaceListParser()


@pytest.fixture
def event_html():
    """Load event detail HTML fixture."""
    fixture_path = Path(__file__).parent.parent / "fixtures" / "liverc" / "486677" / "event.html"
    return fixture_path.read_text(encoding="utf-8")


def test_parse_race_list_success(parser, event_html):
    """Test successful parsing of race list."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    races = parser.parse(event_html, url)
    
    assert len(races) > 0
    assert all(isinstance(race, ConnectorRaceSummary) for race in races)
    
    # Check first race
    first_race = races[0]
    assert first_race.source_race_id
    assert first_race.race_full_label
    assert first_race.class_name
    assert first_race.race_label
    assert first_race.race_url.startswith("https://")


def test_parse_race_list_extracts_race_id(parser, event_html):
    """Test that race IDs are correctly extracted from URLs."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    races = parser.parse(event_html, url)
    
    # All race IDs should be numeric strings
    for race in races:
        assert race.source_race_id
        assert race.source_race_id.isdigit()


def test_parse_race_list_extracts_race_number(parser, event_html):
    """Test that race numbers are correctly extracted from labels."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    races = parser.parse(event_html, url)
    
    # Check that race_order is extracted when present
    races_with_order = [r for r in races if r.race_order is not None]
    assert len(races_with_order) > 0
    
    for race in races_with_order:
        assert isinstance(race.race_order, int)
        assert race.race_order > 0


def test_parse_race_list_parses_labels(parser, event_html):
    """Test that class name and race label are correctly parsed from full label."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    races = parser.parse(event_html, url)
    
    # Find a main race with simple parentheses (Class (Class Label)) - e.g. "1/8 Nitro Buggy (1/8 Nitro Buggy A-Main)"
    main_race = next(
        (r for r in races if "Main" in r.race_label and r.race_full_label.count("(") == 1),
        None,
    )
    if main_race:
        assert main_race.class_name
        assert main_race.race_label
        assert "Main" in main_race.race_label


def test_parse_race_list_parses_times(parser, event_html):
    """Test that race times are correctly parsed."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    races = parser.parse(event_html, url)
    
    # Some races should have start_time
    races_with_time = [r for r in races if r.start_time is not None]
    assert len(races_with_time) > 0
    
    for race in races_with_time:
        assert isinstance(race.start_time, datetime)


def test_parse_race_list_builds_urls(parser, event_html):
    """Test that race URLs are correctly built."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    races = parser.parse(event_html, url)
    
    for race in races:
        # Race URL should contain track slug and race ID
        assert "canberraoffroad" in race.race_url
        assert race.source_race_id in race.race_url
        assert "/results/?p=view_race_result&id=" in race.race_url


def test_parse_race_list_invalid_html(parser):
    """Test parsing invalid HTML raises error."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    
    with pytest.raises(EventPageFormatError):
        parser.parse("<html><body>No races here</body></html>", url)


def test_parse_race_list_url_encoded_href(parser):
    """Test that URL-encoded view%5Frace%5Fresult links are parsed (Motorama-style)."""
    html = """
    <html>
    <body>
    <table class="table table-hover entry_list_data">
      <tbody>
        <tr><th>Seeding Round 1</th><th>Time Completed</th></tr>
        <tr>
          <td>
            <a href="/results/?p=view%5Frace%5Fresult&id=6539753" class="block">
              Race 1: 4wd Short Course (4wd Short Course (Heat 1/2))
            </a>
          </td>
          <td>Feb 20, 2026 at 11:50am</td>
        </tr>
      </tbody>
    </table>
    </body>
    </html>
    """
    url = "https://motorama8th.liverc.com/results/?p=view_event&id=496016"
    races = parser.parse(html, url)
    assert len(races) == 1
    assert races[0].source_race_id == "6539753"
    assert races[0].section_header == "Seeding Round 1"


def test_parse_race_list_section_headers(parser, event_html):
    """Test that section headers are captured and attached to subsequent races."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    races = parser.parse(event_html, url)
    # Fixture has Main Events, Qualifier Round 3, 2, 1 - races should have section_header
    races_with_header = [r for r in races if r.section_header is not None]
    assert len(races_with_header) > 0
    # Main Events races come first
    main_races = [r for r in races if r.section_header == "Main Events"]
    qual_races = [r for r in races if r.section_header and "Qualifier" in r.section_header]
    assert len(main_races) > 0 or len(qual_races) > 0

