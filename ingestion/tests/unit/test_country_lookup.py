# @fileoverview Unit tests for country lookup module
#
# @description Tests ISO 3166-1 alpha-2 recognition and normalization
#              including Asian countries and legacy indicators

import pytest

from ingestion.common.country_lookup import (
    is_known_country,
    normalize_country,
    COUNTRY_INDICATORS,
)


class TestIsKnownCountry:
    """Tests for is_known_country."""

    def test_legacy_indicators(self):
        """Legacy indicators should be recognized."""
        assert is_known_country("Australia") is True
        assert is_known_country("AU") is True
        assert is_known_country("United States") is True
        assert is_known_country("US") is True
        assert is_known_country("Canada") is True
        assert is_known_country("CA") is True
        assert is_known_country("United Kingdom") is True
        assert is_known_country("UK") is True
        assert is_known_country("New Zealand") is True
        assert is_known_country("NZ") is True
        assert is_known_country("Germany") is True
        assert is_known_country("DE") is True

    def test_asian_iso_codes(self):
        """Asian ISO 3166-1 alpha-2 codes should be recognized."""
        assert is_known_country("CN") is True
        assert is_known_country("KR") is True
        assert is_known_country("JP") is True
        assert is_known_country("HK") is True
        assert is_known_country("TW") is True
        assert is_known_country("TH") is True
        assert is_known_country("MY") is True
        assert is_known_country("SG") is True
        assert is_known_country("ID") is True
        assert is_known_country("PH") is True
        assert is_known_country("VN") is True
        assert is_known_country("AE") is True

    def test_case_insensitive_iso_codes(self):
        """ISO codes should match case-insensitively (pycountry uses alpha_2 uppercase)."""
        assert is_known_country("kr") is True
        assert is_known_country("cn") is True

    def test_rejects_email_like(self):
        """Should reject lines that look like emails (avoid US in COMCAST.NET)."""
        assert is_known_country("COMCAST.NET") is False
        assert is_known_country("tprice61@COMCAST.NET") is False
        assert is_known_country("user@domain.com") is False

    def test_rejects_empty(self):
        """Should reject empty/whitespace."""
        assert is_known_country("") is False
        assert is_known_country("   ") is False

    def test_rejects_invalid_iso(self):
        """Should reject invalid 2-letter codes."""
        assert is_known_country("XX") is False
        assert is_known_country("ZZ") is False


class TestNormalizeCountry:
    """Tests for normalize_country."""

    def test_legacy_normalization(self):
        """Legacy codes should normalize to preferred names."""
        assert normalize_country("AU") == "Australia"
        assert normalize_country("US") == "United States"
        assert normalize_country("USA") == "United States"
        assert normalize_country("CA") == "Canada"
        assert normalize_country("UK") == "United Kingdom"
        assert normalize_country("GB") == "United Kingdom"
        assert normalize_country("NZ") == "New Zealand"
        assert normalize_country("DE") == "Germany"

    def test_asian_iso_codes_normalize(self):
        """Asian ISO codes should normalize to full country names."""
        assert normalize_country("CN") == "China"
        assert normalize_country("KR") == "Korea, Republic of"
        assert normalize_country("JP") == "Japan"
        assert normalize_country("HK") == "Hong Kong"
        assert normalize_country("TW") == "Taiwan, Province of China"
        assert normalize_country("TH") == "Thailand"
        assert normalize_country("MY") == "Malaysia"
        assert normalize_country("SG") == "Singapore"
        assert normalize_country("ID") == "Indonesia"
        assert normalize_country("PH") == "Philippines"
        assert normalize_country("VN") == "Viet Nam"
        assert normalize_country("AE") == "United Arab Emirates"

    def test_full_names_pass_through(self):
        """Full country names in indicators should pass through."""
        assert normalize_country("United States") == "United States"
        assert normalize_country("Australia") == "Australia"

    def test_rejects_invalid(self):
        """Should return None for invalid input."""
        assert normalize_country(None) is None
        assert normalize_country("") is None
        assert normalize_country("   ") is None
        assert normalize_country("user@domain.com") is None
