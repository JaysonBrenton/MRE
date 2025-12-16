# @fileoverview URL utility functions for LiveRC connector
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Centralized URL construction utilities for LiveRC connector
# 
# @purpose Per specification requirement: "URL rules MUST be centralised in a
#          utility module to prevent duplication."

from typing import Optional
from urllib.parse import urlparse, urljoin


def build_track_url(track_slug: str) -> str:
    """
    Build track base URL.
    
    Args:
        track_slug: Track subdomain slug (e.g., "canberraoffroad")
    
    Returns:
        Full track URL (e.g., "https://canberraoffroad.liverc.com")
    """
    return f"https://{track_slug}.liverc.com"


def build_events_url(track_slug: str) -> str:
    """
    Build track events listing URL.
    
    Args:
        track_slug: Track subdomain slug
    
    Returns:
        Full events URL (e.g., "https://canberraoffroad.liverc.com/events")
    """
    return f"https://{track_slug}.liverc.com/events"


def build_event_url(track_slug: str, source_event_id: str) -> str:
    """
    Build event detail page URL.
    
    Args:
        track_slug: Track subdomain slug
        source_event_id: Event ID from LiveRC
    
    Returns:
        Full event URL (e.g., "https://canberraoffroad.liverc.com/results/?p=view_event&id=6304829")
    """
    return f"https://{track_slug}.liverc.com/results/?p=view_event&id={source_event_id}"


def build_race_url(track_slug: str, source_race_id: str) -> str:
    """
    Build race result page URL.
    
    Args:
        track_slug: Track subdomain slug
        source_race_id: Race ID from LiveRC
    
    Returns:
        Full race URL (e.g., "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=6304829")
    """
    return f"https://{track_slug}.liverc.com/results/?p=view_race_result&id={source_race_id}"


def parse_track_slug_from_url(url: str) -> Optional[str]:
    """
    Extract track slug from URL.
    
    Args:
        url: Full URL or relative URL
    
    Returns:
        Track slug if found, None otherwise
    
    Examples:
        >>> parse_track_slug_from_url("https://canberraoffroad.liverc.com/events")
        "canberraoffroad"
        >>> parse_track_slug_from_url("/results/?p=view_event&id=123")
        None
    """
    if not url:
        return None
    
    # Handle relative URLs
    if not url.startswith("http"):
        return None
    
    try:
        parsed = urlparse(url)
        hostname = parsed.netloc
        
        # Extract subdomain (track slug)
        # Format: {track_slug}.liverc.com
        if hostname.endswith(".liverc.com"):
            slug = hostname.replace(".liverc.com", "")
            if slug:
                return slug
        
        return None
    except Exception:
        return None


def normalize_race_url(race_url: str, track_slug: Optional[str] = None) -> str:
    """
    Normalize race URL to full absolute URL.
    
    Args:
        race_url: Race URL (may be absolute or relative)
        track_slug: Track slug if URL is relative
    
    Returns:
        Full absolute URL
    
    Examples:
        >>> normalize_race_url("https://canberraoffroad.liverc.com/results/?p=view_race_result&id=123")
        "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=123"
        >>> normalize_race_url("/results/?p=view_race_result&id=123", "canberraoffroad")
        "https://canberraoffroad.liverc.com/results/?p=view_race_result&id=123"
    """
    # Already absolute
    if race_url.startswith("http"):
        return race_url
    
    # Relative URL - need track_slug
    if not track_slug:
        raise ValueError("track_slug required for relative URLs")
    
    # Handle both /results/... and results/... formats
    if race_url.startswith("/"):
        return f"https://{track_slug}.liverc.com{race_url}"
    else:
        return f"https://{track_slug}.liverc.com/{race_url}"

