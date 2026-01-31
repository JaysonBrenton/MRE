// @fileoverview Driver details API route
//
// @created 2025-12-24
// @creator Jayson Brenton
// @lastModified 2025-12-24
//
// @description API route for getting driver details with transponder numbers and event entries
//
// @purpose Provides user-facing API for driver data including transponder numbers and multi-class participation

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getDriverWithEventEntries } from "@/core/drivers/repo"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized driver details request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const { driverId } = await params
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("eventId") || undefined

    const driver = await getDriverWithEventEntries(driverId, eventId)

    if (!driver) {
      requestLogger.warn("Driver not found", { driverId })
      return errorResponse("NOT_FOUND", "Driver not found", {}, 404)
    }

    requestLogger.info("Driver fetched successfully", {
      driverId,
      eventEntriesCount: driver.eventEntries.length,
      eventId: eventId || "all",
    })

    return successResponse({
      id: driver.id,
      display_name: driver.displayName,
      source_driver_id: driver.sourceDriverId,
      transponder_number: driver.transponderNumber,
      event_entries: driver.eventEntries.map((entry) => ({
        event_id: entry.eventId,
        event_name: entry.eventName,
        class_name: entry.className,
        transponder_number: entry.transponderNumber,
        car_number: entry.carNumber,
        override: entry.override
          ? {
              transponder_number: entry.override.transponderNumber,
              effective_from_race_id: entry.override.effectiveFromRaceId,
              effective_from_race_label: entry.override.effectiveFromRaceLabel,
              created_at: entry.override.createdAt.toISOString(),
            }
          : undefined,
      })),
    })
  } catch (error) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
