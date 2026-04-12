/**
 * POST /api/v1/telemetry/uploads — create artifact row and target storage path (stage 1 intake).
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { successResponse, errorResponse, parseRequestBody, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { env } from "@/lib/env"
import { createTelemetryUploadIntent } from "@/core/telemetry/telemetry-repo"

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const parsed = await parseRequestBody<{ originalFileName?: string; contentType?: string }>(
      request
    )
    if (!parsed.success || !parsed.data) {
      return errorResponse("UNPROCESSABLE_ENTITY", "Invalid JSON body", undefined, 422)
    }

    const originalFileName =
      typeof parsed.data.originalFileName === "string" ? parsed.data.originalFileName : ""
    const contentType = typeof parsed.data.contentType === "string" ? parsed.data.contentType : ""

    if (!originalFileName.trim()) {
      return errorResponse("VALIDATION_ERROR", "originalFileName is required", undefined, 400)
    }

    const artifact = await createTelemetryUploadIntent(session.user.id, {
      originalFileName,
      contentType: contentType || "application/octet-stream",
    })

    const base = env.APP_URL.replace(/\/$/, "")
    const uploadUrl = `${base}/api/v1/telemetry/uploads/${artifact.id}/bytes`

    return successResponse(
      {
        uploadId: artifact.id,
        uploadUrl,
        method: "PUT",
        storagePath: artifact.storagePath,
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
