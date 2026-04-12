"""Write canonical GNSS streams as Parquet (pyarrow)."""

from __future__ import annotations

from pathlib import Path
from typing import List

import pyarrow as pa
import pyarrow.parquet as pq

from ingestion.telemetry.parsers.csv_gnss import GnssSample


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
