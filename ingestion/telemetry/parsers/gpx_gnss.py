"""
GPX 1.1 track parser (Level 1 GNSS).

@see docs/telemetry/Design/Supported Formats and Parser Specification.md §12.2
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from ingestion.telemetry.errors import TelemetryParseError
from ingestion.telemetry.parsers.csv_gnss import GnssSample


def _findall_trkpt(root: ET.Element) -> List[ET.Element]:
    # Default namespace handling: strip or use *
    pts: List[ET.Element] = []
    for trk in root.iter():
        tag = trk.tag.split("}")[-1] if "}" in trk.tag else trk.tag
        if tag == "trkpt":
            pts.append(trk)
    return pts


def _parse_iso_time(text: str) -> int:
    text = text.strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError as exc:
        raise TelemetryParseError(
            "GPX_BAD_TIMESTAMP",
            f"Invalid GPX time: {text!r}",
        ) from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    return int(dt.timestamp() * 1_000_000_000)


def parse_gpx_gnss(xml_bytes: bytes) -> Tuple[List[GnssSample], Dict[str, Any]]:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        raise TelemetryParseError("GPX_PARSE_ERROR", f"Invalid XML: {exc}") from exc

    tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag
    if tag.lower() != "gpx":
        raise TelemetryParseError("GPX_NOT_GPX", "Root element is not gpx")

    trkpts = _findall_trkpt(root)
    if not trkpts:
        raise TelemetryParseError("GPX_NO_TRACKPOINTS", "No trkpt elements found")

    out: List[GnssSample] = []
    missing_time = False
    for pt in trkpts:
        lat_s = pt.get("lat")
        lon_s = pt.get("lon")
        if lat_s is None or lon_s is None:
            continue
        try:
            lat = float(lat_s)
            lon = float(lon_s)
        except ValueError:
            continue

        ele_el = None
        time_el = None
        for ch in pt:
            ctag = ch.tag.split("}")[-1] if "}" in ch.tag else ch.tag
            if ctag == "ele":
                ele_el = ch
            elif ctag == "time":
                time_el = ch

        alt: float | None = None
        if ele_el is not None and ele_el.text and ele_el.text.strip():
            try:
                alt = float(ele_el.text.strip().replace(",", "."))
            except ValueError:
                alt = None

        if time_el is None or not (time_el.text or "").strip():
            missing_time = True
            continue

        t_ns = _parse_iso_time(time_el.text or "")
        out.append(
            GnssSample(
                t_ns=t_ns,
                lat_deg=lat,
                lon_deg=lon,
                alt_m=alt,
                speed_mps=None,
            )
        )

    if missing_time and not out:
        raise TelemetryParseError(
            "GPX_MISSING_TIME",
            "Trackpoints are missing <time> elements",
        )

    if not out:
        raise TelemetryParseError(
            "GPX_NO_VALID_POINTS",
            "No trackpoints with lat, lon, and time",
        )

    out.sort(key=lambda s: s.t_ns)
    meta = {"rowCount": len(out), "format": "gpx_1_1"}
    return out, meta
