// @fileoverview Event search API route
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description API route for searching events by track and date range
// 
// @purpose Provides user-facing API for event discovery. This route delegates
//          to core business logic functions, following the mobile-safe architecture
//          requirement that API routes should not contain business logic or
//          Prisma queries.

import { NextRequest } from "next/server";
import { searchEvents } from "@/core/events/search-events";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/api-utils";

/**
 * Type guard to check if error has a message property
 */
function hasErrorMessage(error: unknown): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  )
}

/**
 * Type guard to check if error has code and message properties
 */
function hasErrorCode(error: unknown): error is { code: string; message: string; field?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    typeof (error as { message: unknown }).message === "string"
  )
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const trackId = searchParams.get("track_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    // Call core business logic function (will validate and throw if invalid)
    // Only include dates if they are provided (not empty strings)
    const searchInput: any = {
      trackId: trackId || "",
    }
    
    if (startDate && startDate.trim() !== "") {
      searchInput.startDate = startDate
    }
    
    if (endDate && endDate.trim() !== "") {
      searchInput.endDate = endDate
    }
    
    const result = await searchEvents(searchInput);

    return successResponse({
      track: {
        id: result.track.id,
        source: result.track.source,
        source_track_slug: result.track.sourceTrackSlug,
        track_name: result.track.trackName,
      },
      events: result.events,
    });
  } catch (error: unknown) {
    // Handle validation errors
    if (hasErrorCode(error)) {
      if (error.code === "VALIDATION_ERROR") {
        return errorResponse(
          error.code,
          error.message,
          error.field ? { field: error.field } : {},
          400
        );
      }
    }

    // Handle "Track not found" error from repo
    if (error instanceof Error && error.message === "Track not found") {
      return errorResponse(
        "NOT_FOUND",
        "Track not found",
        {},
        404
      );
    }

    // Handle unexpected errors (e.g., database connection errors)
    if (hasErrorMessage(error)) {
      console.error("Event search API unexpected error:", {
        message: error.message,
        stack: error instanceof Error ? error.stack : undefined
      })
    } else {
      console.error("Event search API unexpected error:", error)
    }
    return serverErrorResponse("Failed to search events")
  }
}

