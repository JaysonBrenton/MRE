/**
 * GET /api/v1/telemetry/share/[token]/map — public map polyline (no auth).
 */

import { NextRequest } from "next/server"
import { TelemetrySessionStatus } from "@prisma/client"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { weakEtagFromParts } from "@/core/telemetry/telemetry-etag"
import {
  getGnssParquetRelativePathForMapPreview,
  getTelemetrySessionByShareToken,
} from "@/core/telemetry/telemetry-repo"
import { MapReadError, readGnssMapPolyline } from "@/core/telemetry/telemetry-parquet-map"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const requestId = generateRequestId()
  try {
    const { token } = await params
    const row = await getTelemetrySessionByShareToken(token)
    if (!row || row.status !== TelemetrySessionStatus.READY) {
      return errorResponse("NOT_FOUND", "Session not found", undefined, 404)
    }

    const parquetRelativePath = getGnssParquetRelativePathForMapPreview(row)
    if (!parquetRelativePath) {
      return errorResponse("NOT_FOUND", "No canonical GNSS path for this session", undefined, 404)
    }

    const { searchParams } = new URL(request.url)
    const maxPointsRaw = searchParams.get("max_points")
    const maxPoints = maxPointsRaw ? Number.parseInt(maxPointsRaw, 10) : undefined
    if (maxPointsRaw !== null && maxPointsRaw !== "" && Number.isNaN(maxPoints ?? NaN)) {
      return errorResponse("VALIDATION_ERROR", "Invalid max_points", undefined, 400)
    }

    const etag = weakEtagFromParts([
      row.id,
      row.updatedAt.toISOString(),
      parquetRelativePath,
      String(maxPoints ?? ""),
    ])
    const inm = request.headers.get("if-none-match")
    if (inm && inm === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": CACHE_CONTROL.NO_CACHE },
      })
    }

    try {
      const polyline = await readGnssMapPolyline({
        parquetRelativePath,
        maxPoints: maxPoints && maxPoints > 0 ? maxPoints : undefined,
      })

      return successResponse(
        {
          meta: {
            level: polyline.meta.level,
            pointCount: polyline.meta.pointCount,
            rowCount: polyline.meta.rowCount,
            timeBounds: polyline.timeBounds,
          },
          data: {
            lat_deg: polyline.latDeg,
            lon_deg: polyline.lonDeg,
          },
        },
        200,
        undefined,
        CACHE_CONTROL.NO_CACHE,
        { ETag: etag }
      )
    } catch (err: unknown) {
      if (err instanceof MapReadError) {
        const status =
          err.code === "NOT_FOUND"
            ? 404
            : err.code === "PAYLOAD_TOO_LARGE"
              ? 413
              : err.code === "INVALID_PATH" || err.code === "INVALID_DATA"
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
