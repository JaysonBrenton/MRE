# Class-level thresholds for invalid lap detection (suspected cut).

from ingestion.ingestion.derived_laps.constants import (
    CLASS_THRESHOLD_FACTOR,
    MIN_CLASS_THRESHOLD_SECONDS,
)


def calculate_class_threshold(
    results_with_fast_lap: list[dict],
) -> float | None:
    """
    Compute minimum valid lap time (threshold) for a class from fast_lap_time of results.
    Lap times below this are considered suspected cut.
    
    Args:
        results_with_fast_lap: List of dicts with "fast_lap_time" (float | None)
    
    Returns:
        Threshold in seconds, or None if no valid fast laps.
    """
    times = []
    for r in results_with_fast_lap:
        ft = r.get("fast_lap_time")
        if ft is not None and isinstance(ft, (int, float)) and ft > 0:
            times.append(float(ft))
    if not times:
        return None
    avg = sum(times) / len(times)
    threshold = max(avg * CLASS_THRESHOLD_FACTOR, MIN_CLASS_THRESHOLD_SECONDS)
    return threshold
