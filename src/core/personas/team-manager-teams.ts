/**
 * @fileoverview Team Manager persona team discovery
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Functions for discovering team members for Team Manager persona
 *
 * @purpose This file contains business logic for Team Manager persona team discovery,
 *          following the mobile-safe architecture requirement that business logic
 *          must reside in src/core/<domain>/.
 *
 * @relatedFiles
 * - prisma/schema.prisma (User model)
 * - src/core/personas/repo.ts (persona repository functions)
 */

import { prisma } from "@/lib/prisma"
import type { User } from "@prisma/client"

/**
 * Get team members for Team Manager persona
 *
 * Returns all users with matching teamName, excluding the Team Manager themselves.
 *
 * @param teamManagerId - Team Manager user ID
 * @returns List of team members (drivers) in the team
 */
export async function getTeamMembers(teamManagerId: string): Promise<{
  teamMembers: User[]
  teamName: string | null
}> {
  // Get Team Manager user
  const teamManager = await prisma.user.findUnique({
    where: { id: teamManagerId },
    select: {
      id: true,
      teamName: true,
    },
  })

  if (!teamManager) {
    throw new Error("Team Manager not found")
  }

  if (!teamManager.teamName) {
    return {
      teamMembers: [],
      teamName: null,
    }
  }

  // Find all users with matching teamName, excluding the Team Manager
  const teamMembers = await prisma.user.findMany({
    where: {
      teamName: teamManager.teamName,
      id: {
        not: teamManagerId,
      },
      isTeamManager: false, // Only include drivers, not other team managers
    },
    orderBy: {
      driverName: "asc",
    },
  })

  return {
    teamMembers,
    teamName: teamManager.teamName,
  }
}

/**
 * Get team events for Team Manager persona
 *
 * Returns events where any team member participated.
 *
 * @param teamManagerId - Team Manager user ID
 * @returns List of events with team member participation
 */
export async function getTeamEvents(teamManagerId: string): Promise<{
  events: Array<{
    eventId: string
    eventName: string
    eventDate: Date
    participants: Array<{
      userId: string
      driverName: string
    }>
  }>
  teamName: string | null
}> {
  const { teamMembers, teamName } = await getTeamMembers(teamManagerId)

  if (!teamName || teamMembers.length === 0) {
    return {
      events: [],
      teamName,
    }
  }

  // Get event driver links for all team members
  const teamMemberIds = teamMembers.map((m) => m.id)
  const eventDriverLinks = await prisma.eventDriverLink.findMany({
    where: {
      userId: {
        in: teamMemberIds,
      },
      userDriverLink: {
        status: {
          in: ["confirmed", "suggested"],
        },
      },
    },
    include: {
      event: {
        select: {
          id: true,
          eventName: true,
          eventDate: true,
        },
      },
      user: {
        select: {
          id: true,
          driverName: true,
        },
      },
    },
    orderBy: {
      event: {
        eventDate: "desc",
      },
    },
  })

  // Group events by event ID
  const eventMap = new Map<
    string,
    {
      eventId: string
      eventName: string
      eventDate: Date
      participants: Array<{
        userId: string
        driverName: string
      }>
    }
  >()

  for (const link of eventDriverLinks) {
    const eventId = link.event.id
    if (!eventMap.has(eventId)) {
      eventMap.set(eventId, {
        eventId: link.event.id,
        eventName: link.event.eventName,
        eventDate: link.event.eventDate,
        participants: [],
      })
    }

    const event = eventMap.get(eventId)!
    // Add participant if not already added
    if (!event.participants.find((p) => p.userId === link.user.id)) {
      event.participants.push({
        userId: link.user.id,
        driverName: link.user.driverName,
      })
    }
  }

  return {
    events: Array.from(eventMap.values()),
    teamName,
  }
}
