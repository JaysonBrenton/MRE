/**
 * POST /api/v1/telemetry/uploads/{uploadId}/finalise — create session, run, and enqueue first job.
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { env } from "@/lib/env"
import { finaliseTelemetryUpload } from "@/core/telemetry/telemetry-repo"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { uploadId } = await params
    let name: string | undefined
    let livercEventId: string | undefined
    let livercRaceId: string | undefined
    try {
      const raw = await request.text()
      if (raw.trim()) {
        const body = JSON.parse(raw) as {
          name?: unknown
          livercEventId?: unknown
          livercRaceId?: unknown
        }
        if (typeof body.name === "string") {
          name = body.name
        }
        if (typeof body.livercEventId === "string" && body.livercEventId.trim()) {
          livercEventId = body.livercEventId.trim()
        }
        if (typeof body.livercRaceId === "string" && body.livercRaceId.trim()) {
          livercRaceId = body.livercRaceId.trim()
        }
      }
    } catch {
      return errorResponse("UNPROCESSABLE_ENTITY", "Invalid JSON body", undefined, 422)
    }

    const result = await finaliseTelemetryUpload(session.user.id, uploadId, {
      name,
      livercEventId,
      livercRaceId,
    })

    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return errorResponse("NOT_FOUND", "Upload not found", undefined, 404)
      }
      if (result.code === "BAD_LIVERC_EVENT" || result.code === "BAD_LIVERC_RACE") {
        return errorResponse("VALIDATION_ERROR", "Invalid LiveRC link reference", undefined, 400)
      }
      return errorResponse(
        "VALIDATION_ERROR",
        "Upload file bytes before finalising",
        undefined,
        400
      )
    }

    const base = env.APP_URL.replace(/\/$/, "")
    const sessionPollUrl = `${base}/api/v1/telemetry/sessions/${result.sessionId}`

    if (result.idempotent) {
      return successResponse(
        {
          sessionId: result.sessionId,
          sessionPollUrl,
          idempotent: true,
        },
        200,
        undefined,
        CACHE_CONTROL.NO_CACHE
      )
    }

    return successResponse(
      {
        sessionId: result.sessionId,
        runId: result.runId,
        sessionPollUrl,
        idempotent: false,
      },
      201,
      undefined,
      CACHE_CONTROL.NO_CACHE
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
