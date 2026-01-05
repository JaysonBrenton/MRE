// @fileoverview Events API route
//
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
//
// @description API route for fetching all fully imported events
//
// @purpose Provides user-facing API for retrieving all events with full ingestion.
//          This route delegates to core repository functions, following the
//          mobile-safe architecture requirement that API routes should not contain
//          business logic or Prisma queries.

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getAllImportedEvents } from "@/core/events/repo"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

// Cache events list for 30 minutes (1800 seconds)
export const revalidate = 1800

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized events list request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams

    // Pagination
    const limitParam = searchParams.get("limit")
    const offsetParam = searchParams.get("offset")
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 20
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10)) : 0

    // Filters
    const trackId = searchParams.get("trackId") || undefined
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")
    const statusParam = searchParams.get("status")
    const orderByParam = searchParams.get("orderBy")
    const orderDirectionParam = searchParams.get("orderDirection")

    // Parse dates
    let startDate: Date | undefined
    let endDate: Date | undefined
    if (startDateParam) {
      startDate = new Date(startDateParam)
      if (isNaN(startDate.getTime())) {
        startDate = undefined
      }
    }
    if (endDateParam) {
      endDate = new Date(endDateParam)
      if (isNaN(endDate.getTime())) {
        endDate = undefined
      }
    }

    // Parse status (imported | all)
    const status = statusParam === "all" ? "all" : "imported"

    // Parse orderBy
    const validOrderBy = ["eventDate", "eventName", "trackName", "eventEntries", "eventDrivers"]
    const orderBy =
      orderByParam && validOrderBy.includes(orderByParam)
        ? (orderByParam as
            | "eventDate"
            | "eventName"
            | "trackName"
            | "eventEntries"
            | "eventDrivers")
        : "eventDate"

    // Parse orderDirection
    const orderDirection = orderDirectionParam === "asc" ? "asc" : "desc"

    // Parse filter parameter (optional - "my" to filter to user's events)
    const filterParam = searchParams.get("filter")
    const userId = filterParam === "my" ? session.user.id : undefined

    const result = await getAllImportedEvents({
      limit,
      offset,
      trackId,
      startDate,
      endDate,
      status,
      orderBy,
      orderDirection,
      userId,
    })

    requestLogger.info("Events list retrieved successfully", {
      eventCount: result.events.length,
      total: result.total,
      limit,
      offset,
      trackId,
      status,
      orderBy,
      orderDirection,
      userId: userId || null,
    })

    // Event list - cache for 5 minutes (moderately cacheable)
    return successResponse(
      {
        events: result.events,
        pagination: {
          total: result.total,
          limit,
          offset,
        },
      },
      200,
      undefined,
      CACHE_CONTROL.EVENT_SUMMARY
    )
  } catch (error: unknown) {
    // Handle unexpected errors using server error handler
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
