# @fileoverview Track dashboard parser for LiveRC
# 
# @created 2025-01-27
# @creator Auto (AI Assistant)
# @lastModified 2025-01-27
# 
# @description Parser for track dashboard pages to extract metadata
# 
# @purpose Extracts location data, contact information, track statistics,
#          descriptions, and logos from LiveRC track dashboard pages

from typing import Optional
from urllib.parse import urlparse, parse_qs, unquote
from selectolax.parser import HTMLParser
import re

from ingestion.common.logging import get_logger
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
            
            # Remove track name (first line, usually after <strong>)
            if address_lines and address_lines[0]:
                # Track name is typically in <strong> and might be the first line
                # Skip it if it looks like a track name (contains common track words)
                first_line = address_lines[0]
                track_name_indicators = ["rc", "speedway", "raceway", "track", "off-road", "offroad"]
                if not any(indicator.lower() in first_line.lower() for indicator in track_name_indicators):
                    # Might not be track name, keep it
                    pass
            
            # Try to extract structured address from lines
            if address_lines:
                # Filter out contact info lines (phone, website, email)
                contact_markers = ["p:", "w:", "e:", "phone", "website", "email", "tel:", "http"]
                address_only_lines = [
                    line for line in address_lines
                    if not any(marker in line.lower() for marker in contact_markers)
                ]
                
                if address_only_lines:
                    # Build full address string from remaining lines
                    data.address = ", ".join(address_only_lines)
                    
                    # Try to parse city/state/country from last line
                    if len(address_only_lines) > 0:
                        last_line = address_only_lines[-1]
                        # Check if last line contains city/state/country patterns
                        if re.search(r'\d{4,5}', last_line) or any(
                            country in last_line 
                            for country in ["United States", "USA", "US", "Australia", "AU", "Canada", "CA"]
                        ):
                            self._parse_city_state_country(last_line, data)
                        elif len(address_only_lines) > 1:
                            # Try second-to-last line if last doesn't match
                            second_last = address_only_lines[-2]
                            if re.search(r'\d{4,5}', second_last):
                                self._parse_city_state_country(second_last, data)
            
            # Extract phone
            phone_link = panel_body.css_first("address a[href^='tel:']")
            if phone_link:
                phone_href = phone_link.attributes.get("href", "")
                if phone_href.startswith("tel:"):
                    data.phone = phone_href[4:].strip()
                else:
                    phone_text = phone_link.text(separator=" ").strip()
                    if phone_text:
                        data.phone = phone_text
            
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
                data.country = parts[2]
            elif len(parts) == 2:
                # Format: City, State Postal Country or City State, Country
                # Check if second part contains country name
                country_indicators = ["United States", "USA", "US", "Australia", "AU", "Canada", "CA"]
                if any(ind in parts[1] for ind in country_indicators):
                    data.country = parts[1]
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
                    # Check for country at end
                    country_indicators = ["United States", "USA", "US", "Australia", "AU", "Canada", "CA"]
                    if words[-1] in country_indicators:
                        data.country = words[-1]
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
    
    def _parse_map_section(self, tree: HTMLParser, data: TrackDashboardData) -> None:
        """Extract map coordinates or address from Google Maps embed."""
        try:
            # Find Track Map panel by looking for panel-heading containing "Track Map"
            panel_headings = tree.css("div.panel-heading")
            map_panel = None
            for heading in panel_headings:
                text = heading.text(separator=" ").strip()
                if "Track Map" in text or "Map" in text:
                    map_panel = heading
                    break
            
            if not map_panel:
                return
            
            panel = map_panel.parent
            if not panel:
                return
            
            # Find iframe
            iframe = panel.css_first("iframe[src*='google.com/maps']")
            if not iframe:
                return
            
            src = iframe.attributes.get("src", "")
            if not src:
                return
            
            # Parse Google Maps embed URL
            # Format: https://www.google.com/maps/embed/v1/place?key=...&q=ADDRESS
            parsed = urlparse(src)
            query_params = parse_qs(parsed.query)
            
            # Extract address from 'q' parameter
            if 'q' in query_params:
                address_query = query_params['q'][0]
                # Decode URL encoding
                address_query = unquote(address_query)
                
                # If we don't have an address yet, use this
                if not data.address:
                    data.address = address_query
                
                # Try to extract coordinates if present in query
                # Some embeds might have lat/lng in the URL
                if 'center' in query_params:
                    center = query_params['center'][0]
                    coords = center.split(',')
                    if len(coords) == 2:
                        try:
                            data.latitude = float(coords[0])
                            data.longitude = float(coords[1])
                        except ValueError:
                            pass
            
            # Note: Direct coordinate extraction from Google Maps embed is limited
            # We'll need to geocode the address as a fallback
        
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

