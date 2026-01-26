# @fileoverview Tests for practice day parser
# 
# @created 2026-01-XX
# @creator System
# @lastModified 2026-01-XX
# 
# @description Unit tests for practice day HTML parsing

import pytest
from datetime import date, datetime
from pathlib import Path

from ingestion.connectors.liverc.parsers.practice_day_parser import PracticeDayParser
from ingestion.ingestion.errors import EventPageFormatError


# Test fixtures directory
FIXTURES_DIR = Path(__file__).parent / "fixtures" / "liverc" / "practice"


class TestPracticeDayParser:
    """Test suite for PracticeDayParser."""
    
    def test_parse_practice_day_overview_basic(self):
        """Test parsing a basic practice day overview page."""
        parser = PracticeDayParser()
        
        # Load test fixture
        fixture_path = FIXTURES_DIR / "canberraoffroad-day-2025-10-25.html"
        if not fixture_path.exists():
            pytest.skip(f"Test fixture not found: {fixture_path}")
        
        html = fixture_path.read_text()
        practice_date = date(2025, 10, 25)
        
        result = parser.parse_practice_day_overview(
            html=html,
            track_slug="canberraoffroad",
            practice_date=practice_date,
        )
        
        assert result.date == practice_date
        assert result.track_slug == "canberraoffroad"
        assert result.session_count > 0
        assert len(result.sessions) > 0
        
        # Check first session
        first_session = result.sessions[0]
        assert first_session.session_id
        assert first_session.driver_name
        assert first_session.class_name
        assert first_session.start_time
        assert first_session.session_url
    
    def test_parse_practice_day_overview_no_sessions(self):
        """Test parsing a practice day with no sessions."""
        parser = PracticeDayParser()
        
        # Create HTML with no sessions message
        html = """
        <html>
        <body>
            <div>There are no practice sessions available for the given date.</div>
        </body>
        </html>
        """
        
        practice_date = date(2025, 10, 25)
        
        result = parser.parse_practice_day_overview(
            html=html,
            track_slug="testtrack",
            practice_date=practice_date,
        )
        
        assert result.date == practice_date
        assert result.session_count == 0
        assert len(result.sessions) == 0
        assert result.total_laps == 0
    
    def test_parse_practice_day_overview_invalid_html(self):
        """Test parsing invalid HTML raises error."""
        parser = PracticeDayParser()
        
        html = "<html><body>Invalid content</body></html>"
        practice_date = date(2025, 10, 25)
        
        with pytest.raises(EventPageFormatError):
            parser.parse_practice_day_overview(
                html=html,
                track_slug="testtrack",
                practice_date=practice_date,
            )
    
    def test_parse_practice_month_view(self):
        """Test parsing practice month view (placeholder - needs implementation)."""
        parser = PracticeDayParser()
        
        # This is a placeholder test - implementation needs to be completed
        html = "<html><body>Month view</body></html>"
        
        dates = parser.parse_practice_month_view(
            html=html,
            track_slug="testtrack",
            year=2025,
            month=10,
        )
        
        # For now, this should return empty list until implementation is complete
        assert isinstance(dates, list)
    
    def test_parse_practice_session_detail(self):
        """Test parsing practice session detail (placeholder - needs implementation)."""
        parser = PracticeDayParser()
        
        html = "<html><body>Session detail</body></html>"
        
        with pytest.raises(NotImplementedError):
            parser.parse_practice_session_detail(
                html=html,
                session_id="12345",
            )
