#!/usr/bin/env python3
"""
Download F1 circuit centre lines (GeoJSON, MIT) and emit CSV + GPX fixtures for MRE import tests.

Source: https://github.com/bacinger/f1-circuits (MIT License, Tomislav Bacinger)
Not affiliated with Formula 1. Coordinates are approximate circuit polylines, not race telemetry.

Usage (from repo root, in Docker ingestion container or local venv with urllib):
  python ingestion/scripts/build_f1_telemetry_fixtures.py

Output: ingestion/tests/fixtures/telemetry/f1-circuits/
"""

from __future__ import annotations

import json
import ssl
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Tuple
from xml.sax.saxutils import escape

# Raw URLs on GitHub (master branch)
BASE = "https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits"
CIRCUITS: List[Tuple[str, str, int]] = [
    ("mc-1929.geojson", "f1_monaco", 47),
    ("gb-1948.geojson", "f1_silverstone", 153),
    ("be-1925.geojson", "f1_spa", 401),
    ("jp-1962.geojson", "f1_suzuka", 60),
]

OUT_DIR = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "telemetry" / "f1-circuits"
INTERVAL_MS = 100  # 10 Hz synthetic sampling along the provided vertices


def fetch_json(url: str) -> dict:
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers={"User-Agent": "mre-telemetry-fixture-builder/1.0"})
    with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def linestring_coords(geojson: dict) -> List[Tuple[float, float]]:
    out: List[Tuple[float, float]] = []
    for feat in geojson.get("features") or []:
        geom = feat.get("geometry") or {}
        if geom.get("type") != "LineString":
            continue
        for c in geom.get("coordinates") or []:
            if len(c) >= 2:
                lon, lat = float(c[0]), float(c[1])
                out.append((lat, lon))
    if not out:
        raise ValueError("No LineString coordinates")
    return out


def write_csv(path: Path, coords: List[Tuple[float, float]], alt_m: float) -> None:
    lines = ["timestamp_ms,lat,lon,alt_m,speed_mps"]
    for i, (lat, lon) in enumerate(coords):
        ts = i * INTERVAL_MS
        lines.append(f"{ts},{lat:.8f},{lon:.8f},{alt_m},")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_gpx(path: Path, name: str, coords: List[Tuple[float, float]], alt_m: float) -> None:
    base = datetime(2024, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="MRE fixture (bacinger/f1-circuits GeoJSON)" '
        'xmlns="http://www.topografix.com/GPX/1/1">',
        "<trk>",
        f"<name>{escape(name)}</name>",
        "<trkseg>",
    ]
    for i, (lat, lon) in enumerate(coords):
        t = base + timedelta(milliseconds=i * INTERVAL_MS)
        iso = t.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        parts.append(
            f'<trkpt lat="{lat:.8f}" lon="{lon:.8f}">'
            f"<ele>{alt_m:.1f}</ele><time>{iso}</time></trkpt>"
        )
    parts.extend(["</trkseg>", "</trk>", "</gpx>"])
    path.write_text("\n".join(parts) + "\n", encoding="utf-8")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    readme = OUT_DIR / "README.md"
    readme.write_text(
        """# F1 circuit line fixtures (synthetic timing)

These files are **not** official F1 telemetry. They are **centre-line polylines** from
[github.com/bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT License),
converted to CSV and GPX with **synthetic** 10 Hz timestamps for **import testing** only.

| File | Circuit |
|------|---------|
| `f1_monaco_*` | Circuit de Monaco |
| `f1_silverstone_*` | Silverstone |
| `f1_spa_*` | Spa-Francorchamps |
| `f1_suzuka_*` | Suzuka |

Regenerate: `python ingestion/scripts/build_f1_telemetry_fixtures.py` (Docker: run inside `mre-liverc-ingestion-service`).
""",
        encoding="utf-8",
    )

    for geo_name, stem, alt in CIRCUITS:
        data = fetch_json(f"{BASE}/{geo_name}")
        coords = linestring_coords(data)
        write_csv(OUT_DIR / f"{stem}.csv", coords, float(alt))
        write_gpx(OUT_DIR / f"{stem}.gpx", stem.replace("_", " ").title(), coords, float(alt))
        print(f"Wrote {stem}.csv / {stem}.gpx ({len(coords)} points)")


if __name__ == "__main__":
    main()
