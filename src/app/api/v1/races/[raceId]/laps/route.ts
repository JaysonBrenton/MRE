// @fileoverview Race laps API route
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description API route for getting lap data for all drivers in a race
// 
// @purpose Provides user-facing API for multi-driver lap data overlays

import { NextRequest } from "next/server";
import { getRaceWithLaps } from "@/core/races/repo";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const { raceId } = await params;
    const race = await getRaceWithLaps(raceId);

    if (!race) {
      return errorResponse(
        "NOT_FOUND",
        "Race not found",
        {},
        404
      );
    }

    return successResponse({
      race_id: race.id,
      series: race.results.map((result: typeof race.results[0]) => ({
        race_result_id: result.id,
        driver: {
          race_driver_id: result.raceDriver.id,
          display_name: result.raceDriver.displayName,
          source_driver_id: result.raceDriver.sourceDriverId,
        },
        laps: result.laps.map((lap: typeof result.laps[0]) => ({
          lap_number: lap.lapNumber,
          lap_time_seconds: lap.lapTimeSeconds,
          elapsed_race_time: lap.elapsedRaceTime,
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching race laps:", error);
    return serverErrorResponse("Failed to fetch race laps");
  }
}

