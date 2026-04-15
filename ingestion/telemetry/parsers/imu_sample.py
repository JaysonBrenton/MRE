"""Canonical IMU sample type for fusion (independent of any vendor file format)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class ImuSample:
    t_ns: int
    ax: Optional[float]
    ay: Optional[float]
    az: Optional[float]
    gx: Optional[float]
    gy: Optional[float]
    gz: Optional[float]
    mx: Optional[float] = None
    my: Optional[float] = None
    mz: Optional[float] = None
