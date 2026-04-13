"""Write canonical GNSS streams as Parquet (pyarrow)."""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

import pyarrow as pa
import pyarrow.parquet as pq

from ingestion.telemetry.parsers.csv_gnss import GnssSample
from ingestion.telemetry.parsers.fit_imu import ImuSample


def write_gnss_parquet(path: Path, samples: List[GnssSample]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    t_ns = [s.t_ns for s in samples]
    lat = [s.lat_deg for s in samples]
    lon = [s.lon_deg for s in samples]
    alt = [s.alt_m for s in samples]
    spd = [s.speed_mps for s in samples]

    table = pa.table(
        {
            "t_ns": pa.array(t_ns, type=pa.int64()),
            "lat_deg": pa.array(lat, type=pa.float64()),
            "lon_deg": pa.array(lon, type=pa.float64()),
            "alt_m": pa.array(
                [a if a is not None else None for a in alt],
                type=pa.float64(),
            ),
            "speed_mps": pa.array(
                [v if v is not None else None for v in spd],
                type=pa.float64(),
            ),
        }
    )
    pq.write_table(table, path)


def write_accel_parquet(path: Path, samples: List[ImuSample]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    def f(get: str) -> pa.Array:
        vals: List[Optional[float]] = []
        for s in samples:
            v = getattr(s, get)
            vals.append(float(v) if v is not None else None)
        return pa.array(vals, type=pa.float64())

    table = pa.table(
        {
            "t_ns": pa.array([s.t_ns for s in samples], type=pa.int64()),
            "ax_mps2": f("ax"),
            "ay_mps2": f("ay"),
            "az_mps2": f("az"),
        }
    )
    pq.write_table(table, path)


def write_gyro_parquet(path: Path, samples: List[ImuSample]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    def f(get: str) -> pa.Array:
        vals: List[Optional[float]] = []
        for s in samples:
            v = getattr(s, get)
            vals.append(float(v) if v is not None else None)
        return pa.array(vals, type=pa.float64())

    table = pa.table(
        {
            "t_ns": pa.array([s.t_ns for s in samples], type=pa.int64()),
            "gx_rads": f("gx"),
            "gy_rads": f("gy"),
            "gz_rads": f("gz"),
        }
    )
    pq.write_table(table, path)


def write_mag_parquet(path: Path, samples: List[ImuSample]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    def f(get: str) -> pa.Array:
        vals: List[Optional[float]] = []
        for s in samples:
            v = getattr(s, get)
            vals.append(float(v) if v is not None else None)
        return pa.array(vals, type=pa.float64())

    table = pa.table(
        {
            "t_ns": pa.array([s.t_ns for s in samples], type=pa.int64()),
            "mx": f("mx"),
            "my": f("my"),
            "mz": f("mz"),
        }
    )
    pq.write_table(table, path)


def write_imu_parquet(path: Path, samples: List[ImuSample]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    def col(
        getter: str,
    ) -> pa.Array:
        vals: List[Optional[float]] = []
        for s in samples:
            v = getattr(s, getter)
            vals.append(float(v) if v is not None else None)
        return pa.array(vals, type=pa.float64())

    table = pa.table(
        {
            "t_ns": pa.array([s.t_ns for s in samples], type=pa.int64()),
            "ax_mps2": col("ax"),
            "ay_mps2": col("ay"),
            "az_mps2": col("az"),
            "gx_rads": col("gx"),
            "gy_rads": col("gy"),
            "gz_rads": col("gz"),
            "mx": col("mx"),
            "my": col("my"),
            "mz": col("mz"),
        }
    )
    pq.write_table(table, path)


def write_fused_pose_parquet(
    path: Path,
    samples: List[GnssSample],
    *,
    pose_source: str,
) -> None:
    """Placeholder fused pose: GNSS geometry + explicit pose_source column."""
    path.parent.mkdir(parents=True, exist_ok=True)
    n = len(samples)
    src = [pose_source] * n
    table = pa.table(
        {
            "t_ns": pa.array([s.t_ns for s in samples], type=pa.int64()),
            "lat_deg": pa.array([s.lat_deg for s in samples], type=pa.float64()),
            "lon_deg": pa.array([s.lon_deg for s in samples], type=pa.float64()),
            "alt_m": pa.array(
                [float(a) if a is not None else None for a in (s.alt_m for s in samples)],
                type=pa.float64(),
            ),
            "speed_mps": pa.array(
                [float(v) if v is not None else None for v in (s.speed_mps for s in samples)],
                type=pa.float64(),
            ),
            "pose_source": pa.array(src, type=pa.string()),
        }
    )
    pq.write_table(table, path)
