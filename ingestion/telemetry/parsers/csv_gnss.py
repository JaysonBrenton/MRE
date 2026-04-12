"""
CSV GNSS parser (Level 1).

@see docs/telemetry/Design/Supported Formats and Parser Specification.md §12.1
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from io import StringIO
from typing import Any, Dict, List, Optional, Tuple

from ingestion.telemetry.errors import TelemetryParseError


@dataclass(frozen=True)
class GnssSample:
    t_ns: int
    lat_deg: float
    lon_deg: float
    alt_m: Optional[float]
    speed_mps: Optional[float]


def _norm_key(name: str) -> str:
    s = name.strip().lower().replace(" ", "_").replace("-", "_")
    s = re.sub(r"[^a-z0-9_]", "", s)
    return s


def _map_headers(raw: List[str]) -> Dict[str, str]:
    """Returns norm_key -> original header."""
    return {_norm_key(h): h for h in raw if h.strip()}


def _pick_column(
    header_map: Dict[str, str],
    candidates: Tuple[str, ...],
) -> Optional[str]:
    for c in candidates:
        nk = _norm_key(c)
        if nk in header_map:
            return header_map[nk]
    return None


def _parse_float(cell: str) -> Optional[float]:
    cell = cell.strip()
    if not cell:
        return None
    try:
        return float(cell.replace(",", "."))
    except ValueError:
        return None


def _parse_time_columns(
    row: Dict[str, str],
    time_header: Optional[str],
    *,
    session_epoch_ms: int,
) -> int:
    """Return t_ns for this row."""
    if not time_header:
        raise TelemetryParseError(
            "CSV_NO_TIME_COLUMN",
            "No time column found (expected timestamp, timestamp_ms, epoch_ms, or time)",
        )
    raw = (row.get(time_header) or "").strip()
    if not raw:
        raise TelemetryParseError("CSV_NO_TIME_COLUMN", "Empty time cell")

    th = _norm_key(time_header)

    # ISO 8601
    if "t" in raw.lower() and ("-" in raw or ":" in raw):
        try:
            iso = raw.replace("Z", "+00:00")
            dt = datetime.fromisoformat(iso)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            else:
                dt = dt.astimezone(timezone.utc)
            return int(dt.timestamp() * 1_000_000_000)
        except ValueError:
            pass

    # Numeric epoch / relative ms
    try:
        v = float(raw.replace(",", "."))
    except ValueError as exc:
        raise TelemetryParseError(
            "CSV_AMBIGUOUS_TIME_FORMAT",
            f"Could not parse time value: {raw!r}",
        ) from exc

    # Heuristic: epoch ms (modern), epoch seconds, or relative ms from session start (fixtures)
    if v >= 1e12:
        return int(v * 1_000_000)
    if v >= 1e9:
        return int(v * 1_000_000_000)
    rel_ms = int(v)
    return int((session_epoch_ms + rel_ms) * 1_000_000)


def parse_csv_gnss(
    text: str,
    *,
    session_created_at: datetime,
) -> Tuple[List[GnssSample], Dict[str, Any]]:
    """
    Parse CSV text into GNSS samples.

    session_created_at: used as epoch for relative timestamp_ms columns (fixture style).
    """
    if not text or not text.strip():
        raise TelemetryParseError("CSV_EMPTY", "CSV file is empty")

    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t;")
    except csv.Error:
        dialect = csv.excel

    reader = csv.reader(StringIO(text.strip()), dialect)
    rows = list(reader)
    if not rows:
        raise TelemetryParseError("CSV_EMPTY", "CSV has no rows")

    header_row = rows[0]
    if not any(_norm_key(h) for h in header_row if h.strip()):
        raise TelemetryParseError("CSV_NO_HEADER", "CSV appears to have no header row")

    header_map = _map_headers(header_row)

    lat_h = _pick_column(
        header_map,
        ("lat", "latitude", "lat_deg", "gps_lat", "latitude_deg"),
    )
    lon_h = _pick_column(
        header_map,
        ("lon", "lng", "longitude", "lon_deg", "gps_lon", "longitude_deg"),
    )
    if not lat_h or not lon_h:
        raise TelemetryParseError(
            "CSV_NO_POSITION_COLUMNS",
            "Need latitude and longitude columns",
        )

    time_h = _pick_column(
        header_map,
        (
            "timestamp_ms",
            "timestamp",
            "time",
            "time_utc",
            "epoch_ms",
            "epoch",
            "t",
            "utc",
        ),
    )
    if not time_h:
        raise TelemetryParseError(
            "CSV_NO_TIME_COLUMN",
            "No time column found (required for Level 1 GNSS)",
        )

    alt_h = _pick_column(header_map, ("alt", "alt_m", "altitude", "ele", "elevation"))
    speed_h = _pick_column(
        header_map,
        ("speed_mps", "speed", "velocity", "speed_ms"),
    )

    if session_created_at.tzinfo is None:
        session_utc = session_created_at.replace(tzinfo=timezone.utc)
    else:
        session_utc = session_created_at.astimezone(timezone.utc)
    session_epoch_ms = int(session_utc.timestamp() * 1000)

    data_rows = rows[1:]
    if not data_rows:
        raise TelemetryParseError("CSV_NO_DATA", "CSV has no data rows")

    out: List[GnssSample] = []
    for line in data_rows:
        if not line or not any(c.strip() for c in line):
            continue
        row = dict(zip(header_row, line))
        t_ns = _parse_time_columns(row, time_h, session_epoch_ms=session_epoch_ms)
        lat = _parse_float(row.get(lat_h, ""))
        lon = _parse_float(row.get(lon_h, ""))
        if lat is None or lon is None:
            continue
        alt = _parse_float(row.get(alt_h, "")) if alt_h else None
        spd = _parse_float(row.get(speed_h, "")) if speed_h else None
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
        raise TelemetryParseError("CSV_NO_DATA", "No valid GNSS rows after parsing")

    out.sort(key=lambda s: s.t_ns)

    meta = {
        "timeColumn": time_h,
        "latColumn": lat_h,
        "lonColumn": lon_h,
        "delimiter": dialect.delimiter,
        "rowCount": len(out),
    }
    return out, meta
