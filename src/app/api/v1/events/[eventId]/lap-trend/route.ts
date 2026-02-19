/**
 * @fileoverview Event lap trend API – lap-by-lap times for selected drivers
 *
 * @description Returns every single lap for the given drivers in event order for trend charting.
 * No auth required – same as GET /api/v1/events/[eventId]/laps (event data is not user-specific).
 *
 * @relatedFiles
 * - src/core/events/get-lap-data.ts (getEventLapTrend)
 * - src/components/organisms/event-analysis/OverviewTab.tsx (consumer)
 */

import { NextRequest } from "next/server"
import { getEventLapTrend } from "@/core/events/get-lap-data"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  try {
    const { eventId } = await params
    const searchParams = request.nextUrl.searchParams
    const driverIdsParam = searchParams.get("driverIds")
    const driverIds =
      driverIdsParam && driverIdsParam.trim() !== ""
        ? driverIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
        : []

    const data = await getEventLapTrend(eventId, driverIds)

    requestLogger.info("Lap trend fetched", {
      eventId,
      driverCount: data.drivers.length,
      totalLaps: data.drivers.reduce((sum, d) => sum + d.laps.length, 0),
    })

    return successResponse(data)
  } catch (error) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
