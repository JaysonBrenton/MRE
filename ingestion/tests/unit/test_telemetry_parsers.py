"""Unit tests for telemetry CSV/GPX parsers (fixtures)."""

from datetime import datetime, timezone
from pathlib import Path

import pytest

from ingestion.telemetry.errors import TelemetryParseError
from ingestion.telemetry.parsers.csv_gnss import parse_csv_gnss
from ingestion.telemetry.parsers.gpx_gnss import parse_gpx_gnss
from ingestion.telemetry.parsers.json_gnss import parse_json_gnss
from ingestion.telemetry.parsers.nmea_gnss import parse_nmea_gnss

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


def test_sample_nmea_rmc_gga_parses() -> None:
    text = (FIXTURES / "sample_nmea_rmc_gga.nmea").read_text(encoding="utf-8")
    session_start = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    samples, meta = parse_nmea_gnss(text, session_created_at=session_start)
    assert len(samples) == 1
    assert meta["format"] == "nmea_0183"
    assert samples[0].lat_deg == pytest.approx(48.0 + 7.038 / 60.0)
    assert samples[0].lon_deg == pytest.approx(11.0 + 31.0 / 60.0)
    assert samples[0].alt_m == pytest.approx(545.4)
    assert samples[0].speed_mps == pytest.approx(22.4 * 0.514444)


def test_nmea_gga_only_uses_session_calendar_date() -> None:
    text = "$GPGGA,123519.00,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,"
    session_start = datetime(2026, 1, 15, 8, 0, 0, tzinfo=timezone.utc)
    samples, _ = parse_nmea_gnss(text, session_created_at=session_start)
    assert len(samples) == 1
    expect = datetime(2026, 1, 15, 12, 35, 19, tzinfo=timezone.utc)
    assert samples[0].t_ns == int(expect.timestamp() * 1_000_000_000)


def test_nmea_no_fix_errors() -> None:
    text = "$GPGGA,123519.00,4807.038,N,01131.000,E,0,08,0.9,545.4,M,46.9,M,,"
    session_start = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    with pytest.raises(TelemetryParseError) as exc:
        parse_nmea_gnss(text, session_created_at=session_start)
    assert exc.value.code == "NMEA_NO_FIX"


def test_nmea_empty_errors() -> None:
    session_start = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    with pytest.raises(TelemetryParseError) as exc:
        parse_nmea_gnss("  \n", session_created_at=session_start)
    assert exc.value.code == "NMEA_EMPTY"


def test_sample_gnss_json_parses() -> None:
    text = (FIXTURES / "sample_gnss.json").read_text(encoding="utf-8")
    session_start = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    samples, meta = parse_json_gnss(text, session_created_at=session_start)
    assert len(samples) == 11
    assert meta["format"] == "json_gnss"
    assert meta["rowCount"] == 11
    assert samples[0].lat_deg == pytest.approx(-35.33670471)
