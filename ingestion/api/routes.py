# @fileoverview FastAPI routes for ingestion operations
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description API route handlers for ingestion endpoints
# 
# @purpose Exposes ingestion operations via REST API

import asyncio
import os
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.connector import LiveRCConnector
from ingestion.db.repository import Repository
from ingestion.db.session import SessionLocal, get_db
from ingestion.ingestion.errors import (
    IngestionError,
    IngestionInProgressError,
    ConnectorHTTPError,
    EventPageFormatError,
)
from ingestion.common.site_policy import RobotsDisallowedError
from ingestion.ingestion.pipeline import IngestionPipeline
from ingestion.services.track_sync_service import TrackSyncService
from ingestion.services.practice_day_discovery import (
    discover_practice_days,
    search_practice_days,
)
from ingestion.api.jobs import TRACK_SYNC_JOBS
from ingestion.api.job_queue import (
    enqueue_by_event_id,
    enqueue_by_source_id,
    get_job,
    is_queue_enabled,
    queue_position_for_job,
)

logger = get_logger(__name__)

router = APIRouter()


class IngestRequest(BaseModel):
    """Request body for ingestion endpoint."""
    depth: str = "laps_full"
    
    def __init__(self, **data):
        super().__init__(**data)
        # Validate depth - reject summary_only (V1 only supports none and laps_full)
        if self.depth == "summary_only":
            raise ValueError("depth='summary_only' is not supported in V1. Use 'laps_full' for full ingestion or 'none' for discovery only.")


class DiscoverEventsRequest(BaseModel):
    """Request body for discovery endpoint."""
    track_slug: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class IngestBySourceIdRequest(BaseModel):
    """Request body for ingestion by source ID endpoint."""
    source_event_id: str
    track_id: str
    depth: str = "laps_full"
    
    def __init__(self, **data):
        super().__init__(**data)
        # Validate depth - reject summary_only (V1 only supports none and laps_full)
        if self.depth == "summary_only":
            raise ValueError("depth='summary_only' is not supported in V1. Use 'laps_full' for full ingestion or 'none' for discovery only.")


class EntryListRequest(BaseModel):
    """Request body for entry list endpoint."""
    source_event_id: str
    track_slug: str


class DiscoverPracticeDaysRequest(BaseModel):
    """Request body for practice day discovery endpoint."""
    track_slug: str
    year: int
    month: int
    
    @field_validator('month')
    @classmethod
    def validate_month(cls, v: int) -> int:
        if v < 1 or v > 12:
            raise ValueError('Month must be between 1 and 12')
        return v


class SearchPracticeDaysRequest(BaseModel):
    """Request body for practice day search endpoint."""
    track_id: str
    start_date: Optional[str] = None  # YYYY-MM-DD format
    end_date: Optional[str] = None  # YYYY-MM-DD format


class IngestPracticeDayRequest(BaseModel):
    """Request body for practice day ingestion endpoint."""
    track_id: str
    date: str  # YYYY-MM-DD format


@router.post("/tracks/sync")
async def sync_tracks(include_metadata: bool = True) -> Dict[str, Any]:
    """Kick off asynchronous track sync job."""
    job = TRACK_SYNC_JOBS.create()
    logger.info(
        "sync_tracks_job_created",
        job_id=job.id,
        include_metadata=include_metadata,
    )
    asyncio.create_task(_run_track_sync_job(job.id, include_metadata))
    return {"jobId": job.id}


@router.get("/tracks/sync/{job_id}")
async def get_track_sync_job(job_id: str) -> Dict[str, Any]:
    job = TRACK_SYNC_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail={"error": "JOB_NOT_FOUND"})
    return job.to_dict()


async def _run_track_sync_job(job_id: str, include_metadata: bool) -> None:
    TRACK_SYNC_JOBS.set_running(job_id)
    session = SessionLocal()
    try:
        repository = Repository(session)
        connector = LiveRCConnector()
        metadata_concurrency = int(os.getenv("TRACK_SYNC_METADATA_CONCURRENCY", "6"))
        service = TrackSyncService(
            db=session,
            repository=repository,
            connector=connector,
            metadata_concurrency=metadata_concurrency,
        )

        def progress(stage: str, processed: int, total: int) -> None:
            TRACK_SYNC_JOBS.update_progress(job_id, stage, processed, total)

        result = await service.run(
            include_metadata=include_metadata,
            progress_cb=progress,
            generate_report=True,
        )
        TRACK_SYNC_JOBS.complete(job_id, result)
    except Exception as exc:  # pragma: no cover - background execution
        session.rollback()
        TRACK_SYNC_JOBS.fail(job_id, str(exc))
        logger.error("track_sync_job_failed", job_id=job_id, error=str(exc), exc_info=True)
    finally:
        session.close()


@router.post("/events/sync")
async def sync_events(
    track_id: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Sync events for a track.
    
    Args:
        track_id: Track ID (UUID string)
    
    Returns:
        Sync summary with counts of events added and updated
    """
    logger.info("sync_events_start", track_id=track_id)
    
    try:
        # Validate track_id and get track
        from ingestion.db.models import Track
        try:
            track_uuid = UUID(track_id)
            # Convert to string since tracks.id is TEXT in database
            track_id_str = str(track_uuid)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "source": "api",
                        "message": f"Invalid track_id format: {track_id}",
                        "details": {},
                    }
                },
            )
        
        track = db.query(Track).filter(Track.id == track_id_str).first()
        if not track:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": {
                        "code": "NOT_FOUND",
                        "source": "api",
                        "message": f"Track not found: {track_id}",
                        "details": {},
                    }
                },
            )
        
        connector = LiveRCConnector()
        repository = Repository(db)
        
        # Fetch events from LiveRC
        events = await connector.list_events_for_track(track.source_track_slug)
        
        # Track sync statistics
        events_added = 0
        events_updated = 0
        
        # Upsert each event
        for event_summary in events:
            # Check if event exists to determine if it's new
            from ingestion.db.models import Event
            existing = db.query(Event).filter(
                Event.source == event_summary.source,
                Event.source_event_id == event_summary.source_event_id
            ).first()
            
            # Convert event_date from datetime to datetime if needed
            event_date = event_summary.event_date
            if isinstance(event_date, datetime):
                pass  # Already datetime
            else:
                # Assume it's a date, convert to datetime
                from datetime import date
                if isinstance(event_date, date):
                    event_date = datetime.combine(event_date, datetime.min.time())
            
            # Upsert event (repository preserves ingest_depth for existing events)
            # New events will get ingest_depth = "none" automatically
            repository.upsert_event(
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
        
        db.commit()
        
        logger.info(
            "sync_events_success",
            track_id=track_id,
            events_added=events_added,
            events_updated=events_updated,
        )
        
        return {
            "track_id": track_id,
            "events_added": events_added,
            "events_updated": events_updated,
            "total_events": len(events),
        }
    
    except HTTPException:
        raise
    
    except ConnectorHTTPError as e:
        logger.error("sync_events_http_error", error=str(e))
        db.rollback()
        raise HTTPException(
            status_code=502,
            detail={
                "error": {
                    "code": "CONNECTOR_HTTP_ERROR",
                    "source": "connector",
                    "message": str(e),
                    "details": {},
                }
            },
        )
    
    except EventPageFormatError as e:
        logger.error("sync_events_parse_error", error=str(e))
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "PAGE_FORMAT_ERROR",
                    "source": "connector",
                    "message": str(e),
                    "details": {},
                }
            },
        )
    
    except Exception as e:
        logger.error("sync_events_error", error=str(e), exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "source": "api",
                    "message": "Internal server error",
                    "details": {},
                }
            },
        )


@router.post("/events/discover")
async def discover_events(
    request: DiscoverEventsRequest,
) -> Dict[str, Any]:
    """
    Discover events from LiveRC for a track (no database access).
    
    This endpoint is a pure connector - it fetches events from LiveRC
    and filters by date range if provided, but does not access the database.
    
    Args:
        request: Discovery request with track_slug and optional date bounds
    
    Returns:
        Standard envelope: { "success": true, "data": { "events": [...] } }
        or { "success": false, "error": { ... } }
    """
    logger.info("discover_events_start", track_slug=request.track_slug)
    
    try:
        connector = LiveRCConnector()
        
        # Fetch all events for the track from LiveRC
        events = await connector.list_events_for_track(request.track_slug)
        
        # Filter by date range if provided
        filtered_events = events
        if request.start_date or request.end_date:
            filtered_events = []
            for event in events:
                event_date = event.event_date
                # Convert datetime to date for comparison if needed
                if isinstance(event_date, datetime):
                    event_date_only = event_date.date()
                elif isinstance(event_date, date):
                    event_date_only = event_date
                else:
                    # Skip events without valid dates
                    continue
                
                # Parse date strings if provided
                start_date_obj = None
                end_date_obj = None
                
                if request.start_date:
                    try:
                        start_date_obj = datetime.fromisoformat(request.start_date.replace('Z', '+00:00')).date()
                    except (ValueError, AttributeError):
                        # Try simpler format
                        try:
                            start_date_obj = datetime.strptime(request.start_date, "%Y-%m-%d").date()
                        except ValueError:
                            logger.warning("discover_events_invalid_start_date", start_date=request.start_date)
                
                if request.end_date:
                    try:
                        end_date_obj = datetime.fromisoformat(request.end_date.replace('Z', '+00:00')).date()
                    except (ValueError, AttributeError):
                        # Try simpler format
                        try:
                            end_date_obj = datetime.strptime(request.end_date, "%Y-%m-%d").date()
                        except ValueError:
                            logger.warning("discover_events_invalid_end_date", end_date=request.end_date)
                
                # Apply filters
                include = True
                if start_date_obj and event_date_only < start_date_obj:
                    include = False
                if end_date_obj and event_date_only > end_date_obj:
                    include = False
                
                if include:
                    filtered_events.append(event)
        
        # Convert EventSummary objects to dicts for JSON serialization
        events_data = []
        for event in filtered_events:
            event_date = event.event_date
            # Normalize event_date to ISO string
            if isinstance(event_date, datetime):
                event_date_str = event_date.isoformat()
            elif isinstance(event_date, date):
                event_date_str = datetime.combine(event_date, datetime.min.time()).isoformat()
            else:
                event_date_str = str(event_date)
            
            events_data.append({
                "source": event.source,
                "source_event_id": event.source_event_id,
                "track_slug": event.track_slug,
                "event_name": event.event_name,
                "event_date": event_date_str,
                "event_entries": event.event_entries,
                "event_drivers": event.event_drivers,
                "event_url": event.event_url,
            })
        
        logger.info("discover_events_success", track_slug=request.track_slug, event_count=len(events_data))
        
        return {
            "success": True,
            "data": {
                "events": events_data,
            },
        }
    
    except ConnectorHTTPError as e:
        logger.error("discover_events_http_error", error=str(e), track_slug=request.track_slug)
        return {
            "success": False,
            "error": {
                "code": "CONNECTOR_HTTP_ERROR",
                "message": str(e),
                "details": None,
                "source": "liverc_discovery",
            },
        }
    
    except EventPageFormatError as e:
        logger.error("discover_events_parse_error", error=str(e), track_slug=request.track_slug)
        return {
            "success": False,
            "error": {
                "code": "PAGE_FORMAT_ERROR",
                "message": str(e),
                "details": None,
                "source": "liverc_discovery",
            },
        }
    
    except RobotsDisallowedError as e:
        logger.error("discover_events_robots_disallowed", error=str(e), track_slug=request.track_slug)
        return {
            "success": False,
            "error": {
                "code": "ROBOTS_DISALLOWED",
                "message": str(e),
                "details": None,
                "source": "liverc_discovery",
            },
        }
    
    except Exception as e:
        logger.error("discover_events_error", error=str(e), track_slug=request.track_slug, exc_info=True)
        return {
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Internal server error during discovery",
                "details": None,
                "source": "liverc_discovery",
            },
        }


@router.get("/ingestion/jobs/{job_id}")
async def get_ingestion_job(job_id: str) -> Dict[str, Any]:
    """
    Get status of a queued ingestion job.
    Returns 404 if job_id is unknown (e.g. wrong worker or job expired).
    When status is queued, includes queue_position (1-based).
    """
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    position = queue_position_for_job(job)
    return {"success": True, "data": job.to_response(queue_position=position)}


@router.post("/events/{event_id}/ingest")
async def ingest_event(
    event_id: str,
    request: IngestRequest,
) -> Dict[str, Any]:
    """
    Trigger event ingestion.
    When queue is enabled (INGESTION_USE_QUEUE=true), returns 202 with job_id
    and processes in background. Otherwise runs synchronously.
    """
    try:
        logger.info("ingest_event_api_start", event_id=event_id, depth=request.depth)

        if is_queue_enabled():
            job_id = enqueue_by_event_id(event_id=event_id, depth=request.depth)
            return JSONResponse(
                status_code=202,
                content={
                    "success": True,
                    "queued": True,
                    "job_id": job_id,
                    "data": {"job_id": job_id, "status": "queued"},
                },
            )

        pipeline = IngestionPipeline()
        result = await pipeline.ingest_event(
            event_id=UUID(event_id),
            depth=request.depth,
        )

        return {
            "success": True,
            "data": result,
        }

    except IngestionInProgressError as e:
        return {
            "success": False,
            "error": {
                "code": "INGESTION_IN_PROGRESS",
                "source": "ingest_event",
                "message": str(e),
                "details": {},
            },
        }
    
    except IngestionError as e:
        error_dict = e.to_dict()
        return {
            "success": False,
            "error": {
                "code": error_dict.get("error", {}).get("code", "INGESTION_ERROR"),
                "source": "ingest_event",
                "message": error_dict.get("error", {}).get("message", str(e)),
                "details": error_dict.get("error", {}).get("details", {}),
            },
        }
    
    except ValueError as e:
        return {
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "source": "ingest_event",
                "message": str(e),
                "details": {},
            },
        }
    
    except Exception as e:
        logger.error("ingest_event_api_error", event_id=event_id, error=str(e), exc_info=True)
        return {
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "source": "ingest_event",
                "message": "Internal server error",
                "details": {},
            },
        }


@router.post("/events/ingest")
async def ingest_event_by_source_id(
    request: IngestBySourceIdRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Ingest event by source_event_id and track_id (creates Event if missing).
    
    This endpoint can ingest events that don't yet exist in the database.
    The pipeline will fetch full event metadata from LiveRC and create
    the Event row if needed.
    
    Args:
        request: Ingestion request with source_event_id, track_id, and optional depth
    
    Returns:
        Standard envelope: { "success": true, "data": { ...ingestion_result... } }
        or { "success": false, "error": { ... } }
    """
    logger.info(
        "ingest_event_by_source_id_start",
        source_event_id=request.source_event_id,
        track_id=request.track_id,
        depth=request.depth,
    )
    
    try:
        # Validate track_id format (must be valid UUID string)
        try:
            UUID(request.track_id)
            # Keep as string - tracks.id is TEXT in database, not UUID type
            track_id_str = request.track_id
        except ValueError:
            return {
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "source": "ingest_event_by_source_id",
                    "message": f"Invalid track_id format: {request.track_id}",
                    "details": {},
                },
            }
        
        # Verify track exists
        from ingestion.db.models import Track
        # Direct string comparison - tracks.id is TEXT column
        track = db.query(Track).filter(Track.id == track_id_str).first()
        if not track:
            return {
                "success": False,
                "error": {
                    "code": "NOT_FOUND",
                    "source": "ingest_event_by_source_id",
                    "message": f"Track not found: {request.track_id}",
                    "details": {},
                },
            }

        if is_queue_enabled():
            job_id = enqueue_by_source_id(
                source_event_id=request.source_event_id,
                track_id=track_id_str,
                depth=request.depth,
            )
            return JSONResponse(
                status_code=202,
                content={
                    "success": True,
                    "queued": True,
                    "job_id": job_id,
                    "data": {"job_id": job_id, "status": "queued"},
                },
            )

        pipeline = IngestionPipeline()
        track_uuid = UUID(track_id_str)
        result = await pipeline.ingest_event_by_source_id(
            source_event_id=request.source_event_id,
            track_id=track_uuid,
            depth=request.depth,
        )

        return {
            "success": True,
            "data": result,
        }

    except IngestionInProgressError as e:
        return {
            "success": False,
            "error": {
                "code": "INGESTION_IN_PROGRESS",
                "source": "ingest_event_by_source_id",
                "message": str(e),
                "details": {},
            },
        }
    
    except IngestionError as e:
        error_dict = e.to_dict()
        return {
            "success": False,
            "error": {
                "code": error_dict.get("error", {}).get("code", "INGESTION_ERROR"),
                "source": "ingest_event_by_source_id",
                "message": error_dict.get("error", {}).get("message", str(e)),
                "details": error_dict.get("error", {}).get("details", {}),
            },
        }
    
    except ValueError as e:
        return {
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "source": "ingest_event_by_source_id",
                "message": str(e),
                "details": {},
            },
        }
    
    except Exception as e:
        logger.error(
            "ingest_event_by_source_id_error",
            source_event_id=request.source_event_id,
            track_id=request.track_id,
            error=str(e),
            error_type=type(e).__name__,
            exc_info=True,
        )
        # Return a more descriptive error message if available
        error_message = "Internal server error"
        if isinstance(e, (EventPageFormatError, ConnectorHTTPError)):
            error_message = str(e)
        
        return {
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "source": "ingest_event_by_source_id",
                "message": error_message,
                "details": {"error_type": type(e).__name__},
            },
        }


@router.post("/events/entry-list")
async def get_event_entry_list(
    request: EntryListRequest,
) -> Dict[str, Any]:
    """
    Fetch entry list for an event from LiveRC.
    
    This endpoint fetches the entry list page for a given event and returns
    all driver entries grouped by racing class. Useful for filtering events
    by driver name before importing.
    
    Args:
        request: Entry list request with source_event_id and track_slug
    
    Returns:
        Standard envelope: { "success": true, "data": { ...entry_list... } }
        or { "success": false, "error": { ... } }
    """
    logger.info(
        "get_event_entry_list_start",
        source_event_id=request.source_event_id,
        track_slug=request.track_slug,
    )
    
    try:
        connector = LiveRCConnector()
        
        # Fetch entry list from LiveRC
        entry_list = await connector.fetch_entry_list(
            track_slug=request.track_slug,
            source_event_id=request.source_event_id,
        )
        
        # Convert ConnectorEntryList to dict for JSON serialization
        entries_by_class = {}
        for class_name, drivers in entry_list.entries_by_class.items():
            entries_by_class[class_name] = [
                {
                    "driver_name": driver.driver_name,
                    "car_number": driver.car_number,
                    "transponder_number": driver.transponder_number,
                    "source_driver_id": driver.source_driver_id,
                    "class_name": driver.class_name,
                }
                for driver in drivers
            ]
        
        logger.info(
            "get_event_entry_list_success",
            source_event_id=request.source_event_id,
            track_slug=request.track_slug,
            class_count=len(entries_by_class),
        )
        
        return {
            "success": True,
            "data": {
                "source_event_id": entry_list.source_event_id,
                "entries_by_class": entries_by_class,
            },
        }
    
    except ConnectorHTTPError as e:
        logger.error(
            "get_event_entry_list_http_error",
            error=str(e),
            source_event_id=request.source_event_id,
            track_slug=request.track_slug,
        )
        return {
            "success": False,
            "error": {
                "code": "CONNECTOR_HTTP_ERROR",
                "message": str(e),
                "details": None,
                "source": "liverc_entry_list",
            },
        }
    
    except EventPageFormatError as e:
        logger.error(
            "get_event_entry_list_parse_error",
            error=str(e),
            source_event_id=request.source_event_id,
            track_slug=request.track_slug,
        )
        return {
            "success": False,
            "error": {
                "code": "PAGE_FORMAT_ERROR",
                "message": str(e),
                "details": None,
                "source": "liverc_entry_list",
            },
        }
    
    except Exception as e:
        logger.error(
            "get_event_entry_list_error",
            error=str(e),
            source_event_id=request.source_event_id,
            track_slug=request.track_slug,
            exc_info=True,
        )
        return {
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Internal server error during entry list fetch",
                "details": None,
                "source": "liverc_entry_list",
            },
        }


@router.get("/ingestion/status/{event_id}")
async def get_ingestion_status(
    event_id: str,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get ingestion status for an event.
    
    Args:
        event_id: Event ID
    
    Returns:
        Ingestion status
    """
    from ingestion.db.models import Event
    
    event = db.get(Event, UUID(event_id))
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return {
        "event_id": str(event.id),
        "ingest_depth": event.ingest_depth.value,
        "last_ingested_at": event.last_ingested_at.isoformat() if event.last_ingested_at else None,
    }


@router.post("/practice-days/discover")
async def discover_practice_days_endpoint(
    request: DiscoverPracticeDaysRequest,
) -> Dict[str, Any]:
    """
    Discover practice days from LiveRC for a track and date range.
    
    Args:
        request: Discovery request with track_slug, start_date, and end_date
    
    Returns:
        Standard envelope: { "success": true, "data": { "practice_days": [...] } }
        or { "success": false, "error": { ... } }
    """
    # Validate month range
    if request.month < 1 or request.month > 12:
        return {
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Month must be between 1 and 12",
                "details": None,
                "source": "practice_day_discovery",
            },
        }
    
    # Calculate date range from year/month
    start_date_obj = date(request.year, request.month, 1)
    # Get last day of month
    if request.month == 12:
        end_date_obj = date(request.year + 1, 1, 1) - timedelta(days=1)
    else:
        end_date_obj = date(request.year, request.month + 1, 1) - timedelta(days=1)
    
    logger.info(
        "discover_practice_days_start",
        track_slug=request.track_slug,
        year=request.year,
        month=request.month,
        calculated_start_date=start_date_obj.isoformat(),
        calculated_end_date=end_date_obj.isoformat(),
    )
    
    try:
        # Discover practice days
        practice_days = await discover_practice_days(
            track_slug=request.track_slug,
            start_date=start_date_obj,
            end_date=end_date_obj,
        )
        
        # Convert to dicts for JSON serialization
        practice_days_data = []
        for pd in practice_days:
            practice_days_data.append({
                "date": pd.date.isoformat(),
                "track_slug": pd.track_slug,
                "session_count": pd.session_count,
                "total_laps": pd.total_laps,
                "total_track_time_seconds": pd.total_track_time_seconds,
                "unique_drivers": pd.unique_drivers,
                "unique_classes": pd.unique_classes,
                "time_range_start": pd.time_range_start.isoformat() if pd.time_range_start else None,
                "time_range_end": pd.time_range_end.isoformat() if pd.time_range_end else None,
                "sessions": [
                    {
                        "session_id": s.session_id,
                        "driver_name": s.driver_name,
                        "class_name": s.class_name,
                        "transponder_number": s.transponder_number,
                        "start_time": s.start_time.isoformat(),
                        "duration_seconds": s.duration_seconds,
                        "lap_count": s.lap_count,
                        "fastest_lap": s.fastest_lap,
                        "average_lap": s.average_lap,
                        "session_url": s.session_url,
                    }
                    for s in pd.sessions
                ],
            })
        
        logger.info(
            "discover_practice_days_success",
            track_slug=request.track_slug,
            practice_day_count=len(practice_days_data),
        )
        
        return {
            "success": True,
            "data": {
                "practice_days": practice_days_data,
            },
        }
    
    except ValueError as e:
        logger.error("discover_practice_days_validation_error", error=str(e))
        return {
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": str(e),
                "details": None,
                "source": "practice_day_discovery",
            },
        }
    
    except Exception as e:
        logger.error("discover_practice_days_error", error=str(e), exc_info=True)
        return {
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Internal server error during practice day discovery",
                "details": None,
                "source": "practice_day_discovery",
            },
        }


@router.get("/practice-days/search")
async def search_practice_days_endpoint(
    track_id: str = Query(..., description="Track ID (UUID string)"),
    start_date: Optional[str] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date filter (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Search for already-ingested practice days in database.
    
    Args:
        track_id: Track ID (UUID string)
        start_date: Optional start date filter (YYYY-MM-DD)
        end_date: Optional end date filter (YYYY-MM-DD)
    
    Returns:
        Standard envelope: { "success": true, "data": { "practice_days": [...] } }
        or { "success": false, "error": { ... } }
    """
    logger.info(
        "search_practice_days_start",
        track_id=track_id,
        start_date=start_date,
        end_date=end_date,
    )
    
    try:
        # Validate track_id
        try:
            track_uuid = UUID(track_id)
        except ValueError:
            return {
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": f"Invalid track_id format: {track_id}",
                    "details": None,
                    "source": "practice_day_search",
                },
            }
        
        # Parse dates if provided
        start_date_obj = None
        end_date_obj = None
        if start_date:
            try:
                start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                return {
                    "success": False,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": f"Invalid start_date format: {start_date}. Use YYYY-MM-DD format.",
                        "details": None,
                        "source": "practice_day_search",
                    },
                }
        
        if end_date:
            try:
                end_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
            except ValueError:
                return {
                    "success": False,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": f"Invalid end_date format: {end_date}. Use YYYY-MM-DD format.",
                        "details": None,
                        "source": "practice_day_search",
                    },
                }
        
        # Search practice days
        events = await search_practice_days(
            track_id=track_uuid,
            start_date=start_date_obj,
            end_date=end_date_obj,
        )
        
        # Convert to dicts for JSON serialization
        practice_days_data = []
        for event in events:
            practice_days_data.append({
                "id": str(event.id),
                "event_name": event.event_name,
                "event_date": event.event_date.isoformat() if event.event_date else None,
                "source_event_id": event.source_event_id,
                "track_id": str(event.track_id),
                "ingest_depth": event.ingest_depth.value,
            })
        
        logger.info(
            "search_practice_days_success",
            track_id=track_id,
            practice_day_count=len(practice_days_data),
        )
        
        return {
            "success": True,
            "data": {
                "practice_days": practice_days_data,
            },
        }
    
    except Exception as e:
        logger.error("search_practice_days_error", error=str(e), exc_info=True)
        return {
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Internal server error during practice day search",
                "details": None,
                "source": "practice_day_search",
            },
        }


@router.post("/practice-days/ingest")
async def ingest_practice_day_endpoint(
    request: IngestPracticeDayRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Ingest a practice day (all sessions for a date).
    
    Args:
        request: Ingestion request with track_id and date
    
    Returns:
        Standard envelope: { "success": true, "data": { ...ingestion_result... } }
        or { "success": false, "error": { ... } }
    """
    logger.info(
        "ingest_practice_day_start",
        track_id=request.track_id,
        date=request.date,
    )
    
    try:
        # Parse date
        try:
            practice_date = datetime.strptime(request.date, "%Y-%m-%d").date()
        except ValueError:
            return {
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": f"Invalid date format: {request.date}. Use YYYY-MM-DD format.",
                    "details": None,
                    "source": "practice_day_ingestion",
                },
            }
        
        # Validate track_id
        try:
            track_uuid = UUID(request.track_id)
        except ValueError:
            return {
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": f"Invalid track_id format: {request.track_id}",
                    "details": None,
                    "source": "practice_day_ingestion",
                },
            }
        
        # Ingest practice day
        pipeline = IngestionPipeline()
        result = await pipeline.ingest_practice_day(
            track_id=track_uuid,
            practice_date=practice_date,
        )
        
        return {
            "success": True,
            "data": result,
        }
    
    except IngestionInProgressError as e:
        return {
            "success": False,
            "error": {
                "code": "INGESTION_IN_PROGRESS",
                "source": "practice_day_ingestion",
                "message": str(e),
                "details": {},
            },
        }
    
    except IngestionError as e:
        error_dict = e.to_dict()
        return {
            "success": False,
            "error": {
                "code": error_dict.get("error", {}).get("code", "INGESTION_ERROR"),
                "source": "practice_day_ingestion",
                "message": error_dict.get("error", {}).get("message", str(e)),
                "details": error_dict.get("error", {}).get("details", {}),
            },
        }
    
    except ValueError as e:
        return {
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "source": "practice_day_ingestion",
                "message": str(e),
                "details": {},
            },
        }
    
    except ConnectorHTTPError as e:
        logger.error("ingest_practice_day_http_error", error=str(e))
        return {
            "success": False,
            "error": {
                "code": "CONNECTOR_HTTP_ERROR",
                "source": "practice_day_ingestion",
                "message": str(e),
                "details": {},
            },
        }
    
    except EventPageFormatError as e:
        logger.error("ingest_practice_day_parse_error", error=str(e))
        return {
            "success": False,
            "error": {
                "code": "PAGE_FORMAT_ERROR",
                "source": "practice_day_ingestion",
                "message": str(e),
                "details": {},
            },
        }
    
    except Exception as e:
        logger.error("ingest_practice_day_error", error=str(e), exc_info=True)
        # Return a more descriptive error message if available
        error_message = "Internal server error during practice day ingestion"
        if isinstance(e, (EventPageFormatError, ConnectorHTTPError)):
            error_message = str(e)
        else:
            # Include the actual error message for debugging
            error_message = f"Internal server error: {str(e)}"
        
        return {
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "source": "practice_day_ingestion",
                "message": error_message,
                "details": {"error_type": type(e).__name__},
            },
        }
