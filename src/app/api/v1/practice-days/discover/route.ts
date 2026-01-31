/**
 * @fileoverview Practice day discovery API route
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description API route for discovering practice days from LiveRC
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { discoverPracticeDays } from "@/core/practice-days/discover-practice-days"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized practice day discovery request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const body = await request.json()
    const { track_id, year, month } = body

    // Validate required fields
    if (!track_id) {
      return errorResponse("VALIDATION_ERROR", "track_id is required", {}, 400)
    }

    if (typeof year !== "number" || typeof month !== "number") {
      return errorResponse("VALIDATION_ERROR", "year and month must be numbers", {}, 400)
    }

    if (month < 1 || month > 12) {
      return errorResponse("VALIDATION_ERROR", "month must be between 1 and 12", {}, 400)
    }

    requestLogger.debug("Practice day discovery request", {
      trackId: track_id,
      year: year,
      month: month,
    })

    const result = await discoverPracticeDays({
      trackId: track_id,
      year: year,
      month: month,
    })

    requestLogger.info("Practice day discovery successful", {
      practiceDayCount: result.practiceDays.length,
    })

    return successResponse(result)
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
