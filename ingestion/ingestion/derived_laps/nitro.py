# Nitro-only: fuel stop and flame out detection.

import re

from ingestion.ingestion.derived_laps.constants import (
    INCIDENT_FUEL_STOP,
    INCIDENT_FLAME_OUT,
    INCIDENT_MECHANICAL,
    FUEL_MIN_ADDED_SECONDS,
    FUEL_MAX_ADDED_SECONDS,
    PIT_WINDOW_START_SECONDS,
    PIT_WINDOW_END_SECONDS,
    FLAME_OUT_LONG_FACTOR,
    FLAME_OUT_MIN_LONG_SECONDS,
    RETURN_TO_NORMAL_FACTOR,
    CONFIDENCE_HIGH,
    CONFIDENCE_MEDIUM,
)


def is_nitro_class(vehicle_type: str | None, class_name: str) -> bool:
    """Return True if class is nitro (for fuel stop / flame out logic)."""
    if vehicle_type and "nitro" in vehicle_type.lower():
        return True
    if class_name and re.search(r"\bnitro\b", class_name, re.I):
        return True
    return False


def compute_fuel_stop_annotations(
    result_id: str,
    laps: list[dict],
    driver_median: float | None,
) -> list[dict]:
    """
    Mark laps that look like fuel stops: lap time in [median+5, median+15] and
    elapsed_race_time in [7 min, 10 min].
    
    Args:
        result_id: race_result id
        laps: List of dicts with lap_number, lap_time_seconds, elapsed_race_time
        driver_median: Driver median lap time (seconds)
    
    Returns:
        List of annotation dicts (incident_type suspected_fuel_stop).
    """
    out = []
    if driver_median is None or driver_median <= 0:
        return out
    low = driver_median + FUEL_MIN_ADDED_SECONDS
    high = driver_median + FUEL_MAX_ADDED_SECONDS
    for lap in laps:
        lap_num = lap.get("lap_number")
        lap_time = lap.get("lap_time_seconds")
        elapsed = lap.get("elapsed_race_time")
        if lap_num is None or lap_time is None:
            continue
        if elapsed is None:
            continue
        if not (low <= lap_time <= high):
            continue
        if not (PIT_WINDOW_START_SECONDS <= elapsed <= PIT_WINDOW_END_SECONDS):
            continue
        out.append({
            "race_result_id": result_id,
            "lap_number": lap_num,
            "invalid_reason": None,
            "incident_type": INCIDENT_FUEL_STOP,
            "confidence": CONFIDENCE_HIGH,
            "metadata": {"lap_time_seconds": lap_time, "elapsed_race_time": elapsed, "driver_median": driver_median},
        })
    return out


def compute_flame_out_annotations(
    result_id: str,
    laps: list[dict],
    driver_median: float | None,
    invalid_lap_numbers: set[int],
) -> list[dict]:
    """
    Mark very long lap(s) followed by return to normal as suspected flame out.
    Only applied when driver continues (has laps after the long one).
    
    Args:
        result_id: race_result id
        laps: List of dicts with lap_number, lap_time_seconds (ordered by lap_number)
        driver_median: Driver median lap time (seconds)
        invalid_lap_numbers: Laps already marked invalid (excluded from baseline)
    
    Returns:
        List of annotation dicts (incident_type suspected_flame_out).
    """
    out = []
    if driver_median is None or driver_median <= 0:
        return out
    long_threshold = max(driver_median * FLAME_OUT_LONG_FACTOR, FLAME_OUT_MIN_LONG_SECONDS)
    return_band = driver_median * RETURN_TO_NORMAL_FACTOR
    sorted_laps = sorted([l for l in laps if l.get("lap_number") is not None], key=lambda x: x["lap_number"])
    for i, lap in enumerate(sorted_laps):
        lap_num = lap.get("lap_number")
        lap_time = lap.get("lap_time_seconds")
        if lap_num is None or lap_time is None or lap_time <= 0:
            continue
        if lap_num in invalid_lap_numbers:
            continue
        if lap_time < long_threshold:
            continue
        # Check if there is a "return to normal" lap after this
        next_laps = sorted_laps[i + 1 : i + 4]  # next 1–3 laps
        if not next_laps:
            continue
        returned = any(
            (l.get("lap_time_seconds") or 0) <= return_band and l.get("lap_number") not in invalid_lap_numbers
            for l in next_laps
        )
        if not returned:
            continue
        out.append({
            "race_result_id": result_id,
            "lap_number": lap_num,
            "invalid_reason": None,
            "incident_type": INCIDENT_FLAME_OUT,
            "confidence": CONFIDENCE_MEDIUM,
            "metadata": {"lap_time_seconds": lap_time, "driver_median": driver_median, "long_threshold": long_threshold},
        })
    return out
