"""Unit tests for EventMetadataParser."""

import pytest
from pathlib import Path
from datetime import datetime

from ingestion.connectors.liverc.parsers.event_metadata_parser import (
    EventMetadataParser,
    EventMetadata,
    pick_canonical_event_name,
)
from ingestion.ingestion.errors import EventPageFormatError


@pytest.fixture
def parser():
    """Create EventMetadataParser instance."""
    return EventMetadataParser()


@pytest.fixture
def event_html():
    """Load event detail HTML fixture."""
    fixture_path = Path(__file__).parent.parent / "fixtures" / "liverc" / "486677" / "event.html"
    return fixture_path.read_text(encoding="utf-8")


def test_parse_event_metadata_success(parser, event_html):
    """Test successful parsing of event metadata."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    metadata = parser.parse(event_html, url)
    
    assert isinstance(metadata, EventMetadata)
    assert metadata.source_event_id == "486677"
    assert metadata.event_name == "Cormcc 2025 Rudi Wensing Memorial, Clay Cup"
    assert isinstance(metadata.event_date, datetime)
    assert metadata.event_entries > 0
    assert metadata.event_drivers > 0


def test_parse_event_metadata_extracts_event_id(parser, event_html):
    """Test that event ID is correctly extracted from URL."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    metadata = parser.parse(event_html, url)
    
    assert metadata.source_event_id == "486677"


def test_parse_event_metadata_parses_date(parser, event_html):
    """Test that event date is correctly parsed (date only, no time)."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    metadata = parser.parse(event_html, url)
    
    assert isinstance(metadata.event_date, datetime)
    # Date should be Nov 16, 2025
    assert metadata.event_date.year == 2025
    assert metadata.event_date.month == 11
    assert metadata.event_date.day == 16
    # Time should be 00:00:00 (date only)
    assert metadata.event_date.hour == 0
    assert metadata.event_date.minute == 0
    assert metadata.event_date.second == 0


def test_parse_event_metadata_extracts_stats(parser, event_html):
    """Test that entries and drivers are correctly extracted from Event Stats."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    metadata = parser.parse(event_html, url)
    
    # From fixture: Entries: 71, Drivers: 60
    assert metadata.event_entries == 71
    assert metadata.event_drivers == 60


def test_parse_event_metadata_extracts_total_race_laps(parser, event_html):
    """Test that Total Race Laps is extracted from Event Stats when present."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event&id=486677"
    metadata = parser.parse(event_html, url)
    
    # From fixture: Total Race Laps: 4,129
    assert metadata.total_race_laps == 4129


def test_parse_event_metadata_missing_url_id(parser, event_html):
    """Test that missing event ID in URL raises error."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event"
    
    with pytest.raises(EventPageFormatError):
        parser.parse(event_html, url)


def test_pick_canonical_event_name_club_vs_meet():
    """Venue in h1, distinct meet name in h3 — prefer h3."""
    h1 = "Canberra Off Road Model Car Club"
    h3 = "Cormcc 2025 Rudi Wensing Memorial, Clay Cup"
    assert pick_canonical_event_name(h1, h3) == h3


def test_pick_canonical_event_name_series_year_mismatch():
    """Same series in h1/h3 but different years — prefer primary h1 title."""
    h1 = "2026 Psycho Nitro Blast"
    h3 = "2025 Psycho Nitro Blast 19"
    assert pick_canonical_event_name(h1, h3) == h1


def test_parse_event_metadata_prefers_h1_when_series_year_mismatch(parser):
    """Detail page where h1 is the series title and h3 is an older round label."""
    html = """
    <html><body>
    <h1 class="page-header"><span class="fa fa-road"></span> 2026 Psycho Nitro Blast</h1>
    <h3 class="page-header text-nowrap pull-left">
      <span class="fa fa-list-ol"></span> 2025 Psycho Nitro Blast 19
    </h3>
    <h5 class="page-header text-nowrap pull-left">
      <span class="fa fa-calendar"></span> Mar 5, 2026
    </h5>
    <table class="table table-sm"><tbody>
      <tr><td>Entries: 10<br />Drivers: 8</td></tr>
    </tbody></table>
    </body></html>
    """
    url = "https://racetime.liverc.com/results/?p=view_event&id=500696"
    metadata = parser.parse(html, url)
    assert metadata.event_name == "2026 Psycho Nitro Blast"
    assert metadata.source_event_id == "500696"

