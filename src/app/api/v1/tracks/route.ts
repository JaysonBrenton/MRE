// @fileoverview Tracks API route
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description API route for track catalogue operations
// 
// @purpose Provides user-facing API for querying tracks from database.
//          This route delegates to core business logic functions, following
//          the mobile-safe architecture requirement that API routes should
//          not contain business logic or Prisma queries.

import { NextRequest } from "next/server";
import { getTracks } from "@/core/tracks/get-tracks";
import { successResponse, serverErrorResponse } from "@/lib/api-utils";

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const followedParam = searchParams.get("followed");
    const activeParam = searchParams.get("active");

    // Parse query parameters (default to true if not specified)
    const followed = followedParam !== "false";
    const active = activeParam !== "false";

    // Call core business logic function
    const tracks = await getTracks({
      followed,
      active,
    });

    return successResponse({ tracks });
  } catch (error: unknown) {
    // Handle unexpected errors (e.g., database connection errors)
    if (hasErrorMessage(error)) {
      console.error("Tracks API unexpected error:", {
        message: error.message,
        stack: error instanceof Error ? error.stack : undefined
      })
    } else {
      console.error("Tracks API unexpected error:", error)
    }
    return serverErrorResponse("Failed to fetch tracks")
  }
}

