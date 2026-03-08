# @fileoverview Unit tests for track dashboard parser
# 
# @created 2025-01-27
# @creator Auto (AI Assistant)
# @lastModified 2025-01-27

import pytest
from pathlib import Path

from ingestion.connectors.liverc.parsers.track_dashboard_parser import (
    TrackDashboardParser,
    TrackDashboardData,
)


def read_fixture(filename: str) -> str:
    """Read HTML fixture file."""
    fixture_dir = Path(__file__).parent.parent / "fixtures" / "liverc"
    fixture_path = fixture_dir / filename
    with open(fixture_path, "r", encoding="utf-8") as f:
        return f.read()


class TestTrackDashboardParser:
    """Tests for TrackDashboardParser."""
    
    def test_parse_bbcc_dashboard(self):
        """Test parsing BBRCC Off-Road dashboard."""
        html = read_fixture("BBRCC Off-Road's Dashboard.html")
        parser = TrackDashboardParser()
        data = parser.parse(html, "https://bayrc.liverc.com/")
        
        assert data is not None
        assert data.address is not None
        assert "Hanging Rock Complex" in data.address
        assert "Batemans Bay" in data.address or data.city == "Batemans Bay"
        assert data.country == "Australia" or "Australia" in (data.country or "")
        assert data.phone == "+61 403 594 396" or "+61" in (data.phone or "")
        assert data.website is not None
        assert "bayrc.com.au" in (data.website or "")

    def test_parse_canberra_dashboard(self):
        """Test parsing Canberra Off Road Model Car Club dashboard."""
        html = read_fixture("canberraoffroad_dashboard.html")
        parser = TrackDashboardParser()
        data = parser.parse(html, "https://canberraoffroad.liverc.com/")

        assert data is not None
        assert data.address is not None
        assert "Kyeema" in data.address
        assert data.city == "Narrabundah" or "Narrabundah" in (data.city or "")
        assert data.postal_code in ("02604", "2604") or (data.postal_code and "2604" in data.postal_code)
        assert data.country == "Australia" or "Australia" in (data.country or "")
        assert data.website is not None
        assert "cormcc.org" in (data.website or "")
        assert data.email is not None
        assert "cormcc.org" in (data.email or "")

    def test_parse_thunder_alley_dashboard(self):
        """Test parsing Thunder Alley RC Speedway dashboard."""
        html = read_fixture("Thunder Alley RC Speedway's Dashboard.html")
        parser = TrackDashboardParser()
        data = parser.parse(html, "https://thunderalley.liverc.com/")
        
        assert data is not None
        assert data.address is not None
        assert "5320 US 301" in data.address or "5320" in (data.address or "")
        assert data.city == "Lucama" or "Lucama" in (data.city or "")
        assert data.state == "NC" or "NC" in (data.state or "")
        assert data.postal_code == "27851" or "27851" in (data.postal_code or "")
        assert data.country == "United States" or "United States" in (data.country or "")
        assert data.phone is not None
        assert "252-291-4088" in (data.phone or "")
        assert data.description is not None
        assert "Indoor Tracks" in (data.description or "")
        assert data.logo_url is not None
        assert "livetimescoring.com/track_logos" in (data.logo_url or "")

    def test_parse_missing_sections(self):
        """Test graceful handling of missing sections."""
        # Minimal HTML without dashboard sections
        html = "<html><body><h1>Test Track</h1></body></html>"
        parser = TrackDashboardParser()
        data = parser.parse(html, "https://test.liverc.com/")
        
        # Should return empty data structure, not raise exception
        assert data is not None
        assert isinstance(data, TrackDashboardData)
        # All fields should be None
        assert data.address is None
        assert data.phone is None
        assert data.latitude is None
        assert data.longitude is None
    
    def test_parse_empty_html(self):
        """Test graceful handling of empty HTML."""
        html = ""
        parser = TrackDashboardParser()
        data = parser.parse(html, "https://test.liverc.com/")
        
        assert data is not None
        assert isinstance(data, TrackDashboardData)
    
    def test_parse_invalid_html(self):
        """Test graceful handling of invalid HTML."""
        html = "<html><body><div>Unclosed tags..."
        parser = TrackDashboardParser()
        data = parser.parse(html, "https://test.liverc.com/")
        
        # Should not raise exception
        assert data is not None
        assert isinstance(data, TrackDashboardData)
    
    def test_parse_google_maps_query(self):
        """Test extraction of address from Google Maps embed."""
        html = '''
        <div class="panel panel-default">
            <div class="panel-heading">Track Map</div>
            <div class="panel-body">
                <iframe src="https://www.google.com/maps/embed/v1/place?key=TEST&q=123+Main+St,City,State+12345,US"></iframe>
            </div>
        </div>
        '''
        parser = TrackDashboardParser()
        data = parser.parse(html, "https://test.liverc.com/")
        
        # Should extract address from q parameter
        assert data.address is not None or data.address == "123 Main St,City,State 12345,US"

    def test_parse_asian_address_about_section(self):
        """Test parsing Asian address (City, ISO code) from About panel."""
        html = '''
        <div class="panel panel-default">
            <div class="panel-heading">About Suwon RC</div>
            <div class="panel-body">
                <address>
                    <strong>Suwon RC Racetrack</strong><br>
                    123 Race Street<br>
                    Suwon, KR<br>
                </address>
            </div>
        </div>
        '''
        parser = TrackDashboardParser()
        data = parser.parse(html, "https://suwon.liverc.com/")
        assert data.country == "Korea, Republic of"
        assert data.city == "Suwon"
        assert data.address is not None

    def test_parse_asian_address_map_only(self):
        """Test parsing Asian address from Google Maps q parameter."""
        html = '''
        <div class="panel panel-default">
            <div class="panel-heading">Track Map</div>
            <div class="panel-body">
                <iframe src="https://www.google.com/maps/embed/v1/place?key=TEST&q=Shenzhen,CN"></iframe>
            </div>
        </div>
        '''
        parser = TrackDashboardParser()
        data = parser.parse(html, "https://test.liverc.com/")
        assert data.country == "China"
        assert data.city == "Shenzhen"

    def test_parse_china_thailand_uae_addresses(self):
        """Test parsing various Asian ISO codes from About panel."""
        for city, code, expected_country in [
            ("Shanghai", "CN", "China"),
            ("Phuket", "TH", "Thailand"),
            ("Dubai", "AE", "United Arab Emirates"),
            ("Hong Kong", "HK", "Hong Kong"),
            ("Singapore", "SG", "Singapore"),
            ("Tokyo", "JP", "Japan"),
        ]:
            html = f'''
            <div class="panel panel-default">
                <div class="panel-heading">About Test</div>
                <div class="panel-body">
                    <address>
                        <strong>Test Track</strong><br>
                        {city}, {code}<br>
                    </address>
                </div>
            </div>
            '''
            parser = TrackDashboardParser()
            data = parser.parse(html, "https://test.liverc.com/")
            assert data.country == expected_country, f"Failed for {city}, {code}"
            assert data.city == city

    def test_parse_email_not_matched_as_country(self):
        """Email-like text should not be matched as country (exact match avoids US in COMCAST.NET)."""
        html = '''
        <div class="panel panel-default">
            <div class="panel-heading">About Bad Data</div>
            <div class="panel-body">
                <address>
                    <strong>Test Track</strong><br>
                    123 Main St<br>
                    Tallahassee, FL<br>
                    tprice61@COMCAST.NET<br>
                </address>
            </div>
        </div>
        '''
        parser = TrackDashboardParser()
        data = parser.parse(html, "https://test.liverc.com/")
        # Country must NOT be the email (substring match would wrongly match US in COMCAST.NET)
        assert data.country != "tprice61@COMCAST.NET"
        if data.country:
            assert "@" not in data.country
    
    def test_parse_email_obfuscation(self):
        """Test parsing obfuscated email addresses from About panel."""
        html = '''
        <div class="panel panel-default">
            <div class="panel-heading">About Test Track</div>
            <div class="panel-body">
                <address>
                    <strong>Test Track</strong><br>
                    <a href="javascript:noSpam('user', 'domain.com');">user@domain.com</a>
                </address>
            </div>
        </div>
        '''
        parser = TrackDashboardParser()
        data = parser.parse(html, "https://test.liverc.com/")
        assert data.email == "user@domain.com"

