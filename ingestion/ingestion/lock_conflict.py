# @fileoverview Classify advisory lock conflicts (active job vs stale pooled lock)

from __future__ import annotations

from typing import Optional
from uuid import UUID

from ingestion.common import metrics
from ingestion.ingestion.errors import IngestionInProgressError


def _active_job_for_event(event_id: str):
    from ingestion.api.job_queue import get_active_job_for_event_id

    return get_active_job_for_event_id(event_id)


def _active_job_for_source(source_event_id: str, track_id: str):
    from ingestion.api.job_queue import get_active_job_for_source

    return get_active_job_for_source(source_event_id, track_id)


def raise_event_lock_conflict(event_id: UUID) -> None:
    """Raise IngestionInProgressError with queue-aware hint."""
    event_id_str = str(event_id)
    job = _active_job_for_event(event_id_str)
    if job:
        raise IngestionInProgressError(
            event_id_str,
            hint="ingestion_running",
            active_job_id=job.job_id,
        )
    metrics.record_advisory_lock_leaked_suspected()
    raise IngestionInProgressError(
        event_id_str,
        hint="stale_lock_suspected",
    )


def raise_source_lock_conflict(
    source_event_id: str,
    track_id: Optional[UUID] = None,
) -> None:
    """Raise IngestionInProgressError for source-event lock conflicts."""
    active_job_id: Optional[str] = None
    hint = "stale_lock_suspected"
    job = None
    if track_id is not None:
        job = _active_job_for_source(source_event_id, str(track_id))
        if job:
            hint = "ingestion_running"
            active_job_id = job.job_id

    if job is None:
        metrics.record_advisory_lock_leaked_suspected()

    raise IngestionInProgressError(
        source_event_id,
        hint=hint,
        active_job_id=active_job_id,
        source_event_id=source_event_id,
    )
