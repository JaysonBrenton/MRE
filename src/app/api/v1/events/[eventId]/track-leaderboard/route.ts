/**
 * @fileoverview Track leaderboard API route – via event (resolves track from event)
 *
 * @description Returns aggregate main-race points leaderboard for the track of the given event.
 *              Supports class and date range filters.
 *
 * @relatedFiles
 * - src/core/tracks/get-track-leaderboard.ts (business logic)
 * - src/components/organisms/event-analysis/TrackLeaderboardTab.tsx (consumer)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTrackLeaderboard } from "@/core/tracks/get-track-leaderboard"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

type DateRangePreset = "this_year" | "last_12_months" | "all_time"

function resolveDateRange(dateRange?: string | null): { startDate?: Date; endDate?: Date } {
  if (!dateRange || dateRange === "all_time") {
    return {}
  }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (dateRange === "this_year") {
    const start = new Date(today.getFullYear(), 0, 1)
    return { startDate: start, endDate: today }
  }
  if (dateRange === "last_12_months") {
    const start = new Date(today)
    start.setFullYear(start.getFullYear() - 1)
    start.setDate(start.getDate() + 1)
    return { startDate: start, endDate: today }
  }
  return {}
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized track leaderboard request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const { eventId } = await params
    const searchParams = request.nextUrl.searchParams
    const className = searchParams.get("class_name") || undefined
    const classesOnly = searchParams.get("classes_only") === "true"
    const dateRange = searchParams.get("date_range") as DateRangePreset | null
    const startDateParam = searchParams.get("start_date")
    const endDateParam = searchParams.get("end_date")

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { trackId: true },
    })
    if (!event) {
      return errorResponse("NOT_FOUND", "Event not found", { eventId }, 404)
    }

    let startDate: Date | undefined
    let endDate: Date | undefined
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam)
      endDate = new Date(endDateParam)
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return errorResponse("VALIDATION_ERROR", "Invalid start_date or end_date", {}, 400)
      }
    } else {
      const resolved = resolveDateRange(dateRange)
      startDate = resolved.startDate
      endDate = resolved.endDate
    }

    const result = await getTrackLeaderboard(event.trackId, {
      className: className || null,
      startDate,
      endDate,
      classesOnly,
    })

    if (!result) {
      return errorResponse("NOT_FOUND", "Track not found", { trackId: event.trackId }, 404)
    }

    requestLogger.info("Track leaderboard fetched", {
      eventId,
      trackId: event.trackId,
      driverCount: result.drivers.length,
      classCount: result.classes.length,
    })

    return successResponse({
      trackName: result.trackName,
      drivers: result.drivers,
      classes: result.classes,
    })
  } catch (error) {
    requestLogger.error("Error in track leaderboard API", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
    })
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
