/**
 * GET /api/v1/tracks/search?q=&limit=
 * Authenticated catalogue search for host-track picker.
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { searchTracksForHostPicker } from "@/core/events/user-event-host-track"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const session = await auth()
    if (!session?.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }
    const q = request.nextUrl.searchParams.get("q") ?? ""
    const limitRaw = request.nextUrl.searchParams.get("limit")
    const limit = limitRaw ? parseInt(limitRaw, 10) : 20
    const tracks = await searchTracksForHostPicker(q, Number.isFinite(limit) ? limit : 20)
    return successResponse({ tracks }, 200, undefined, CACHE_CONTROL.NO_CACHE)
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
