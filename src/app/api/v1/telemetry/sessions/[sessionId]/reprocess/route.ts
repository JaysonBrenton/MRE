/**
 * POST /api/v1/telemetry/sessions/{sessionId}/reprocess — full re-ingest (READY only).
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { reprocessTelemetrySession } from "@/core/telemetry/telemetry-repo"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { sessionId } = await params
    const result = await reprocessTelemetrySession(session.user.id, sessionId)
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return errorResponse("NOT_FOUND", "Session not found", undefined, 404)
      }
      if (result.code === "REPROCESS_COOLDOWN") {
        return errorResponse(
          "RATE_LIMITED",
          "Reprocess was requested too soon; wait for the cooldown period",
          undefined,
          429
        )
      }
      if (result.code === "NOT_READY") {
        return errorResponse(
          "VALIDATION_ERROR",
          "Only processed (ready) sessions can be reprocessed",
          undefined,
          400
        )
      }
      return errorResponse(
        "VALIDATION_ERROR",
        "No upload artifact for this session",
        undefined,
        400
      )
    }

    return successResponse(
      { runId: result.runId, sessionId },
      200,
      undefined,
      CACHE_CONTROL.NO_CACHE
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, _request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
