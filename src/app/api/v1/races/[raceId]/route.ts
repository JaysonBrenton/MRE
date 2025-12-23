// @fileoverview Race detail API route
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description API route for getting race results
// 
// @purpose Provides user-facing API for race data

import { NextRequest } from "next/server";
import { getRaceWithResults } from "@/core/races/repo";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { createRequestLogger, generateRequestId } from "@/lib/request-context";
import { handleApiError } from "@/lib/server-error-handler";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ raceId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  try {
    const { raceId } = await params;
    const race = await getRaceWithResults(raceId);

    if (!race) {
      requestLogger.warn("Race not found", { raceId })
      return errorResponse(
        "NOT_FOUND",
        "Race not found",
        {},
        404
      );
    }

    requestLogger.info("Race fetched successfully", {
      raceId,
      resultsCount: race.results.length,
    })

    return successResponse({
      race: {
        id: race.id,
        event_id: race.eventId,
        class_name: race.className,
        race_label: race.raceLabel,
        race_order: race.raceOrder,
        start_time: race.startTime?.toISOString() || null,
        duration_seconds: race.durationSeconds,
      },
      results: race.results.map((result) => ({
        race_result_id: result.id,
        position_final: result.positionFinal,
        laps_completed: result.lapsCompleted,
        total_time_seconds: result.totalTimeSeconds,
        fast_lap_time: result.fastLapTime,
        avg_lap_time: result.avgLapTime,
        consistency: result.consistency,
        driver: {
          race_driver_id: result.raceDriver.id,
          display_name: result.raceDriver.displayName,
          source_driver_id: result.raceDriver.sourceDriverId,
        },
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

