"""Unit tests for telemetry CSV/GPX parsers (fixtures)."""

from datetime import datetime, timezone
from pathlib import Path

import pytest

from ingestion.telemetry.errors import TelemetryParseError
from ingestion.telemetry.parsers.csv_gnss import parse_csv_gnss
from ingestion.telemetry.parsers.gpx_gnss import parse_gpx_gnss

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "telemetry"


def test_sample_gnss_csv_parses() -> None:
    text = (FIXTURES / "sample_gnss_10hz.csv").read_text(encoding="utf-8")
    session_start = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    samples, meta = parse_csv_gnss(text, session_created_at=session_start)
    assert len(samples) == 11
    assert meta["rowCount"] == 11
    assert samples[0].lat_deg == pytest.approx(-35.33670471)
    assert samples[0].t_ns > 0


def test_csv_no_time_errors() -> None:
    text = (FIXTURES / "csv_no_time.csv").read_text(encoding="utf-8")
    session_start = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    with pytest.raises(TelemetryParseError) as exc:
        parse_csv_gnss(text, session_created_at=session_start)
    assert exc.value.code == "CSV_NO_TIME_COLUMN"


def test_sample_gpx_parses() -> None:
    raw = (FIXTURES / "sample_track.gpx").read_bytes()
    samples, meta = parse_gpx_gnss(raw)
    assert len(samples) == 5
    assert meta["rowCount"] == 5
    assert samples[0].lat_deg == pytest.approx(-35.33670471)
