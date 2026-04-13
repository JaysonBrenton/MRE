"""
NMEA 0183 GNSS parser (Level 1).

Parses RMC (time, date, position, speed) and GGA (time, position, altitude)
sentences into canonical GNSS samples.

@see docs/telemetry/Design/Supported Formats and Parser Specification.md §5.1
"""

from __future__ import annotations

from dataclasses import replace
from datetime import date, datetime, time, timezone
from typing import Any, Dict, List, Optional, Tuple

from ingestion.telemetry.errors import TelemetryParseError
from ingestion.telemetry.parsers.csv_gnss import GnssSample

_KNOTS_TO_MPS = 0.514444


def _parse_float(cell: str) -> Optional[float]:
    cell = cell.strip()
    if not cell:
        return None
    try:
        return float(cell.replace(",", "."))
    except ValueError:
        return None


def _verify_checksum(line: str) -> bool:
    """Validate NMEA *HH checksum when present; accept lines without *."""
    if "*" not in line:
        return True
    body, rest = line.rsplit("*", 1)
    rest = rest.strip()
    if len(rest) < 2:
        return True
    try:
        expected = int(rest[:2], 16)
    except ValueError:
        return False
    if not body.startswith("$"):
        return False
    xor = 0
    for ch in body[1:]:
        xor ^= ord(ch)
    return xor == expected


def _split_sentence(line: str) -> List[str]:
    line = line.strip()
    if not line.startswith("$"):
        return []
    if "*" in line:
        line = line.split("*")[0]
    return line.split(",")


def _sentence_kind(field0: str) -> Optional[str]:
    if len(field0) < 4:
        return None
    tail = field0[1:]
    if "GGA" in tail:
        return "GGA"
    if "RMC" in tail:
        return "RMC"
    return None


def _parse_coord(coord: str, hemi: str) -> Optional[float]:
    if not coord or not hemi:
        return None
    try:
        v = float(coord)
    except ValueError:
        return None
    deg = int(v // 100)
    mins = v - deg * 100
    value = deg + mins / 60.0
    if hemi in ("S", "W"):
        value = -value
    elif hemi not in ("N", "E"):
        return None
    return value


def _parse_hhmmss_sss(s: str) -> Optional[Tuple[int, int, float]]:
    s = s.strip()
    if len(s) < 6:
        return None
    try:
        hh = int(s[0:2])
        mm = int(s[2:4])
        sec = float(s[4:])
    except ValueError:
        return None
    return hh, mm, sec


def _parse_ddmmyy(s: str) -> Optional[date]:
    s = s.strip()
    if len(s) != 6 or not s.isdigit():
        return None
    dd = int(s[0:2])
    mm = int(s[2:4])
    yy = int(s[4:6])
    year = 2000 + yy if yy < 80 else 1900 + yy
    try:
        return date(year, mm, dd)
    except ValueError:
        return None


def _combine_utc(d: date, hh: int, mm: int, sec: float) -> int:
    sec_i = int(sec)
    micro = int(round((sec - sec_i) * 1_000_000))
    t = time(hh, mm, sec_i, micro, tzinfo=timezone.utc)
    dt = datetime.combine(d, t, tzinfo=timezone.utc)
    return int(dt.timestamp() * 1_000_000_000)


def _session_fallback_date(session_created_at: datetime) -> date:
    if session_created_at.tzinfo is None:
        u = session_created_at.replace(tzinfo=timezone.utc)
    else:
        u = session_created_at.astimezone(timezone.utc)
    return u.date()


def parse_nmea_gnss(
    text: str,
    *,
    session_created_at: datetime,
) -> Tuple[List[GnssSample], Dict[str, Any]]:
    """
    Parse NMEA 0183 text into GNSS samples.

    Uses GPRMC/GNRMC for full UTC when date is present; merges GGA altitude.
    GGA-only points use the date from the last preceding RMC, or the session
    calendar day (UTC) when no RMC date is available.
    """
    if not text or not text.strip():
        raise TelemetryParseError("NMEA_EMPTY", "NMEA file is empty")

    rmc_rows: List[GnssSample] = []
    gga_rows: List[GnssSample] = []
    last_date: Optional[date] = None
    rmc_count = 0
    gga_count = 0
    skipped_checksum = 0

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if not line.startswith("$"):
            continue
        if not _verify_checksum(line):
            skipped_checksum += 1
            continue

        parts = _split_sentence(line)
        if len(parts) < 2:
            continue
        kind = _sentence_kind(parts[0])
        if kind == "RMC":
            rmc_count += 1
            # $..RMC,time,status,lat,N,lon,E,speed_kn,course,date,...
            if len(parts) < 10:
                continue
            status = (parts[2] or "").strip()
            if status != "A":
                continue
            tpart = _parse_hhmmss_sss(parts[1])
            if tpart is None:
                continue
            hh, mm, sec = tpart
            lat = _parse_coord(parts[3], parts[4])
            lon = _parse_coord(parts[5], parts[6])
            if lat is None or lon is None:
                continue
            spd_kn = _parse_float(parts[7]) if len(parts) > 7 else None
            spd_mps = spd_kn * _KNOTS_TO_MPS if spd_kn is not None else None
            d = _parse_ddmmyy(parts[9] or "")
            if d is not None:
                last_date = d
            else:
                d = last_date or _session_fallback_date(session_created_at)
            t_ns = _combine_utc(d, hh, mm, sec)
            rmc_rows.append(
                GnssSample(
                    t_ns=t_ns,
                    lat_deg=lat,
                    lon_deg=lon,
                    alt_m=None,
                    speed_mps=spd_mps,
                )
            )
        elif kind == "GGA":
            gga_count += 1
            # $..GGA,time,lat,N,lon,E,quality,sats,hdop,alt,M,geoid,M,...
            if len(parts) < 10:
                continue
            qual = (parts[6] or "").strip()
            if not qual or qual == "0":
                continue
            tpart = _parse_hhmmss_sss(parts[1])
            if tpart is None:
                continue
            hh, mm, sec = tpart
            lat = _parse_coord(parts[2], parts[3])
            lon = _parse_coord(parts[4], parts[5])
            if lat is None or lon is None:
                continue
            alt = _parse_float(parts[9]) if len(parts) > 9 else None
            d = last_date or _session_fallback_date(session_created_at)
            t_ns = _combine_utc(d, hh, mm, sec)
            gga_rows.append(
                GnssSample(
                    t_ns=t_ns,
                    lat_deg=lat,
                    lon_deg=lon,
                    alt_m=alt,
                    speed_mps=None,
                )
            )

    if not rmc_rows and not gga_rows:
        raise TelemetryParseError(
            "NMEA_NO_FIX",
            "No valid RMC or GGA sentences with a position fix",
        )

    by_sec: Dict[int, GnssSample] = {}

    def sec_key(t_ns: int) -> int:
        return t_ns // 1_000_000_000

    for s in rmc_rows:
        k = sec_key(s.t_ns)
        by_sec[k] = s

    for g in gga_rows:
        k = sec_key(g.t_ns)
        if k in by_sec:
            cur = by_sec[k]
            if g.alt_m is not None:
                by_sec[k] = replace(cur, alt_m=g.alt_m)
        else:
            by_sec[k] = g

    out = sorted(by_sec.values(), key=lambda x: x.t_ns)
    if not out:
        raise TelemetryParseError(
            "NMEA_NO_FIX",
            "No valid GNSS samples after merging NMEA sentences",
        )

    meta: Dict[str, Any] = {
        "rowCount": len(out),
        "format": "nmea_0183",
        "rmcSentencesSeen": rmc_count,
        "ggaSentencesSeen": gga_count,
        "skippedBadChecksum": skipped_checksum,
    }
    return out, meta


def looks_like_nmea_text(sample: str) -> bool:
    """Heuristic: first lines look like NMEA GNSS sentences."""
    for line in sample.splitlines()[:80]:
        line = line.strip()
        if not line.startswith("$"):
            continue
        if "GGA" in line or "RMC" in line:
            return True
    return False
