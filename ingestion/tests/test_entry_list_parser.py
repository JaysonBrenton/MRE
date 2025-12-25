# @fileoverview Tests for entry list parser
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27

import pytest

from ingestion.connectors.liverc.parsers.entry_list_parser import EntryListParser
from ingestion.ingestion.errors import EventPageFormatError


class TestEntryListParser:
    """Tests for EntryListParser."""
    
    def test_parse_empty_html(self):
        """Test parsing empty HTML returns empty entry list."""
        parser = EntryListParser()
        html = "<html><body></body></html>"
        result = parser.parse(html, "http://test.com", "123")
        
        assert result.source_event_id == "123"
        assert result.entries_by_class == {}
    
    def test_parse_single_class(self):
        """Test parsing entry list with single racing class."""
        parser = EntryListParser()
        html = """
        <html>
        <body>
            <table>
                <thead>
                    <tr><th colspan="3">1/8 Electric Buggy Entries: 2</th></tr>
                    <tr><th>#</th><th>Driver</th><th>Transponder #</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1</td>
                        <td>JOHN DOE</td>
                        <td>1234567</td>
                    </tr>
                    <tr>
                        <td>2</td>
                        <td>JANE SMITH</td>
                        <td>7654321</td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        """
        result = parser.parse(html, "http://test.com", "123")
        
        assert result.source_event_id == "123"
        assert "1/8 Electric Buggy" in result.entries_by_class
        entries = result.entries_by_class["1/8 Electric Buggy"]
        assert len(entries) == 2
        assert entries[0].driver_name == "JOHN DOE"
        assert entries[0].transponder_number == "1234567"
        assert entries[1].driver_name == "JANE SMITH"
        assert entries[1].transponder_number == "7654321"
    
    def test_parse_multiple_classes(self):
        """Test parsing entry list with multiple racing classes."""
        parser = EntryListParser()
        html = """
        <html>
        <body>
            <table>
                <thead>
                    <tr><th colspan="3">1/8 Electric Buggy Entries: 1</th></tr>
                    <tr><th>#</th><th>Driver</th><th>Transponder #</th></tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>DRIVER A</td><td>1111111</td></tr>
                </tbody>
            </table>
            <table>
                <thead>
                    <tr><th colspan="3">1/8 Nitro Buggy Entries: 1</th></tr>
                    <tr><th>#</th><th>Driver</th><th>Transponder #</th></tr>
                </thead>
                <tbody>
                    <tr><td>1</td><td>DRIVER B</td><td>2222222</td></tr>
                </tbody>
            </table>
        </body>
        </html>
        """
        result = parser.parse(html, "http://test.com", "123")
        
        assert len(result.entries_by_class) == 2
        assert "1/8 Electric Buggy" in result.entries_by_class
        assert "1/8 Nitro Buggy" in result.entries_by_class
    
    def test_parse_missing_transponder(self):
        """Test parsing entry with missing transponder number."""
        parser = EntryListParser()
        html = """
        <html>
        <body>
            <table>
                <thead>
                    <tr><th colspan="3">1/8 Electric Buggy Entries: 1</th></tr>
                    <tr><th>#</th><th>Driver</th><th>Transponder #</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1</td>
                        <td>DRIVER NO TRANSPONDER</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        """
        result = parser.parse(html, "http://test.com", "123")
        
        entries = result.entries_by_class["1/8 Electric Buggy"]
        assert entries[0].transponder_number is None
    
    def test_parse_multiline_driver_name(self):
        """Test parsing driver name with multiple lines."""
        parser = EntryListParser()
        html = """
        <html>
        <body>
            <table>
                <thead>
                    <tr><th colspan="3">1/8 Electric Buggy Entries: 1</th></tr>
                    <tr><th>#</th><th>Driver</th><th>Transponder #</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1</td>
                        <td>LASTNAME, FIRSTNAME<br>FIRSTNAME LASTNAME</td>
                        <td>1234567</td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
        """
        result = parser.parse(html, "http://test.com", "123")
        
        entries = result.entries_by_class["1/8 Electric Buggy"]
        # Should take first line
        assert "LASTNAME" in entries[0].driver_name or "FIRSTNAME" in entries[0].driver_name

