"""
Auto start/finish line lap detection from GNSS (loop closure).

Heuristic: leave a radius around the first point, accumulate path length on track,
then count a lap when re-entering the start zone after sufficient distance.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List, Literal, Tuple

from ingestion.telemetry.parsers.csv_gnss import GnssSample

# ~50 m start/finish zone; GPS error tolerant
_START_ZONE_RADIUS_M = 50.0
# Minimum path before a re-entry counts as a lap (short circuits / noise)
_MIN_LAP_PATH_M = 120.0
_MIN_LAP_SAMPLES = 25


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    c = 2 * math.asin(min(1.0, math.sqrt(a)))
    return r * c


def _segment_m(a: GnssSample, b: GnssSample) -> float:
    return _haversine_m(a.lat_deg, a.lon_deg, b.lat_deg, b.lon_deg)


@dataclass(frozen=True)
class LapSpan:
    lap_number: int
    start_idx: int
    end_idx: int
    validity: Literal["VALID", "OUTLAP", "INVALID"]


def detect_laps_auto_sfl(samples: List[GnssSample]) -> Tuple[List[LapSpan], str]:
    """
    Returns lap spans (inclusive indices) and a short status string.
    """
    if len(samples) < _MIN_LAP_SAMPLES * 2:
        return [], "too_few_points"

    lat0 = samples[0].lat_deg
    lon0 = samples[0].lon_deg

    laps: List[LapSpan] = []
    phase = "seek_leave"
    path_m = 0.0
    lap_start_idx = 0
    lap_number = 0

    for i in range(1, len(samples)):
        prev = samples[i - 1]
        cur = samples[i]
        dseg = _segment_m(prev, cur)
        dist_start = _haversine_m(lat0, lon0, cur.lat_deg, cur.lon_deg)

        if phase == "seek_leave":
            if dist_start > _START_ZONE_RADIUS_M:
                phase = "on_track"
                lap_start_idx = i
                path_m = dseg
        elif phase == "on_track":
            path_m += dseg
            if (
                dist_start < _START_ZONE_RADIUS_M
                and path_m >= _MIN_LAP_PATH_M
                and (i - lap_start_idx) >= _MIN_LAP_SAMPLES
            ):
                lap_number += 1
                validity: Literal["VALID", "OUTLAP", "INVALID"] = (
                    "OUTLAP" if lap_number == 1 else "VALID"
                )
                laps.append(
                    LapSpan(
                        lap_number=lap_number,
                        start_idx=lap_start_idx,
                        end_idx=i,
                        validity=validity,
                    )
                )
                phase = "seek_leave"
                path_m = 0.0

    if not laps:
        return [], "no_closure"

    return laps, "ok"
