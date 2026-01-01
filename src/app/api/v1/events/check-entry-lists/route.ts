// @fileoverview Check entry lists for driver name API route
// 
// @created 2025-01-28
// @creator Auto-generated
// @lastModified 2025-01-28
// 
// @description API route for checking if a driver name appears in entry lists
//             for liverc events
// 
// @purpose Provides user-facing API for checking entry lists. This route
//          delegates to core business logic functions, following the mobile-safe
//          architecture requirement that API routes should not contain business logic.

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { checkEntryListsForDriver, type LiveRCEvent, type DbEvent } from "@/core/events/check-entry-lists-for-driver"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

// Set route timeout to 6 minutes (slightly longer than our operation timeout)
// This ensures Next.js doesn't kill the request before our timeout triggers
export const maxDuration = 360 // 6 minutes in seconds

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized entry list check request")
    return errorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      {},
      401
    )
  }

  try {
    const body = await request.json()
    const { events, track_slug } = body

    requestLogger.debug("Entry list check request", {
      eventCount: events?.length || 0,
      trackSlug: track_slug,
    })

    // Validate required fields
    if (!events || !Array.isArray(events) || events.length === 0) {
      requestLogger.warn("Validation failed - missing or empty events array")
      return errorResponse(
        "VALIDATION_ERROR",
        "events array is required and must not be empty",
        { field: "events" },
        400
      )
    }

    // Get driver name from session
    const driverName = session.user.name
    if (!driverName) {
      requestLogger.warn("No driver name in session")
      return errorResponse(
        "VALIDATION_ERROR",
        "Driver name not found in session",
        {},
        400
      )
    }

    // Separate LiveRC events (have source_event_id) from DB events (have event_id)
    const livercEvents: LiveRCEvent[] = []
    const dbEvents: Array<{ eventId: string }> = []

    for (const event of events) {
      if (event.source_event_id) {
        // LiveRC event - requires track_slug
        if (!track_slug || typeof track_slug !== "string") {
          requestLogger.warn("Validation failed - missing track_slug for LiveRC event")
          return errorResponse(
            "VALIDATION_ERROR",
            "track_slug is required for LiveRC events",
            { field: "track_slug" },
            400
          )
        }
        livercEvents.push({
          sourceEventId: event.source_event_id,
          trackSlug: track_slug,
        })
      } else if (event.event_id) {
        // DB event - doesn't need track_slug
        dbEvents.push({
          eventId: event.event_id,
        })
      } else {
        requestLogger.warn("Validation failed - event missing source_event_id or event_id", {
          event,
        })
        return errorResponse(
          "VALIDATION_ERROR",
          "Each event must have either source_event_id (for LiveRC events) or event_id (for DB events)",
          { field: "events" },
          400
        )
      }
    }

    requestLogger.debug("Separated events", {
      livercEventCount: livercEvents.length,
      dbEventCount: dbEvents.length,
    })

    // Add overall timeout for the entire operation (5 minutes max)
    // This prevents the API route from hanging indefinitely
    const overallTimeoutMs = 5 * 60 * 1000 // 5 minutes
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Entry list check timed out after ${overallTimeoutMs / 1000} seconds. Some events may still be processing.`))
      }, overallTimeoutMs)
    })

    // Call core business logic function with timeout
    const result = await Promise.race([
      checkEntryListsForDriver(livercEvents, dbEvents, driverName),
      timeoutPromise,
    ])

    requestLogger.info("Entry list check completed", {
      driverName,
      checkedEvents: livercEvents.length,
      foundInEvents: Object.values(result.driverInEvents).filter(Boolean).length,
      errors: Object.keys(result.errors).length,
    })

    return successResponse({
      driver_in_events: result.driverInEvents,
      errors: result.errors,
    })
  } catch (error: unknown) {
    // Handle unexpected errors
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      undefined,
      errorInfo.statusCode
    )
  }
}

