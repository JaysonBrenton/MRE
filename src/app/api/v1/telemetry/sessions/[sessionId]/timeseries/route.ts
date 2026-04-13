/**
 * GET /api/v1/telemetry/sessions/{sessionId}/timeseries — GNSS columns (ClickHouse if materialised, else Parquet).
 */

import { NextRequest, NextResponse } from "next/server"
import { TelemetrySessionStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { queryGnssTimeseriesFromClickhouse } from "@/core/telemetry/telemetry-clickhouse"
import { weakEtagFromParts } from "@/core/telemetry/telemetry-etag"
import {
  getTelemetrySessionForUser,
  resolvePrimaryGnssDatasetId,
  resolvePrimaryGnssParquetPath,
} from "@/core/telemetry/telemetry-repo"
import {
  readGnssTimeseriesFromParquet,
  TimeseriesReadError,
} from "@/core/telemetry/telemetry-parquet-timeseries"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { sessionId } = await params
    const row = await getTelemetrySessionForUser(sessionId, session.user.id)
    if (!row) {
      return errorResponse("NOT_FOUND", "Session not found", undefined, 404)
    }

    if (row.status !== TelemetrySessionStatus.READY) {
      return errorResponse("NOT_READY", "Session has no readable telemetry yet", undefined, 409)
    }

    const parquetRelativePath = resolvePrimaryGnssParquetPath(row)
    const datasetId = resolvePrimaryGnssDatasetId(row)
    if (!parquetRelativePath || !datasetId) {
      return errorResponse(
        "NOT_FOUND",
        "No canonical GNSS dataset for this session",
        undefined,
        404
      )
    }

    const { searchParams } = new URL(request.url)
    const tNsMinRaw = searchParams.get("t_ns_min")
    const tNsMaxRaw = searchParams.get("t_ns_max")
    const maxRowsRaw = searchParams.get("max_rows")
    const strideRaw = searchParams.get("stride")
    const dsRate = searchParams.get("ds_rate")?.trim().toLowerCase()

    const tNsMin = tNsMinRaw ? Number.parseInt(tNsMinRaw, 10) : undefined
    const tNsMax = tNsMaxRaw ? Number.parseInt(tNsMaxRaw, 10) : undefined
    const maxRows = maxRowsRaw ? Number.parseInt(maxRowsRaw, 10) : 100_000
    let stride = strideRaw ? Number.parseInt(strideRaw, 10) : 1
    if (dsRate === "10hz" || dsRate === "ds_10hz") {
      stride = Math.max(stride, 10)
    }
    if (dsRate === "1hz" || dsRate === "ds_1hz") {
      stride = Math.max(stride, 100)
    }

    if (tNsMinRaw !== null && tNsMinRaw !== "" && Number.isNaN(tNsMin ?? NaN)) {
      return errorResponse("VALIDATION_ERROR", "Invalid t_ns_min", undefined, 400)
    }
    if (tNsMaxRaw !== null && tNsMaxRaw !== "" && Number.isNaN(tNsMax ?? NaN)) {
      return errorResponse("VALIDATION_ERROR", "Invalid t_ns_max", undefined, 400)
    }
    if (maxRowsRaw !== null && maxRowsRaw !== "" && Number.isNaN(maxRows ?? NaN)) {
      return errorResponse("VALIDATION_ERROR", "Invalid max_rows", undefined, 400)
    }
    if (strideRaw !== null && strideRaw !== "" && Number.isNaN(stride ?? NaN)) {
      return errorResponse("VALIDATION_ERROR", "Invalid stride", undefined, 400)
    }
    stride = Math.min(Math.max(1, stride), 10_000)

    const etag = weakEtagFromParts([
      sessionId,
      datasetId,
      row.updatedAt.toISOString(),
      String(tNsMin ?? ""),
      String(tNsMax ?? ""),
      String(maxRows),
      String(stride),
      dsRate ?? "",
    ])
    const inm = request.headers.get("if-none-match")
    if (inm && inm === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": CACHE_CONTROL.NO_CACHE },
      })
    }

    const applyStride = (cols: {
      t_ns: number[]
      lat_deg: number[]
      lon_deg: number[]
      alt_m: (number | null)[]
      speed_mps: (number | null)[]
    }) => {
      if (stride <= 1) return cols
      const t_ns: number[] = []
      const lat_deg: number[] = []
      const lon_deg: number[] = []
      const alt_m: (number | null)[] = []
      const speed_mps: (number | null)[] = []
      for (let i = 0; i < cols.t_ns.length; i += stride) {
        t_ns.push(cols.t_ns[i])
        lat_deg.push(cols.lat_deg[i])
        lon_deg.push(cols.lon_deg[i])
        alt_m.push(cols.alt_m[i])
        speed_mps.push(cols.speed_mps[i])
      }
      return { t_ns, lat_deg, lon_deg, alt_m, speed_mps }
    }

    const ch = await queryGnssTimeseriesFromClickhouse({
      sessionId,
      datasetId,
      tNsMin,
      tNsMax,
      maxRows: maxRows && maxRows > 0 ? maxRows : 100_000,
    })

    if (ch) {
      const columns = applyStride(ch.columns)
      return NextResponse.json(
        {
          success: true as const,
          data: {
            parquetRelativePath,
            source: "clickhouse" as const,
            meta: { ...ch.meta, stride, ds_rate: dsRate ?? null },
            columns,
          },
        },
        {
          status: 200,
          headers: {
            "Cache-Control": CACHE_CONTROL.NO_CACHE,
            ETag: etag,
          },
        }
      )
    }

    try {
      const ts = await readGnssTimeseriesFromParquet({
        parquetRelativePath,
        tNsMin,
        tNsMax,
        maxRows,
      })

      const columns = applyStride(ts.columns)

      return NextResponse.json(
        {
          success: true as const,
          data: {
            parquetRelativePath,
            source: "parquet" as const,
            meta: { ...ts.meta, stride, ds_rate: dsRate ?? null },
            columns,
          },
        },
        {
          status: 200,
          headers: {
            "Cache-Control": CACHE_CONTROL.NO_CACHE,
            ETag: etag,
          },
        }
      )
    } catch (err: unknown) {
      if (err instanceof TimeseriesReadError) {
        const status =
          err.code === "NOT_FOUND"
            ? 404
            : err.code === "PAYLOAD_TOO_LARGE"
              ? 413
              : err.code === "INVALID_PATH" || err.code === "EMPTY"
                ? 400
                : 500
        return errorResponse(err.code, err.message, undefined, status)
      }
      throw err
    }
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
