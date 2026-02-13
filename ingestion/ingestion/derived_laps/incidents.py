# Incident detection: crash (slow lap 10-35s over baseline) and mechanical (very slow or DNF).

from ingestion.ingestion.derived_laps.constants import (
    INCIDENT_CRASH,
    INCIDENT_MECHANICAL,
    CRASH_MIN_ADDED_SECONDS,
    CRASH_MAX_ADDED_SECONDS,
    MECHANICAL_ADDED_SECONDS,
    CONFIDENCE_HIGH,
    CONFIDENCE_MEDIUM,
)


def compute_incident_annotations(
    result_id: str,
    laps: list[dict],
    driver_median: float | None,
    laps_completed_by_leader: int,
    driver_laps_count: int,
    invalid_lap_numbers: set[int],
) -> list[dict]:
    """
    Mark laps that indicate crash (10-35s over baseline, driver continues) or
    mechanical (very long lap and/or DNF).
    
    Args:
        result_id: race_result id
        laps: List of dicts with lap_number, lap_time_seconds (ordered by lap_number)
        driver_median: Driver median lap time (seconds)
        laps_completed_by_leader: Max laps completed in this race (for DNF check)
        driver_laps_count: Number of laps this driver completed
        invalid_lap_numbers: Lap numbers already marked invalid (exclude from baseline use)
    
    Returns:
        List of annotation dicts (incident_type, confidence, metadata).
    """
    out = []
    if driver_median is None or driver_median <= 0:
        return out
    crash_band_min = driver_median + CRASH_MIN_ADDED_SECONDS
    crash_band_max = driver_median + CRASH_MAX_ADDED_SECONDS
    mechanical_threshold = driver_median + MECHANICAL_ADDED_SECONDS
    # Check if driver DNF (stopped early)
    dnf = driver_laps_count < laps_completed_by_leader if laps_completed_by_leader else False
    lap_numbers_list = [lap["lap_number"] for lap in laps if lap.get("lap_number") is not None]
    has_later_laps = lambda i: any(n > i for n in lap_numbers_list)
    for lap in laps:
        lap_num = lap.get("lap_number")
        lap_time = lap.get("lap_time_seconds")
        if lap_num is None or lap_time is None or lap_time <= 0:
            continue
        if lap_num in invalid_lap_numbers:
            continue
        if lap_time > mechanical_threshold:
            # Very long lap -> mechanical (or flame out, handled in nitro)
            out.append({
                "race_result_id": result_id,
                "lap_number": lap_num,
                "invalid_reason": None,
                "incident_type": INCIDENT_MECHANICAL,
                "confidence": CONFIDENCE_HIGH if dnf and not has_later_laps(lap_num) else CONFIDENCE_MEDIUM,
                "metadata": {"lap_time_seconds": lap_time, "driver_median": driver_median, "dnf": dnf},
            })
        elif crash_band_min <= lap_time <= crash_band_max and has_later_laps(lap_num):
            # In crash band and driver continued -> suspected crash
            out.append({
                "race_result_id": result_id,
                "lap_number": lap_num,
                "invalid_reason": None,
                "incident_type": INCIDENT_CRASH,
                "confidence": CONFIDENCE_MEDIUM,
                "metadata": {"lap_time_seconds": lap_time, "driver_median": driver_median},
            })
    return out
