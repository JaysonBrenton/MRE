import "server-only"

import { stat } from "fs/promises"
import { compressors } from "hyparquet-compressors"
import { asyncBufferFromFile, parquetMetadataAsync, parquetReadObjects } from "hyparquet"

import { coerceParquetNumber } from "./telemetry-parquet-coerce"
import { absolutePathFromStoragePath } from "./telemetry-upload-storage"

const MAX_PARQUET_BYTES = 32 * 1024 * 1024
const MAX_ROWS = 1_000_000
const DEFAULT_MAX_POINTS = 2000
const ABS_MAX_POINTS = 10_000

function assertCanonicalRelativePath(relativePath: string): void {
  const normalized = relativePath.replace(/^[/\\]+/, "")
  const parts = normalized.split("/").filter(Boolean)
  if (parts.length === 0 || parts[0] !== "canonical") {
    throw new MapReadError("INVALID_PATH", "Path must be under canonical/")
  }
  if (parts.some((p) => p === ".." || p === ".")) {
    throw new MapReadError("INVALID_PATH", "Invalid path segment")
  }
}

export class MapReadError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "MapReadError"
  }
}

export type GnssMapPolylineResult = {
  latDeg: number[]
  lonDeg: number[]
  timeBounds: { tUnixMsMin: number; tUnixMsMax: number }
  meta: { pointCount: number; rowCount: number; level: string }
}

/**
 * Reads a bounded GNSS polyline from canonical gnss_pvt.parquet for map preview.
 * Validates path stays under TELEMETRY_UPLOAD_ROOT; enforces size and row limits.
 */
export async function readGnssMapPolyline(params: {
  parquetRelativePath: string
  maxPoints?: number
}): Promise<GnssMapPolylineResult> {
  const maxPoints = Math.min(Math.max(params.maxPoints ?? DEFAULT_MAX_POINTS, 2), ABS_MAX_POINTS)

  assertCanonicalRelativePath(params.parquetRelativePath)
  const normalized = params.parquetRelativePath.replace(/^[/\\]+/, "")
  const abs = absolutePathFromStoragePath(normalized)

  let size: number
  try {
    size = (await stat(abs)).size
  } catch {
    throw new MapReadError("NOT_FOUND", "Canonical GNSS file not found")
  }
  if (size > MAX_PARQUET_BYTES) {
    throw new MapReadError("PAYLOAD_TOO_LARGE", "GNSS file is too large to preview")
  }

  const file = await asyncBufferFromFile(abs)
  const metadata = await parquetMetadataAsync(file)
  const numRows = Number(metadata.num_rows ?? 0)
  if (!Number.isFinite(numRows) || numRows < 1) {
    throw new MapReadError("EMPTY", "GNSS file has no rows")
  }
  if (numRows > MAX_ROWS) {
    throw new MapReadError("PAYLOAD_TOO_LARGE", "GNSS file has too many rows to preview")
  }

  const rows = (await parquetReadObjects({
    file,
    columns: ["lat_deg", "lon_deg", "t_ns"],
    compressors,
  })) as Array<Record<string, unknown>>

  const rowCount = rows.length
  if (rowCount === 0) {
    throw new MapReadError("EMPTY", "GNSS file has no rows")
  }

  const stride = Math.max(1, Math.ceil(rowCount / maxPoints))
  const latDeg: number[] = []
  const lonDeg: number[] = []
  let tMinNs = Number.POSITIVE_INFINITY
  let tMaxNs = Number.NEGATIVE_INFINITY

  for (let i = 0; i < rowCount; i += stride) {
    const row = rows[i]
    const lat = coerceParquetNumber(row.lat_deg)
    const lon = coerceParquetNumber(row.lon_deg)
    const tns = coerceParquetNumber(row.t_ns)
    if (lat === null || lon === null || tns === null) {
      continue
    }
    latDeg.push(lat)
    lonDeg.push(lon)
    if (tns < tMinNs) tMinNs = tns
    if (tns > tMaxNs) tMaxNs = tns
  }

  if (latDeg.length === 0) {
    throw new MapReadError("INVALID_DATA", "GNSS file has no valid coordinates")
  }

  if (!Number.isFinite(tMinNs) || !Number.isFinite(tMaxNs)) {
    throw new MapReadError("INVALID_DATA", "GNSS file has no valid timestamps")
  }

  return {
    latDeg,
    lonDeg,
    timeBounds: {
      tUnixMsMin: Math.floor(tMinNs / 1e6),
      tUnixMsMax: Math.floor(tMaxNs / 1e6),
    },
    meta: {
      pointCount: latDeg.length,
      rowCount,
      level: "raw",
    },
  }
}
