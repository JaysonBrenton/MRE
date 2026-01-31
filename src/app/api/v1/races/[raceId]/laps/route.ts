// @fileoverview Race laps API route
//
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
//
// @description API route for getting lap data for all drivers in a race
//
// @purpose Provides user-facing API for multi-driver lap data overlays

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getRaceWithLaps } from "@/core/races/repo"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ raceId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized race laps request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const { raceId } = await params
    const race = await getRaceWithLaps(raceId)

    if (!race) {
      requestLogger.warn("Race not found", { raceId })
      return errorResponse("NOT_FOUND", "Race not found", {}, 404)
    }

    requestLogger.info("Race laps fetched successfully", {
      raceId,
      driversCount: race.results.length,
    })

    return successResponse({
      race_id: race.id,
      series: race.results.map((result: (typeof race.results)[0]) => ({
        race_result_id: result.id,
        driver: {
          race_driver_id: result.raceDriver.id,
          display_name: result.raceDriver.displayName,
          source_driver_id: result.raceDriver.sourceDriverId,
        },
        laps: result.laps.map((lap: (typeof result.laps)[0]) => ({
          lap_number: lap.lapNumber,
          lap_time_seconds: lap.lapTimeSeconds,
          elapsed_race_time: lap.elapsedRaceTime,
        })),
      })),
    })
  } catch (error) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
