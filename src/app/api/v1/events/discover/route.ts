// @fileoverview LiveRC event discovery API route
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description API route for discovering events from LiveRC
// 
// @purpose Provides user-facing API for LiveRC event discovery. This route
//          delegates to core business logic functions, following the mobile-safe
//          architecture requirement that API routes should not contain business logic.

import { NextRequest } from "next/server";
import { discoverLiveRCEvents } from "@/core/events/discover-liverc-events";
import { getTrackById } from "@/core/tracks/repo";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { track_id, start_date, end_date } = body;

    // Validate required fields
    if (!track_id) {
      return errorResponse(
        "VALIDATION_ERROR",
        "track_id is required",
        { field: "track_id" },
        400
      );
    }

    // Look up track to get track slug
    const track = await getTrackById(track_id);

    if (!track) {
      return errorResponse(
        "NOT_FOUND",
        "Track not found",
        { track_id },
        404
      );
    }

    // Call core business logic function
    // Note: start_date and end_date are optional for discovery
    // If not provided, we'll discover all events (no date filtering)
    const result = await discoverLiveRCEvents({
      trackId: track.id,
      startDate: start_date,
      endDate: end_date,
    });

    return successResponse({
      new_events: result.newEvents,
      existing_events: result.existingEvents,
    });
  } catch (error: unknown) {
    console.error("Error discovering LiveRC events:", error);
    
    // Handle known error types
    if (error instanceof Error) {
      if (error.message.includes("Discovery failed")) {
        return errorResponse(
          "DISCOVERY_FAILED",
          error.message,
          {},
          500
        );
      }
    }
    
    return serverErrorResponse("Failed to discover events from LiveRC");
  }
}

