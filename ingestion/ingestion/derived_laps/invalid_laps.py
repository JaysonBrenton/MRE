# Invalid lap detection (suspected cut: lap too fast).

from ingestion.ingestion.derived_laps.constants import (
    INVALID_REASON_SUSPECTED_CUT,
    CONFIDENCE_HIGH,
    CONFIDENCE_MEDIUM,
    DRIVER_FAST_FACTOR,
)


def compute_invalid_annotations(
    result_id: str,
    laps: list[dict],
    class_threshold: float | None,
    driver_median: float | None,
) -> list[dict]:
    """
    Mark laps that are suspiciously fast (suspected cut).
    
    A lap is invalid if:
    - lap_time_seconds < class_threshold (class-based), and optionally
    - lap_time_seconds < driver_median * DRIVER_FAST_FACTOR (driver-relative)
    
    Args:
        result_id: race_result id
        laps: List of dicts with lap_number, lap_time_seconds
        class_threshold: Min valid lap time from class (seconds)
        driver_median: Driver median lap time (seconds), optional
    
    Returns:
        List of annotation dicts: race_result_id, lap_number, invalid_reason, confidence, metadata
    """
    out = []
    if class_threshold is None:
        return out
    for lap in laps:
        lap_num = lap.get("lap_number")
        lap_time = lap.get("lap_time_seconds")
        if lap_num is None or lap_time is None or lap_time <= 0:
            continue
        if lap_time >= class_threshold:
            continue
        # Optional: also require driver-relative check for higher confidence
        driver_check = True
        if driver_median is not None and driver_median > 0:
            driver_check = lap_time < driver_median * DRIVER_FAST_FACTOR
        if not driver_check:
            continue
        confidence = CONFIDENCE_HIGH if (driver_median and lap_time < driver_median * DRIVER_FAST_FACTOR) else CONFIDENCE_MEDIUM
        out.append({
            "race_result_id": result_id,
            "lap_number": lap_num,
            "invalid_reason": INVALID_REASON_SUSPECTED_CUT,
            "incident_type": None,
            "confidence": confidence,
            "metadata": {"class_threshold": class_threshold, "lap_time_seconds": lap_time},
        })
    return out
