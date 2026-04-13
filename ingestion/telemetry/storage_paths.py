"""Shared upload root resolution and GNSS helpers for the telemetry worker."""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional

from ingestion.telemetry.parsers.csv_gnss import GnssSample

UPLOAD_ROOT = Path(os.getenv("TELEMETRY_UPLOAD_ROOT", "/data/telemetry"))


def resolve_artifact_path(storage_path: str) -> Path:
    rel = storage_path.lstrip("/\\")
    full = (UPLOAD_ROOT / rel).resolve()
    root = UPLOAD_ROOT.resolve()
    root_str = str(root)
    full_str = str(full)
    if full_str != root_str and not full_str.startswith(root_str + os.sep):
        raise ValueError("storage_path escapes TELEMETRY_UPLOAD_ROOT")
    return full


def estimate_hz(samples: List[GnssSample]) -> Optional[int]:
    if len(samples) < 2:
        return None
    dts: List[int] = []
    for i in range(1, len(samples)):
        dt = samples[i].t_ns - samples[i - 1].t_ns
        if dt > 0:
            dts.append(dt)
    if not dts:
        return None
    dts.sort()
    med = dts[len(dts) // 2]
    if med <= 0:
        return None
    return max(1, int(round(1_000_000_000 / med)))
