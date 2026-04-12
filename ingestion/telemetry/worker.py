"""
Telemetry worker: claim jobs from telemetry_jobs (SKIP LOCKED), validate raw uploads.

Run: python -m ingestion.telemetry.worker
Environment: DATABASE_URL, TELEMETRY_UPLOAD_ROOT (default /data/telemetry),
  TELEMETRY_WORKER_ID, TELEMETRY_WORKER_POLL_INTERVAL_SEC.

@see docs/telemetry/Design/Telemetry_MVP_Implementation_Decisions.md §1
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

from ingestion.common.logging import configure_logging, get_logger
from ingestion.db.session import engine as _engine

logger = get_logger(__name__)

WORKER_ID = os.getenv("TELEMETRY_WORKER_ID", "telemetry-worker-1")
POLL_SEC = float(os.getenv("TELEMETRY_WORKER_POLL_INTERVAL_SEC", "2"))
UPLOAD_ROOT = Path(os.getenv("TELEMETRY_UPLOAD_ROOT", "/data/telemetry"))


def _get_engine() -> Engine:
    return _engine


def claim_next_job(conn: Connection, worker_id: str) -> Optional[Dict[str, Any]]:
    """SKIP LOCKED select + mark RUNNING (caller must wrap in transaction)."""
    row = conn.execute(
        text(
            """
            SELECT id FROM telemetry_jobs
            WHERE status = 'QUEUED' AND (next_retry_at IS NULL OR next_retry_at <= NOW())
            ORDER BY created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
            """
        )
    ).fetchone()
    if not row:
        return None
    jid = row[0]
    conn.execute(
        text(
            """
            UPDATE telemetry_jobs
            SET status = 'RUNNING',
                locked_at = NOW(),
                locked_by = :wid,
                attempt_count = attempt_count + 1,
                updated_at = NOW()
            WHERE id = :jid
            """
        ),
        {"jid": jid, "wid": worker_id},
    )
    job = (
        conn.execute(
            text(
                """
                SELECT id, run_id, job_type, payload, attempt_count, max_attempts
                FROM telemetry_jobs
                WHERE id = :jid
                """
            ),
            {"jid": jid},
        )
        .mappings()
        .one()
    )
    return dict(job)


def _resolve_artifact_path(storage_path: str) -> Path:
    rel = storage_path.lstrip("/\\")
    full = (UPLOAD_ROOT / rel).resolve()
    root = UPLOAD_ROOT.resolve()
    root_str = str(root)
    full_str = str(full)
    if full_str != root_str and not full_str.startswith(root_str + os.sep):
        raise ValueError("storage_path escapes TELEMETRY_UPLOAD_ROOT")
    return full


def _artifact_validate(conn: Connection, job: Dict[str, Any]) -> None:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    artifact_id = payload.get("artifactId") or payload.get("artifact_id")
    if not artifact_id:
        raise ValueError("MISSING_ARTIFACT_ID_IN_PAYLOAD")

    run_id = job["run_id"]
    run = (
        conn.execute(
            text(
                """
                SELECT id, session_id, status
                FROM telemetry_processing_runs
                WHERE id = :rid
                """
            ),
            {"rid": run_id},
        )
        .mappings()
        .one()
    )
    session_id = run["session_id"]

    art = (
        conn.execute(
            text(
                """
                SELECT id, storage_path, byte_size, session_id
                FROM telemetry_artifacts
                WHERE id = :aid
                """
            ),
            {"aid": artifact_id},
        )
        .mappings()
        .one()
    )

    if art["session_id"] != session_id:
        raise ValueError("ARTIFACT_SESSION_MISMATCH")

    conn.execute(
        text(
            """
            UPDATE telemetry_processing_runs
            SET status = 'RUNNING',
                started_at = COALESCE(started_at, NOW()),
                updated_at = NOW()
            WHERE id = :rid
            """
        ),
        {"rid": run_id},
    )

    path = _resolve_artifact_path(art["storage_path"])
    if not path.is_file():
        raise FileNotFoundError("FILE_NOT_FOUND")

    size = path.stat().st_size
    expected = int(art["byte_size"])
    if size != expected:
        raise ValueError(f"SIZE_MISMATCH expected={expected} actual={size}")

    conn.execute(
        text(
            """
            UPDATE telemetry_jobs
            SET status = 'SUCCEEDED',
                locked_at = NULL,
                locked_by = NULL,
                last_error_code = NULL,
                last_error_message = NULL,
                updated_at = NOW()
            WHERE id = :jid
            """
        ),
        {"jid": job["id"]},
    )
    conn.execute(
        text(
            """
            UPDATE telemetry_processing_runs
            SET status = 'SUCCEEDED',
                finished_at = NOW(),
                error_code = NULL,
                error_detail = NULL,
                updated_at = NOW()
            WHERE id = :rid
            """
        ),
        {"rid": run_id},
    )
    conn.execute(
        text(
            """
            UPDATE telemetry_sessions
            SET status = 'READY',
                updated_at = NOW()
            WHERE id = :sid
            """
        ),
        {"sid": session_id},
    )


def _fail_job(
    conn: Connection,
    job: Dict[str, Any],
    *,
    code: str,
    message: str,
) -> None:
    run_id = job["run_id"]
    run = (
        conn.execute(
            text("SELECT session_id FROM telemetry_processing_runs WHERE id = :rid"),
            {"rid": run_id},
        )
        .mappings()
        .one()
    )
    session_id = run["session_id"]
    conn.execute(
        text(
            """
            UPDATE telemetry_jobs
            SET status = 'FAILED',
                last_error_code = :code,
                last_error_message = :msg,
                updated_at = NOW()
            WHERE id = :jid
            """
        ),
        {"jid": job["id"], "code": code, "msg": message[:4000]},
    )
    conn.execute(
        text(
            """
            UPDATE telemetry_processing_runs
            SET status = 'FAILED',
                finished_at = NOW(),
                error_code = :code,
                error_detail = :msg,
                updated_at = NOW()
            WHERE id = :rid
            """
        ),
        {"rid": run_id, "code": code, "msg": message[:4000]},
    )
    conn.execute(
        text(
            """
            UPDATE telemetry_sessions
            SET status = 'FAILED',
                updated_at = NOW()
            WHERE id = :sid
            """
        ),
        {"sid": session_id},
    )


def process_one(engine: Engine, worker_id: str) -> bool:
    """Returns True if a job was claimed and handled (success or failure row updates)."""
    with engine.connect() as conn:
        with conn.begin():
            job = claim_next_job(conn, worker_id)
            if not job:
                return False
            jt = job.get("job_type")
            try:
                if jt == "artifact_validate":
                    _artifact_validate(conn, job)
                else:
                    raise ValueError(f"UNKNOWN_JOB_TYPE:{jt}")
            except Exception as exc:  # noqa: BLE001
                msg = f"{type(exc).__name__}: {exc}"
                logger.warning("telemetry_job_failed", job_id=job["id"], error=msg)
                _fail_job(conn, job, code="ARTIFACT_VALIDATE_FAILED", message=msg)
        return True


def main() -> None:
    configure_logging()
    eng = _get_engine()
    logger.info(
        "telemetry_worker_start",
        worker_id=WORKER_ID,
        poll_sec=POLL_SEC,
        upload_root=str(UPLOAD_ROOT),
    )
    while True:
        try:
            processed = process_one(eng, WORKER_ID)
            if not processed:
                time.sleep(POLL_SEC)
        except Exception as exc:  # noqa: BLE001
            logger.exception("telemetry_worker_loop_error", error=str(exc))
            time.sleep(POLL_SEC)


if __name__ == "__main__":
    main()
