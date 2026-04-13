"""Sort GNSS samples by time and drop duplicate timestamps (keep last)."""

from __future__ import annotations

from typing import List

from ingestion.telemetry.parsers.csv_gnss import GnssSample


def time_align_gnss(samples: List[GnssSample]) -> List[GnssSample]:
    if not samples:
        return []
    ordered = sorted(samples, key=lambda s: s.t_ns)
    out: List[GnssSample] = []
    last_t: int | None = None
    for s in ordered:
        if last_t is not None and s.t_ns == last_t:
            out[-1] = s
            continue
        out.append(s)
        last_t = s.t_ns
    return out
