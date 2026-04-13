"""Lap detection via start/finish line crossing and orchestration."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, List, Literal, Tuple

from ingestion.telemetry.lap_detection import LapSpan, detect_laps_auto_sfl
from ingestion.telemetry.parsers.csv_gnss import GnssSample


def _ll_to_xy(lat: float, lon: float, lat0: float, lon0: float) -> Tuple[float, float]:
    r = 6371000.0
    x = r * math.radians(lon - lon0) * math.cos(math.radians(lat0))
    y = r * math.radians(lat - lat0)
    return x, y


def detect_laps_line_crossing(
    samples: List[GnssSample],
    sfl_a: Tuple[float, float],
    sfl_b: Tuple[float, float],
    *,
    min_lap_path_m: float = 120.0,
    min_lap_samples: int = 25,
) -> Tuple[List[LapSpan], str]:
    """
    sfl_a/sfl_b are (lat, lon). Uses sign change across the SFL segment as crossing.
    """
    if len(samples) < min_lap_samples * 2:
        return [], "too_few_points"
    lat0 = samples[0].lat_deg
    lon0 = samples[0].lon_deg
    ax, ay = _ll_to_xy(sfl_a[0], sfl_a[1], lat0, lon0)
    bx, by = _ll_to_xy(sfl_b[0], sfl_b[1], lat0, lon0)
    dx, dy = bx - ax, by - ay

    def side(px: float, py: float) -> float:
        return dx * (py - ay) - dy * (px - ax)

    laps: List[LapSpan] = []
    p0x, p0y = _ll_to_xy(samples[0].lat_deg, samples[0].lon_deg, lat0, lon0)
    prev_s = side(p0x, p0y)
    path_m = 0.0
    lap_start_idx = 0
    lap_number = 0
    last_side = prev_s

    for i in range(1, len(samples)):
        px, py = _ll_to_xy(samples[i - 1].lat_deg, samples[i - 1].lon_deg, lat0, lon0)
        cx, cy = _ll_to_xy(samples[i].lat_deg, samples[i].lon_deg, lat0, lon0)
        path_m += math.hypot(cx - px, cy - py)
        s = side(cx, cy)
        if last_side != 0 and s != 0 and last_side * s < 0 and path_m >= min_lap_path_m and (i - lap_start_idx) >= min_lap_samples:
            lap_number += 1
            validity: Literal["VALID", "OUTLAP", "INVALID"] = "OUTLAP" if lap_number == 1 else "VALID"
            laps.append(
                LapSpan(
                    lap_number=lap_number,
                    start_idx=lap_start_idx,
                    end_idx=i,
                    validity=validity,
                )
            )
            lap_start_idx = i
            path_m = 0.0
        last_side = s if s != 0 else last_side

    if not laps:
        return [], "no_closure"
    return laps, "ok"


def detect_laps(
    samples: List[GnssSample],
    *,
    user_sfl_geojson: Any = None,
    track_sfl_geojson: Any = None,
) -> Tuple[List[LapSpan], str, str]:
    """
    Priority: user GeoJSON LineString > track catalogue GeoJSON > auto loop closure.
    """
    from ingestion.telemetry.geojson_sfl import parse_sfl_segment_from_geojson

    seg = parse_sfl_segment_from_geojson(user_sfl_geojson)
    if seg:
        a, b = seg
        laps, st = detect_laps_line_crossing(samples, a, b)
        return laps, st, "user_line"
    seg = parse_sfl_segment_from_geojson(track_sfl_geojson)
    if seg:
        a, b = seg
        laps, st = detect_laps_line_crossing(samples, a, b)
        return laps, st, "track_line"
    laps, st = detect_laps_auto_sfl(samples)
    return laps, st, "auto_loop"


@dataclass(frozen=True)
class LapDetectorVersions:
    line: str = "line-crossing-0.2.0"
    auto: str = "auto-sfl-0.1.0"


def version_for_method(method: str) -> str:
    if method in ("user_line", "track_line"):
        return LapDetectorVersions().line
    return LapDetectorVersions().auto
