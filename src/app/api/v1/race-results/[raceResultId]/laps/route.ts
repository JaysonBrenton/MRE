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
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ raceResultId: string }> }
) {
  try {
    const { raceResultId } = await params;
    const result = await getRaceResultWithLaps(raceResultId);

    if (!result) {
      return errorResponse(
        "NOT_FOUND",
        "Race result not found",
        {},
        404
      );
    }

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
    console.error("Error fetching laps:", error);
    return serverErrorResponse("Failed to fetch laps");
  }
}

