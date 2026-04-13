import "server-only"

import { stat } from "fs/promises"
import { compressors } from "hyparquet-compressors"
import { asyncBufferFromFile, parquetMetadataAsync, parquetReadObjects } from "hyparquet"

import { coerceParquetNumber } from "./telemetry-parquet-coerce"
import { absolutePathFromStoragePath } from "./telemetry-upload-storage"

const MAX_PARQUET_BYTES = 48 * 1024 * 1024
const MAX_ROWS = 2_000_000

export class TimeseriesReadError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "TimeseriesReadError"
  }
}

export type GnssTimeseriesResult = {
  columns: {
    t_ns: number[]
    lat_deg: number[]
    lon_deg: number[]
    alt_m: (number | null)[]
    speed_mps: (number | null)[]
  }
  meta: { rowCount: number; filteredCount: number }
}

function assertCanonicalRelativePath(relativePath: string): void {
  const normalized = relativePath.replace(/^[/\\]+/, "")
  const parts = normalized.split("/").filter(Boolean)
  if (parts.length === 0 || parts[0] !== "canonical") {
    throw new TimeseriesReadError("INVALID_PATH", "Path must be under canonical/")
  }
  if (parts.some((p) => p === ".." || p === ".")) {
    throw new TimeseriesReadError("INVALID_PATH", "Invalid path segment")
  }
}

/**
 * Reads GNSS columns from canonical Parquet with optional t_ns window (nanoseconds).
 */
export async function readGnssTimeseriesFromParquet(params: {
  parquetRelativePath: string
  tNsMin?: number
  tNsMax?: number
  maxRows?: number
}): Promise<GnssTimeseriesResult> {
  assertCanonicalRelativePath(params.parquetRelativePath)
  const normalized = params.parquetRelativePath.replace(/^[/\\]+/, "")
  const abs = absolutePathFromStoragePath(normalized)

  let size: number
  try {
    size = (await stat(abs)).size
  } catch {
    throw new TimeseriesReadError("NOT_FOUND", "Canonical GNSS file not found")
  }
  if (size > MAX_PARQUET_BYTES) {
    throw new TimeseriesReadError("PAYLOAD_TOO_LARGE", "GNSS file is too large for this endpoint")
  }

  const file = await asyncBufferFromFile(abs)
  const metadata = await parquetMetadataAsync(file)
  const numRows = Number(metadata.num_rows ?? 0)
  if (!Number.isFinite(numRows) || numRows < 1) {
    throw new TimeseriesReadError("EMPTY", "GNSS file has no rows")
  }
  if (numRows > MAX_ROWS) {
    throw new TimeseriesReadError("PAYLOAD_TOO_LARGE", "GNSS file has too many rows")
  }

  const rows = (await parquetReadObjects({
    file,
    columns: ["t_ns", "lat_deg", "lon_deg", "alt_m", "speed_mps"],
    compressors,
  })) as Array<Record<string, unknown>>

  const tMin = params.tNsMin
  const tMax = params.tNsMax
  const maxRows = params.maxRows && params.maxRows > 0 ? Math.min(params.maxRows, 500_000) : 100_000

  const t_ns: number[] = []
  const lat_deg: number[] = []
  const lon_deg: number[] = []
  const alt_m: (number | null)[] = []
  const speed_mps: (number | null)[] = []

  for (const row of rows) {
    const t = coerceParquetNumber(row.t_ns)
    const lat = coerceParquetNumber(row.lat_deg)
    const lon = coerceParquetNumber(row.lon_deg)
    if (t === null || lat === null || lon === null) continue
    if (tMin !== undefined && t < tMin) continue
    if (tMax !== undefined && t > tMax) continue
    t_ns.push(t)
    lat_deg.push(lat)
    lon_deg.push(lon)
    const a = coerceParquetNumber(row.alt_m)
    const sp = coerceParquetNumber(row.speed_mps)
    alt_m.push(a)
    speed_mps.push(sp)
    if (t_ns.length >= maxRows) break
  }

  if (t_ns.length === 0) {
    throw new TimeseriesReadError("EMPTY", "No samples in requested window")
  }

  return {
    columns: { t_ns, lat_deg, lon_deg, alt_m, speed_mps },
    meta: { rowCount: rows.length, filteredCount: t_ns.length },
  }
}
