"""Unit tests for EventMetadataParser."""

import pytest
from pathlib import Path
from datetime import datetime

from ingestion.connectors.liverc.parsers.event_metadata_parser import EventMetadataParser, EventMetadata
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
    assert metadata.event_name
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


def test_parse_event_metadata_missing_url_id(parser, event_html):
    """Test that missing event ID in URL raises error."""
    url = "https://canberraoffroad.liverc.com/results/?p=view_event"
    
    with pytest.raises(EventPageFormatError):
        parser.parse(event_html, url)

