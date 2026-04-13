"""Extract IMU samples from Garmin FIT when present (record or sensor messages)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timezone
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

from fitparse import FitFile

from ingestion.telemetry.errors import TelemetryParseError
from ingestion.telemetry.parsers.fit_gnss import _fit_timestamp_to_ns, is_fit_magic


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


def _maybe_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    return None


def _collect_imu_fields(
    vals: Dict[str, Any],
) -> Tuple[
    Optional[float],
    Optional[float],
    Optional[float],
    Optional[float],
    Optional[float],
    Optional[float],
    Optional[float],
    Optional[float],
    Optional[float],
]:
    """Map common FIT field names to ax..gz and magnetometer (device units)."""
    ax = ay = az = gx = gy = gz = mx = my = mz = None
    for k, v in vals.items():
        lk = str(k).lower()
        if "mag" in lk or "compass" in lk:
            if "x" in lk or lk.endswith("_x"):
                mx = _maybe_float(v) or mx
            elif "y" in lk or lk.endswith("_y"):
                my = _maybe_float(v) or my
            elif "z" in lk or lk.endswith("_z"):
                mz = _maybe_float(v) or mz
        if "accel" in lk or lk.startswith("acc"):
            if "x" in lk or lk.endswith("_x"):
                ax = _maybe_float(v) or ax
            elif "y" in lk or lk.endswith("_y"):
                ay = _maybe_float(v) or ay
            elif "z" in lk or lk.endswith("_z"):
                az = _maybe_float(v) or az
        if "gyro" in lk or "rot" in lk:
            if "x" in lk or lk.endswith("_x"):
                gx = _maybe_float(v) or gx
            elif "y" in lk or lk.endswith("_y"):
                gy = _maybe_float(v) or gy
            elif "z" in lk or lk.endswith("_z"):
                gz = _maybe_float(v) or gz
    return ax, ay, az, gx, gy, gz, mx, my, mz


def parse_fit_imu(raw_bytes: bytes) -> Tuple[List[ImuSample], Dict[str, Any]]:
    if not raw_bytes:
        raise TelemetryParseError("FIT_EMPTY", "FIT file is empty")
    if not is_fit_magic(raw_bytes):
        raise TelemetryParseError(
            "FIT_NOT_FIT",
            "File does not look like a FIT activity (missing .FIT header)",
        )

    try:
        fit = FitFile(BytesIO(raw_bytes))
    except Exception as exc:  # noqa: BLE001
        raise TelemetryParseError("FIT_PARSE_ERROR", f"Could not open FIT: {exc}") from exc

    out: List[ImuSample] = []
    for msg in fit.get_messages():
        name = getattr(msg, "name", None) or getattr(msg, "type", None)
        if name not in ("record", "gyroscope_data", "accelerometer_data"):
            continue
        vals = {f.name: f.value for f in msg.fields}
        t_ns = _fit_timestamp_to_ns(vals.get("timestamp"))
        if t_ns is None:
            continue
        ax, ay, az, gx, gy, gz, mx, my, mz = _collect_imu_fields(vals)
        if not any(v is not None for v in (ax, ay, az, gx, gy, gz, mx, my, mz)):
            continue
        out.append(
            ImuSample(
                t_ns=t_ns,
                ax=ax,
                ay=ay,
                az=az,
                gx=gx,
                gy=gy,
                gz=gz,
                mx=mx,
                my=my,
                mz=mz,
            )
        )

    out.sort(key=lambda s: s.t_ns)
    meta = {"format": "fit_imu", "rowCount": len(out)}
    return out, meta
