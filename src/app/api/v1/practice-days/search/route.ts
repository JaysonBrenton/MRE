/**
 * @fileoverview Practice day search API route
 * 
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 * 
 * @description API route for searching practice days in database
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { searchPracticeDays } from "@/core/practice-days/search-practice-days"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized practice day search request")
    return errorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      {},
      401
    )
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const track_id = searchParams.get("track_id")
    const start_date = searchParams.get("start_date")
    const end_date = searchParams.get("end_date")

    if (!track_id) {
      return errorResponse(
        "VALIDATION_ERROR",
        "track_id is required",
        {},
        400
      )
    }

    requestLogger.debug("Practice day search request", {
      trackId: track_id,
      startDate: start_date,
      endDate: end_date,
    })

    const result = await searchPracticeDays({
      trackId: track_id,
      startDate: start_date || undefined,
      endDate: end_date || undefined,
    })

    requestLogger.info("Practice day search successful", {
      practiceDayCount: result.practiceDays.length,
    })

    return successResponse(result)
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      undefined,
      errorInfo.statusCode
    )
  }
}
