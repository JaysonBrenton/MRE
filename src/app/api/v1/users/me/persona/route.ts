/**
 * @fileoverview User persona API endpoint
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description API endpoint for getting and setting current user's persona
 * 
 * @purpose This endpoint allows users to view their current persona and select
 *          Race Engineer persona. Driver, Admin, and Team Manager personas are
 *          auto-assigned and cannot be manually selected.
 * 
 * @relatedFiles
 * - src/core/personas/repo.ts (persona repository functions)
 * - src/core/personas/assign.ts (persona assignment logic)
 * - src/core/personas/driver-events.ts (driver event discovery)
 * - src/core/personas/team-manager-teams.ts (team member discovery)
 * - docs/architecture/mobile-safe-architecture-guidelines.md (API standards)
 */

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserPersona } from "@/core/personas/repo"
import { assignRaceEngineerPersona } from "@/core/personas/assign"
import { discoverDriverEvents } from "@/core/personas/driver-events"
import { getTeamMembers } from "@/core/personas/team-manager-teams"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/v1/users/me/persona
 * 
 * Returns current user's assigned persona with additional data based on persona type
 */
export async function GET() {
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

    const persona = await getUserPersona(session.user.id)

    if (!persona) {
      return errorResponse(
        "PERSONA_NOT_FOUND",
        "No persona assigned to user",
        undefined,
        404
      )
    }

    // Add persona-specific data
    const responseData: {
      persona: typeof persona
      events?: Awaited<ReturnType<typeof discoverDriverEvents>>["events"]
      participationDetails?: Awaited<ReturnType<typeof discoverDriverEvents>>["participationDetails"]
      teamMembers?: Awaited<ReturnType<typeof getTeamMembers>>["teamMembers"]
      teamName?: string | null
    } = {
      persona
    }

    // Add Driver persona events
    if (persona.type === "driver") {
      const { events, participationDetails } = await discoverDriverEvents(session.user.id)
      responseData.events = events
      responseData.participationDetails = participationDetails
    }

    // Add Team Manager persona team members
    if (persona.type === "team_manager") {
      const { teamMembers, teamName } = await getTeamMembers(session.user.id)
      responseData.teamMembers = teamMembers
      responseData.teamName = teamName
    }

    return successResponse(responseData)
  } catch (error) {
    logger.error("Error fetching user persona", {
      error: error instanceof Error ? error.message : String(error)
    })

    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to fetch user persona",
      undefined,
      500
    )
  }
}

/**
 * POST /api/v1/users/me/persona
 * 
 * Allows users to select Race Engineer persona (other personas are auto-assigned)
 */
export async function POST(request: Request) {
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

    const bodyResult = await parseRequestBody<{ personaId?: string }>(request)
    if (!bodyResult.success) {
      return bodyResult.response
    }
    const { personaId } = bodyResult.data

    if (!personaId || typeof personaId !== "string") {
      return errorResponse(
        "VALIDATION_ERROR",
        "personaId is required",
        undefined,
        400
      )
    }

    // Get the persona to verify it exists and is selectable
    const persona = await prisma.persona.findUnique({
      where: { id: personaId }
    })

    if (!persona) {
      return errorResponse(
        "PERSONA_NOT_FOUND",
        "Persona not found",
        undefined,
        404
      )
    }

    // Only Race Engineer persona can be manually selected
    if (persona.type !== "race_engineer") {
      return errorResponse(
        "INVALID_PERSONA",
        "Only Race Engineer persona can be manually selected",
        undefined,
        400
      )
    }

    // Assign Race Engineer persona
    await assignRaceEngineerPersona(session.user.id)

    // Return updated persona
    const updatedPersona = await getUserPersona(session.user.id)

    return successResponse({ persona: updatedPersona })
  } catch (error) {
    logger.error("Error assigning persona", {
      error: error instanceof Error ? error.message : String(error)
    })

    return errorResponse(
      "INTERNAL_ERROR",
      "Failed to assign persona",
      undefined,
      500
    )
  }
}

