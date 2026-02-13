#!/usr/bin/env python3
"""
Generate synthetic telemetry seed data from a KML track template.

Reads a KML file (polygon boundary = racing line), resamples the path at uniform
spacing, simulates laps with speed variation by curvature, and outputs CSV plus
metadata.json. Deterministic given --seed.

Usage:
  python -m ingestion.scripts.generate-telemetry-seed \\
    --track ingestion/tests/fixtures/telemetry/track-templates/cormcc.kml \\
    --output ingestion/tests/fixtures/telemetry/synth/pack-a/cormcc-clean-position-only \\
    --laps 10 --seed 42

See docs/telemetry/Design/Telemetry_Seed_Data_Guide.md for fixture layout.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

# KML namespaces
KML_NS = "{http://www.opengis.net/kml/2.2}"
GX_NS = "{http://www.google.com/kml/ext/2.2}"

# Approx meters per degree at this latitude (Canberra ~-35.3)
M_PER_DEG_LAT = 110574.0
M_PER_DEG_LON_AT_35S = 110574.0 * math.cos(math.radians(35.3))


def parse_kml_racing_line(kml_path: Path) -> list[tuple[float, float]]:
    """Extract (lat, lon) points from KML Polygon outer boundary (racing line)."""
    tree = ET.parse(kml_path)
    root = tree.getroot()
    coords_elem = root.find(f".//{KML_NS}coordinates")
    if coords_elem is None or coords_elem.text is None:
        raise ValueError(f"No coordinates found in {kml_path}")
    points: list[tuple[float, float]] = []
    for line in coords_elem.text.strip().split():
        parts = line.split(",")
        if len(parts) >= 2:
            lon, lat = float(parts[0]), float(parts[1])
            points.append((lat, lon))
    # Drop duplicate closing point if present
    if len(points) >= 2 and points[0] == points[-1]:
        points = points[:-1]
    return points


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Approximate distance in meters between two WGS84 points."""
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    return 6371000 * c


def cumulative_distances(points: list[tuple[float, float]]) -> list[float]:
    """Cumulative distance along path in meters."""
    dists = [0.0]
    for i in range(1, len(points)):
        d = haversine_m(
            points[i - 1][0], points[i - 1][1],
            points[i][0], points[i][1],
        )
        dists.append(dists[-1] + d)
    return dists


def resample_path(
    points: list[tuple[float, float]],
    cumdist: list[float],
    spacing_m: float,
) -> list[tuple[float, float, float]]:
    """Resample path at uniform spacing. Returns (lat, lon, distance_m) per point."""
    total = cumdist[-1]
    n = max(2, int(total / spacing_m))
    target_dists = [total * i / n for i in range(n)] + [total]
    out: list[tuple[float, float, float]] = []
    for td in target_dists:
        if td >= total:
            td = total
        # Find segment
        i = 0
        while i < len(cumdist) - 1 and cumdist[i + 1] < td:
            i += 1
        if i >= len(cumdist) - 1:
            out.append((points[-1][0], points[-1][1], total))
            continue
        # Linear interpolate
        t = (td - cumdist[i]) / (cumdist[i + 1] - cumdist[i]) if cumdist[i + 1] > cumdist[i] else 0
        lat = points[i][0] + t * (points[i + 1][0] - points[i][0])
        lon = points[i][1] + t * (points[i + 1][1] - points[i][1])
        out.append((lat, lon, td))
    return out


def curvature_at(resampled: list[tuple[float, float, float]], idx: int) -> float:
    """Approximate curvature (heading change rate) at index."""
    n = len(resampled)
    if idx <= 0 or idx >= n - 1:
        return 0.0
    p0, p1, p2 = resampled[idx - 1], resampled[idx], resampled[idx + 1]
    # Heading from p0 to p1
    h1 = math.atan2(
        (p1[1] - p0[1]) * M_PER_DEG_LON_AT_35S,
        (p1[0] - p0[0]) * M_PER_DEG_LAT,
    )
    h2 = math.atan2(
        (p2[1] - p1[1]) * M_PER_DEG_LON_AT_35S,
        (p2[0] - p1[0]) * M_PER_DEG_LAT,
    )
    d = haversine_m(p0[0], p0[1], p2[0], p2[1])
    if d < 0.1:
        return 0.0
    dh = abs((h2 - h1 + math.pi) % (2 * math.pi) - math.pi)
    return dh / (d / 2)


def interpolate_at_dist(
    resampled: list[tuple[float, float, float]],
    dist: float,
) -> tuple[float, float, int]:
    """Interpolate (lat, lon) at distance along path. Returns (lat, lon, seg_idx)."""
    total = resampled[-1][2]
    d = dist % total if total > 0 else 0
    for i in range(len(resampled) - 1):
        d0, d1 = resampled[i][2], resampled[i + 1][2]
        if d0 <= d <= d1:
            t = (d - d0) / (d1 - d0) if d1 > d0 else 0
            lat = resampled[i][0] + t * (resampled[i + 1][0] - resampled[i][0])
            lon = resampled[i][1] + t * (resampled[i + 1][1] - resampled[i][1])
            return (lat, lon, i)
    return (resampled[-1][0], resampled[-1][1], len(resampled) - 1)


def generate_session(
    resampled: list[tuple[float, float, float]],
    rng: random.Random,
    *,
    num_laps: int = 10,
    sample_hz: float = 10.0,
    base_speed_mps: float = 12.0,
    lateral_jitter_m: float = 0.3,
) -> tuple[list[dict], list[int]]:
    """Generate lap samples. Returns (samples, lap_boundary_sample_indices)."""
    total_dist = resampled[-1][2]
    dt_ms = int(1000 / sample_hz)
    dt_s = 1.0 / sample_hz
    samples: list[dict] = []
    lap_boundaries: list[int] = [0]
    t_ms = 0
    sample_idx = 0
    curvs = [curvature_at(resampled, i) for i in range(len(resampled))]
    max_curv = max(curvs) if curvs else 1.0

    for _ in range(num_laps):
        lap_factor = 0.98 + rng.uniform(0, 0.04)  # 0–4% lap time variation
        dist_along = 0.0

        while dist_along < total_dist:
            lat, lon, seg_idx = interpolate_at_dist(resampled, dist_along)
            curv = curvs[min(seg_idx, len(curvs) - 1)]
            speed_factor = 1.0 - 0.4 * (curv / max_curv)
            speed = base_speed_mps * lap_factor * max(0.5, speed_factor)
            if lateral_jitter_m > 0:
                perp = rng.gauss(0, lateral_jitter_m)
                lat += perp / M_PER_DEG_LAT
                lon += perp / M_PER_DEG_LON_AT_35S
            samples.append({
                "timestamp_ms": t_ms,
                "lat": round(lat, 8),
                "lon": round(lon, 8),
                "speed_mps": round(speed, 3),
            })
            t_ms += dt_ms
            sample_idx += 1
            dist_along += speed * dt_s

        lap_boundaries.append(sample_idx)

    return samples, lap_boundaries


def write_csv(samples: list[dict], out_path: Path) -> None:
    """Write CSV with header timestamp_ms,lat,lon,speed_mps."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        f.write("timestamp_ms,lat,lon,speed_mps\n")
        for s in samples:
            f.write(f"{s['timestamp_ms']},{s['lat']},{s['lon']},{s['speed_mps']}\n")


def write_metadata(
    out_path: Path,
    *,
    dataset_id: str,
    seed: int,
    laps_expected: int,
    capability_profile: str,
    ground_truth: dict,
    notes: str,
) -> None:
    """Write metadata.json fixture descriptor."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    meta = {
        "fixture_version": 1,
        "source": "synthetic",
        "dataset_id": dataset_id,
        "seed": seed,
        "laps_expected": laps_expected,
        "capability_profile": capability_profile,
        "ground_truth": ground_truth,
        "notes": notes,
    }
    with open(out_path, "w") as f:
        json.dump(meta, f, indent=2)
        f.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate synthetic telemetry seed data from KML track.",
    )
    parser.add_argument(
        "--track",
        type=Path,
        required=True,
        help="Path to KML file (polygon = racing line)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output directory for session.csv and metadata.json",
    )
    parser.add_argument("--laps", type=int, default=10, help="Number of laps")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument(
        "--capability",
        default="position-only",
        help="Capability profile (position-only, 3-axis, 6-axis, 9-axis)",
    )
    parser.add_argument(
        "--dataset-id",
        default=None,
        help="Dataset ID (default: derived from output dir name)",
    )
    parser.add_argument(
        "--spacing",
        type=float,
        default=1.0,
        help="Resample spacing along path (m)",
    )
    parser.add_argument(
        "--sample-hz",
        type=float,
        default=10.0,
        help="Sample rate (Hz)",
    )
    parser.add_argument(
        "--base-speed",
        type=float,
        default=12.0,
        help="Base speed m/s",
    )
    parser.add_argument(
        "--lateral-jitter",
        type=float,
        default=0.3,
        help="Lateral jitter std dev (m), 0 to disable",
    )
    args = parser.parse_args()

    if not args.track.exists():
        print(f"Error: track file not found: {args.track}", file=sys.stderr)
        return 1

    rng = random.Random(args.seed)
    points = parse_kml_racing_line(args.track)
    cumdist = cumulative_distances(points)
    resampled = resample_path(points, cumdist, args.spacing)
    total_dist = resampled[-1][2]
    samples, lap_boundaries = generate_session(
        resampled,
        rng,
        num_laps=args.laps,
        sample_hz=args.sample_hz,
        base_speed_mps=args.base_speed,
        lateral_jitter_m=args.lateral_jitter,
    )

    dataset_id = args.dataset_id or args.output.name
    lap_times_ms: list[int] = []
    dt_ms = int(1000 / args.sample_hz)
    for i in range(len(lap_boundaries) - 1):
        n = lap_boundaries[i + 1] - lap_boundaries[i]
        lap_times_ms.append(n * dt_ms)
    ground_truth = {
        "lap_times_ms": lap_times_ms,
        "lap_boundaries_sample_idx": lap_boundaries[:-1],
        "total_distance_m": round(total_dist, 2),
        "track_name": args.track.stem,
    }

    csv_path = args.output / "session.csv"
    meta_path = args.output / "metadata.json"
    write_csv(samples, csv_path)
    write_metadata(
        meta_path,
        dataset_id=dataset_id,
        seed=args.seed,
        laps_expected=args.laps,
        capability_profile=args.capability,
        ground_truth=ground_truth,
        notes=f"Generated from {args.track.name}. Clean position-only session.",
    )
    print(f"Wrote {len(samples)} samples to {csv_path}")
    print(f"Wrote metadata to {meta_path}")
    print(f"Laps: {args.laps}, lap times (ms): {lap_times_ms[:5]}{'...' if len(lap_times_ms) > 5 else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
