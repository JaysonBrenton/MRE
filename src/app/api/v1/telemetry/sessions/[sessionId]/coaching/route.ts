/**
 * GET /api/v1/telemetry/sessions/{sessionId}/coaching — heuristic tips from quality + segments.
 */

import { NextRequest, NextResponse } from "next/server"
import { TelemetrySessionStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { weakEtagFromParts } from "@/core/telemetry/telemetry-etag"
import { buildTelemetryCoachingPayload } from "@/core/telemetry/telemetry-coaching"
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
      return errorResponse(
        "NOT_READY",
        "Coaching is available when the session is ready",
        undefined,
        409
      )
    }

    const run = row.currentRun
    const runId = run?.id
    const laps = row.laps.filter((l) => (runId ? l.runId === runId : true))
    const payload = buildTelemetryCoachingPayload(run?.qualitySummary ?? null, laps.length)

    const etag = weakEtagFromParts([
      sessionId,
      row.updatedAt.toISOString(),
      run?.id ?? "",
      String(payload.tips.length),
      String(payload.cornerSegmentCount),
    ])
    const inm = request.headers.get("if-none-match")
    if (inm && inm === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": CACHE_CONTROL.NO_CACHE },
      })
    }

    return NextResponse.json(
      { success: true as const, data: { coaching: payload } },
      {
        status: 200,
        headers: {
          "Cache-Control": CACHE_CONTROL.NO_CACHE,
          ETag: etag,
        },
      }
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
