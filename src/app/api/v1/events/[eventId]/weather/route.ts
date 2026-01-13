/**
 * @fileoverview Event weather API route
 * 
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 * 
 * @description API route for getting weather data for an event
 * 
 * @purpose Provides user-facing API for event weather data (current conditions, forecast).
 *          Follows mobile-safe architecture by delegating to core function.
 * 
 * @relatedFiles
 * - src/core/weather/get-weather-for-event.ts (business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getWeatherForEvent } from "@/core/weather/get-weather-for-event"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

// Cache weather data for 5 minutes (300 seconds)
// Note: Actual caching is handled in the database, this is just HTTP cache
export const revalidate = 300

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized weather request")
    return errorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      {},
      401
    )
  }

  try {
    const { eventId } = await params
    const weatherData = await getWeatherForEvent(eventId)

    requestLogger.info("Weather data fetched successfully", {
      eventId,
      isCached: weatherData.isCached,
    })

    return successResponse(weatherData)
  } catch (error) {
    const errorInfo = handleApiError(error, request, requestId)
    
    // If event not found, return 404
    if (errorInfo.message.includes("Event not found") || errorInfo.message.includes("not found")) {
      return errorResponse(
        "NOT_FOUND",
        "Event not found",
        {},
        404
      )
    }

    // For service unavailable (API failures with no cache), return 503
    if (
      errorInfo.message.includes("no cache available") || 
      errorInfo.message.includes("Failed to fetch") ||
      errorInfo.message.includes("Network error") ||
      errorInfo.message.includes("network connectivity") ||
      errorInfo.message.includes("Unable to reach")
    ) {
      return errorResponse(
        "SERVICE_UNAVAILABLE",
        "Weather service unavailable",
        {},
        503
      )
    }

    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      undefined,
      errorInfo.statusCode
    )
  }
}

