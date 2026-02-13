# Driver baselines (median lap time) for incident detection.

import statistics


def driver_median_lap_seconds(
    laps: list[dict],
    exclude_lap_numbers: set[int] | None = None,
) -> float | None:
    """
    Compute median lap time (seconds) for a driver's laps.
    Used as baseline for crash/mechanical/fuel/flame-out detection.
    
    Args:
        laps: List of dicts with "lap_time_seconds" (float)
        exclude_lap_numbers: Optional set of lap_number to exclude (e.g. already invalid)
    
    Returns:
        Median in seconds, or None if no valid laps.
    """
    times = []
    for lap in laps:
        ln = lap.get("lap_number")
        if exclude_lap_numbers and ln is not None and ln in exclude_lap_numbers:
            continue
        t = lap.get("lap_time_seconds")
        if t is not None and isinstance(t, (int, float)) and t > 0:
            times.append(float(t))
    if not times:
        return None
    return statistics.median(times)
