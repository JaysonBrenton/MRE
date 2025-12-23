// @fileoverview Lap data API route
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description API route for getting lap data for a race result
// 
// @purpose Provides user-facing API for lap time series data

import { NextRequest } from "next/server";
import { getRaceResultWithLaps } from "@/core/race-results/repo";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { createRequestLogger, generateRequestId } from "@/lib/request-context";
import { handleApiError } from "@/lib/server-error-handler";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ raceResultId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  try {
    const { raceResultId } = await params;
    const result = await getRaceResultWithLaps(raceResultId);

    if (!result) {
      requestLogger.warn("Race result not found", { raceResultId })
      return errorResponse(
        "NOT_FOUND",
        "Race result not found",
        {},
        404
      );
    }

    requestLogger.info("Race result laps fetched successfully", {
      raceResultId,
      lapsCount: result.laps.length,
    })

    return successResponse({
      race_result_id: result.id,
      laps: result.laps.map((lap) => ({
        lap_number: lap.lapNumber,
        position_on_lap: lap.positionOnLap,
        lap_time_seconds: lap.lapTimeSeconds,
        lap_time_raw: lap.lapTimeRaw,
        pace_string: lap.paceString,
        elapsed_race_time: lap.elapsedRaceTime,
        segments_json: lap.segmentsJson,
      })),
    });
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

