"""Unit tests for TrackListParser."""

import pytest
from pathlib import Path

from ingestion.connectors.liverc.parsers.track_list_parser import TrackListParser, TrackSummary
from ingestion.ingestion.errors import EventPageFormatError


@pytest.fixture
def parser():
    """Create TrackListParser instance."""
    return TrackListParser()


@pytest.fixture
def track_catalogue_html():
    """Load track catalogue HTML fixture."""
    fixture_path = Path(__file__).parent.parent / "fixtures" / "liverc" / "track_catalogue.html"
    return fixture_path.read_text(encoding="utf-8")


def test_parse_track_list_success(parser, track_catalogue_html):
    """Test successful parsing of track list."""
    url = "https://live.liverc.com"
    tracks = parser.parse(track_catalogue_html, url)
    
    assert len(tracks) > 0
    assert all(isinstance(track, TrackSummary) for track in tracks)
    
    # Check first track
    first_track = tracks[0]
    assert first_track.source == "liverc"
    assert first_track.source_track_slug
    assert first_track.track_name
    assert first_track.track_url.startswith("https://")
    assert first_track.events_url.startswith("https://")
    assert first_track.events_url.endswith("/events")


def test_parse_track_list_extracts_slug(parser, track_catalogue_html):
    """Test that track slug is correctly extracted from URL."""
    url = "https://live.liverc.com"
    tracks = parser.parse(track_catalogue_html, url)
    
    # Check that slugs are valid (alphanumeric, lowercase, no spaces)
    for track in tracks:
        assert track.source_track_slug
        assert track.source_track_slug.islower() or track.source_track_slug.replace("_", "").isalnum()
        assert " " not in track.source_track_slug


def test_parse_track_list_builds_urls(parser, track_catalogue_html):
    """Test that track URLs are correctly built."""
    url = "https://live.liverc.com"
    tracks = parser.parse(track_catalogue_html, url)
    
    for track in tracks:
        # Track URL should be https://{slug}.liverc.com/
        assert track.track_url == f"https://{track.source_track_slug}.liverc.com/"
        # Events URL should be https://{slug}.liverc.com/events
        assert track.events_url == f"https://{track.source_track_slug}.liverc.com/events"


def test_parse_track_list_invalid_html(parser):
    """Test parsing invalid HTML raises error."""
    url = "https://live.liverc.com"
    
    with pytest.raises(EventPageFormatError):
        parser.parse("<html><body>No tracks here</body></html>", url)


def test_parse_track_list_empty_html(parser):
    """Test parsing empty HTML raises error."""
    url = "https://live.liverc.com"
    
    with pytest.raises(EventPageFormatError):
        parser.parse("", url)

