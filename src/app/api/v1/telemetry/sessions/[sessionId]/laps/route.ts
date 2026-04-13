/**
 * GET /api/v1/telemetry/sessions/{sessionId}/laps — lap list (Postgres).
 */

import { NextRequest, NextResponse } from "next/server"
import { TelemetrySessionStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { weakEtagFromParts } from "@/core/telemetry/telemetry-etag"
import { getTelemetrySessionForUser } from "@/core/telemetry/telemetry-repo"

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
      return errorResponse("NOT_READY", "Session has no lap data yet", undefined, 409)
    }

    const runId = row.currentRun?.id
    const laps = row.laps
      .filter((l) => (runId ? l.runId === runId : true))
      .map((l) => ({
        lapNumber: l.lapNumber,
        startTimeUtc: l.startTimeUtc.toISOString(),
        endTimeUtc: l.endTimeUtc.toISOString(),
        durationMs: l.durationMs,
        validity: l.validity.toLowerCase(),
        qualityScore: l.qualityScore,
      }))

    const etag = weakEtagFromParts([
      sessionId,
      row.updatedAt.toISOString(),
      runId ?? "",
      laps.map((l) => `${l.lapNumber}:${l.startTimeUtc}:${l.durationMs}`).join("|"),
    ])
    const inm = request.headers.get("if-none-match")
    if (inm && inm === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": CACHE_CONTROL.NO_CACHE },
      })
    }

    return successResponse({ laps }, 200, undefined, CACHE_CONTROL.NO_CACHE, { ETag: etag })
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
