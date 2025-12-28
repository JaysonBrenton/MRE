/**
 * @fileoverview Driver persona events API endpoint
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description API endpoint for getting events where Driver persona participated
 * 
 * @purpose This endpoint returns events where the Driver persona participated,
 *          using fuzzy matching via UserDriverLink and EventDriverLink.
 * 
 * @relatedFiles
 * - src/core/personas/driver-events.ts (driver event discovery logic)
 * - docs/architecture/mobile-safe-architecture-guidelines.md (API standards)
 */

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserPersona } from "@/core/personas/repo"
import { discoverDriverEvents, getDriverEvents } from "@/core/personas/driver-events"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { logger } from "@/lib/logger"

/**
 * GET /api/v1/personas/driver/events
 * 
 * Returns events where Driver persona participated using fuzzy matching
 * 
 * Query parameters:
 * - matchType: Filter by match type (transponder, exact, fuzzy) - comma-separated
 * - minSimilarityScore: Minimum similarity score (0-1)
 * - confirmedOnly: Only return confirmed matches (true/false)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return errorResponse(
        "UNAUTHORIZED",
        "Authentication required",
        undefined,
        401
      )
    }

    // Verify user has Driver persona
    const persona = await getUserPersona(session.user.id)
    if (!persona || persona.type !== "driver") {
      return errorResponse(
        "INVALID_PERSONA",
        "User does not have Driver persona",
        undefined,
        400
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const matchTypeParam = searchParams.get("matchType")
    const minSimilarityScoreParam = searchParams.get("minSimilarityScore")
    const confirmedOnlyParam = searchParams.get("confirmedOnly")

    const options: Parameters<typeof getDriverEvents>[1] = {}

    if (matchTypeParam) {
      const matchTypes = matchTypeParam.split(",").map(t => t.trim()) as Array<"transponder" | "exact" | "fuzzy">
      options.matchType = matchTypes
    }

    if (minSimilarityScoreParam) {
      const score = parseFloat(minSimilarityScoreParam)
      if (!isNaN(score)) {
        options.minSimilarityScore = score
      }
    }

    if (confirmedOnlyParam === "true") {
      options.confirmedOnly = true
    }

    // Get events with optional filtering
    const { events, participationDetails } = options.matchType || options.minSimilarityScore !== undefined || options.confirmedOnly
      ? await getDriverEvents(session.user.id, options)
      : await discoverDriverEvents(session.user.id)

    return successResponse({
      events,
      participationDetails
    })
  } catch (error) {
    logger.error("Error fetching driver events", {
      error: error instanceof Error ? error.message : String(error)
    })

    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to fetch driver events",
      undefined,
      500
    )
  }
}

