# @fileoverview HTML sample fetching utility for LiveRC
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Utility script to fetch HTML samples from LiveRC for fixture creation
# 
# @purpose Enables developers to capture real LiveRC HTML pages for parser development
#          and testing. Supports both manual URL input and automated discovery.

import argparse
import asyncio
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

from ingestion.common.logging import configure_logging, get_logger
from ingestion.connectors.liverc.client.httpx_client import HTTPXClient
from ingestion.ingestion.errors import ConnectorHTTPError

logger = get_logger(__name__)


def redact_sensitive_data(html: str) -> str:
    """
    Redact sensitive data from HTML (emails, IPs) per fixture management spec.
    
    Args:
        html: Raw HTML content
    
    Returns:
        HTML with sensitive data redacted
    """
    # Redact email addresses
    html = re.sub(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        'REDACTED_EMAIL',
        html
    )
    
    # Redact IP addresses
    html = re.sub(
        r'\b(?:\d{1,3}\.){3}\d{1,3}\b',
        'REDACTED_IP',
        html
    )
    
    return html


def create_metadata(
    page_type: str,
    source_url: str,
    **kwargs
) -> dict:
    """
    Create metadata.json structure for a fixture.
    
    Args:
        page_type: Type of page (track_catalogue, track_events, event, race)
        source_url: Source URL
        **kwargs: Additional metadata fields
    
    Returns:
        Metadata dictionary
    """
    metadata = {
        "page_type": page_type,
        "source_url": source_url,
        "fetched_at": datetime.utcnow().isoformat() + "Z",
        "fixture_version": 1,
    }
    metadata.update(kwargs)
    return metadata


async def fetch_and_save(
    url: str,
    output_path: Path,
    redact: bool = True,
    metadata: Optional[dict] = None,
) -> None:
    """
    Fetch HTML from URL and save to file.
    
    Args:
        url: URL to fetch
        output_path: Path to save HTML file
        redact: Whether to redact sensitive data
        metadata: Optional metadata to save alongside HTML
    """
    logger.info("fetch_start", url=url, output_path=str(output_path))
    
    try:
        async with HTTPXClient() as client:
            response = await client.get(url)
            html = response.text
            
            if redact:
                html = redact_sensitive_data(html)
            
            # Ensure directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save HTML
            output_path.write_text(html, encoding='utf-8')
            logger.info("fetch_success", url=url, output_path=str(output_path), size_bytes=len(html))
            
            # Save metadata if provided
            if metadata:
                metadata_path = output_path.parent / "metadata.json"
                with open(metadata_path, 'w', encoding='utf-8') as f:
                    json.dump(metadata, f, indent=2)
                logger.info("metadata_saved", path=str(metadata_path))
    
    except ConnectorHTTPError as e:
        logger.error("fetch_failed", url=url, error=str(e))
        raise
    except Exception as e:
        logger.error("fetch_unexpected_error", url=url, error=str(e), exc_info=True)
        raise


async def fetch_track_catalogue(output_dir: Path) -> None:
    """Fetch track catalogue page."""
    url = "https://live.liverc.com"
    output_path = output_dir / "track_catalogue.html"
    
    metadata = create_metadata(
        page_type="track_catalogue",
        source_url=url,
    )
    
    await fetch_and_save(url, output_path, metadata=metadata)
    
    # Create notes.md
    notes_path = output_dir / "notes.md"
    notes_path.write_text(f"""# Track Catalogue Fixture

**Source URL**: {url}
**Fetched**: {datetime.utcnow().isoformat()}Z

## Purpose
This fixture contains the global LiveRC track catalogue page used for track discovery.

## Expected Structure
- Track list container (div, table, or list)
- Individual track items with:
  - Track slug (from URL or element)
  - Track name
  - Track URL
  - Events URL
  - Last updated timestamp (if available)

## Notes
- This page should be static HTML (no JavaScript required)
- Track slugs are typically extracted from URLs or subdomain patterns
""")
    
    logger.info("track_catalogue_fetched", output_path=str(output_path))


async def fetch_track_events(track_slug: str, output_dir: Path) -> None:
    """Fetch track events page."""
    url = f"https://{track_slug}.liverc.com/events"
    output_path = output_dir / f"{track_slug}_events.html"
    
    metadata = create_metadata(
        page_type="track_events",
        track_slug=track_slug,
        source_url=url,
    )
    
    await fetch_and_save(url, output_path, metadata=metadata)
    
    logger.info("track_events_fetched", track_slug=track_slug, output_path=str(output_path))


async def fetch_event_detail(
    track_slug: str,
    event_id: str,
    output_dir: Path,
) -> None:
    """Fetch event detail page."""
    url = f"https://{track_slug}.liverc.com/results/?p=view_event&id={event_id}"
    event_dir = output_dir / event_id
    output_path = event_dir / "event.html"
    
    metadata = create_metadata(
        page_type="event",
        event_id=event_id,
        source="liverc",
        track_slug=track_slug,
        source_url=url,
    )
    
    await fetch_and_save(url, output_path, metadata=metadata)
    
    # Create notes.md
    notes_path = event_dir / "notes.md"
    notes_path.write_text(f"""# Event Detail Fixture

**Event ID**: {event_id}
**Track Slug**: {track_slug}
**Source URL**: {url}
**Fetched**: {datetime.utcnow().isoformat()}Z

## Purpose
This fixture contains the event detail page with event metadata and race list.

## Expected Structure
- Event header with:
  - Event name
  - Event date
  - Entries count
  - Drivers count
- Race list/table with:
  - Race ID (from URL parameter)
  - Class name
  - Race label (A-Main, Heat 1, etc.)
  - Race order (if present)
  - Race URL
  - Start time (if available)
  - Duration (if available)

## Notes
- This page may require JavaScript for race list rendering
- Race URLs are typically relative or absolute
- Race order may be extracted from label or separate element
""")
    
    logger.info("event_detail_fetched", event_id=event_id, output_path=str(output_path))


async def fetch_race_result(
    track_slug: str,
    race_id: str,
    event_id: str,
    output_dir: Path,
) -> None:
    """Fetch race result page."""
    url = f"https://{track_slug}.liverc.com/results/?p=view_race_result&id={race_id}"
    event_dir = output_dir / event_id
    output_path = event_dir / f"race.{race_id}.html"
    
    await fetch_and_save(url, output_path)
    
    logger.info("race_result_fetched", race_id=race_id, output_path=str(output_path))
    
    # Update metadata.json with race info
    metadata_path = event_dir / "metadata.json"
    if metadata_path.exists():
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        if "races_expected" not in metadata:
            metadata["races_expected"] = []
        if race_id not in metadata["races_expected"]:
            metadata["races_expected"].append(race_id)
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Fetch HTML samples from LiveRC for fixture creation"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="ingestion/tests/fixtures/liverc",
        help="Output directory for fixtures (default: ingestion/tests/fixtures/liverc)",
    )
    parser.add_argument(
        "--track-catalogue",
        action="store_true",
        help="Fetch track catalogue page",
    )
    parser.add_argument(
        "--track-events",
        type=str,
        metavar="TRACK_SLUG",
        help="Fetch events page for track (e.g., canberraoffroad)",
    )
    parser.add_argument(
        "--event-detail",
        nargs=2,
        metavar=("TRACK_SLUG", "EVENT_ID"),
        help="Fetch event detail page (track_slug event_id)",
    )
    parser.add_argument(
        "--race-result",
        nargs=3,
        metavar=("TRACK_SLUG", "RACE_ID", "EVENT_ID"),
        help="Fetch race result page (track_slug race_id event_id)",
    )
    parser.add_argument(
        "--url",
        type=str,
        help="Fetch arbitrary URL and save to output directory",
    )
    parser.add_argument(
        "--no-redact",
        action="store_true",
        help="Disable sensitive data redaction",
    )
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level",
    )
    
    args = parser.parse_args()
    
    # Configure logging
    configure_logging(args.log_level)
    
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        if args.track_catalogue:
            await fetch_track_catalogue(output_dir)
        
        if args.track_events:
            await fetch_track_events(args.track_events, output_dir)
        
        if args.event_detail:
            track_slug, event_id = args.event_detail
            await fetch_event_detail(track_slug, event_id, output_dir)
        
        if args.race_result:
            track_slug, race_id, event_id = args.race_result
            await fetch_race_result(track_slug, race_id, event_id, output_dir)
        
        if args.url:
            url = args.url
            parsed = urlparse(url)
            filename = f"{parsed.netloc.replace('.', '_')}{parsed.path.replace('/', '_')}.html"
            if not filename.endswith('.html'):
                filename += '.html'
            output_path = output_dir / filename
            await fetch_and_save(url, output_path, redact=not args.no_redact)
        
        if not any([
            args.track_catalogue,
            args.track_events,
            args.event_detail,
            args.race_result,
            args.url,
        ]):
            parser.print_help()
            logger.warning("no_action_specified")
    
    except Exception as e:
        logger.error("script_failed", error=str(e), exc_info=True)
        raise


if __name__ == "__main__":
    asyncio.run(main())

