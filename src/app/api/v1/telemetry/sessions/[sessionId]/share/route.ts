/**
 * POST / DELETE — mint or revoke read-only share link for a READY session.
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { mintTelemetryShareToken, revokeTelemetryShareToken } from "@/core/telemetry/telemetry-repo"

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
    const result = await mintTelemetryShareToken(session.user.id, sessionId)
    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return errorResponse("NOT_FOUND", "Session not found", undefined, 404)
      }
      return errorResponse(
        "NOT_READY",
        "Share links are available when the session is ready",
        undefined,
        409
      )
    }

    const base =
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
      process.env.VERCEL_URL?.replace(/\/$/, "") ||
      ""
    const shareUrl = base ? `${base}/api/v1/telemetry/share/${result.token}` : null

    return successResponse(
      { token: result.token, shareUrl },
      200,
      undefined,
      CACHE_CONTROL.NO_CACHE
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, _request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

export async function DELETE(
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
    const result = await revokeTelemetryShareToken(session.user.id, sessionId)
    if (!result.ok) {
      return errorResponse("NOT_FOUND", "Session not found", undefined, 404)
    }

    return successResponse({ revoked: true }, 200, undefined, CACHE_CONTROL.NO_CACHE)
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, _request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
