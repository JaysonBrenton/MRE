/**
 * @fileoverview Event analysis API route
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description API route for getting event analysis data
 * 
 * @purpose Provides user-facing API for event analysis data including races, drivers, and statistics.
 *          Follows mobile-safe architecture by delegating to core function.
 * 
 * @relatedFiles
 * - src/core/events/get-event-analysis-data.ts (business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getEventAnalysisData } from "@/core/events/get-event-analysis-data"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized event analysis request")
    return errorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      {},
      401
    )
  }

  try {
    const { eventId } = await params
    const analysisData = await getEventAnalysisData(eventId)

    if (!analysisData) {
      requestLogger.warn("Event not found", { eventId })
      return errorResponse(
        "NOT_FOUND",
        "Event not found",
        {},
        404
      )
    }

    requestLogger.info("Event analysis data fetched successfully", {
      eventId,
      racesCount: analysisData.races.length,
      driversCount: analysisData.drivers.length,
    })

    // Convert Date objects to ISO strings for JSON serialization
    return successResponse({
      event: {
        id: analysisData.event.id,
        eventName: analysisData.event.eventName,
        eventDate: analysisData.event.eventDate.toISOString(),
        trackName: analysisData.event.trackName,
      },
      races: analysisData.races.map((race) => ({
        ...race,
        startTime: race.startTime?.toISOString() || null,
      })),
      drivers: analysisData.drivers,
      entryList: analysisData.entryList,
      summary: {
        totalRaces: analysisData.summary.totalRaces,
        totalDrivers: analysisData.summary.totalDrivers,
        totalLaps: analysisData.summary.totalLaps,
        dateRange: {
          earliest: analysisData.summary.dateRange.earliest?.toISOString() || null,
          latest: analysisData.summary.dateRange.latest?.toISOString() || null,
        },
      },
    })
  } catch (error) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      undefined,
      errorInfo.statusCode
    )
  }
}

