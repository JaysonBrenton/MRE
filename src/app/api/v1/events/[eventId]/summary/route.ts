/**
 * @fileoverview Event summary API route
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description API route for getting lightweight event summary
 *
 * @purpose Provides user-facing API for event summary data (metadata + aggregated stats).
 *          This endpoint uses database aggregations and does not load the full event graph,
 *          making it much faster than the full analysis endpoint.
 *          Follows mobile-safe architecture by delegating to core function.
 *
 * @relatedFiles
 * - src/core/events/get-event-analysis-data.ts (business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getEventSummary } from "@/core/events/get-event-analysis-data"
import { successResponse, errorResponse, CACHE_CONTROL } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

// Cache summary data for 1 hour (3600 seconds)
export const revalidate = 3600

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized event summary request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const { eventId } = await params
    const userId = session.user.id
    const summaryData = await getEventSummary(eventId, userId)

    if (!summaryData) {
      requestLogger.warn("Event not found", { eventId })
      return errorResponse("NOT_FOUND", "Event not found", {}, 404)
    }

    requestLogger.info("Event summary fetched successfully", {
      eventId,
      totalRaces: summaryData.summary.totalRaces,
      totalDrivers: summaryData.summary.totalDrivers,
      totalLaps: summaryData.summary.totalLaps,
      topDriversCount: summaryData.topDrivers?.length ?? 0,
      mostConsistentCount: summaryData.mostConsistentDrivers?.length ?? 0,
      bestAvgLapCount: summaryData.bestAvgLapDrivers?.length ?? 0,
      mostImprovedCount: summaryData.mostImprovedDrivers?.length ?? 0,
      hasUserBestLap: !!summaryData.userBestLap,
    })

    // Event summary - cache for 5 minutes
    return successResponse(
      {
        event: {
          id: summaryData.event.id,
          eventName: summaryData.event.eventName,
          eventDate: summaryData.event.eventDate.toISOString(),
          trackName: summaryData.event.trackName,
        },
        summary: {
          totalRaces: summaryData.summary.totalRaces,
          totalDrivers: summaryData.summary.totalDrivers,
          totalLaps: summaryData.summary.totalLaps,
          dateRange: {
            earliest: summaryData.summary.dateRange.earliest?.toISOString() || null,
            latest: summaryData.summary.dateRange.latest?.toISOString() || null,
          },
        },
        topDrivers: summaryData.topDrivers,
        mostConsistentDrivers: summaryData.mostConsistentDrivers,
        bestAvgLapDrivers: summaryData.bestAvgLapDrivers,
        mostImprovedDrivers: summaryData.mostImprovedDrivers,
        userBestLap: summaryData.userBestLap,
        userBestConsistency: summaryData.userBestConsistency,
        userBestAvgLap: summaryData.userBestAvgLap,
        userBestImprovement: summaryData.userBestImprovement,
      },
      200,
      undefined,
      CACHE_CONTROL.EVENT_SUMMARY
    )
  } catch (error) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
