"""Heuristic corner / segment detection from GNSS path (curvature peaks)."""

from __future__ import annotations

import math
from typing import Any, Dict, List

from ingestion.telemetry.parsers.csv_gnss import GnssSample


def _bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    y = math.sin(math.radians(lon2 - lon1)) * math.cos(math.radians(lat2))
    x = math.cos(math.radians(lat1)) * math.sin(math.radians(lat2)) - math.sin(math.radians(lat1)) * math.cos(
        math.radians(lat2)
    ) * math.cos(math.radians(lon2 - lon1))
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def detect_segments_corners(samples: List[GnssSample], *, window: int = 5) -> List[Dict[str, Any]]:
    """
    Labels segments as straight vs corner from heading-rate magnitude (deg/s).
    """
    if len(samples) < window * 4:
        return []

    headings: List[float] = []
    for i in range(1, len(samples)):
        headings.append(
            _bearing_deg(
                samples[i - 1].lat_deg,
                samples[i - 1].lon_deg,
                samples[i].lat_deg,
                samples[i].lon_deg,
            )
        )

    rates: List[float] = []
    for i in range(1, len(headings)):
        dh = headings[i] - headings[i - 1]
        if dh > 180:
            dh -= 360
        if dh < -180:
            dh += 360
        dt = max(1e-6, (samples[i + 1].t_ns - samples[i].t_ns) / 1e9)
        rates.append(abs(dh) / dt)

    if not rates:
        return []

    med = sorted(rates)[len(rates) // 2]
    thresh = max(15.0, med * 4.0)

    segments: List[Dict[str, Any]] = []
    i0 = 0
    kind = "straight" if rates[0] < thresh else "corner"
    for i in range(1, len(rates)):
        nk = "straight" if rates[i] < thresh else "corner"
        if nk != kind:
            segments.append(
                {
                    "startIndex": i0,
                    "endIndex": i,
                    "type": kind,
                    "maxHeadingRateDegS": max(rates[i0:i]) if i > i0 else rates[i0],
                }
            )
            i0 = i
            kind = nk
    segments.append(
        {
            "startIndex": i0,
            "endIndex": len(rates) - 1,
            "type": kind,
            "maxHeadingRateDegS": max(rates[i0:]) if i0 < len(rates) else rates[-1],
        }
    )
    return segments
