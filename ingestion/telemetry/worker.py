"""
Telemetry worker: claim jobs from telemetry_jobs (SKIP LOCKED), validate uploads, parse to Parquet.

Run: python -m ingestion.telemetry.worker
Environment: DATABASE_URL, TELEMETRY_UPLOAD_ROOT (default /data/telemetry),
  TELEMETRY_WORKER_ID, TELEMETRY_WORKER_POLL_INTERVAL_SEC.

@see docs/telemetry/Design/Telemetry_MVP_Implementation_Decisions.md §1
"""

from __future__ import annotations

import json
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

from ingestion.common.logging import configure_logging, get_logger
from ingestion.common.metrics import record_telemetry_job
from ingestion.db.session import engine as _engine
from ingestion.telemetry.canonical_parquet import write_gnss_parquet
from ingestion.telemetry.errors import TelemetryParseError
from ingestion.telemetry.garmin_fit_policy import is_garmin_fit_file
from ingestion.telemetry.pipeline_v1 import run_v1_postprocess
from ingestion.telemetry.parsers.csv_gnss import parse_csv_gnss
from ingestion.telemetry.parsers.gpx_gnss import parse_gpx_gnss
from ingestion.telemetry.parsers.json_gnss import parse_json_gnss
from ingestion.telemetry.parsers.nmea_gnss import looks_like_nmea_text, parse_nmea_gnss
from ingestion.telemetry.parsers.ubx_gnss import looks_like_ubx
from ingestion.telemetry.storage_paths import UPLOAD_ROOT, estimate_hz, resolve_artifact_path
from ingestion.telemetry.time_align import time_align_gnss

logger = get_logger(__name__)

WORKER_ID = os.getenv("TELEMETRY_WORKER_ID", "telemetry-worker-1")
POLL_SEC = float(os.getenv("TELEMETRY_WORKER_POLL_INTERVAL_SEC", "2"))


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


def _enqueue_job(
    conn: Connection,
    *,
    run_id: str,
    job_type: str,
    payload: Dict[str, Any],
) -> None:
    jid = str(uuid.uuid4())
    conn.execute(
        text(
            """
            INSERT INTO telemetry_jobs (
                id, run_id, job_type, status, payload,
                attempt_count, max_attempts, created_at, updated_at
            )
            VALUES (
                :jid, :rid, :jt, 'QUEUED', CAST(:payload AS jsonb),
                0, 3, NOW(), NOW()
            )
            """
        ),
        {"jid": jid, "rid": run_id, "jt": job_type, "payload": json.dumps(payload)},
    )


def _parse_payload(job: Dict[str, Any]) -> Dict[str, Any]:
    payload = job.get("payload") or {}
    if isinstance(payload, str):
        payload = json.loads(payload)
    return payload if isinstance(payload, dict) else {}


def _artifact_validate(conn: Connection, job: Dict[str, Any]) -> None:
    payload = _parse_payload(job)
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
                SELECT id, storage_path, byte_size, session_id, original_file_name
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

    path = resolve_artifact_path(art["storage_path"])
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

    _enqueue_job(
        conn,
        run_id=run_id,
        job_type="parse_raw",
        payload={"artifactId": artifact_id},
    )


def _detect_format(path, original_file_name: str) -> str:
    name = (original_file_name or "").lower()
    if name.endswith(".gpx"):
        return "gpx"
    head = path.read_bytes()[:512].lstrip()
    if head.startswith(b"<?xml") or head.startswith(b"<gpx"):
        return "gpx"
    if name.endswith(".nmea"):
        return "nmea"
    try:
        text_head = path.read_text(encoding="utf-8-sig")[:16384]
    except UnicodeDecodeError:
        text_head = ""
    if looks_like_nmea_text(text_head):
        return "nmea"
    raw_probe_ubx = path.read_bytes()[:4096]
    if name.endswith(".ubx") or looks_like_ubx(raw_probe_ubx):
        return "ubx"
    th = text_head.lstrip()
    if name.endswith(".json") or th.startswith("{") or th.startswith("["):
        return "json"
    if name.endswith(".csv"):
        return "csv"
    return "csv"


def _parse_raw(conn: Connection, job: Dict[str, Any]) -> None:
    payload = _parse_payload(job)
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

    sess = (
        conn.execute(
            text(
                """
                SELECT id, created_at
                FROM telemetry_sessions
                WHERE id = :sid
                """
            ),
            {"sid": session_id},
        )
        .mappings()
        .one()
    )

    art = (
        conn.execute(
            text(
                """
                SELECT id, storage_path, session_id, original_file_name
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

    path = resolve_artifact_path(art["storage_path"])
    fmt = _detect_format(path, str(art["original_file_name"]))
    raw_bytes = path.read_bytes()

    if is_garmin_fit_file(raw_bytes, str(art["original_file_name"])):
        raise TelemetryParseError(
            "GARMIN_FIT_NOT_SUPPORTED",
            "Garmin FIT files are not supported. Export as CSV, GPX, NMEA, or JSON.",
        )

    if fmt == "gpx":
        samples, pmeta = parse_gpx_gnss(raw_bytes)
        detected = "gpx"
    elif fmt == "ubx":
        from ingestion.telemetry.parsers.ubx_gnss import parse_ubx_gnss

        samples, pmeta = parse_ubx_gnss(raw_bytes)
        detected = "ubx_gnss"
    elif fmt == "json":
        try:
            decoded_utf8 = raw_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise TelemetryParseError(
                "JSON_UNSUPPORTED_ENCODING",
                f"Could not decode as UTF-8: {exc}",
            ) from exc
        samples, pmeta = parse_json_gnss(
            decoded_utf8, session_created_at=sess["created_at"]
        )
        detected = "json_gnss"
    elif fmt == "nmea":
        try:
            decoded_utf8 = raw_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise TelemetryParseError(
                "CSV_UNSUPPORTED_ENCODING",
                f"Could not decode as UTF-8: {exc}",
            ) from exc
        samples, pmeta = parse_nmea_gnss(
            decoded_utf8, session_created_at=sess["created_at"]
        )
        detected = "nmea_gnss"
    else:
        try:
            decoded_utf8 = raw_bytes.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise TelemetryParseError(
                "CSV_UNSUPPORTED_ENCODING",
                f"Could not decode as UTF-8: {exc}",
            ) from exc
        samples, pmeta = parse_csv_gnss(
            decoded_utf8, session_created_at=sess["created_at"]
        )
        detected = "csv_gnss"

    samples = time_align_gnss(samples)

    dataset_id = str(uuid.uuid4())
    rel_parquet = f"canonical/{session_id}/{run_id}/{dataset_id}/gnss_pvt.parquet"
    out_path = resolve_artifact_path(rel_parquet)
    write_gnss_parquet(out_path, samples)

    t_ns_list = [s.t_ns for s in samples]
    t_min_ns = min(t_ns_list)
    t_max_ns = max(t_ns_list)

    def _ns_to_dt(ns: int) -> datetime:
        return datetime.fromtimestamp(ns / 1e9, tz=timezone.utc)

    start_dt = _ns_to_dt(t_min_ns)
    end_dt = _ns_to_dt(t_max_ns)

    sr = estimate_hz(samples)

    conn.execute(
        text(
            """
            INSERT INTO telemetry_datasets (
                id, session_id, run_id, dataset_type, sensor_type,
                imu_dof, imu_channels, frame, axis_convention,
                sample_rate_hz, downsample_factor, clickhouse_table, clickhouse_where_hint,
                schema_version, units_version, created_from_artifact_ids,
                created_at, updated_at
            )
            VALUES (
                :id, :sid, :rid,
                'CANON_GNSS'::"TelemetryDatasetType",
                'GNSS'::"TelemetryDatasetSensorType",
                NULL, ARRAY[]::TEXT[], NULL, NULL,
                :sr, NULL, 'not_materialized', NULL,
                1, 1, CAST(:art_ids AS jsonb),
                NOW(), NOW()
            )
            """
        ),
        {
            "id": dataset_id,
            "sid": session_id,
            "rid": run_id,
            "sr": sr,
            "art_ids": json.dumps([artifact_id]),
        },
    )

    quality_summary, out_ids, fusion_ver, lap_det_ver = run_v1_postprocess(
        conn,
        session_id=session_id,
        run_id=run_id,
        artifact_id=artifact_id,
        gnss_dataset_id=dataset_id,
        rel_gnss_parquet=rel_parquet,
        samples=samples,
        format_detected=detected,
        parser_meta=pmeta,
    )

    conn.execute(
        text(
            """
            UPDATE telemetry_processing_runs
            SET status = 'SUCCEEDED',
                finished_at = NOW(),
                error_code = NULL,
                error_detail = NULL,
                output_dataset_ids = CAST(:ods AS jsonb),
                quality_summary = CAST(:qs AS jsonb),
                fusion_version = :fv,
                lap_detector_version = :lv,
                updated_at = NOW()
            WHERE id = :rid
            """
        ),
        {
            "rid": run_id,
            "ods": json.dumps(out_ids),
            "qs": json.dumps(quality_summary),
            "fv": fusion_ver,
            "lv": lap_det_ver,
        },
    )

    conn.execute(
        text(
            """
            UPDATE telemetry_sessions
            SET status = 'READY',
                start_time_utc = :st,
                end_time_utc = :et,
                updated_at = NOW()
            WHERE id = :sid
            """
        ),
        {"sid": session_id, "st": start_dt, "et": end_dt},
    )

    conn.execute(
        text(
            """
            UPDATE telemetry_artifacts
            SET format_detected = :fd,
                status = 'CANONICALISED',
                updated_at = NOW()
            WHERE id = :aid
            """
        ),
        {"aid": artifact_id, "fd": detected},
    )

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
            jt = job.get("job_type") or "unknown"
            try:
                if jt == "artifact_validate":
                    _artifact_validate(conn, job)
                elif jt == "parse_raw":
                    _parse_raw(conn, job)
                else:
                    raise ValueError(f"UNKNOWN_JOB_TYPE:{jt}")
                record_telemetry_job(str(jt), "success")
            except TelemetryParseError as exc:
                msg = f"{exc.code}: {exc.detail}"
                logger.warning("telemetry_job_failed", job_id=job["id"], error=msg)
                record_telemetry_job(str(jt), "failed")
                _fail_job(conn, job, code=exc.code, message=exc.detail)
            except Exception as exc:  # noqa: BLE001
                msg = f"{type(exc).__name__}: {exc}"
                code = "ARTIFACT_VALIDATE_FAILED" if jt == "artifact_validate" else "PARSE_RAW_FAILED"
                logger.warning("telemetry_job_failed", job_id=job["id"], error=msg)
                record_telemetry_job(str(jt), "failed")
                _fail_job(conn, job, code=code, message=msg)
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
