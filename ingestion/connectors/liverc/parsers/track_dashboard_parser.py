# @fileoverview Track dashboard parser for LiveRC
#
# @created 2025-01-27
# @creator Auto (AI Assistant)
# @lastModified 2025-03-08
#
# @description Parser for track dashboard pages to extract metadata
#
# @purpose Extracts location data, contact information, track statistics,
#          descriptions, and logos from LiveRC track dashboard pages

from typing import Optional, Tuple
from urllib.parse import urlparse, parse_qs, unquote
from selectolax.parser import HTMLParser
import re

from ingestion.common.logging import get_logger
from ingestion.common.country_lookup import (
    is_known_country as _is_known_country,
    normalize_country as _normalize_country,
    COUNTRY_INDICATORS,
)
from ingestion.ingestion.errors import EventPageFormatError

logger = get_logger(__name__)


class TrackDashboardData:
    """Extracted metadata from track dashboard page."""
    def __init__(
        self,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        address: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        country: Optional[str] = None,
        postal_code: Optional[str] = None,
        phone: Optional[str] = None,
        website: Optional[str] = None,
        email: Optional[str] = None,
        description: Optional[str] = None,
        logo_url: Optional[str] = None,
        facebook_url: Optional[str] = None,
        total_laps: Optional[int] = None,
        total_races: Optional[int] = None,
        total_events: Optional[int] = None,
    ):
        self.latitude = latitude
        self.longitude = longitude
        self.address = address
        self.city = city
        self.state = state
        self.country = country
        self.postal_code = postal_code
        self.phone = phone
        self.website = website
        self.email = email
        self.description = description
        self.logo_url = logo_url
        self.facebook_url = facebook_url
        self.total_laps = total_laps
        self.total_races = total_races
        self.total_events = total_events


class TrackDashboardParser:
    """Parser for LiveRC track dashboard page."""

    def parse(self, html: str, url: str) -> TrackDashboardData:
        """
        Parse track dashboard page to extract metadata.
        
        Args:
            html: HTML content from dashboard page
            url: Source URL for error reporting
        
        Returns:
            TrackDashboardData with extracted metadata (fields may be None)
        """
        logger.debug("parse_dashboard_start", url=url)
        
        try:
            tree = HTMLParser(html)
            data = TrackDashboardData()
            
            # Extract address and contact info from "About" section
            self._parse_about_section(tree, data)
            
            # Extract map coordinates/address from Google Maps embed
            self._parse_map_section(tree, data)
            
            # Extract track description
            self._parse_description(tree, data)
            
            # Extract logo URL
            self._parse_logo(tree, data)
            
            # Extract Facebook URL
            self._parse_facebook(tree, data)
            
            # Extract lifetime stats
            self._parse_stats(tree, data)
            
            logger.debug("parse_dashboard_success", url=url)
            return data
        
        except Exception as e:
            logger.warning("parse_dashboard_error", url=url, error=str(e))
            # Return empty data structure on error (graceful degradation)
            return TrackDashboardData()
    
    def _parse_about_section(self, tree: HTMLParser, data: TrackDashboardData) -> None:
        """Extract address and contact info from About section."""
        try:
            # Find the "About" panel by looking for panel-heading containing "About"
            panel_headings = tree.css("div.panel-heading")
            about_panel = None
            for heading in panel_headings:
                if heading.text(separator=" ").strip().startswith("About"):
                    about_panel = heading
                    break
            
            if not about_panel:
                return
            
            # Navigate to the panel body
            panel = about_panel.parent
            if not panel:
                return
            
            panel_body = panel.css_first("div.panel-body")
            if not panel_body:
                return
            
            # Find address element
            address_elem = panel_body.css_first("address")
            if not address_elem:
                return
            
            # Extract address lines by getting all text and splitting by <br>
            # The address element structure is:
            # <address>
            #   <strong>Track Name</strong>
            #   <br>Street Address<br>City, State Postal<br>Country<br>
            #   <br><abbr>P:</abbr> <a href="tel:...">Phone</a>...
            # </address>
            
            # Get full text content
            full_text = address_elem.text(separator="\n")
            # Split by newlines (which were inserted by separator)
            address_lines = [line.strip() for line in full_text.split("\n") if line.strip()]
            
            # Try to extract structured address from lines
            if address_lines:
                # Filter out contact info lines (phone, website, email)
                contact_markers = ["p:", "w:", "e:", "phone", "website", "email", "tel:", "http"]
                address_only_lines = [
                    line for line in address_lines
                    if not any(marker in line.lower() for marker in contact_markers)
                ]
                
                if address_only_lines:
                    track_name_indicators = ["rc", "speedway", "raceway", "track", "off-road", "offroad"]
                    addr_start = 0
                    if any(
                        ind in address_only_lines[0].lower()
                        for ind in track_name_indicators
                    ):
                        addr_start = 1
                    addr_lines = address_only_lines[addr_start:]
                    if addr_lines:
                        data.address = ", ".join(addr_lines)
                        last_line = addr_lines[-1]
                        second_last = addr_lines[-2] if len(addr_lines) > 1 else None
                        if _is_known_country(last_line):
                            data.country = _normalize_country(last_line.strip())
                            if second_last and not data.city:
                                self._parse_city_state_country(second_last, data)
                        else:
                            self._parse_city_state_country(last_line, data)
                            if second_last and not data.country and _is_known_country(second_last):
                                data.country = _normalize_country(second_last.strip())
            
            # Extract phone
            phone_link = panel_body.css_first("address a[href^='tel:']")
            if phone_link:
                href = phone_link.attributes.get("href", "")
                if href.startswith("tel:"):
                    data.phone = href[4:].strip()
                else:
                    t = phone_link.text(separator=" ").strip()
                    if t:
                        data.phone = t
            else:
                for line in address_lines:
                    if line.upper().startswith("P:") and "N/A" in line.upper():
                        data.phone = "N/A"
                        break
            
            # Extract website
            website_link = panel_body.css_first("address a[href^='http']:not([href^='tel:'])")
            if website_link:
                href = website_link.attributes.get("href", "")
                if href and href.startswith("http"):
                    data.website = href
            
            # Extract email (may be obfuscated)
            email_link = panel_body.css_first("address a[href^='javascript:noSpam']")
            if email_link:
                # Email may be in text as HTML entities or in JavaScript
                email_text = email_link.text(separator="").strip()
                if email_text and "@" in email_text:
                    data.email = email_text
                else:
                    # Try to decode from JavaScript function
                    href = email_link.attributes.get("href", "")
                    if "noSpam" in href:
                        # Pattern: noSpam('user', 'domain.com')
                        match = re.search(r"noSpam\('([^']+)',\s*'([^']+)'\)", href)
                        if match:
                            user = match.group(1)
                            domain = match.group(2)
                            data.email = f"{user}@{domain}"
        
        except Exception as e:
            logger.debug("parse_about_section_error", error=str(e))
    
    def _parse_city_state_country(self, line: str, data: TrackDashboardData) -> None:
        """Parse city, state, postal code, and country from address line."""
        try:
            # Common patterns:
            # "City, State PostalCode, Country"
            # "City State PostalCode Country"
            # "City, State PostalCode Country"
            # "City, State, Country"
            
            # Remove extra whitespace
            line = re.sub(r'\s+', ' ', line.strip())
            
            # Split by comma
            parts = [p.strip() for p in line.split(',')]
            
            if len(parts) >= 3:
                # Format: City, State Postal, Country
                data.city = parts[0]
                # Extract state and postal from middle part
                state_postal = parts[1]
                postal_match = re.search(r'(\d{4,5})', state_postal)
                if postal_match:
                    data.postal_code = postal_match.group(1)
                    data.state = state_postal[:postal_match.start()].strip()
                else:
                    data.state = state_postal
                data.country = _normalize_country(parts[2])
            elif len(parts) == 2:
                # Format: City, State Postal Country or City State, Country
                # Check if second part is a known country (exact match, incl. ISO codes)
                if _is_known_country(parts[1]):
                    data.country = _normalize_country(parts[1])
                    # First part is city, state, postal
                    first = parts[0]
                    postal_match = re.search(r'(\d{4,5})', first)
                    if postal_match:
                        data.postal_code = postal_match.group(1)
                        remaining = first[:postal_match.start()].strip()
                        # Last word before postal is likely state
                        words = remaining.split()
                        if len(words) > 1:
                            data.city = " ".join(words[:-1])
                            data.state = words[-1]
                        else:
                            data.city = remaining
                    else:
                        # No postal: entire first part is city (e.g. "Suwon" in "Suwon, KR")
                        data.city = first
                else:
                    # Probably City, State Postal
                    data.city = parts[0]
                    second = parts[1]
                    postal_match = re.search(r'(\d{4,5})', second)
                    if postal_match:
                        data.postal_code = postal_match.group(1)
                        data.state = second[:postal_match.start()].strip()
                    else:
                        data.state = second
            else:
                # Single part - try to extract components
                words = line.split()
                if words:
                    # Check for country at end (exact match, incl. ISO codes)
                    if _is_known_country(words[-1]):
                        data.country = _normalize_country(words[-1])
                        words = words[:-1]
                    
                    # Check for postal code
                    for i, word in enumerate(words):
                        if re.match(r'^\d{4,5}$', word):
                            data.postal_code = word
                            data.state = words[i-1] if i > 0 else None
                            data.city = " ".join(words[:i-1]) if i > 1 else words[0] if i == 1 else None
                            break
        
        except Exception as e:
            logger.debug("parse_city_state_country_error", error=str(e))
    
    def _parse_map_address(
        self, address_query: str
    ) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str], Optional[str]]:
        """
        Parse map q= address into (address, city, state, postal_code, country).
        Format often: "Street,City,+Postal,AU" or "Venue,Street,City State Postal,Country"
        """
        raw = unquote(address_query).strip()
        if not raw:
            return None, None, None, None, None
        parts = [p.strip() for p in raw.split(",") if p.strip()]
        if not parts:
            return raw, None, None, None, None
        country = None
        postal_code = None
        city = None
        state = None
        last = parts[-1].strip()
        if _is_known_country(last):
            country = _normalize_country(last)
            parts = parts[:-1]
        if parts:
            second_last = parts[-1].strip()
            postal_match = re.search(r"(\d{4,5})", second_last)
            if postal_match:
                postal_code = postal_match.group(1)
                remaining = second_last[: postal_match.start()].strip().replace("+", " ").strip()
                words = remaining.split()
                if len(words) >= 2:
                    state = words[-1]
                    city = " ".join(words[:-1])
                elif len(words) == 1 and words[0]:
                    state = words[0]
                    city = parts[-2].strip() if len(parts) >= 2 else None
                elif len(parts) >= 2:
                    city = parts[-2].strip()
            else:
                city = second_last
            address = ", ".join(parts[:-1]) if len(parts) > 1 else parts[0]
        else:
            address = raw
        return address, city, state, postal_code, country

    def _parse_map_section(self, tree: HTMLParser, data: TrackDashboardData) -> None:
        """Extract map address from Google Maps embed; use as fallback for missing fields."""
        try:
            panel_headings = tree.css("div.panel-heading")
            map_panel = None
            for heading in panel_headings:
                text = heading.text(separator=" ").strip()
                if "Track Map" in text or "Map" in text:
                    map_panel = heading
                    break

            if not map_panel or not map_panel.parent:
                return

            iframe = map_panel.parent.css_first("iframe[src*='google.com/maps']")
            if not iframe:
                return

            src = iframe.attributes.get("src", "")
            if not src:
                return

            parsed = urlparse(src)
            query_params = parse_qs(parsed.query)

            if "q" not in query_params:
                return

            address_query = query_params["q"][0]
            map_addr, map_city, map_state, map_postal, map_country = self._parse_map_address(
                address_query
            )

            if not map_addr:
                return

            if not data.address:
                data.address = unquote(address_query)
            if not data.city and map_city:
                data.city = map_city
            if not data.state and map_state:
                data.state = map_state
            if not data.postal_code and map_postal:
                data.postal_code = map_postal
            if not data.country and map_country:
                data.country = map_country

            if "center" in query_params:
                center = query_params["center"][0]
                coords = center.split(",")
                if len(coords) == 2:
                    try:
                        data.latitude = float(coords[0])
                        data.longitude = float(coords[1])
                    except ValueError:
                        pass

        except Exception as e:
            logger.debug("parse_map_section_error", error=str(e))
    
    def _parse_description(self, tree: HTMLParser, data: TrackDashboardData) -> None:
        """Extract track description from About panel."""
        try:
            # Find the "About" panel
            panel_headings = tree.css("div.panel-heading")
            about_panel = None
            for heading in panel_headings:
                if heading.text(separator=" ").strip().startswith("About"):
                    about_panel = heading
                    break
            
            if not about_panel:
                return
            
            panel = about_panel.parent
            if not panel:
                return
            
            panel_body = panel.css_first("div.panel-body")
            if not panel_body:
                return
            
            # Look for description text after the address row
            # Usually in a row with class "row" after the first row
            rows = panel_body.css("div.row")
            if len(rows) > 1:
                # Second row often contains description
                desc_row = rows[1]
                # Get text content, excluding address section
                desc_text = desc_row.text(separator="\n").strip()
                if desc_text and len(desc_text) > 20:  # Meaningful description
                    data.description = desc_text
        
        except Exception as e:
            logger.debug("parse_description_error", error=str(e))
    
    def _parse_logo(self, tree: HTMLParser, data: TrackDashboardData) -> None:
        """Extract logo URL from About panel."""
        try:
            # Find the "About" panel
            panel_headings = tree.css("div.panel-heading")
            about_panel = None
            for heading in panel_headings:
                if heading.text(separator=" ").strip().startswith("About"):
                    about_panel = heading
                    break
            
            if not about_panel:
                return
            
            panel = about_panel.parent
            if not panel:
                return
            
            panel_body = panel.css_first("div.panel-body")
            if not panel_body:
                return
            
            # Look for logo image (usually in assets.livetimescoring.com)
            logo_img = panel_body.css_first("img[src*='livetimescoring.com/track_logos']")
            if logo_img:
                src = logo_img.attributes.get("src", "")
                if src:
                    data.logo_url = src
        
        except Exception as e:
            logger.debug("parse_logo_error", error=str(e))
    
    def _parse_facebook(self, tree: HTMLParser, data: TrackDashboardData) -> None:
        """Extract Facebook URL from Facebook panel."""
        try:
            # Find Facebook panel by looking for panel-heading containing "Facebook"
            panel_headings = tree.css("div.panel-heading")
            fb_panel = None
            for heading in panel_headings:
                text = heading.text(separator=" ").strip()
                if "Facebook" in text:
                    fb_panel = heading
                    break
            
            if not fb_panel:
                return
            
            panel = fb_panel.parent
            if not panel:
                return
            
            panel_body = panel.css_first("div.panel-body")
            if not panel_body:
                return
            
            # Look for Facebook link
            fb_link = panel_body.css_first("a[href*='facebook.com']")
            if fb_link:
                href = fb_link.attributes.get("href", "")
                if href:
                    data.facebook_url = href
        
        except Exception as e:
            logger.debug("parse_facebook_error", error=str(e))
    
    def _parse_stats(self, tree: HTMLParser, data: TrackDashboardData) -> None:
        """Extract lifetime track statistics."""
        try:
            # Find Lifetime Track Stats panel by looking for panel-heading containing "Stats"
            panel_headings = tree.css("div.panel-heading")
            stats_panel = None
            for heading in panel_headings:
                text = heading.text(separator=" ").strip()
                if "Lifetime Track Stats" in text or ("Stats" in text and "Track" in text):
                    stats_panel = heading
                    break
            
            if not stats_panel:
                return
            
            panel = stats_panel.parent
            if not panel:
                return
            
            panel_body = panel.css_first("div.panel-body")
            if not panel_body:
                return
            
            # Find stats table
            table = panel_body.css_first("table")
            if not table:
                return
            
            # Parse table rows
            rows = table.css("tbody tr")
            for row in rows:
                th = row.css_first("th")
                td = row.css_first("td.text-right")
                
                if not th or not td:
                    continue
                
                label = th.text(separator=" ").strip().lower()
                value_str = td.text(separator=" ").strip().replace(",", "")
                
                try:
                    value = int(value_str)
                    
                    if "lap" in label and "s" not in label:  # "Laps" not "Practice Sessions"
                        data.total_laps = value
                    elif "race" in label and "s" in label:
                        data.total_races = value
                    elif "event" in label and "s" in label:
                        data.total_events = value
                except ValueError:
                    continue
        
        except Exception as e:
            logger.debug("parse_stats_error", error=str(e))

