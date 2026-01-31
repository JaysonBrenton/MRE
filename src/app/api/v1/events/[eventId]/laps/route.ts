/**
 * @fileoverview API endpoint for fetching lap data
 *
 * @created 2025-01-27
 * @creator Auto-generated
 * @lastModified 2025-01-27
 *
 * @description API route for fetching lap data for an event, optionally filtered by class
 *
 * @purpose Provides lap data for the Race Details tab table view.
 *          Follows MRE API format standards.
 *
 * @relatedFiles
 * - src/core/events/get-lap-data.ts (core function)
 * - src/components/event-analysis/sessions/LapDataTable.tsx (consumer)
 */

import { NextRequest, NextResponse } from "next/server"
import { getLapData } from "@/core/events/get-lap-data"

/**
 * GET /api/v1/events/[eventId]/laps
 *
 * Query parameters:
 * - className (optional): Filter by class name
 *
 * Returns lap data grouped by driver and race
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_EVENT_ID",
            message: "Event ID is required and must be a string",
          },
        },
        { status: 400 }
      )
    }

    // Get optional className filter from query params
    const searchParams = request.nextUrl.searchParams
    const className = searchParams.get("className")

    // Normalize className (empty string becomes null)
    const normalizedClassName = className && className.trim() !== "" ? className.trim() : null

    // Fetch lap data
    const lapData = await getLapData(eventId, normalizedClassName)

    if (lapData === null) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EVENT_NOT_FOUND",
            message: "Event not found",
          },
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: lapData,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[API] Error fetching lap data:", error)

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An error occurred while fetching lap data",
          details: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    )
  }
}
