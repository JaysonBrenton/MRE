"""Optional ClickHouse materialisation for GNSS v1 cache table."""

from __future__ import annotations

import os
import uuid
from typing import Any, List, Optional

from ingestion.common.logging import get_logger
from ingestion.telemetry.parsers.csv_gnss import GnssSample

logger = get_logger(__name__)

_TABLE = "telemetry_gnss_v1"


def _client():
    try:
        import clickhouse_connect
    except ImportError:
        return None
    host = os.getenv("CLICKHOUSE_HOST", "").strip()
    if not host:
        return None
    port = int(os.getenv("CLICKHOUSE_HTTP_PORT", "8123"))
    user = os.getenv("CLICKHOUSE_USER", "default")
    password = os.getenv("CLICKHOUSE_PASSWORD", "")
    return clickhouse_connect.get_client(host=host, port=port, username=user, password=password)


def ensure_clickhouse_schema(client: Any) -> None:
    client.command(
        f"""
        CREATE TABLE IF NOT EXISTS {_TABLE} (
            session_id UUID,
            run_id UUID,
            dataset_id UUID,
            t_ns Int64,
            lat_deg Float64,
            lon_deg Float64,
            alt_m Nullable(Float64),
            speed_mps Nullable(Float64)
        )
        ENGINE = MergeTree()
        ORDER BY (session_id, t_ns)
        """
    )


def delete_session_rows(session_id: str) -> None:
    # get_client() may raise on first HTTP round-trip (auth); keep optional delete best-effort.
    try:
        client = _client()
        if client is None:
            return
        ensure_clickhouse_schema(client)
        sid = str(uuid.UUID(session_id))
        client.command(f"DELETE FROM {_TABLE} WHERE session_id = toUUID('{sid}')")
    except Exception as exc:  # noqa: BLE001
        logger.warning("clickhouse_delete_failed", error=str(exc))


def materialise_gnss_session(
    *,
    session_id: str,
    run_id: str,
    dataset_id: str,
    samples: List[GnssSample],
) -> Optional[str]:
    """
    Inserts GNSS rows into ClickHouse. Returns \"ok\" or None if skipped/failed.
    """
    if not samples:
        return None
    try:
        # get_client() performs an initial query; auth/network errors must not fail the ingest job.
        client = _client()
        if client is None:
            return None
        ensure_clickhouse_schema(client)
        sid = uuid.UUID(session_id)
        rid = uuid.UUID(run_id)
        did = uuid.UUID(dataset_id)
        rows: List[List[Any]] = []
        for s in samples:
            rows.append(
                [
                    sid,
                    rid,
                    did,
                    int(s.t_ns),
                    float(s.lat_deg),
                    float(s.lon_deg),
                    float(s.alt_m) if s.alt_m is not None else None,
                    float(s.speed_mps) if s.speed_mps is not None else None,
                ]
            )
        client.insert(
            _TABLE,
            rows,
            column_names=[
                "session_id",
                "run_id",
                "dataset_id",
                "t_ns",
                "lat_deg",
                "lon_deg",
                "alt_m",
                "speed_mps",
            ],
        )
        return "ok"
    except Exception as exc:  # noqa: BLE001
        logger.warning("clickhouse_materialise_failed", error=str(exc))
        return "failed"
