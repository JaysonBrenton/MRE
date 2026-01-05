// @fileoverview Tracks API route
//
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
//
// @description API route for track catalogue operations
//
// @purpose Provides user-facing API for querying tracks from database.
//          This route delegates to core business logic functions, following
//          the mobile-safe architecture requirement that API routes should
//          not contain business logic or Prisma queries.

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getTracks } from "@/core/tracks/get-tracks"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized tracks request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const followedParam = searchParams.get("followed")
    const activeParam = searchParams.get("active")

    // Parse query parameters (default to true if not specified)
    const followed = followedParam !== "false"
    const active = activeParam !== "false"

    requestLogger.debug("Tracks request", {
      followed,
      active,
    })

    // Call core business logic function
    const tracks = await getTracks({
      followed,
      active,
    })

    requestLogger.info("Tracks fetched successfully", {
      trackCount: tracks.length,
    })

    // Static reference data - cache for 1 hour
    return successResponse({ tracks }, 200, undefined, CACHE_CONTROL.STATIC)
  } catch (error: unknown) {
    // Handle unexpected errors using server error handler
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
