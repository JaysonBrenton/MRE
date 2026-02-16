// @fileoverview Event search API route
//
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
//
// @description API route for searching events by track and date range
//
// @purpose Provides user-facing API for event discovery. This route delegates
//          to core business logic functions, following the mobile-safe architecture
//          requirement that API routes should not contain business logic or
//          Prisma queries.

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  searchEvents,
  type SearchEventsInput,
  type SearchEventsWithPracticeDaysResult,
} from "@/core/events/search-events"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

/**
 * Type guard to check if error has code and message properties
 */
function hasErrorCode(error: unknown): error is { code: string; message: string; field?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    typeof (error as { message: unknown }).message === "string"
  )
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized event search request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const trackId = searchParams.get("track_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const includePracticeDays =
      searchParams.get("include_practice_days") === "true" ||
      searchParams.get("include_practice_days") === "1"

    requestLogger.debug("Event search request", {
      trackId,
      startDate,
      endDate,
      includePracticeDays,
    })

    // Validate track_id is provided before proceeding
    if (!trackId || trackId.trim() === "") {
      requestLogger.warn("Event search validation error - missing track_id", {
        trackId,
        hasTrackId: !!trackId,
      })
      return errorResponse("VALIDATION_ERROR", "track_id is required", { field: "track_id" }, 400)
    }

    const searchInput: SearchEventsInput = {
      trackId: trackId.trim(),
      includePracticeDays,
    }

    if (startDate && startDate.trim() !== "") {
      searchInput.startDate = startDate
    }

    if (endDate && endDate.trim() !== "") {
      searchInput.endDate = endDate
    }

    const result = await searchEvents(searchInput)

    requestLogger.info("Event search successful", {
      trackId: result.track.id,
      eventCount: result.events.length,
      practiceDayCount: "practiceDays" in result ? result.practiceDays.length : 0,
    })

    const payload: Record<string, unknown> = {
      track: {
        id: result.track.id,
        source: result.track.source,
        source_track_slug: result.track.sourceTrackSlug,
        track_name: result.track.trackName,
      },
      events: result.events,
    }

    if (includePracticeDays && "practiceDays" in result) {
      const withPractice = result as SearchEventsWithPracticeDaysResult
      payload.practice_days = withPractice.practiceDays
      payload.practice_range_min = withPractice.practiceRangeMin
      payload.practice_range_max = withPractice.practiceRangeMax
    }

    return successResponse(payload)
  } catch (error: unknown) {
    // Handle validation errors
    if (hasErrorCode(error)) {
      if (error.code === "VALIDATION_ERROR") {
        requestLogger.warn("Event search validation error", {
          code: error.code,
          message: error.message,
          field: error.field,
        })
        return errorResponse(
          error.code,
          error.message,
          error.field ? { field: error.field } : {},
          400
        )
      }
    }

    // Handle "Track not found" error from repo
    if (error instanceof Error && error.message === "Track not found") {
      const requestedTrackId = request.nextUrl.searchParams.get("track_id")
      requestLogger.warn("Track not found", {
        trackId: requestedTrackId,
      })
      return errorResponse(
        "NOT_FOUND",
        "Track not found",
        { trackId: requestedTrackId || null },
        404
      )
    }

    // Handle unexpected errors using server error handler
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
