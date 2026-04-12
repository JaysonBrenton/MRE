/**
 * PUT /api/v1/telemetry/uploads/{uploadId}/bytes — write raw bytes to TELEMETRY_UPLOAD_ROOT (stage 1).
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { writeTelemetryArtifactBytes } from "@/core/telemetry/telemetry-repo"

export const runtime = "nodejs"

export async function PUT(
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
    const buf = Buffer.from(await request.arrayBuffer())

    const result = await writeTelemetryArtifactBytes({
      ownerUserId: session.user.id,
      artifactId: uploadId,
      bytes: buf,
    })

    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return errorResponse("NOT_FOUND", "Upload not found", undefined, 404)
      }
      return errorResponse("CONFLICT", "Upload already finalised", undefined, 409)
    }

    return successResponse(
      {
        uploadId: result.artifact.id,
        byteSize: result.artifact.byteSize.toString(),
        sha256: result.artifact.sha256,
      },
      200,
      undefined,
      CACHE_CONTROL.NO_CACHE
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
