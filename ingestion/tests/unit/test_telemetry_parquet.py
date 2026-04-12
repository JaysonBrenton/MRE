"""Parquet writer smoke test."""

from datetime import datetime, timezone
from pathlib import Path

import pyarrow.parquet as pq

from ingestion.telemetry.canonical_parquet import write_gnss_parquet
from ingestion.telemetry.parsers.csv_gnss import parse_csv_gnss

_FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "telemetry"


def test_write_gnss_parquet_roundtrip(tmp_path: Path) -> None:
    text = (_FIXTURES / "sample_gnss_10hz.csv").read_text(encoding="utf-8")
    session_start = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    samples, _ = parse_csv_gnss(text, session_created_at=session_start)
    out = tmp_path / "out.parquet"
    write_gnss_parquet(out, samples)
    t = pq.read_table(out)
    assert t.num_rows == len(samples)
    assert "t_ns" in t.column_names
