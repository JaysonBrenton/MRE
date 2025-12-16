# @fileoverview FastAPI routes for ingestion operations
# 
# @created 2025-01-27
# @creator Jayson Brenton
# @lastModified 2025-01-27
# 
# @description API route handlers for ingestion endpoints
# 
# @purpose Exposes ingestion operations via REST API

from datetime import datetime, date
from typing import Dict, Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ingestion.common.logging import get_logger
from ingestion.connectors.liverc.connector import LiveRCConnector
from ingestion.db.repository import Repository
from ingestion.db.session import get_db
from ingestion.ingestion.errors import (
    IngestionError,
    IngestionInProgressError,
    ConnectorHTTPError,
    EventPageFormatError,
)
from ingestion.ingestion.pipeline import IngestionPipeline

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


@router.post("/tracks/sync")
async def sync_tracks(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Sync track catalogue from LiveRC.
    
    Returns:
        Sync summary with counts of tracks added, updated, and deactivated
    """
    logger.info("sync_tracks_start")
    
    try:
        connector = LiveRCConnector()
        repository = Repository(db)
        
        # Fetch tracks from LiveRC
        tracks = await connector.list_tracks()
        
        # Track sync statistics
        tracks_added = 0
        tracks_updated = 0
        seen_slugs = set()
        
        # Upsert each track
        for track_summary in tracks:
            seen_slugs.add(track_summary.source_track_slug)
            
            # Upsert track (repository handles insert vs update)
            from ingestion.db.models import Track
            existing = db.query(Track).filter(
                Track.source == track_summary.source,
                Track.source_track_slug == track_summary.source_track_slug
            ).first()
            
            if existing:
                tracks_updated += 1
            else:
                tracks_added += 1
            
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
        from ingestion.db.models import Track
        all_tracks = db.query(Track).filter(Track.source == "liverc").all()
        tracks_deactivated = 0
        
        for track in all_tracks:
            if track.source_track_slug not in seen_slugs:
                track.is_active = False
                tracks_deactivated += 1
        
        db.commit()
        
        logger.info(
            "sync_tracks_success",
            tracks_added=tracks_added,
            tracks_updated=tracks_updated,
            tracks_deactivated=tracks_deactivated,
        )
        
        return {
            "tracks_added": tracks_added,
            "tracks_updated": tracks_updated,
            "tracks_deactivated": tracks_deactivated,
            "total_tracks": len(tracks),
        }
    
    except ConnectorHTTPError as e:
        logger.error("sync_tracks_http_error", error=str(e))
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
        logger.error("sync_tracks_parse_error", error=str(e))
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
        logger.error("sync_tracks_error", error=str(e), exc_info=True)
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


@router.post("/events/{event_id}/ingest")
async def ingest_event(
    event_id: str,
    request: IngestRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Trigger event ingestion.
    
    Args:
        event_id: Event ID
        request: Ingestion request with depth
    
    Returns:
        Ingestion summary
    
    Raises:
        HTTPException: On ingestion errors
    """
    try:
        logger.info("ingest_event_api_start", event_id=event_id, depth=request.depth)
        
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
        
        pipeline = IngestionPipeline()
        # Pipeline expects UUID type - convert validated string back to UUID for pipeline
        track_uuid = UUID(track_id_str)
        result = await pipeline.ingest_event_by_source_id(
            source_event_id=request.source_event_id,
            track_id=track_uuid,  # Pass UUID object (repository converts to string internally)
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

