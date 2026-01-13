"""In-memory job tracking for long-running API tasks."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Dict, Optional
from uuid import uuid4

from ingestion.services.track_sync_service import TrackSyncResult


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class TrackSyncJob:
    id: str
    status: str = "pending"
    created_at: datetime = field(default_factory=_utcnow)
    updated_at: datetime = field(default_factory=_utcnow)
    stage: str = "metadata"
    processed: int = 0
    total: int = 0
    error: Optional[str] = None
    report_path: Optional[str] = None
    result: Optional[TrackSyncResult] = None

    def to_dict(self) -> Dict[str, object]:
        result = {
            "jobId": self.id,
            "status": self.status,
            "stage": self.stage,
            "processed": self.processed,
            "total": self.total,
            "error": self.error,
            "reportPath": self.report_path,
            "metadataFailures": self.result.metadata_failures if self.result else 0,
            "tracksAdded": self.result.tracks_added if self.result else 0,
            "tracksUpdated": self.result.tracks_updated if self.result else 0,
            "tracksDeactivated": self.result.tracks_deactivated if self.result else 0,
            "metadataEnabled": self.result.metadata_enabled if self.result else True,
            "durationSeconds": self.result.duration_seconds if self.result else None,
            "startedAt": self.result.started_at.isoformat() if self.result else None,
            "completedAt": self.updated_at.isoformat() if self.status in {"success", "error"} else None,
        }
        
        # Add stage-level performance metrics if available
        if self.result and self.result.stage_metrics:
            result["stageMetrics"] = [
                {
                    "stage": m.stage,
                    "durationSeconds": m.duration_seconds,
                    "itemsProcessed": m.items_processed,
                    "itemsTotal": m.items_total,
                }
                for m in self.result.stage_metrics
            ]
        
        return result


class TrackSyncJobStore:
    """Thread-safe in-memory store for track sync jobs."""

    def __init__(self) -> None:
        self._jobs: Dict[str, TrackSyncJob] = {}
        self._lock = Lock()

    def create(self) -> TrackSyncJob:
        with self._lock:
            job = TrackSyncJob(id=str(uuid4()))
            self._jobs[job.id] = job
            return job

    def set_running(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.status = "running"
            job.updated_at = _utcnow()

    def update_progress(self, job_id: str, stage: str, processed: int, total: int) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.stage = stage
            job.processed = processed
            job.total = total
            job.updated_at = _utcnow()

    def complete(self, job_id: str, result: TrackSyncResult) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.status = "success"
            job.result = result
            job.report_path = result.report_path
            job.updated_at = _utcnow()

    def fail(self, job_id: str, error: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            job.status = "error"
            job.error = error
            job.updated_at = _utcnow()

    def get(self, job_id: str) -> Optional[TrackSyncJob]:
        with self._lock:
            return self._jobs.get(job_id)


TRACK_SYNC_JOBS = TrackSyncJobStore()

