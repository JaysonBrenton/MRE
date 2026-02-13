# @fileoverview In-process ingestion job queue and background workers
#
# @created 2026-02-04
# @description Provides "queue and process in background" semantics for event
#              ingestion. When enabled, ingest endpoints return 202 with job_id;
#              workers process jobs from the queue and update status.
#              Requires single worker (UVICORN_WORKERS=1) when queue is enabled
#              so job status is in-process.

from __future__ import annotations

import asyncio
import os
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict
from uuid import UUID, uuid4

from ingestion.common.logging import get_logger
from ingestion.ingestion.pipeline import IngestionPipeline

logger = get_logger(__name__)


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class JobType(str, Enum):
    BY_SOURCE_ID = "by_source_id"
    BY_EVENT_ID = "by_event_id"


@dataclass
class IngestBySourceIdPayload:
    source_event_id: str
    track_id: str
    depth: str


@dataclass
class IngestByEventIdPayload:
    event_id: str
    depth: str


@dataclass
class Job:
    job_id: str
    job_type: JobType
    payload: IngestBySourceIdPayload | IngestByEventIdPayload
    status: JobStatus = JobStatus.QUEUED
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    result: Dict[str, Any] | None = None
    error_code: str | None = None
    error_message: str | None = None

    def to_response(self, queue_position: int | None = None) -> Dict[str, Any]:
        out: Dict[str, Any] = {
            "job_id": self.job_id,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
        if queue_position is not None:
            out["queue_position"] = queue_position
        if self.status == JobStatus.COMPLETED and self.result:
            out["result"] = self.result
        if self.status == JobStatus.FAILED:
            out["error_code"] = self.error_code
            out["error_message"] = self.error_message
        return out


def _queue_enabled() -> bool:
    return os.getenv("INGESTION_USE_QUEUE", "true").strip().lower() in ("1", "true", "yes")


def is_queue_enabled() -> bool:
    return _queue_enabled()


# In-memory store (process-local; use single worker when queue enabled)
_job_store: Dict[str, Job] = {}
_queue: asyncio.Queue[Job] = asyncio.Queue()
_queue_order: deque[str] = deque()

# Limit concurrent ingestion jobs (e.g. 2 at a time)
_max_concurrent = max(1, int(os.getenv("INGESTION_QUEUE_MAX_CONCURRENT", "2")))
_semaphore = asyncio.Semaphore(_max_concurrent)

# Completed/failed jobs retention (seconds)
_job_retention_seconds = int(os.getenv("INGESTION_QUEUE_JOB_TTL_SECONDS", "3600"))

# Track whether background workers have been started (so we only start once)
_workers_started = False


def enqueue_by_source_id(source_event_id: str, track_id: str, depth: str = "laps_full") -> str:
    job_id = str(uuid4())
    payload = IngestBySourceIdPayload(
        source_event_id=source_event_id,
        track_id=track_id,
        depth=depth,
    )
    job = Job(job_id=job_id, job_type=JobType.BY_SOURCE_ID, payload=payload)
    _job_store[job_id] = job
    _queue.put_nowait(job)
    _queue_order.append(job_id)
    logger.info("ingestion_job_queued", job_id=job_id, job_type=JobType.BY_SOURCE_ID.value)
    return job_id


def enqueue_by_event_id(event_id: str, depth: str = "laps_full") -> str:
    job_id = str(uuid4())
    payload = IngestByEventIdPayload(event_id=event_id, depth=depth)
    job = Job(job_id=job_id, job_type=JobType.BY_EVENT_ID, payload=payload)
    _job_store[job_id] = job
    _queue.put_nowait(job)
    _queue_order.append(job_id)
    logger.info("ingestion_job_queued", job_id=job_id, job_type=JobType.BY_EVENT_ID.value)
    return job_id


def get_job(job_id: str) -> Job | None:
    return _job_store.get(job_id)


def queue_position_for_job(job: Job) -> int | None:
    """1-based position among queued jobs (only when status is QUEUED)."""
    if job.status != JobStatus.QUEUED:
        return None
    _prune_queue_order()
    position = 1
    for job_id in _queue_order:
        stored = _job_store.get(job_id)
        if not stored or stored.status != JobStatus.QUEUED:
            continue
        if stored.job_id == job.job_id:
            return position
        position += 1
    return None


def _remove_from_queue_order(job_id: str) -> None:
    try:
        _queue_order.remove(job_id)
    except ValueError:
        pass


def _prune_queue_order() -> None:
    for job_id in list(_queue_order):
        job = _job_store.get(job_id)
        if not job or job.status != JobStatus.QUEUED:
            _remove_from_queue_order(job_id)


def _cleanup_jobs() -> None:
    if _job_retention_seconds <= 0:
        to_delete = [job_id for job_id, job in _job_store.items() if job.status != JobStatus.QUEUED]
    else:
        cutoff = datetime.utcnow() - timedelta(seconds=_job_retention_seconds)
        to_delete = [
            job_id
            for job_id, job in _job_store.items()
            if job.status not in (JobStatus.QUEUED, JobStatus.RUNNING)
            and job.updated_at < cutoff
        ]
    for job_id in to_delete:
        _job_store.pop(job_id, None)
        _remove_from_queue_order(job_id)


async def _run_job(job: Job) -> None:
    job.status = JobStatus.RUNNING
    job.updated_at = datetime.utcnow()
    pipeline = IngestionPipeline()
    try:
        if job.job_type == JobType.BY_SOURCE_ID:
            p = job.payload
            if not isinstance(p, IngestBySourceIdPayload):
                raise TypeError("Expected IngestBySourceIdPayload")
            result = await pipeline.ingest_event_by_source_id(
                source_event_id=p.source_event_id,
                track_id=UUID(p.track_id),
                depth=p.depth,
            )
        else:
            p = job.payload
            if not isinstance(p, IngestByEventIdPayload):
                raise TypeError("Expected IngestByEventIdPayload")
            result = await pipeline.ingest_event(
                event_id=UUID(p.event_id),
                depth=p.depth,
            )
        job.status = JobStatus.COMPLETED
        job.result = result
        job.updated_at = datetime.utcnow()
        logger.info(
            "ingestion_job_completed",
            job_id=job.job_id,
            job_type=job.job_type.value,
            event_id=result.get("event_id"),
        )
    except Exception as e:  # noqa: BLE001
        job.status = JobStatus.FAILED
        job.updated_at = datetime.utcnow()
        code = getattr(e, "code", "INGESTION_ERROR")
        job.error_code = code if isinstance(code, str) else "INGESTION_ERROR"
        job.error_message = str(e)
        logger.error(
            "ingestion_job_failed",
            job_id=job.job_id,
            job_type=job.job_type.value,
            error=str(e),
            exc_info=True,
        )
    finally:
        _cleanup_jobs()


async def _worker() -> None:
    while True:
        job = await _queue.get()
        _remove_from_queue_order(job.job_id)
        async with _semaphore:
            await _run_job(job)
        _queue.task_done()


def start_workers(num_workers: int | None = None) -> None:
    """Start background worker tasks. Call from app startup."""
    global _workers_started
    if _workers_started:
        return
    worker_count = num_workers if num_workers is not None else _max_concurrent
    for i in range(max(1, worker_count)):
        asyncio.create_task(_worker())
        logger.info("ingestion_queue_worker_started", worker_index=i)
    _workers_started = True


def _reset_queue_state_for_tests() -> None:  # pragma: no cover - used in unit tests only
    global _queue, _semaphore, _workers_started
    _job_store.clear()
    _queue_order.clear()
    _queue = asyncio.Queue()
    _semaphore = asyncio.Semaphore(_max_concurrent)
    _workers_started = False
    _cleanup_jobs()
