"""Telemetry v1 quality scores and reason codes (GNSS-centric)."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from ingestion.telemetry.parsers.csv_gnss import GnssSample


def _continuity_score(samples: List[GnssSample]) -> float:
    """Penalise large time gaps (seconds)."""
    if len(samples) < 2:
        return 50.0
    gaps_ms: List[float] = []
    for i in range(1, len(samples)):
        dt_ms = (samples[i].t_ns - samples[i - 1].t_ns) / 1e6
        if dt_ms > 0:
            gaps_ms.append(dt_ms)
    if not gaps_ms:
        return 50.0
    gaps_ms.sort()
    med = gaps_ms[len(gaps_ms) // 2]
    # > 2s gap is bad
    bad = sum(1 for g in gaps_ms if g > 2000)
    ratio_bad = bad / len(gaps_ms)
    base = 100.0 * (1.0 - min(1.0, ratio_bad * 2))
    if med > 500:
        base *= 0.85
    return max(0.0, min(100.0, base))


def _rate_score(estimated_hz: Optional[int]) -> float:
    if not estimated_hz:
        return 55.0
    if estimated_hz < 5:
        return 40.0
    if estimated_hz < 10:
        return 65.0
    return min(100.0, 70.0 + estimated_hz)


def compute_quality_summary(
    samples: List[GnssSample],
    *,
    estimated_hz: Optional[int],
    lap_count: int,
) -> Dict[str, Any]:
    continuity = _continuity_score(samples)
    rate = _rate_score(estimated_hz)
    lap_timing = min(100.0, 55.0 + min(45.0, lap_count * 5.0)) if lap_count else 45.0
    overall = (continuity * 0.35 + rate * 0.35 + lap_timing * 0.3)

    reason_codes: List[str] = []
    if estimated_hz and estimated_hz < 5:
        reason_codes.append("GNSS_RATE_BELOW_5HZ")
    if estimated_hz and estimated_hz < 10:
        reason_codes.append("GNSS_RATE_BELOW_10HZ")
    if len(samples) >= 2:
        gaps_ms = [
            (samples[i].t_ns - samples[i - 1].t_ns) / 1e6
            for i in range(1, len(samples))
        ]
        if gaps_ms and max(gaps_ms) > 5000:
            reason_codes.append("GNSS_LARGE_TIME_GAP")
    if lap_count == 0:
        reason_codes.append("NO_LAPS_DETECTED")
    if len(samples) < 200:
        reason_codes.append("GNSS_SHORT_SESSION")

    gates = {
        "lap_timing": overall >= 55.0 and lap_count > 0,
        "comparison": overall >= 75.0,
        "map_preview": overall >= 35.0,
    }

    return {
        "continuity": round(continuity, 2),
        "sample_rate": round(rate, 2),
        "lap_timing": round(lap_timing, 2),
        "overall": round(overall, 2),
        "reason_codes": reason_codes,
        "gates": gates,
        "task_scores": {
            "continuity": round(continuity, 2),
            "rate": round(rate, 2),
            "lap_timing": round(lap_timing, 2),
        },
    }
