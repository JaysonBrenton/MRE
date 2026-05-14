"""Nitro pit stop detection v2 (sequence-aware, race-length-aware)."""

from __future__ import annotations

import re
from statistics import median
from typing import Any, Dict, List

from ingestion.ingestion.derived_laps.constants import INCIDENT_FUEL_STOP, CONFIDENCE_MEDIUM

DETECTION_VERSION = "pit_v2.0"


def _is_nitro_gate(vehicle_type: str | None, class_name: str, race_label: str | None) -> bool:
    vt = (vehicle_type or "").lower()
    if "ep" in vt or "electric" in vt:
        return False
    if "nitro" in vt:
        return True

    text = f"{class_name or ''} {race_label or ''}".lower()
    # Fallback text matching for legacy/unset vehicle types.
    if re.search(r"\bnitro\b", text):
        return True
    if re.search(r"\bgp\b", text) and not re.search(r"\b(ep|electric)\b", text):
        return True
    return False


def _duration_profile(duration_seconds: int | None) -> Dict[str, float]:
    duration = duration_seconds or 0
    if duration <= 7 * 60:
        return {"min_elapsed": 0.0, "expected_stops": 0.0}
    if duration <= 10 * 60:
        return {"min_elapsed": 5 * 60.0, "expected_stops": 1.0}
    if duration <= 30 * 60:
        return {"min_elapsed": 7 * 60.0, "expected_stops": 3.0}
    return {"min_elapsed": 7 * 60.0, "expected_stops": 7.0}


def _median(values: List[float]) -> float | None:
    cleaned = [v for v in values if isinstance(v, (int, float)) and v > 0]
    if not cleaned:
        return None
    return float(median(cleaned))


def _classify_strategy(
    pit_estimates: List[float],
    expected_stops: float,
    duration_seconds: int | None,
) -> Dict[str, Any]:
    count = len(pit_estimates)
    intervals = [
        round(pit_estimates[i] - pit_estimates[i - 1], 3)
        for i in range(1, len(pit_estimates))
    ]
    median_interval = _median(intervals)

    if count == 0:
        label = "no_stop"
        confidence = 0.95
    elif count == 1:
        duration = duration_seconds or 0
        label = "single_stop_late" if duration and pit_estimates[0] > (duration * 0.6) else "standard_cadence"
        confidence = 0.75
    elif count >= expected_stops:
        label = "standard_cadence"
        confidence = 0.78
    else:
        label = "stretch_cadence"
        confidence = 0.72

    return {
        "strategy_label": label,
        "strategy_confidence": confidence,
        "pit_count_detected": count,
        "median_interval_seconds": median_interval,
        "intervals_json": intervals,
        "metadata": {"expected_stops_prior": expected_stops},
    }


def detect_pit_stops_for_race(race_data: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
    """Return lap annotations, pit events, and pit strategy rows for one race."""
    race = race_data.get("race") or {}
    results = race_data.get("results") or []
    vehicle_type = race_data.get("vehicle_type")
    class_name = race.get("class_name") or ""
    race_label = race.get("race_label")
    duration_seconds = race.get("duration_seconds")
    profile = _duration_profile(duration_seconds)

    if not _is_nitro_gate(vehicle_type, class_name, race_label):
        return {
            "lap_annotations": [],
            "pit_stop_events": [],
            "driver_pit_strategies": [],
        }

    lap_annotations: List[Dict[str, Any]] = []
    pit_stop_events: List[Dict[str, Any]] = []
    driver_pit_strategies: List[Dict[str, Any]] = []

    for result in results:
        result_id = result.get("id")
        laps = sorted(result.get("laps") or [], key=lambda l: l.get("lap_number") or 0)
        if not result_id or len(laps) < 3:
            continue

        baseline = _median([lap.get("lap_time_seconds") for lap in laps])
        if baseline is None:
            continue

        candidates: List[Dict[str, Any]] = []
        for lap in laps:
            lap_number = lap.get("lap_number")
            lap_time = lap.get("lap_time_seconds")
            elapsed_end = lap.get("elapsed_race_time")
            if (
                lap_number is None
                or not isinstance(lap_time, (float, int))
                or not isinstance(elapsed_end, (float, int))
            ):
                continue
            if elapsed_end < profile["min_elapsed"]:
                continue

            delta = float(lap_time) - baseline
            if delta < 4.0 or delta > 18.0:
                continue
            # Very long laps are more likely crash/mechanical than pit stop.
            if lap_time > baseline + 35.0:
                continue

            confidence = min(0.98, max(0.5, 0.55 + ((delta - 4.0) / 14.0) * 0.4))
            candidates.append(
                {
                    "lap_number": int(lap_number),
                    "lap_time_seconds": float(lap_time),
                    "elapsed_lap_end": float(elapsed_end),
                    "pit_time_loss_seconds": round(max(0.0, delta), 3),
                    "confidence": round(confidence, 3),
                }
            )

        selected: List[Dict[str, Any]] = []
        for candidate in sorted(candidates, key=lambda c: c["lap_number"]):
            if selected and (candidate["lap_number"] - selected[-1]["lap_number"] < 2):
                # Keep higher-confidence candidate inside refractory window.
                if candidate["confidence"] > selected[-1]["confidence"]:
                    selected[-1] = candidate
                continue
            selected.append(candidate)

        pit_estimates: List[float] = []
        for event in selected:
            lap_start = max(0.0, event["elapsed_lap_end"] - event["lap_time_seconds"])
            pit_estimate = round((lap_start + event["elapsed_lap_end"]) / 2.0, 3)
            pit_estimates.append(pit_estimate)

            pit_stop_events.append(
                {
                    "race_result_id": result_id,
                    "lap_number": event["lap_number"],
                    "pit_time_estimate_seconds": pit_estimate,
                    "pit_time_earliest_seconds": round(lap_start, 3),
                    "pit_time_latest_seconds": round(event["elapsed_lap_end"], 3),
                    "pit_time_loss_seconds": event["pit_time_loss_seconds"],
                    "baseline_seconds": round(baseline, 3),
                    "detection_confidence": event["confidence"],
                    "detection_version": DETECTION_VERSION,
                    "metadata": {"method": "lap_window_midpoint"},
                }
            )
            lap_annotations.append(
                {
                    "race_result_id": result_id,
                    "lap_number": event["lap_number"],
                    "invalid_reason": None,
                    "incident_type": INCIDENT_FUEL_STOP,
                    "confidence": max(CONFIDENCE_MEDIUM, event["confidence"]),
                    "metadata": {
                        "pit_v2": True,
                        "pit_time_estimate_seconds": pit_estimate,
                        "pit_time_earliest_seconds": round(lap_start, 3),
                        "pit_time_latest_seconds": round(event["elapsed_lap_end"], 3),
                        "pit_time_loss_seconds": event["pit_time_loss_seconds"],
                        "detection_version": DETECTION_VERSION,
                    },
                }
            )

        strategy = _classify_strategy(
            pit_estimates=pit_estimates,
            expected_stops=profile["expected_stops"],
            duration_seconds=duration_seconds,
        )
        driver_pit_strategies.append(
            {
                "race_result_id": result_id,
                **strategy,
                "detection_version": DETECTION_VERSION,
            }
        )

    return {
        "lap_annotations": lap_annotations,
        "pit_stop_events": pit_stop_events,
        "driver_pit_strategies": driver_pit_strategies,
    }
