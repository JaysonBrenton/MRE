/**
 * GET /api/v1/telemetry/sessions/{sessionId}/quality — quality scores + reason codes from last successful run.
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
      return errorResponse("NOT_READY", "Session has no quality summary yet", undefined, 409)
    }

    const run = row.currentRun
    const qs = run?.qualitySummary
    const q =
      qs && typeof qs === "object" && qs !== null && "quality" in qs
        ? (qs as { quality?: unknown }).quality
        : null

    const etag = weakEtagFromParts([
      sessionId,
      row.updatedAt.toISOString(),
      run?.id ?? "",
      run?.pipelineVersion ?? "",
      run?.fusionVersion ?? "",
      run?.lapDetectorVersion ?? "",
    ])
    const inm = request.headers.get("if-none-match")
    if (inm && inm === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": CACHE_CONTROL.NO_CACHE },
      })
    }

    return successResponse(
      {
        pipelineVersion: run?.pipelineVersion ?? null,
        fusionVersion: run?.fusionVersion ?? null,
        lapDetectorVersion: run?.lapDetectorVersion ?? null,
        quality: q,
        rawQualitySummary: qs,
      },
      200,
      undefined,
      CACHE_CONTROL.NO_CACHE,
      { ETag: etag }
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
