#!/usr/bin/env python3
"""
Build multi-lap synthetic telemetry fixtures (GNSS + synthetic IMU/heading).

Outputs CSV, JSON, GPX, NMEA, and metadata.json under
ingestion/tests/fixtures/telemetry/multi-lap-full/.

GNSS columns match existing parsers (timestamp_ms, lat, lon, alt_m, speed_mps).
Extra CSV/JSON columns (heading, accel, gyro) are for offline testing and
documentation; the current CSV parser ignores them.

NMEA is emitted at 1 Hz because the NMEA merger deduplicates by whole-second
timestamps (see nmea_gnss.py).

Usage:
  docker exec -it mre-liverc-ingestion-service python \\
    /app/ingestion/scripts/build_multi_lap_full_telemetry_fixtures.py
"""

from __future__ import annotations

import importlib.util
import json
import math
import random
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple
from xml.etree import ElementTree as ET

G = 9.80665


def _load_gen_seed():
    here = Path(__file__).resolve().parent
    p = here / "generate-telemetry-seed.py"
    spec = importlib.util.spec_from_file_location("gen_telemetry_seed", p)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    return mod


def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    φ1 = math.radians(lat1)
    φ2 = math.radians(lat2)
    Δλ = math.radians(lon2 - lon1)
    y = math.sin(Δλ) * math.cos(φ2)
    x = math.cos(φ1) * math.sin(φ2) - math.sin(φ1) * math.cos(φ2) * math.cos(Δλ)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def unwrap_delta_deg(prev: float, cur: float) -> float:
    d = (cur - prev + 180.0) % 360.0 - 180.0
    return d


def lat_to_nmea(lat_deg: float) -> Tuple[str, str]:
    hem = "S" if lat_deg < 0 else "N"
    lat = abs(lat_deg)
    d = int(lat)
    minutes = (lat - d) * 60.0
    return f"{d:02d}{minutes:07.4f}", hem


def lon_to_nmea(lon_deg: float) -> Tuple[str, str]:
    hem = "W" if lon_deg < 0 else "E"
    lon = abs(lon_deg)
    d = int(lon)
    minutes = (lon - d) * 60.0
    return f"{d:03d}{minutes:07.4f}", hem


def nmea_checksum(body_after_dollar: str) -> str:
    xor = 0
    for ch in body_after_dollar:
        xor ^= ord(ch)
    return f"{xor:02X}"


def build_rmc_gga(
    t: datetime,
    lat: float,
    lon: float,
    speed_mps: float,
    course_deg: float,
    alt_m: float,
) -> Tuple[str, str]:
    utc = t.astimezone(timezone.utc)
    hhmmss = utc.strftime("%H%M%S.%f")[:-3]
    dmy = utc.strftime("%d%m%y")
    lat_s, lat_h = lat_to_nmea(lat)
    lon_s, lon_h = lon_to_nmea(lon)
    spd_kn = speed_mps / 0.514444
    rmc_core = (
        f"GPRMC,{hhmmss},A,{lat_s},{lat_h},{lon_s},{lon_h},"
        f"{spd_kn:.1f},{course_deg:.1f},{dmy},003.1,W"
    )
    rmc = "$" + rmc_core + "*" + nmea_checksum(rmc_core)
    gga_core = (
        f"GPGGA,{hhmmss},{lat_s},{lat_h},{lon_s},{lon_h},"
        f"1,08,0.9,{alt_m:.1f},M,46.9,M,,"
    )
    gga = "$" + gga_core + "*" + nmea_checksum(gga_core)
    return rmc, gga


@dataclass
class RichSample:
    timestamp_ms: int
    lat: float
    lon: float
    alt_m: float
    speed_mps: float
    heading_deg: float
    ax_mps2: float
    ay_mps2: float
    az_mps2: float
    gx_rads: float
    gy_rads: float
    gz_rads: float
    hdop: float
    fix_quality: int


def enrich_samples(
    raw: List[Dict[str, Any]],
    dt_s: float,
    rng: random.Random,
    base_alt_m: float,
) -> List[RichSample]:
    n = len(raw)
    headings: List[float] = []
    for i in range(n):
        if i == 0:
            h = bearing_deg(
                raw[i]["lat"],
                raw[i]["lon"],
                raw[i + 1]["lat"],
                raw[i + 1]["lon"],
            )
        elif i == n - 1:
            h = bearing_deg(
                raw[i - 1]["lat"],
                raw[i - 1]["lon"],
                raw[i]["lat"],
                raw[i]["lon"],
            )
        else:
            h = bearing_deg(
                raw[i - 1]["lat"],
                raw[i - 1]["lon"],
                raw[i + 1]["lat"],
                raw[i + 1]["lon"],
            )
        headings.append(h)

    out: List[RichSample] = []
    prev_h = headings[0]
    prev_v = raw[0]["speed_mps"]

    for i in range(n):
        t_ms = int(raw[i]["timestamp_ms"])
        lat = float(raw[i]["lat"])
        lon = float(raw[i]["lon"])
        spd = float(raw[i]["speed_mps"])
        h = headings[i]
        dist_along = i * spd * dt_s  # approx for elevation ripple
        alt = base_alt_m + 2.0 * math.sin(dist_along * 0.02) + rng.gauss(0, 0.05)

        dh = unwrap_delta_deg(prev_h, h) if i > 0 else 0.0
        yaw_rads = math.radians(dh) / dt_s if i > 0 else 0.0
        dv = (spd - prev_v) / dt_s if i > 0 else 0.0

        # Body-frame style: x forward, y left, z up (simplified bicycle)
        ax = dv + rng.gauss(0, 0.15)
        ay = spd * yaw_rads + rng.gauss(0, 0.2)
        az = G + rng.gauss(0, 0.1)
        gx = rng.gauss(0, 0.02)
        gy = rng.gauss(0, 0.02)
        gz = yaw_rads + rng.gauss(0, 0.02)

        out.append(
            RichSample(
                timestamp_ms=t_ms,
                lat=lat,
                lon=lon,
                alt_m=round(alt, 3),
                speed_mps=round(spd, 4),
                heading_deg=round(h, 3),
                ax_mps2=round(ax, 4),
                ay_mps2=round(ay, 4),
                az_mps2=round(az, 4),
                gx_rads=round(gx, 5),
                gy_rads=round(gy, 5),
                gz_rads=round(gz, 5),
                hdop=0.9,
                fix_quality=1,
            )
        )
        prev_h = h
        prev_v = spd

    return out


def write_csv(path: Path, samples: List[RichSample]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    headers = (
        "timestamp_ms,lat,lon,alt_m,speed_mps,heading_deg,"
        "ax_mps2,ay_mps2,az_mps2,gx_rads,gy_rads,gz_rads,hdop,fix_quality\n"
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(headers)
        for s in samples:
            f.write(
                f"{s.timestamp_ms},{s.lat:.8f},{s.lon:.8f},{s.alt_m:.3f},{s.speed_mps},"
                f"{s.heading_deg},{s.ax_mps2},{s.ay_mps2},{s.az_mps2},"
                f"{s.gx_rads},{s.gy_rads},{s.gz_rads},{s.hdop},{s.fix_quality}\n"
            )


def write_json(path: Path, samples: List[RichSample]) -> None:
    arr = []
    for s in samples:
        arr.append(
            {
                "timestamp_ms": s.timestamp_ms,
                "lat": s.lat,
                "lon": s.lon,
                "alt_m": s.alt_m,
                "speed_mps": s.speed_mps,
                "heading_deg": s.heading_deg,
                "ax_mps2": s.ax_mps2,
                "ay_mps2": s.ay_mps2,
                "az_mps2": s.az_mps2,
                "gx_rads": s.gx_rads,
                "gy_rads": s.gy_rads,
                "gz_rads": s.gz_rads,
                "hdop": s.hdop,
                "fix_quality": s.fix_quality,
            }
        )
    with open(path, "w", encoding="utf-8") as f:
        json.dump(arr, f, indent=2)
        f.write("\n")


def write_gpx(path: Path, samples: List[RichSample], base_utc: datetime) -> None:
    gpx_ns = "http://www.topografix.com/GPX/1/1"
    root = ET.Element(f"{{{gpx_ns}}}gpx", version="1.1", creator="MRE multi-lap fixture")
    trk = ET.SubElement(root, f"{{{gpx_ns}}}trk")
    ET.SubElement(trk, f"{{{gpx_ns}}}name").text = "Synthetic multi-lap (cormcc)"
    seg = ET.SubElement(trk, f"{{{gpx_ns}}}trkseg")
    for s in samples:
        pt = ET.SubElement(
            seg,
            f"{{{gpx_ns}}}trkpt",
            lat=f"{s.lat:.8f}",
            lon=f"{s.lon:.8f}",
        )
        ET.SubElement(pt, f"{{{gpx_ns}}}ele").text = f"{s.alt_m:.3f}"
        t = base_utc + timedelta(milliseconds=s.timestamp_ms)
        iso = t.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        ET.SubElement(pt, f"{{{gpx_ns}}}time").text = iso
    tree = ET.ElementTree(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    tree.write(path, encoding="utf-8", xml_declaration=True)


def write_nmea_1hz(
    path: Path,
    samples: List[RichSample],
    base_utc: datetime,
) -> None:
    """One RMC+GGA pair per second — matches parser second-resolution merge."""
    path.parent.mkdir(parents=True, exist_ok=True)
    lines: List[str] = []
    # samples are 10 Hz, dt 100 ms -> one pair per second
    stride = 10
    for i in range(0, len(samples), stride):
        s = samples[i]
        t = base_utc + timedelta(milliseconds=s.timestamp_ms)
        rmc, gga = build_rmc_gga(
            t,
            s.lat,
            s.lon,
            s.speed_mps,
            s.heading_deg,
            s.alt_m,
        )
        lines.append(rmc)
        lines.append(gga)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main() -> int:
    repo = Path(__file__).resolve().parents[2]
    out_dir = repo / "ingestion" / "tests" / "fixtures" / "telemetry" / "multi-lap-full"
    kml = (
        repo
        / "ingestion"
        / "tests"
        / "fixtures"
        / "telemetry"
        / "track-templates"
        / "cormcc.kml"
    )
    if not kml.exists():
        print(f"Missing KML: {kml}", file=sys.stderr)
        return 1

    gen = _load_gen_seed()
    rng = random.Random(42)
    points = gen.parse_kml_racing_line(kml)
    cumdist = gen.cumulative_distances(points)
    resampled = gen.resample_path(points, cumdist, spacing_m=1.0)
    total_dist = resampled[-1][2]

    num_laps = 5
    sample_hz = 10.0
    raw, lap_boundaries = gen.generate_session(
        resampled,
        rng,
        num_laps=num_laps,
        sample_hz=sample_hz,
        base_speed_mps=12.0,
        lateral_jitter_m=0.25,
    )

    dt_ms = int(1000 / sample_hz)
    dt_s = 1.0 / sample_hz
    base_alt = 580.0
    rich = enrich_samples(raw, dt_s, rng, base_alt)

    base_utc = datetime(2026, 6, 1, 12, 0, 0, tzinfo=timezone.utc)

    lap_times_ms: List[int] = []
    for i in range(len(lap_boundaries) - 1):
        n = lap_boundaries[i + 1] - lap_boundaries[i]
        lap_times_ms.append(n * dt_ms)

    meta = {
        "fixture_version": 1,
        "source": "synthetic_multi_lap_full",
        "track_template": "track-templates/cormcc.kml",
        "seed": 42,
        "laps": num_laps,
        "sample_hz": sample_hz,
        "session_start_utc_iso": base_utc.isoformat().replace("+00:00", "Z"),
        "ground_truth": {
            "lap_times_ms": lap_times_ms,
            "lap_boundaries_sample_idx": lap_boundaries[:-1],
            "total_distance_m": round(float(total_dist), 2),
            "row_count": len(rich),
        },
        "files": {
            "session_full.csv": "GNSS + synthetic IMU columns (parser uses GNSS columns only)",
            "session_full.json": "Same data as JSON array",
            "session_full.gpx": "GPX 1.1 track, times from session_start + timestamp_ms",
            "session_full_1hz.nmea": "GPRMC+GPGGA at 1 Hz (NMEA parser merges by second)",
        },
    }

    write_csv(out_dir / "session_full.csv", rich)
    write_json(out_dir / "session_full.json", rich)
    write_gpx(out_dir / "session_full.gpx", rich, base_utc)
    write_nmea_1hz(out_dir / "session_full_1hz.nmea", rich, base_utc)

    with open(out_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
        f.write("\n")

    print(f"Wrote {len(rich)} samples to {out_dir}")
    print(f"Laps: {num_laps}, lap times (ms): {lap_times_ms}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
