"""Unit tests for EventListParser."""

import pytest
from pathlib import Path
from datetime import datetime

from ingestion.connectors.liverc.parsers.event_list_parser import EventListParser, EventSummary
from ingestion.ingestion.errors import EventPageFormatError


@pytest.fixture
def parser():
    """Create EventListParser instance."""
    return EventListParser()


@pytest.fixture
def events_html():
    """Load events listing HTML fixture."""
    fixture_path = Path(__file__).parent.parent / "fixtures" / "liverc" / "canberraoffroad_events.html"
    return fixture_path.read_text(encoding="utf-8")


def test_parse_event_list_success(parser, events_html):
    """Test successful parsing of event list."""
    url = "https://canberraoffroad.liverc.com/events"
    track_slug = "canberraoffroad"
    events = parser.parse(events_html, url, track_slug)
    
    assert len(events) > 0
    assert all(isinstance(event, EventSummary) for event in events)
    
    # Check first event
    first_event = events[0]
    assert first_event.source == "liverc"
    assert first_event.source_event_id
    assert first_event.track_slug == track_slug
    assert first_event.event_name
    assert isinstance(first_event.event_date, datetime)
    assert first_event.event_entries >= 0
    assert first_event.event_drivers >= 0
    assert first_event.event_url.startswith("https://")


def test_parse_event_list_extracts_event_id(parser, events_html):
    """Test that event IDs are correctly extracted from URLs."""
    url = "https://canberraoffroad.liverc.com/events"
    track_slug = "canberraoffroad"
    events = parser.parse(events_html, url, track_slug)
    
    # All event IDs should be numeric strings
    for event in events:
        assert event.source_event_id
        assert event.source_event_id.isdigit()


def test_parse_event_list_parses_dates(parser, events_html):
    """Test that event dates are correctly parsed."""
    url = "https://canberraoffroad.liverc.com/events"
    track_slug = "canberraoffroad"
    events = parser.parse(events_html, url, track_slug)
    
    for event in events:
        assert isinstance(event.event_date, datetime)
        # Date should be reasonable (not too far in past/future)
        assert event.event_date.year >= 2010
        assert event.event_date.year <= 2030


def test_parse_event_list_builds_urls(parser, events_html):
    """Test that event URLs are correctly built."""
    url = "https://canberraoffroad.liverc.com/events"
    track_slug = "canberraoffroad"
    events = parser.parse(events_html, url, track_slug)
    
    for event in events:
        # Event URL should contain track slug and event ID
        assert track_slug in event.event_url
        assert event.source_event_id in event.event_url
        assert "/results/?p=view_event&id=" in event.event_url


def test_parse_event_list_invalid_html(parser):
    """Test parsing invalid HTML raises error."""
    url = "https://canberraoffroad.liverc.com/events"
    track_slug = "canberraoffroad"
    
    with pytest.raises(EventPageFormatError):
        parser.parse("<html><body>No events here</body></html>", url, track_slug)

