# @fileoverview CLI commands for ingestion service
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description Click-based CLI commands for admin operations
# 
# @purpose Provides command-line interface for managing ingestion operations

import asyncio
import sys
import os
import glob
from typing import Optional, List, Dict, Callable, Any
from uuid import UUID
from pathlib import Path

import click

from datetime import datetime, timedelta, date

from ingestion.common.logging import configure_logging, get_logger
from ingestion.connectors.liverc.connector import LiveRCConnector
from ingestion.db.session import db_session
from ingestion.db.repository import Repository
from ingestion.db.models import Track, Event, IngestDepth
from ingestion.ingestion.errors import (
    ConnectorHTTPError,
    EventPageFormatError,
    IngestionInProgressError,
    StateMachineError,
    ValidationError,
)
from ingestion.ingestion.pipeline import IngestionPipeline
from ingestion.ingestion.auto_confirm import check_and_confirm_links
from ingestion.common.site_policy import SitePolicy, ScrapingDisabledError

logger = get_logger(__name__)


def _ensure_scraping_enabled(command: str) -> None:
    """Prevent commands from running when scraping is disabled."""
    try:
        SITE_POLICY.ensure_enabled(command)
    except ScrapingDisabledError as exc:
        logger.warning("scraping_disabled", command=command)
        raise click.ClickException(str(exc))


def get_reports_directory() -> Path:
    """
    Get the reports directory path.
    
    Returns:
        Path to reports directory
    """
    # Check if we're in Docker (reports mounted at /app/reports)
    if os.path.exists("/app/reports"):
        return Path("/app/reports")
    # Otherwise, use relative path from repo root
    return Path(__file__).parent.parent.parent / "reports"


def generate_track_sync_report(
    start_time: datetime,
    duration_seconds: float,
    total_tracks: int,
    tracks_added: int,
    tracks_updated: int,
    tracks_deactivated: int,
    new_tracks: List[Dict[str, str]],
    updated_tracks: List[Dict[str, str]],
    deactivated_tracks: List[Dict[str, str]],
) -> str:
    """
    Generate markdown report for track sync operation.
    
    Args:
        start_time: When the sync started
        duration_seconds: How long it took
        total_tracks: Total number of tracks
        tracks_added: Number of new tracks
        tracks_updated: Number of updated tracks
        tracks_deactivated: Number of deactivated tracks
        new_tracks: List of new track details
        updated_tracks: List of updated track details
        deactivated_tracks: List of deactivated track details
    
    Returns:
        Path to the generated report file
    """
    reports_dir = get_reports_directory()
    reports_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate filename with timestamp
    timestamp_str = start_time.strftime("%Y-%m-%d-%H-%M-%S")
    report_filename = f"track-sync-{timestamp_str}.md"
    report_path = reports_dir / report_filename
    
    # Generate report content
    report_lines = [
        "# Track Catalogue Sync Report",
        "",
        f"**Execution Time**: {start_time.strftime('%Y-%m-%d %H:%M:%S')} UTC",
        f"**Duration**: {duration_seconds:.2f}s",
        "",
        "## Summary",
        f"- Total Tracks: {total_tracks}",
        f"- New Tracks: {tracks_added}",
        f"- Updated Tracks: {tracks_updated}",
        f"- Deactivated Tracks: {tracks_deactivated}",
        "",
    ]
    
    # New tracks section
    if new_tracks:
        report_lines.extend([
            "## New Tracks",
        ])
        for i, track in enumerate(new_tracks, 1):
            report_lines.append(
                f"{i}. {track['name']} | {track['slug']} | {track['url']}"
            )
        report_lines.append("")
    else:
        report_lines.extend([
            "## New Tracks",
            "*No new tracks*",
            "",
        ])
    
    # Updated tracks section
    if updated_tracks:
        report_lines.extend([
            "## Updated Tracks",
        ])
        for i, track in enumerate(updated_tracks, 1):
            report_lines.append(
                f"{i}. {track['name']} | {track['slug']} | Updated: {track['changes']}"
            )
        report_lines.append("")
    else:
        report_lines.extend([
            "## Updated Tracks",
            "*No tracks updated*",
            "",
        ])
    
    # Deactivated tracks section
    if deactivated_tracks:
        report_lines.extend([
            "## Deactivated Tracks",
        ])
        for i, track in enumerate(deactivated_tracks, 1):
            report_lines.append(
                f"{i}. {track['name']} | {track['slug']} | No longer in LiveRC catalogue"
            )
        report_lines.append("")
    else:
        report_lines.extend([
            "## Deactivated Tracks",
            "*No tracks deactivated*",
            "",
        ])
    
    # Write report
    report_content = "\n".join(report_lines)
    report_path.write_text(report_content, encoding="utf-8")
    
    logger.info("track_sync_report_generated", report_path=str(report_path))
    
    return str(report_path)


def cleanup_old_reports() -> None:
    """
    Clean up old track sync reports.
    
    Deletes reports older than TRACK_SYNC_REPORT_RETENTION_DAYS (default 30).
    """
    retention_days = int(os.getenv("TRACK_SYNC_REPORT_RETENTION_DAYS", "30"))
    reports_dir = get_reports_directory()
    
    if not reports_dir.exists():
        return
    
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    deleted_count = 0
    
    # Find all track-sync-*.md files
    pattern = str(reports_dir / "track-sync-*.md")
    for report_path in glob.glob(pattern):
        try:
            # Extract timestamp from filename: track-sync-YYYY-MM-DD-HH-MM-SS.md
            filename = Path(report_path).name
            timestamp_str = filename.replace("track-sync-", "").replace(".md", "")
            report_date = datetime.strptime(timestamp_str, "%Y-%m-%d-%H-%M-%S")
            
            if report_date < cutoff_date:
                os.remove(report_path)
                deleted_count += 1
                logger.debug("old_report_deleted", report_path=report_path, report_date=report_date.isoformat())
        except (ValueError, OSError) as e:
            logger.warning("failed_to_delete_report", report_path=report_path, error=str(e))
    
    if deleted_count > 0:
        logger.info("old_reports_cleaned", deleted_count=deleted_count, retention_days=retention_days)


def _refresh_events_for_track(
    session,
    connector: LiveRCConnector,
    track: Track,
    depth: str,
    ingest_new_only: bool,
    ingest_all: bool,
    echo: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """Core logic shared by multiple commands for event refresh."""
    repository = Repository(session)
    events = asyncio.run(connector.list_events_for_track(track.source_track_slug))

    events_added = 0
    events_updated = 0
    new_event_ids: List[UUID] = []

    for event_summary in events:
        existing = session.query(Event).filter(
            Event.source == event_summary.source,
            Event.source_event_id == event_summary.source_event_id
        ).first()

        event_date = event_summary.event_date
        if not isinstance(event_date, datetime):
            if isinstance(event_date, date):
                event_date = datetime.combine(event_date, datetime.min.time())

        event = repository.upsert_event(
            source=event_summary.source,
            source_event_id=event_summary.source_event_id,
            track_id=track.id,
            event_name=event_summary.event_name,
            event_date=event_date,
            event_entries=event_summary.event_entries,
            event_drivers=event_summary.event_drivers,
            event_url=event_summary.event_url,
        )

        if existing:
            events_updated += 1
        else:
            events_added += 1
            new_event_ids.append(event.id)

    session.commit()

    stats = {
        "events_total": len(events),
        "events_added": events_added,
        "events_updated": events_updated,
        "events_ingested": 0,
        "events_failed": 0,
        "races_ingested": 0,
        "results_ingested": 0,
        "laps_ingested": 0,
    }

    if depth == "laps_full":
        pipeline = IngestionPipeline()
        if ingest_all:
            track_events = session.query(Event).filter(Event.track_id == track.id).all()
            events_to_ingest = [e.id for e in track_events]
            ingest_new_only = False
        else:
            events_to_ingest = new_event_ids

        if echo:
            echo(f"\nStarting full ingestion for {len(events_to_ingest)} event(s)...")

        for event_id in events_to_ingest:
            try:
                event = session.get(Event, str(event_id))
                if not event:
                    logger.warning("event_not_found_for_ingestion", event_id=str(event_id))
                    continue

                if ingest_new_only and event.ingest_depth == IngestDepth.LAPS_FULL:
                    logger.debug("event_already_ingested", event_id=str(event_id))
                    continue

                if echo:
                    echo(f"  Ingesting event: {event.event_name} ({event.source_event_id})...")

                result = asyncio.run(pipeline.ingest_event(event_id, depth="laps_full"))
                stats["events_ingested"] += 1
                stats["races_ingested"] += result.get("races_ingested", 0)
                stats["results_ingested"] += result.get("results_ingested", 0)
                stats["laps_ingested"] += result.get("laps_ingested", 0)
                logger.info(
                    "event_ingestion_success",
                    event_id=str(event_id),
                    races=result.get("races_ingested", 0),
                    results=result.get("results_ingested", 0),
                    laps=result.get("laps_ingested", 0)
                )
            except IngestionInProgressError:
                logger.warning("event_ingestion_in_progress", event_id=str(event_id))
                stats["events_failed"] += 1
                if echo:
                    echo("    ⚠ Skipped (ingestion already in progress)")
            except (StateMachineError, ValidationError) as err:
                logger.error("event_ingestion_error", event_id=str(event_id), error=str(err))
                stats["events_failed"] += 1
                if echo:
                    echo(f"    ✗ Failed: {str(err)}")
            except Exception as err:  # pragma: no cover - safety net
                logger.error("event_ingestion_unexpected_error", event_id=str(event_id), error=str(err), exc_info=True)
                stats["events_failed"] += 1
                if echo:
                    echo(f"    ✗ Failed: {str(err)}")

    return stats


@click.group()
@click.option("--log-level", default="INFO", help="Logging level")
def cli(log_level: str):
    """MRE Ingestion CLI tools."""
    configure_logging(log_level)


@cli.group()
def ingest():
    """Ingestion operations."""
    pass


@ingest.group()
def liverc():
    """LiveRC ingestion commands."""
    pass


@liverc.command("list-tracks")
def list_tracks():
    """List all tracks in the catalogue."""
    with db_session() as session:
        from sqlalchemy import select
        repo = Repository(session)
        stmt = select(Track)
        tracks = session.scalars(stmt).all()
        
        if not tracks:
            click.echo("No tracks found.")
            return
        
        click.echo(f"Found {len(tracks)} tracks:")
        for track in tracks:
            click.echo(
                f"  {track.id} | {track.source_track_slug} | {track.track_name} | "
                f"Active: {track.is_active} | Followed: {track.is_followed}"
            )


@liverc.command("refresh-tracks")
def refresh_tracks():
    """Re-scrape the global LiveRC track list."""
    _ensure_scraping_enabled("refresh-tracks")
    start_time = datetime.utcnow()
    logger.info("refresh_tracks_start", timestamp=start_time.isoformat())
    
    try:
        connector = LiveRCConnector()
        
        # Fetch tracks from LiveRC
        tracks = asyncio.run(connector.list_tracks())
        
        new_tracks: List[Dict[str, str]] = []
        updated_tracks: List[Dict[str, str]] = []
        deactivated_tracks: List[Dict[str, str]] = []
        
        with db_session() as session:
            repository = Repository(session)
            tracks_added = 0
            tracks_updated = 0
            seen_slugs = set()
            
            # Upsert each track
            for track_summary in tracks:
                seen_slugs.add(track_summary.source_track_slug)
                
                # Check if track exists
                existing = session.query(Track).filter(
                    Track.source == track_summary.source,
                    Track.source_track_slug == track_summary.source_track_slug
                ).first()
                
                if existing:
                    # Track what changed
                    changes = []
                    if existing.track_name != track_summary.track_name:
                        changes.append("track_name")
                    if existing.track_url != track_summary.track_url:
                        changes.append("track_url")
                    if existing.events_url != track_summary.events_url:
                        changes.append("events_url")
                    if existing.liverc_track_last_updated != track_summary.liverc_track_last_updated:
                        changes.append("liverc_track_last_updated")
                    if existing.is_active != True:
                        changes.append("is_active")
                    
                    if changes:
                        tracks_updated += 1
                        updated_tracks.append({
                            "name": track_summary.track_name,
                            "slug": track_summary.source_track_slug,
                            "url": track_summary.track_url,
                            "changes": ", ".join(changes)
                        })
                else:
                    tracks_added += 1
                    new_tracks.append({
                        "name": track_summary.track_name,
                        "slug": track_summary.source_track_slug,
                        "url": track_summary.track_url
                    })
                
                repository.upsert_track(
                    source=track_summary.source,
                    source_track_slug=track_summary.source_track_slug,
                    track_name=track_summary.track_name,
                    track_url=track_summary.track_url,
                    events_url=track_summary.events_url,
                    liverc_track_last_updated=track_summary.liverc_track_last_updated,
                    is_active=True,
                )
            
            # Mark tracks not in latest sync as inactive
            all_tracks = session.query(Track).filter(Track.source == "liverc").all()
            tracks_deactivated = 0
            
            for track in all_tracks:
                if track.source_track_slug not in seen_slugs:
                    track.is_active = False
                    tracks_deactivated += 1
                    deactivated_tracks.append({
                        "name": track.track_name,
                        "slug": track.source_track_slug,
                        "url": track.track_url
                    })
            
            session.commit()
        
        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        duration_seconds = duration_ms / 1000.0
        
        # Generate markdown report
        report_path = generate_track_sync_report(
            start_time,
            duration_seconds,
            len(tracks),
            tracks_added,
            tracks_updated,
            tracks_deactivated,
            new_tracks,
            updated_tracks,
            deactivated_tracks
        )
        
        # Cleanup old reports
        cleanup_old_reports()
        
        logger.info(
            "refresh_tracks_success",
            command="refresh-tracks",
            tracks_added=tracks_added,
            tracks_updated=tracks_updated,
            tracks_deactivated=tracks_deactivated,
            status="success",
            duration_ms=duration_ms,
            report_path=report_path,
        )
        
        click.echo(f"Track refresh completed:")
        click.echo(f"  Added: {tracks_added}")
        click.echo(f"  Updated: {tracks_updated}")
        click.echo(f"  Deactivated: {tracks_deactivated}")
        click.echo(f"  Total: {len(tracks)}")
        click.echo(f"  Report: {report_path}")
        sys.exit(0)
    
    except ConnectorHTTPError as e:
        logger.error("refresh_tracks_http_error", error=str(e))
        click.echo(f"HTTP error: {str(e)}", err=True)
        sys.exit(2)
    
    except EventPageFormatError as e:
        logger.error("refresh_tracks_parse_error", error=str(e))
        click.echo(f"Parse error: {str(e)}", err=True)
        sys.exit(1)
    
    except Exception as e:
        logger.error("refresh_tracks_error", error=str(e), exc_info=True)
        click.echo(f"Track refresh failed: {str(e)}", err=True)
        sys.exit(2)


@liverc.command("list-events")
@click.option("--track-id", required=True, help="Track ID")
@click.option("--start-date", help="Start date (ISO format)")
@click.option("--end-date", help="End date (ISO format)")
def list_events(track_id: str, start_date: Optional[str], end_date: Optional[str]):
    """List events for a track."""
    with db_session() as session:
        repo = Repository(session)
        track = session.get(Track, str(UUID(track_id)))
        
        if not track:
            click.echo(f"Track {track_id} not found.", err=True)
            sys.exit(1)
        
        from sqlalchemy import select
        from datetime import datetime
        
        stmt = select(Event).where(Event.track_id == track.id)
        
        if start_date:
            stmt = stmt.where(Event.event_date >= datetime.fromisoformat(start_date))
        if end_date:
            stmt = stmt.where(Event.event_date <= datetime.fromisoformat(end_date))
        
        events = session.scalars(stmt).all()
        
        if not events:
            click.echo("No events found.")
            return
        
        click.echo(f"Found {len(events)} events:")
        for event in events:
            click.echo(
                f"  {event.id} | {event.source_event_id} | {event.event_name} | "
                f"{event.event_date} | Depth: {event.ingest_depth.value}"
            )


@liverc.command("refresh-events")
@click.option("--track-id", required=True, help="Track ID")
@click.option("--depth", required=True, type=click.Choice(["none", "laps_full"]), help="Ingestion depth")
@click.option("--ingest-new-only", is_flag=True, default=True, help="Only ingest new events (default: True)")
@click.option("--ingest-all", is_flag=True, default=False, help="Ingest all events regardless of current state")
def refresh_events(track_id: str, depth: str, ingest_new_only: bool, ingest_all: bool):
    """Populate or refresh events for a track, optionally with full ingestion."""
    _ensure_scraping_enabled("refresh-events")
    start_time = datetime.utcnow()
    logger.info(
        "refresh_events_start",
        track_id=track_id,
        depth=depth,
        ingest_new_only=ingest_new_only,
        ingest_all=ingest_all,
        timestamp=start_time.isoformat()
    )

    try:
        track_uuid = UUID(track_id)
    except ValueError:
        click.echo(f"Invalid track_id format: {track_id}", err=True)
        sys.exit(1)

    if ingest_all:
        ingest_new_only = False

    try:
        connector = LiveRCConnector()
        with db_session() as session:
            track = session.get(Track, str(track_uuid))
            if not track:
                click.echo(f"Track {track_id} not found.", err=True)
                sys.exit(1)

            summary = _refresh_events_for_track(
                session=session,
                connector=connector,
                track=track,
                depth=depth,
                ingest_new_only=ingest_new_only,
                ingest_all=ingest_all,
                echo=click.echo,
            )

        duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        logger.info(
            "refresh_events_success",
            command="refresh-events",
            track_id=track_id,
            depth=depth,
            events_added=summary["events_added"],
            events_updated=summary["events_updated"],
            events_ingested=summary["events_ingested"],
            events_failed=summary["events_failed"],
            status="success",
            duration_ms=duration_ms,
        )

        click.echo("Event refresh completed:")
        click.echo(
            f"  Events discovered: {summary['events_added']} new, {summary['events_updated']} updated"
        )
        click.echo(f"  Total events: {summary['events_total']}")

        if depth == "laps_full":
            click.echo("Full ingestion results:")
            click.echo(
                f"  Events ingested: {summary['events_ingested']} successful, {summary['events_failed']} failed"
            )
            click.echo(f"  Races ingested: {summary['races_ingested']}")
            click.echo(f"  Results ingested: {summary['results_ingested']}")
            click.echo(f"  Laps ingested: {summary['laps_ingested']}")

        sys.exit(0)

    except ConnectorHTTPError as e:
        logger.error("refresh_events_http_error", error=str(e))
        click.echo(f"HTTP error: {str(e)}", err=True)
        sys.exit(2)

    except EventPageFormatError as e:
        logger.error("refresh_events_parse_error", error=str(e))
        click.echo(f"Parse error: {str(e)}", err=True)
        sys.exit(1)

    except Exception as e:
        logger.error("refresh_events_error", error=str(e), exc_info=True)
        click.echo(f"Event refresh failed: {str(e)}", err=True)
        sys.exit(2)


@liverc.command("refresh-followed-events")
@click.option("--depth", default="none", show_default=True, type=click.Choice(["none", "laps_full"]), help="Ingestion depth for each track")
@click.option("--ingest-new-only", is_flag=True, default=True, help="Only ingest newly discovered events")
@click.option("--ingest-all", is_flag=True, default=False, help="Re-ingest all events for each track")
@click.option("--quiet", is_flag=True, default=False, help="Suppress per-event console output")
def refresh_followed_events(depth: str, ingest_new_only: bool, ingest_all: bool, quiet: bool):
    """Refresh events for every followed track (automated workflow)."""
    _ensure_scraping_enabled("refresh-followed-events")
    start_time = datetime.utcnow()
    logger.info(
        "refresh_followed_events_start",
        depth=depth,
        ingest_new_only=ingest_new_only,
        ingest_all=ingest_all,
        quiet=quiet,
        timestamp=start_time.isoformat(),
    )

    if ingest_all:
        ingest_new_only = False

    connector = LiveRCConnector()

    with db_session() as session:
        track_rows = session.query(Track.id, Track.source_track_slug).filter(
            Track.is_active.is_(True),
            Track.is_followed.is_(True),
        ).all()

    if not track_rows:
        click.echo("No followed tracks found. Nothing to refresh.")
        sys.exit(0)

    totals = {
        "tracks": len(track_rows),
        "events_total": 0,
        "events_added": 0,
        "events_updated": 0,
        "events_ingested": 0,
        "events_failed": 0,
        "races_ingested": 0,
        "results_ingested": 0,
        "laps_ingested": 0,
    }

    for track_id, track_slug in track_rows:
        with db_session() as session:
            track = session.get(Track, str(track_id))
            if not track:
                logger.warning("followed_track_missing", track_id=str(track_id))
                continue

            echo_fn = None
            if not quiet and depth == "laps_full":
                def echo_with_slug(message: str, slug: str = track_slug) -> None:
                    click.echo(f"[{slug}] {message}")

                echo_fn = echo_with_slug

            try:
                summary = _refresh_events_for_track(
                    session=session,
                    connector=connector,
                    track=track,
                    depth=depth,
                    ingest_new_only=ingest_new_only,
                    ingest_all=ingest_all,
                    echo=echo_fn,
                )
            except Exception as err:
                logger.error(
                    "refresh_followed_events_track_error",
                    track_id=str(track_id),
                    error=str(err),
                    exc_info=True,
                )
                continue

            totals["events_total"] += summary["events_total"]
            totals["events_added"] += summary["events_added"]
            totals["events_updated"] += summary["events_updated"]
            totals["events_ingested"] += summary["events_ingested"]
            totals["events_failed"] += summary["events_failed"]
            totals["races_ingested"] += summary["races_ingested"]
            totals["results_ingested"] += summary["results_ingested"]
            totals["laps_ingested"] += summary["laps_ingested"]

    duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

    logger.info(
        "refresh_followed_events_complete",
        depth=depth,
        totals=totals,
        duration_ms=duration_ms,
    )

    click.echo("Followed track refresh complete:")
    click.echo(f"  Tracks processed: {totals['tracks']}")
    click.echo(
        f"  Events discovered: {totals['events_added']} new, {totals['events_updated']} updated"
    )
    click.echo(f"  Total events scanned: {totals['events_total']}")

    if depth == "laps_full":
        click.echo("\nFull ingestion rollup:")
        click.echo(
            f"  Events ingested: {totals['events_ingested']} successful, {totals['events_failed']} failed"
        )
        click.echo(f"  Races ingested: {totals['races_ingested']}")
        click.echo(f"  Results ingested: {totals['results_ingested']}")
        click.echo(f"  Laps ingested: {totals['laps_ingested']}")

    sys.exit(0)


@liverc.command("ingest-event")
@click.option("--event-id", required=True, help="Event ID")
@click.option("--depth", default="laps_full", help="Ingestion depth")
def ingest_event(event_id: str, depth: str):
    """Perform ingestion for a specific event."""
    _ensure_scraping_enabled("ingest-event")
    click.echo(f"Ingesting event {event_id} with depth {depth}...")
    
    try:
        pipeline = IngestionPipeline()
        result = asyncio.run(
            pipeline.ingest_event(
                event_id=UUID(event_id),
                depth=depth,
            )
        )
        
        click.echo("Ingestion completed successfully:")
        click.echo(f"  Races ingested: {result['races_ingested']}")
        click.echo(f"  Results ingested: {result['results_ingested']}")
        click.echo(f"  Laps ingested: {result['laps_ingested']}")
        sys.exit(0)
    
    except Exception as e:
        click.echo(f"Ingestion failed: {str(e)}", err=True)
        sys.exit(2)


@liverc.command("status")
def status():
    """Show ingestion subsystem health summary."""
    with db_session() as session:
        from sqlalchemy import select, func
        from ingestion.db.models import Race, RaceResult, Lap, IngestDepth
        
        # Counts
        track_count = session.scalar(select(func.count(Track.id)))
        event_count = session.scalar(select(func.count(Event.id)))
        race_count = session.scalar(select(func.count(Race.id)))
        result_count = session.scalar(select(func.count(RaceResult.id)))
        lap_count = session.scalar(select(func.count(Lap.id)))
        
        # Timestamps
        oldest_ingestion = session.scalar(
            select(func.min(Event.last_ingested_at)).where(Event.last_ingested_at.isnot(None))
        )
        newest_ingestion = session.scalar(
            select(func.max(Event.last_ingested_at)).where(Event.last_ingested_at.isnot(None))
        )
        
        # Events by ingest_depth breakdown
        events_by_depth = {}
        for depth in IngestDepth:
            count = session.scalar(
                select(func.count(Event.id)).where(Event.ingest_depth == depth)
            )
            events_by_depth[depth.value] = count
        
        # Output structured log format
        logger.info(
            "status_command",
            command="status",
            tracks=track_count or 0,
            events=event_count or 0,
            races=race_count or 0,
            results=result_count or 0,
            laps=lap_count or 0,
            oldest_ingestion=oldest_ingestion.isoformat() if oldest_ingestion else None,
            newest_ingestion=newest_ingestion.isoformat() if newest_ingestion else None,
            events_by_depth=events_by_depth,
        )
        
        click.echo("Ingestion Status:")
        click.echo(f"  Tracks: {track_count or 0}")
        click.echo(f"  Events: {event_count or 0}")
        click.echo(f"  Races: {race_count or 0}")
        click.echo(f"  Results: {result_count or 0}")
        click.echo(f"  Laps: {lap_count or 0}")
        
        if oldest_ingestion:
            click.echo(f"  Oldest Ingestion: {oldest_ingestion.isoformat()}")
        if newest_ingestion:
            click.echo(f"  Newest Ingestion: {newest_ingestion.isoformat()}")
        
        click.echo("\nEvents by Ingestion Depth:")
        for depth, count in events_by_depth.items():
            click.echo(f"  {depth}: {count}")


@cli.command("auto-confirm-links")
def auto_confirm_links():
    """Auto-confirm user-driver links based on multi-event transponder matches."""
    logger.info("auto_confirm_links_start")
    
    with db_session() as session:
        repo = Repository(session)
        stats = check_and_confirm_links(repo)
        session.commit()
    
    click.echo(f"\nAuto-confirmation complete:")
    click.echo(f"  Links confirmed: {stats['links_confirmed']}")
    click.echo(f"  Links rejected: {stats['links_rejected']}")
    click.echo(f"  Links conflicted: {stats['links_conflicted']}")
    
    logger.info("auto_confirm_links_complete", **stats)


@liverc.command("verify-integrity")
def verify_integrity():
    """Verify data integrity across tables."""
    logger.info("verify_integrity_start", command="verify-integrity")
    
    issues_found = False
    
    with db_session() as session:
        from sqlalchemy import select, func, and_, or_
        from ingestion.db.models import Race, RaceResult, RaceDriver, Lap, IngestDepth
        
        # 1. Check for orphaned races
        orphaned_races = session.query(Race).outerjoin(
            Event, Race.event_id == Event.id
        ).filter(Event.id.is_(None)).all()
        
        if orphaned_races:
            issues_found = True
            click.echo(f"Found {len(orphaned_races)} orphaned races:")
            for race in orphaned_races[:10]:  # Show first 10
                click.echo(f"  Race {race.id} (event_id: {race.event_id})")
            if len(orphaned_races) > 10:
                click.echo(f"  ... and {len(orphaned_races) - 10} more")
        
        # 2. Check for orphaned race results
        orphaned_results = session.query(RaceResult).outerjoin(
            Race, RaceResult.race_id == Race.id
        ).filter(Race.id.is_(None)).all()
        
        if orphaned_results:
            issues_found = True
            click.echo(f"\nFound {len(orphaned_results)} orphaned race results:")
            for result in orphaned_results[:10]:
                click.echo(f"  Result {result.id} (race_id: {result.race_id})")
            if len(orphaned_results) > 10:
                click.echo(f"  ... and {len(orphaned_results) - 10} more")
        
        # 3. Check for missing lap series
        # Results with laps_completed > 0 but no laps in database
        lap_counts = session.query(
            Lap.race_result_id,
            func.count(Lap.id).label('lap_count')
        ).group_by(Lap.race_result_id).subquery()
        
        missing_laps = session.query(RaceResult).outerjoin(
            lap_counts, RaceResult.id == lap_counts.c.race_result_id
        ).filter(
            and_(
                RaceResult.laps_completed > 0,
                or_(
                    lap_counts.c.lap_count.is_(None),
                    lap_counts.c.lap_count != RaceResult.laps_completed
                )
            )
        ).all()
        
        if missing_laps:
            issues_found = True
            click.echo(f"\nFound {len(missing_laps)} results with missing/incomplete lap data:")
            for result in missing_laps[:10]:
                actual_count = session.query(func.count(Lap.id)).filter(
                    Lap.race_result_id == result.id
                ).scalar() or 0
                click.echo(
                    f"  Result {result.id}: expected {result.laps_completed} laps, "
                    f"found {actual_count}"
                )
            if len(missing_laps) > 10:
                click.echo(f"  ... and {len(missing_laps) - 10} more")
        
        # 4. Check for mismatched driver counts
        # Events where event_drivers != actual driver count
        driver_counts = session.query(
            Event.id,
            Event.event_drivers,
            func.count(func.distinct(RaceDriver.id)).label('actual_drivers')
        ).outerjoin(
            Race, Race.event_id == Event.id
        ).outerjoin(
            RaceDriver, RaceDriver.race_id == Race.id
        ).group_by(Event.id, Event.event_drivers).all()
        
        mismatched_drivers = [
            (event_id, expected, actual)
            for event_id, expected, actual in driver_counts
            if expected != actual
        ]
        
        if mismatched_drivers:
            issues_found = True
            click.echo(f"\nFound {len(mismatched_drivers)} events with mismatched driver counts:")
            for event_id, expected, actual in mismatched_drivers[:10]:
                click.echo(
                    f"  Event {event_id}: expected {expected} drivers, found {actual}"
                )
            if len(mismatched_drivers) > 10:
                click.echo(f"  ... and {len(mismatched_drivers) - 10} more")
        
        # 5. Check for events with partial ingestion
        # Events marked as laps_full but missing races
        partial_ingestion = session.query(Event).outerjoin(
            Race, Race.event_id == Event.id
        ).filter(
            and_(
                Event.ingest_depth == IngestDepth.LAPS_FULL,
                Race.id.is_(None)
            )
        ).all()
        
        if partial_ingestion:
            issues_found = True
            click.echo(f"\nFound {len(partial_ingestion)} events marked as fully ingested but missing races:")
            for event in partial_ingestion[:10]:
                click.echo(f"  Event {event.id} ({event.source_event_id})")
            if len(partial_ingestion) > 10:
                click.echo(f"  ... and {len(partial_ingestion) - 10} more")
    
    if issues_found:
        logger.warning("verify_integrity_issues_found", command="verify-integrity")
        click.echo("\nIntegrity check completed with issues found.")
        sys.exit(1)
    else:
        logger.info("verify_integrity_clean", command="verify-integrity")
        click.echo("\nIntegrity check completed - no issues found.")
        sys.exit(0)


if __name__ == "__main__":
    cli()
SITE_POLICY = SitePolicy.shared()
