"""Lap detection heuristics."""

import math

from ingestion.telemetry.lap_detection import detect_laps_auto_sfl
from ingestion.telemetry.parsers.csv_gnss import GnssSample


def _circle_track_samples(*, laps_n: int, points_per_lap: int, t_step_ns: int) -> list[GnssSample]:
    """Synthetic circular path around a start point (London-ish)."""
    lat0, lon0 = 51.5, -0.1
    out: list[GnssSample] = []
    t = 1_700_000_000_000_000_000
    for _ in range(laps_n):
        for i in range(points_per_lap):
            ang = 2 * 3.141592653589793 * i / points_per_lap
            dlat = 0.0012 * math.cos(ang)
            dlon = 0.0018 * math.sin(ang)
            out.append(
                GnssSample(
                    t_ns=t,
                    lat_deg=lat0 + dlat,
                    lon_deg=lon0 + dlon,
                    alt_m=0.0,
                    speed_mps=20.0,
                )
            )
            t += t_step_ns
    return out


def test_detects_at_least_one_lap_on_synthetic_loop():
    samples = _circle_track_samples(laps_n=3, points_per_lap=120, t_step_ns=50_000_000)
    laps, status = detect_laps_auto_sfl(samples)
    assert status == "ok"
    assert len(laps) >= 1
    assert laps[0].validity in ("OUTLAP", "VALID")


def test_too_few_points_returns_empty():
    samples = _circle_track_samples(laps_n=1, points_per_lap=10, t_step_ns=50_000_000)
    laps, status = detect_laps_auto_sfl(samples)
    assert status == "too_few_points"
    assert laps == []
