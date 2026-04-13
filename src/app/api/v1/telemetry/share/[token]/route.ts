/**
 * GET /api/v1/telemetry/share/[token] — public read-only session summary (no auth).
 */

import { NextRequest } from "next/server"
import { TelemetrySessionStatus } from "@prisma/client"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { getTelemetrySessionByShareToken } from "@/core/telemetry/telemetry-repo"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const requestId = generateRequestId()
  try {
    const { token } = await params
    const row = await getTelemetrySessionByShareToken(token)
    if (!row || row.status !== TelemetrySessionStatus.READY) {
      return errorResponse("NOT_FOUND", "Session not found", undefined, 404)
    }

    const runId = row.currentRun?.id
    const laps = row.laps
      .filter((l) => (runId ? l.runId === runId : true))
      .map((l) => ({
        lapNumber: l.lapNumber,
        durationMs: l.durationMs,
        validity: l.validity.toLowerCase(),
      }))

    return successResponse(
      {
        session: {
          id: row.id,
          name: row.name,
          startTimeUtc: row.startTimeUtc.toISOString(),
          endTimeUtc: row.endTimeUtc.toISOString(),
          track: row.track
            ? {
                trackName: row.track.trackName,
                hasStartFinishLine: row.track.startFinishLineGeoJson != null,
              }
            : null,
          laps,
        },
      },
      200,
      undefined,
      CACHE_CONTROL.NO_CACHE
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, _request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
