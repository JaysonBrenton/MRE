/**
 * @fileoverview Practice day ingestion API route
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description API route for ingesting practice days
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { ingestPracticeDay } from "@/core/practice-days/ingest-practice-day"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized practice day ingestion request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const body = await request.json()
    const { track_id, date } = body

    if (!track_id || !date) {
      return errorResponse("VALIDATION_ERROR", "track_id and date are required", {}, 400)
    }

    requestLogger.debug("Practice day ingestion request", {
      trackId: track_id,
      date: date,
    })

    const result = await ingestPracticeDay({
      trackId: track_id,
      date: date,
    })

    requestLogger.info("Practice day ingestion successful", {
      eventId: result.eventId,
      sessionsIngested: result.sessionsIngested,
    })

    return successResponse(result)
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
