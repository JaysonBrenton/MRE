/**
 * @fileoverview Track catalogue sync completion timestamp for UI countdown
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getTrackCatalogueSyncState } from "@/core/tracks/repo"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized catalogue-sync-state request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const { completedAt } = await getTrackCatalogueSyncState()
    return successResponse(
      { completedAt: completedAt ? completedAt.toISOString() : null },
      200,
      undefined,
      CACHE_CONTROL.NO_CACHE
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
