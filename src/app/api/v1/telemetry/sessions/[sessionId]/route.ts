/**
 * GET /api/v1/telemetry/sessions/{sessionId} — session metadata and processing status (stage 1).
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { TelemetrySessionStatus } from "@prisma/client"
import { getTelemetrySessionForUser } from "@/core/telemetry/telemetry-repo"

function serializeSession(
  row: NonNullable<Awaited<ReturnType<typeof getTelemetrySessionForUser>>>
) {
  const failure =
    row.status === TelemetrySessionStatus.FAILED && row.currentRun?.errorCode
      ? {
          code: row.currentRun.errorCode,
          message: row.currentRun.errorDetail || row.currentRun.errorCode,
        }
      : undefined

  return {
    id: row.id,
    name: row.name,
    status: row.status.toLowerCase(),
    startTimeUtc: row.startTimeUtc.toISOString(),
    endTimeUtc: row.endTimeUtc.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    currentRun: row.currentRun
      ? {
          id: row.currentRun.id,
          status: row.currentRun.status.toLowerCase(),
          pipelineVersion: row.currentRun.pipelineVersion,
          errorCode: row.currentRun.errorCode,
          startedAt: row.currentRun.startedAt?.toISOString() ?? null,
          finishedAt: row.currentRun.finishedAt?.toISOString() ?? null,
        }
      : null,
    failure,
  }
}

export async function GET(
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
    const row = await getTelemetrySessionForUser(sessionId, session.user.id)
    if (!row) {
      return errorResponse("NOT_FOUND", "Session not found", undefined, 404)
    }

    return successResponse(
      { session: serializeSession(row) },
      200,
      undefined,
      CACHE_CONTROL.NO_CACHE
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, _request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
