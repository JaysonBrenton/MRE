"""
JSON GNSS parser (Level 1).

Accepts UTF-8 JSON: a top-level array of point objects, or an object with one of
points / samples / records / data holding that array. Each object needs time,
latitude, and longitude (flexible key names, same spirit as CSV).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from ingestion.telemetry.errors import TelemetryParseError
from ingestion.telemetry.parsers.csv_gnss import (
    GnssSample,
    _norm_key,
    _parse_float,
    _pick_column,
)


def _parse_json_time_value(raw: Any, *, session_epoch_ms: int) -> int:
    """Return t_ns from a JSON value (string or number)."""
    if raw is None:
        raise TelemetryParseError("JSON_NO_TIME", "Missing time value")

    if isinstance(raw, bool):
        raise TelemetryParseError("JSON_AMBIGUOUS_TIME", "Invalid time type")

    if isinstance(raw, (int, float)):
        v = float(raw)
        if v >= 1e12:
            return int(v * 1_000_000)
        if v >= 1e9:
            return int(v * 1_000_000_000)
        rel_ms = int(v)
        return int((session_epoch_ms + rel_ms) * 1_000_000)

    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            raise TelemetryParseError("JSON_NO_TIME", "Empty time value")
        # ISO 8601
        if "t" in s.lower() and ("-" in s or ":" in s):
            try:
                iso = s.replace("Z", "+00:00")
                dt = datetime.fromisoformat(iso)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                else:
                    dt = dt.astimezone(timezone.utc)
                return int(dt.timestamp() * 1_000_000_000)
            except ValueError:
                pass
        try:
            v = float(s.replace(",", "."))
        except ValueError as exc:
            raise TelemetryParseError(
                "JSON_AMBIGUOUS_TIME",
                f"Could not parse time value: {s!r}",
            ) from exc
        if v >= 1e12:
            return int(v * 1_000_000)
        if v >= 1e9:
            return int(v * 1_000_000_000)
        rel_ms = int(v)
        return int((session_epoch_ms + rel_ms) * 1_000_000)

    raise TelemetryParseError("JSON_AMBIGUOUS_TIME", "Unsupported time value type")


def _point_key_map(obj: Dict[str, Any]) -> Dict[str, str]:
    return {_norm_key(str(k)): k for k in obj.keys()}


def _extract_point_array(root: Any) -> List[Dict[str, Any]]:
    if isinstance(root, list):
        return [p for p in root if isinstance(p, dict)]
    if isinstance(root, dict):
        for key in ("points", "samples", "records", "data"):
            v = root.get(key)
            if isinstance(v, list):
                return [p for p in v if isinstance(p, dict)]
    return []


def parse_json_gnss(
    text: str,
    *,
    session_created_at: datetime,
) -> Tuple[List[GnssSample], Dict[str, Any]]:
    if not text or not text.strip():
        raise TelemetryParseError("JSON_EMPTY", "JSON file is empty")

    try:
        root = json.loads(text)
    except json.JSONDecodeError as exc:
        raise TelemetryParseError("JSON_PARSE_ERROR", f"Invalid JSON: {exc}") from exc

    points = _extract_point_array(root)
    if not points:
        raise TelemetryParseError(
            "JSON_NO_POINTS",
            "Expected a JSON array of objects or an object with points/samples/records/data",
        )

    if session_created_at.tzinfo is None:
        session_utc = session_created_at.replace(tzinfo=timezone.utc)
    else:
        session_utc = session_created_at.astimezone(timezone.utc)
    session_epoch_ms = int(session_utc.timestamp() * 1000)

    # Infer column names from the first point that has lat+lon+time keys
    lat_k: Optional[str] = None
    lon_k: Optional[str] = None
    time_k: Optional[str] = None
    alt_k: Optional[str] = None
    spd_k: Optional[str] = None

    for p in points:
        km = _point_key_map(p)
        lk = _pick_column(
            km,
            ("lat_deg", "latitude", "lat", "gps_lat", "Latitude"),
        )
        ok = _pick_column(
            km,
            ("lon_deg", "longitude", "lon", "lng", "gps_lon", "Longitude"),
        )
        tk = _pick_column(
            km,
            (
                "timestamp_ms",
                "timestamp",
                "time",
                "time_utc",
                "epoch_ms",
                "epoch",
                "t",
                "utc",
                "t_unix_ms",
            ),
        )
        if lk and ok and tk:
            lat_k, lon_k, time_k = lk, ok, tk
            alt_k = _pick_column(km, ("alt_m", "alt", "altitude", "ele", "elevation"))
            spd_k = _pick_column(
                km,
                ("speed_mps", "speed", "velocity", "speed_ms"),
            )
            break

    if not lat_k or not lon_k or not time_k:
        raise TelemetryParseError(
            "JSON_NO_POSITION",
            "Need latitude, longitude, and time fields on at least one point",
        )

    out: List[GnssSample] = []
    for p in points:
        lat_raw = p.get(lat_k)
        lon_raw = p.get(lon_k)
        time_raw = p.get(time_k)
        if lat_raw is None or lon_raw is None or time_raw is None:
            continue
        if isinstance(lat_raw, str) and not lat_raw.strip():
            continue
        if isinstance(lon_raw, str) and not lon_raw.strip():
            continue

        lat: Optional[float]
        lon: Optional[float]
        if isinstance(lat_raw, (int, float)):
            lat = float(lat_raw)
        else:
            lat = _parse_float(str(lat_raw))
        if isinstance(lon_raw, (int, float)):
            lon = float(lon_raw)
        else:
            lon = _parse_float(str(lon_raw))
        if lat is None or lon is None:
            continue

        t_ns = _parse_json_time_value(time_raw, session_epoch_ms=session_epoch_ms)

        alt: Optional[float] = None
        spd: Optional[float] = None
        if alt_k and p.get(alt_k) is not None:
            ar = p.get(alt_k)
            if isinstance(ar, (int, float)):
                alt = float(ar)
            else:
                alt = _parse_float(str(ar))
        if spd_k and p.get(spd_k) is not None:
            sr = p.get(spd_k)
            if isinstance(sr, (int, float)):
                spd = float(sr)
            else:
                spd = _parse_float(str(sr))

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
            "JSON_NO_DATA",
            "No valid GNSS points after parsing",
        )

    out.sort(key=lambda s: s.t_ns)

    meta = {
        "format": "json_gnss",
        "latKey": lat_k,
        "lonKey": lon_k,
        "timeKey": time_k,
        "rowCount": len(out),
    }
    return out, meta
