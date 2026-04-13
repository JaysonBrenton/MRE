"""
Garmin FIT GNSS parser (Level 1) via fitparse record messages.
"""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from fitparse import FitFile

from ingestion.telemetry.errors import TelemetryParseError
from ingestion.telemetry.parsers.csv_gnss import GnssSample

# FIT position fields are semicircles (Garmin FIT spec)
_SEMICIRCLE_TO_DEG = 180.0 / (2**31)


def _semicircle_to_deg(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v) * _SEMICIRCLE_TO_DEG
    except (TypeError, ValueError):
        return None


def _fit_timestamp_to_ns(ts: Any) -> Optional[int]:
    if ts is None:
        return None
    if isinstance(ts, datetime):
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        else:
            ts = ts.astimezone(timezone.utc)
        return int(ts.timestamp() * 1_000_000_000)
    return None


def is_fit_magic(raw: bytes) -> bool:
    """True if bytes look like a FIT container (ASCII '.FIT' at header offset 8)."""
    return len(raw) >= 12 and raw[8:12] == b".FIT"


def parse_fit_gnss(raw_bytes: bytes) -> Tuple[List[GnssSample], Dict[str, Any]]:
    if not raw_bytes:
        raise TelemetryParseError("FIT_EMPTY", "FIT file is empty")

    if not is_fit_magic(raw_bytes):
        raise TelemetryParseError(
            "FIT_NOT_FIT",
            "File does not look like a FIT activity (missing .FIT header)",
        )

    try:
        fit = FitFile(BytesIO(raw_bytes))
    except Exception as exc:  # noqa: BLE001
        raise TelemetryParseError("FIT_PARSE_ERROR", f"Could not open FIT: {exc}") from exc

    out: List[GnssSample] = []
    for msg in fit.get_messages("record"):
        vals = {f.name: f.value for f in msg.fields}
        lat = _semicircle_to_deg(vals.get("position_lat"))
        lon = _semicircle_to_deg(vals.get("position_long"))
        if lat is None or lon is None:
            continue
        t_ns = _fit_timestamp_to_ns(vals.get("timestamp"))
        if t_ns is None:
            continue

        alt: Optional[float] = None
        for key in ("enhanced_altitude", "altitude"):
            a = vals.get(key)
            if isinstance(a, (int, float)):
                alt = float(a)
                break

        spd: Optional[float] = None
        for key in ("enhanced_speed", "speed"):
            s = vals.get(key)
            if isinstance(s, (int, float)):
                spd = float(s)
                break

        out.append(
            GnssSample(
                t_ns=t_ns,
                lat_deg=lat,
                lon_deg=lon,
                alt_m=alt,
                speed_mps=spd,
            )
        )

    if not out:
        raise TelemetryParseError(
            "FIT_NO_POSITION",
            "No FIT record messages with position and timestamp",
        )

    out.sort(key=lambda s: s.t_ns)

    meta = {
        "format": "fit_gnss",
        "rowCount": len(out),
    }
    return out, meta
