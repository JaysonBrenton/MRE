"""Derive race session start from LiveRC Time Completed and Length (timed duration)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional


def derive_race_start_from_liverc(
    time_completed: Optional[datetime],
    duration_seconds: Optional[int],
) -> Optional[datetime]:
    """
    Session start = Time Completed − Length, using LiveRC's scheduled timed length.

    When duration is unknown, returns None (caller may still show time_completed).
    """
    if time_completed is None or duration_seconds is None:
        return None
    if duration_seconds < 0:
        return None
    return time_completed - timedelta(seconds=int(duration_seconds))
