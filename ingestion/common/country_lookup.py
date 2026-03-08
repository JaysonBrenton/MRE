# @fileoverview Country lookup and normalization for track addresses
#
# @description Uses pycountry for ISO 3166-1 alpha-2 lookup plus a legacy
#              indicator list for backward compatibility and preferred naming
#
# @purpose Ensures all countries (including Asian) are recognized and normalized
#          to full canonical names during address parsing

from typing import Optional

import pycountry


# Legacy country identifiers (exact match). Preserved for backward compatibility
# and preferred canonical names (e.g. "United States" over "US").
COUNTRY_INDICATORS = frozenset([
    "Australia", "AU",
    "United States", "USA", "US",
    "Canada", "CA",
    "United Kingdom", "UK", "GB",
    "New Zealand", "NZ",
    "Germany", "DE",
])

# Legacy normalization: explicit mapping for preferred names
COUNTRY_NORMALIZE = {
    "AU": "Australia",
    "US": "United States",
    "USA": "United States",
    "CA": "Canada",
    "UK": "United Kingdom",
    "GB": "United Kingdom",
    "NZ": "New Zealand",
    "DE": "Germany",
}


def is_known_country(line: str) -> bool:
    """Check if line is a known country (exact match).
    Matches legacy indicators and ISO 3166-1 alpha-2 codes via pycountry.
    Avoids substring match to prevent false positives (e.g. US in COMCAST.NET).
    """
    trimmed = line.strip()
    if not trimmed or "@" in trimmed or len(trimmed) > 60:
        return False
    if trimmed in COUNTRY_INDICATORS:
        return True
    if len(trimmed) == 2 and trimmed.isalpha():
        country = pycountry.countries.get(alpha_2=trimmed.upper())
        return country is not None
    return False


def normalize_country(raw: Optional[str]) -> Optional[str]:
    """Normalize country code/abbreviation to canonical full name.
    Uses legacy COUNTRY_NORMALIZE first, then pycountry for ISO alpha-2.
    Returns None for invalid input (empty, email-like, too long).
    """
    if not raw or not raw.strip():
        return None
    s = raw.strip()
    if "@" in s or len(s) > 60:
        return None
    if s in COUNTRY_NORMALIZE:
        return COUNTRY_NORMALIZE[s]
    if len(s) == 2 and s.isalpha():
        country = pycountry.countries.get(alpha_2=s.upper())
        if country:
            return country.name
    if s in COUNTRY_INDICATORS and s not in COUNTRY_NORMALIZE:
        return s
    return s
