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
    
    def test_parse_practice_month_view_empty(self):
        """Test parsing practice month view with no calendar returns empty list."""
        parser = PracticeDayParser()
        html = "<html><body>Month view</body></html>"
        dates = parser.parse_practice_month_view(
            html=html,
            track_slug="testtrack",
            year=2025,
            month=10,
        )
        assert dates == []

    def test_parse_practice_month_view_canberra_october_2025(self):
        """Test parsing LiveRC October 2025 calendar returns all three practice days.
        Page can have multiple tables (e.g. 'no sessions' for another date first);
        parser must find session_list links for the requested month only.
        """
        parser = PracticeDayParser()
        # Mimic LiveRC: first table (wrong one), then calendar table with dates
        html = """
        <html><body>
        <div class="panel-body">
            <table class="table">
                <tbody>
                    <tr><td>Practice Sessions on February 14, 2026 (Saturday)</td></tr>
                    <tr><td>There are no practice sessions available for the given date.</td></tr>
                </tbody>
            </table>
        </div>
        <div class="panel-body no_padding">
            <table class="table">
                <tbody>
                    <tr><td><a href="/practice/?p=session_list&d=2025-10-25">Sat, Oct 25, 2025</a></td><td><a href="/practice/?p=session_list&d=2025-10-25">56</a></td></tr>
                    <tr><td><a href="https://canberraoffroad.liverc.com/practice/?p=session_list&d=2025-10-12">Sun, Oct 12, 2025</a></td><td><a href="/practice/?p=session_list&d=2025-10-12">2</a></td></tr>
                    <tr><td><a href="/practice/?p=session_list&d=2025-10-11">Sat, Oct 11, 2025</a></td><td><a href="/practice/?p=session_list&d=2025-10-11">13</a></td></tr>
                </tbody>
            </table>
        </div>
        </body></html>
        """
        dates = parser.parse_practice_month_view(
            html=html,
            track_slug="canberraoffroad",
            year=2025,
            month=10,
        )
        assert len(dates) == 3
        assert dates[0].isoformat() == "2025-10-11"
        assert dates[1].isoformat() == "2025-10-12"
        assert dates[2].isoformat() == "2025-10-25"

    def test_parse_practice_month_view_filters_other_months(self):
        """Test that only dates in the requested year/month are returned."""
        parser = PracticeDayParser()
        html = """
        <html><body>
        <a href="/practice/?p=session_list&d=2025-10-25">Oct 25</a>
        <a href="/practice/?p=session_list&d=2025-11-01">Nov 1</a>
        <a href="/practice/?p=session_list&d=2025-10-11">Oct 11</a>
        </body></html>
        """
        dates = parser.parse_practice_month_view(
            html=html,
            track_slug="testtrack",
            year=2025,
            month=10,
        )
        assert len(dates) == 2
        assert dates[0].isoformat() == "2025-10-11"
        assert dates[1].isoformat() == "2025-10-25"
    
    def test_parse_practice_session_detail(self):
        """Test parsing practice session detail (placeholder - needs implementation)."""
        parser = PracticeDayParser()
        
        html = "<html><body>Session detail</body></html>"
        
        with pytest.raises(NotImplementedError):
            parser.parse_practice_session_detail(
                html=html,
                session_id="12345",
            )
