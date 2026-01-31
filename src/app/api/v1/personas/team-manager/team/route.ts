/**
 * @fileoverview Team Manager persona team API endpoint
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description API endpoint for getting team members for Team Manager persona
 *
 * @purpose This endpoint returns team members (drivers) in the Team Manager's team,
 *          identified by matching teamName.
 *
 * @relatedFiles
 * - src/core/personas/team-manager-teams.ts (team member discovery logic)
 * - docs/architecture/mobile-safe-architecture-guidelines.md (API standards)
 */

import { auth } from "@/lib/auth"
import { getUserPersona } from "@/core/personas/repo"
import { getTeamMembers, getTeamEvents } from "@/core/personas/team-manager-teams"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { logger } from "@/lib/logger"

/**
 * GET /api/v1/personas/team-manager/team
 *
 * Returns team members for Team Manager persona
 *
 * Query parameters:
 * - includeEvents: Include team events (true/false)
 */
export async function GET(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    // Verify user has Team Manager persona
    const persona = await getUserPersona(session.user.id)
    if (!persona || persona.type !== "team_manager") {
      return errorResponse(
        "INVALID_PERSONA",
        "User does not have Team Manager persona",
        undefined,
        400
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const includeEventsParam = searchParams.get("includeEvents")

    // Get team members
    const { teamMembers, teamName } = await getTeamMembers(session.user.id)

    const responseData: {
      teamMembers: typeof teamMembers
      teamName: string | null
      events?: Awaited<ReturnType<typeof getTeamEvents>>["events"]
    } = {
      teamMembers,
      teamName,
    }

    // Optionally include team events
    if (includeEventsParam === "true") {
      const { events } = await getTeamEvents(session.user.id)
      responseData.events = events
    }

    return successResponse(responseData)
  } catch (error) {
    logger.error("Error fetching team manager team", {
      error: error instanceof Error ? error.message : String(error),
    })

    return errorResponse("INTERNAL_ERROR", "Failed to fetch team manager team", undefined, 500)
  }
}
