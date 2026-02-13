"""Shared track sync orchestration service."""

from __future__ import annotations

import asyncio
import random
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple
from urllib.parse import urlparse
from uuid import uuid4

from sqlalchemy import func, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.connector import LiveRCConnector
from ingestion.connectors.liverc.parsers.track_list_parser import TrackSummary
from ingestion.connectors.liverc.parsers.track_dashboard_parser import TrackDashboardData
from ingestion.db.models import Track
from ingestion.db.repository import Repository
from ingestion.ingestion.errors import ConnectorHTTPError
from ingestion.reports.track_sync_report import (
    cleanup_old_reports,
    generate_track_sync_report,
)

logger = get_logger(__name__)

ProgressCallback = Optional[Callable[[str, int, int], None]]

# Default batch size for bulk database operations
BULK_UPSERT_BATCH_SIZE = 50  # Reduced to avoid SQL statement size limits

# Retry configuration for metadata fetching
METADATA_RETRY_MAX_ATTEMPTS = 3
METADATA_RETRY_BASE_DELAY = 1.0  # seconds
METADATA_RETRY_MAX_DELAY = 10.0  # seconds


def _validate_email(email: Optional[str]) -> Optional[str]:
    """Validate email format. Returns None if invalid."""
    if not email:
        return None
    # Simple email validation regex
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    if re.match(pattern, email):
        return email
    return None


def _validate_url(url: Optional[str]) -> Optional[str]:
    """Validate URL format. Returns None if invalid."""
    if not url:
        return None
    try:
        result = urlparse(url)
        if result.scheme in ("http", "https") and result.netloc:
            return url
    except Exception:
        pass
    return None


def _validate_coordinates(latitude: Optional[float], longitude: Optional[float]) -> Tuple[Optional[float], Optional[float]]:
    """Validate coordinate ranges. Returns (None, None) if invalid."""
    if latitude is None or longitude is None:
        return None, None
    # Validate ranges: latitude [-90, 90], longitude [-180, 180]
    if -90 <= latitude <= 90 and -180 <= longitude <= 180:
        return latitude, longitude
    return None, None


def _validate_metadata(metadata: TrackDashboardData) -> TrackDashboardData:
    """Validate and sanitize track metadata."""
    # Validate coordinates
    latitude, longitude = _validate_coordinates(metadata.latitude, metadata.longitude)
    
    # Validate URLs
    website = _validate_url(metadata.website)
    logo_url = _validate_url(metadata.logo_url)
    facebook_url = _validate_url(metadata.facebook_url)
    
    # Validate email
    email = _validate_email(metadata.email)
    
    # Create validated copy
    validated = TrackDashboardData(
        latitude=latitude,
        longitude=longitude,
        address=metadata.address,
        city=metadata.city,
        state=metadata.state,
        country=metadata.country,
        postal_code=metadata.postal_code,
        phone=metadata.phone,
        website=website,
        email=email,
        description=metadata.description,
        logo_url=logo_url,
        facebook_url=facebook_url,
        total_laps=metadata.total_laps if metadata.total_laps is not None and metadata.total_laps >= 0 else None,
        total_races=metadata.total_races if metadata.total_races is not None and metadata.total_races >= 0 else None,
        total_events=metadata.total_events if metadata.total_events is not None and metadata.total_events >= 0 else None,
    )
    return validated


@dataclass
class StageMetrics:
    """Performance metrics for a sync stage."""

    stage: str
    duration_seconds: float
    items_processed: int
    items_total: int


@dataclass
class TrackSyncResult:
    """Summary of a track sync run."""

    tracks_added: int
    tracks_updated: int
    tracks_deactivated: int
    total_tracks: int
    metadata_failures: int
    metadata_enabled: bool
    report_path: Optional[str] = None
    duration_seconds: float = 0.0
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    stage_metrics: List[StageMetrics] = field(default_factory=list)


class TrackSyncService:
    """Coordinates LiveRC track sync across entrypoints."""

    def __init__(
        self,
        db: Session,
        repository: Repository,
        connector: LiveRCConnector,
        metadata_concurrency: int = 4,
    ) -> None:
        self._db = db
        self._repository = repository
        self._connector = connector
        self._metadata_concurrency = max(1, metadata_concurrency)

    async def run(
        self,
        include_metadata: bool = True,
        progress_cb: ProgressCallback = None,
        generate_report: bool = True,
    ) -> TrackSyncResult:
        start_time = datetime.now(timezone.utc)
        stage_metrics: List[StageMetrics] = []
        logger.info("track_sync_start", include_metadata=include_metadata)

        # Stage 1: Fetch track list
        stage_start = datetime.now(timezone.utc)
        tracks = await self._connector.list_tracks()
        total_tracks = len(tracks)
        list_fetch_duration = (datetime.now(timezone.utc) - stage_start).total_seconds()
        stage_metrics.append(StageMetrics("list_fetch", list_fetch_duration, total_tracks, total_tracks))
        logger.info("track_sync_list_fetched", duration_seconds=list_fetch_duration, total_tracks=total_tracks)

        # Stage 2: Fetch metadata (optional)
        metadata_map: Dict[str, TrackDashboardData] = {}
        metadata_failures: List[str] = []
        if include_metadata and total_tracks:
            stage_start = datetime.now(timezone.utc)
            metadata_map, metadata_failures = await self._fetch_metadata(tracks, progress_cb)
            metadata_duration = (datetime.now(timezone.utc) - stage_start).total_seconds()
            stage_metrics.append(StageMetrics("metadata_fetch", metadata_duration, len(metadata_map), total_tracks))
            logger.info(
                "track_sync_metadata_fetched",
                duration_seconds=metadata_duration,
                succeeded=len(metadata_map),
                failed=len(metadata_failures),
                total=total_tracks,
            )

        # Stage 3: Bulk upsert tracks
        stage_start = datetime.now(timezone.utc)
        summary = self._upsert_tracks_bulk(
            tracks,
            metadata_map,
            progress_cb,
        )
        upsert_duration = (datetime.now(timezone.utc) - stage_start).total_seconds()
        stage_metrics.append(
            StageMetrics(
                "upsert",
                upsert_duration,
                summary["tracks_added"] + summary["tracks_updated"],
                total_tracks,
            )
        )
        logger.info(
            "track_sync_upsert_complete",
            duration_seconds=upsert_duration,
            added=summary["tracks_added"],
            updated=summary["tracks_updated"],
            deactivated=summary["tracks_deactivated"],
        )

        duration_seconds = (datetime.now(timezone.utc) - start_time).total_seconds()

        report_path = None
        if generate_report:
            report_path = generate_track_sync_report(
                start_time,
                duration_seconds,
                total_tracks,
                summary["tracks_added"],
                summary["tracks_updated"],
                summary["tracks_deactivated"],
                summary["new_tracks"],
                summary["updated_tracks"],
                summary["deactivated_tracks"],
            )
            cleanup_old_reports()

        result = TrackSyncResult(
            tracks_added=summary["tracks_added"],
            tracks_updated=summary["tracks_updated"],
            tracks_deactivated=summary["tracks_deactivated"],
            total_tracks=total_tracks,
            metadata_failures=len(metadata_failures),
            metadata_enabled=include_metadata,
            report_path=report_path,
            duration_seconds=duration_seconds,
            started_at=start_time,
            stage_metrics=stage_metrics,
        )

        logger.info(
            "track_sync_complete",
            tracks_added=result.tracks_added,
            tracks_updated=result.tracks_updated,
            tracks_deactivated=result.tracks_deactivated,
            metadata_failures=result.metadata_failures,
            duration_seconds=duration_seconds,
            report_path=report_path,
            stage_metrics={m.stage: m.duration_seconds for m in stage_metrics},
        )
        return result

    async def _fetch_metadata(
        self,
        tracks: Sequence[TrackSummary],
        progress_cb: ProgressCallback,
    ) -> Tuple[Dict[str, TrackDashboardData], List[str]]:
        metadata: Dict[str, TrackDashboardData] = {}
        failures: List[str] = []
        total = len(tracks)
        completed = 0

        async def _fetch_with_retry(slug: str) -> Optional[TrackDashboardData]:
            """Fetch metadata with exponential backoff retry logic."""
            for attempt in range(1, METADATA_RETRY_MAX_ATTEMPTS + 1):
                try:
                    data = await self._connector.fetch_track_metadata(slug)
                    if data:
                        # Validate metadata before returning
                        validated = _validate_metadata(data)
                        return validated
                    return None
                except (ConnectorHTTPError, asyncio.TimeoutError, ConnectionError) as exc:
                    # Check if this is a retryable error and we have attempts left
                    is_retryable = isinstance(exc, ConnectorHTTPError) or isinstance(
                        exc, (asyncio.TimeoutError, ConnectionError)
                    )
                    
                    if is_retryable and attempt < METADATA_RETRY_MAX_ATTEMPTS:
                        # Calculate exponential backoff with jitter
                        delay = min(
                            METADATA_RETRY_BASE_DELAY * (2 ** (attempt - 1)),
                            METADATA_RETRY_MAX_DELAY,
                        )
                        # Add small random jitter (0-0.5 seconds)
                        jitter = random.uniform(0, 0.5)
                        delay += jitter
                        
                        logger.warning(
                            "track_metadata_fetch_retry",
                            slug=slug,
                            attempt=attempt,
                            max_attempts=METADATA_RETRY_MAX_ATTEMPTS,
                            delay_seconds=delay,
                            error=str(exc),
                        )
                        await asyncio.sleep(delay)
                        continue
                    else:
                        # Non-retryable or max attempts exceeded - re-raise
                        raise
                except Exception as exc:
                    # Non-retryable errors - re-raise immediately
                    raise
            
            # Should not reach here, but return None if all retries exhausted
            return None

        queue: asyncio.Queue[TrackSummary] = asyncio.Queue()
        for summary in tracks:
            queue.put_nowait(summary)

        async def worker() -> None:
            nonlocal completed
            while True:
                try:
                    summary = queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
                try:
                    data = await _fetch_with_retry(summary.source_track_slug)
                    if data:
                        metadata[summary.source_track_slug] = data
                except Exception as exc:  # pragma: no cover - guarded by connector
                    failures.append(summary.source_track_slug)
                    logger.warning(
                        "track_metadata_fetch_error",
                        slug=summary.source_track_slug,
                        error=str(exc),
                    )
                finally:
                    completed += 1
                    if progress_cb:
                        progress_cb("metadata", completed, total)
                    queue.task_done()

        worker_tasks = [
            asyncio.create_task(worker())
            for _ in range(max(1, self._metadata_concurrency))
        ]

        await asyncio.gather(*worker_tasks)
        return metadata, failures

    def _upsert_tracks_bulk(
        self,
        tracks: Sequence[TrackSummary],
        metadata_map: Dict[str, TrackDashboardData],
        progress_cb: ProgressCallback,
    ) -> Dict[str, Any]:
        """Bulk upsert tracks using PostgreSQL INSERT ... ON CONFLICT DO UPDATE."""
        now = datetime.now(timezone.utc)
        existing_tracks = self._load_existing_tracks()
        seen_slugs: set[str] = set()

        # Prepare batch data for bulk insert
        batch_values: List[Dict[str, Any]] = []
        new_tracks: List[Dict[str, str]] = []
        updated_tracks: List[Dict[str, str]] = []
        deactivated_tracks: List[Dict[str, str]] = []

        total = len(tracks)
        processed = 0

        # Process tracks in batches
        for summary in tracks:
            seen_slugs.add(summary.source_track_slug)
            metadata = metadata_map.get(summary.source_track_slug)
            existing = existing_tracks.get(summary.source_track_slug)

            # Build track data dictionary
            # For new tracks, generate a new UUID. For existing tracks, use the existing ID.
            track_id = existing.id if existing else str(uuid4())
            track_data = {
                "id": track_id,
                "source": summary.source,
                "source_track_slug": summary.source_track_slug,
                "track_name": summary.track_name,
                "track_url": summary.track_url,
                "events_url": summary.events_url,
                "liverc_track_last_updated": summary.liverc_track_last_updated,
                "last_seen_at": now,
                "is_active": True,
                "is_followed": existing.is_followed if existing else False,
                "created_at": existing.created_at if existing else now,
                "updated_at": now,
            }

            # Add metadata fields if available
            if metadata:
                track_data.update({
                    "latitude": metadata.latitude,
                    "longitude": metadata.longitude,
                    "address": metadata.address,
                    "city": metadata.city,
                    "state": metadata.state,
                    "country": metadata.country,
                    "postal_code": metadata.postal_code,
                    "phone": metadata.phone,
                    "website": metadata.website,
                    "email": metadata.email,
                    "description": metadata.description,
                    "logo_url": metadata.logo_url,
                    "facebook_url": metadata.facebook_url,
                    "total_laps": metadata.total_laps,
                    "total_races": metadata.total_races,
                    "total_events": metadata.total_events,
                })

            # Track changes for existing records
            if existing:
                changed_fields: List[str] = []
                if existing.track_name != summary.track_name:
                    changed_fields.append("track_name")
                if existing.track_url != summary.track_url:
                    changed_fields.append("track_url")
                if existing.events_url != summary.events_url:
                    changed_fields.append("events_url")
                if existing.liverc_track_last_updated != summary.liverc_track_last_updated:
                    changed_fields.append("liverc_track_last_updated")
                if not existing.is_active:
                    changed_fields.append("is_active")

                # Check metadata changes
                if metadata:
                    for field in [
                        "latitude", "longitude", "address", "city", "state", "country",
                        "postal_code", "phone", "website", "email", "description",
                        "logo_url", "facebook_url", "total_laps", "total_races", "total_events",
                    ]:
                        existing_val = getattr(existing, field)
                        new_val = getattr(metadata, field)
                        if existing_val != new_val:
                            changed_fields.append(field)

                if changed_fields:
                    updated_tracks.append(
                        {
                            "name": summary.track_name,
                            "slug": summary.source_track_slug,
                            "url": summary.track_url,
                            "changes": ", ".join(sorted(set(changed_fields))),
                        }
                    )
            else:
                new_tracks.append(
                    {
                        "name": summary.track_name,
                        "slug": summary.source_track_slug,
                        "url": summary.track_url,
                    }
                )

            batch_values.append(track_data)

            # Process batch when it reaches size limit
            if len(batch_values) >= BULK_UPSERT_BATCH_SIZE:
                self._execute_bulk_upsert(batch_values, now)
                processed += len(batch_values)
                if progress_cb:
                    progress_cb("upsert", processed, total)
                batch_values = []

        # Process remaining batch
        if batch_values:
            self._execute_bulk_upsert(batch_values, now)
            processed += len(batch_values)
            if progress_cb:
                progress_cb("upsert", processed, total)

        # Deactivate tracks not seen in this sync
        tracks_deactivated = 0
        deactivation_values: List[Dict[str, Any]] = []
        for slug, track in existing_tracks.items():
            if track.source != "liverc":
                continue
            if slug not in seen_slugs and track.is_active:
                deactivation_values.append({
                    "source": track.source,
                    "source_track_slug": slug,
                    "is_active": False,
                    "last_seen_at": now,
                })
                deactivated_tracks.append(
                    {
                        "name": track.track_name,
                        "slug": slug,
                        "url": track.track_url,
                    }
                )
                tracks_deactivated += 1

        # Bulk update for deactivation
        if deactivation_values:
            self._execute_bulk_update(deactivation_values, now)

        self._db.commit()

        return {
            "tracks_added": len(new_tracks),
            "tracks_updated": len(updated_tracks),
            "tracks_deactivated": tracks_deactivated,
            "new_tracks": new_tracks,
            "updated_tracks": updated_tracks,
            "deactivated_tracks": deactivated_tracks,
        }

    def _execute_bulk_upsert(self, batch_values: List[Dict[str, Any]], now: datetime) -> None:
        """Execute bulk upsert using PostgreSQL INSERT ... ON CONFLICT DO UPDATE."""
        if not batch_values:
            return

        # Build the INSERT ... ON CONFLICT DO UPDATE statement
        stmt = pg_insert(Track.__table__).values(batch_values)
        
        # On conflict, update all fields except source and source_track_slug (the unique key)
        # For summary fields, always update. For metadata fields, update when provided.
        update_dict = {
            "track_name": stmt.excluded.track_name,
            "track_url": stmt.excluded.track_url,
            "events_url": stmt.excluded.events_url,
            "liverc_track_last_updated": stmt.excluded.liverc_track_last_updated,
            "last_seen_at": stmt.excluded.last_seen_at,
            "is_active": stmt.excluded.is_active,
            "updated_at": now,
        }
        
        # Add metadata fields - include all metadata fields in update
        # PostgreSQL will use the excluded value (from INSERT) which may be None
        # Note: This means None values will overwrite existing metadata (acceptable for sync)
        metadata_fields = [
            "latitude", "longitude", "address", "city", "state", "country",
            "postal_code", "phone", "website", "email", "description",
            "logo_url", "facebook_url", "total_laps", "total_races", "total_events",
        ]
        
        # Only include metadata fields if they appear in any row of the batch
        # Check if at least one row has the field (even if None, we want to update it)
        for field in metadata_fields:
            if any(field in row for row in batch_values):
                update_dict[field] = stmt.excluded[field]

        stmt = stmt.on_conflict_do_update(
            index_elements=["source", "source_track_slug"],
            set_=update_dict,
        )

        self._db.execute(stmt)

    def _execute_bulk_update(self, update_values: List[Dict[str, Any]], now: datetime) -> None:
        """Execute bulk update for track deactivation."""
        if not update_values:
            return

        # Use individual updates (simpler for small batch of deactivations)
        # In the future, could use PostgreSQL UPDATE FROM for true bulk updates
        for update_data in update_values:
            stmt = (
                update(Track.__table__)
                .where(
                    Track.source == update_data["source"],
                    Track.source_track_slug == update_data["source_track_slug"],
                )
                .values(
                    is_active=update_data["is_active"],
                    last_seen_at=update_data["last_seen_at"],
                    updated_at=now,
                )
            )
            self._db.execute(stmt)

    def _load_existing_tracks(self) -> Dict[str, Track]:
        stmt = self._db.query(Track).filter(Track.source == "liverc")
        return {track.source_track_slug: track for track in stmt.all()}

    def _apply_track_summary(
        self,
        track: Track,
        summary: TrackSummary,
        timestamp: datetime,
    ) -> List[str]:
        changed: List[str] = []
        if track.track_name != summary.track_name:
            track.track_name = summary.track_name
            changed.append("track_name")
        if track.track_url != summary.track_url:
            track.track_url = summary.track_url
            changed.append("track_url")
        if track.events_url != summary.events_url:
            track.events_url = summary.events_url
            changed.append("events_url")
        if track.liverc_track_last_updated != summary.liverc_track_last_updated:
            track.liverc_track_last_updated = summary.liverc_track_last_updated
            changed.append("liverc_track_last_updated")
        if not track.is_active:
            track.is_active = True
            changed.append("is_active")
        track.last_seen_at = timestamp
        return changed

    def _apply_metadata(
        self,
        track: Track,
        metadata: TrackDashboardData,
    ) -> List[str]:
        changed: List[str] = []

        def _update(field: str, value: Optional[object]) -> None:
            if value is None:
                return
            current = getattr(track, field)
            if current == value:
                return
            setattr(track, field, value)
            changed.append(field)

        _update("latitude", metadata.latitude)
        _update("longitude", metadata.longitude)
        _update("address", metadata.address)
        _update("city", metadata.city)
        _update("state", metadata.state)
        _update("country", metadata.country)
        _update("postal_code", metadata.postal_code)
        _update("phone", metadata.phone)
        _update("website", metadata.website)
        _update("email", metadata.email)
        _update("description", metadata.description)
        _update("logo_url", metadata.logo_url)
        _update("facebook_url", metadata.facebook_url)
        _update("total_laps", metadata.total_laps)
        _update("total_races", metadata.total_races)
        _update("total_events", metadata.total_events)
        return changed
