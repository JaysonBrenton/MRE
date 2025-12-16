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
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ raceId: string }> }
) {
  try {
    const { raceId } = await params;
    const race = await getRaceWithResults(raceId);

    if (!race) {
      return errorResponse(
        "NOT_FOUND",
        "Race not found",
        {},
        404
      );
    }

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
    console.error("Error fetching race:", error);
    return serverErrorResponse("Failed to fetch race");
  }
}

