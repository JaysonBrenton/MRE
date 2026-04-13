"""Rate-based downsampling (stride) for GNSS streams."""

from __future__ import annotations

from typing import List

from ingestion.telemetry.parsers.csv_gnss import GnssSample


def downsample_stride(samples: List[GnssSample], stride: int) -> List[GnssSample]:
    if stride <= 1 or not samples:
        return list(samples)
    return [samples[i] for i in range(0, len(samples), stride)]


def stride_for_target_hz(estimated_hz: int | None, target_hz: int) -> int:
    if not estimated_hz or estimated_hz <= 0:
        return 1
    if estimated_hz <= target_hz:
        return 1
    return max(1, round(estimated_hz / target_hz))
