/**
 * @fileoverview Core business logic for user-driver links
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-21
 *
 * @description Functions for retrieving and updating user-driver link status
 *
 * @purpose Provides core domain logic for reading and updating driver links, following
 *          mobile-safe architecture guidelines. Link creation happens automatically
 *          server-side, but users can confirm or reject suggested links.
 *
 * @relatedFiles
 * - src/core/users/repo.ts (database access)
 * - src/app/api/v1/users/[userId]/driver-links/route.ts (API endpoint)
 */

import { prisma } from "@/lib/prisma"
import { normalizeDriverName } from "@/core/users/name-normalizer"

export type DriverLinkStatus = {
  driverId: string
  driverName: string
  status: "confirmed" | "suggested" | "rejected" | "conflict"
  similarityScore: number
  matchedAt: Date
  confirmedAt: Date | null
  rejectedAt: Date | null
  conflictReason: string | null
  eventCount: number
  matchType: "transponder" | "exact" | "fuzzy"
}

/**
 * Get all driver links for a user (all statuses).
 *
 * @param userId - User ID
 * @returns Array of driver link statuses
 */
export async function getUserDriverLinks(userId: string): Promise<DriverLinkStatus[]> {
  const links = await prisma.userDriverLink.findMany({
    where: { userId },
    include: {
      driver: true,
      events: {
        select: {
          id: true,
          matchType: true,
        },
      },
    },
    orderBy: [
      { status: "asc" }, // confirmed first, then suggested, then conflict/rejected
      { similarityScore: "desc" },
    ],
  })

  return links.map((link) => {
    // Get match type from events (prefer transponder, then exact, then fuzzy)
    let matchType: DriverLinkStatus["matchType"] = "fuzzy"
    if (link.events.length > 0) {
      const transponderEvent = link.events.find((e) => e.matchType === "transponder")
      const exactEvent = link.events.find((e) => e.matchType === "exact")
      if (transponderEvent) {
        matchType = "transponder"
      } else if (exactEvent) {
        matchType = "exact"
      } else {
        matchType = "fuzzy"
      }
    }

    return {
      driverId: link.driverId,
      driverName: link.driver.displayName,
      status: link.status.toLowerCase() as DriverLinkStatus["status"],
      similarityScore: link.similarityScore,
      matchedAt: link.matchedAt,
      confirmedAt: link.confirmedAt,
      rejectedAt: link.rejectedAt,
      conflictReason: link.conflictReason,
      eventCount: link.events.length,
      matchType,
    }
  })
}

/**
 * Get driver links filtered by status.
 *
 * @param userId - User ID
 * @param status - Status to filter by
 * @returns Array of driver link statuses
 */
export async function getUserDriverLinksByStatus(
  userId: string,
  status: "confirmed" | "suggested" | "rejected" | "conflict"
): Promise<DriverLinkStatus[]> {
  const links = await getUserDriverLinks(userId)
  return links.filter((link) => link.status === status)
}

/**
 * Get all drivers linked to a user (with status).
 *
 * @param userId - User ID
 * @returns Array of driver link statuses (confirmed and suggested only)
 */
export async function getUserLinkedDrivers(userId: string): Promise<DriverLinkStatus[]> {
  const links = await getUserDriverLinks(userId)
  return links.filter((link) => link.status === "confirmed" || link.status === "suggested")
}

/**
 * Get status of specific driver link.
 *
 * @param userId - User ID
 * @param driverId - Driver ID
 * @returns Driver link status or null if not found
 */
export async function getDriverLinkStatus(
  userId: string,
  driverId: string
): Promise<DriverLinkStatus | null> {
  const link = await prisma.userDriverLink.findUnique({
    where: {
      userId_driverId: {
        userId,
        driverId,
      },
    },
    include: {
      driver: true,
      events: {
        select: {
          id: true,
          matchType: true,
        },
        orderBy: {
          matchedAt: "desc",
        },
      },
    },
  })

  if (!link) {
    return null
  }

  // Get match type from events (prefer transponder, then exact, then fuzzy)
  let matchType: DriverLinkStatus["matchType"] = "fuzzy"
  if (link.events.length > 0) {
    const transponderEvent = link.events.find((e) => e.matchType === "transponder")
    const exactEvent = link.events.find((e) => e.matchType === "exact")
    if (transponderEvent) {
      matchType = "transponder"
    } else if (exactEvent) {
      matchType = "exact"
    } else {
      matchType = "fuzzy"
    }
  }

  return {
    driverId: link.driverId,
    driverName: link.driver.displayName,
    status: link.status.toLowerCase() as DriverLinkStatus["status"],
    similarityScore: link.similarityScore,
    matchedAt: link.matchedAt,
    confirmedAt: link.confirmedAt,
    rejectedAt: link.rejectedAt,
    conflictReason: link.conflictReason,
    eventCount: link.events.length,
    matchType,
  }
}

/**
 * Get all links with conflict or rejected status.
 *
 * @param userId - User ID
 * @returns Array of driver link statuses (conflict and rejected only)
 */
export async function getConflicts(userId: string): Promise<DriverLinkStatus[]> {
  const links = await getUserDriverLinks(userId)
  return links.filter((link) => link.status === "conflict" || link.status === "rejected")
}

/**
 * Get all events where user's linked drivers participated.
 *
 * @param userId - User ID
 * @returns Array of event IDs
 */
export async function getUserLinkedEvents(userId: string): Promise<string[]> {
  const eventLinks = await prisma.eventDriverLink.findMany({
    where: { userId },
    select: {
      eventId: true,
    },
    distinct: ["eventId"],
  })

  return eventLinks.map((link) => link.eventId)
}

/**
 * Update UserDriverLink status (confirm or reject).
 *
 * This function handles both cases:
 * 1. If a UserDriverLink exists, update its status
 * 2. If no UserDriverLink exists but there's an EventDriverLink, create one
 *
 * @param userId - User ID
 * @param driverId - Driver ID
 * @param status - New status ("confirmed" or "rejected")
 * @returns Updated driver link status
 */
export async function updateDriverLinkStatus(
  userId: string,
  driverId: string,
  status: "confirmed" | "rejected"
): Promise<DriverLinkStatus> {
  // Find existing UserDriverLink
  let userDriverLink = await prisma.userDriverLink.findUnique({
    where: {
      userId_driverId: {
        userId,
        driverId,
      },
    },
    include: {
      driver: true,
      events: {
        select: {
          id: true,
          matchType: true,
        },
      },
    },
  })

  // If no UserDriverLink exists, check if there's an EventDriverLink to base it on
  if (!userDriverLink) {
    const eventDriverLink = await prisma.eventDriverLink.findFirst({
      where: {
        userId,
        driverId,
      },
      orderBy: {
        matchedAt: "desc",
      },
    })

    if (!eventDriverLink) {
      throw new Error("No driver link found for this user and driver")
    }

    // Create UserDriverLink based on EventDriverLink
    userDriverLink = await prisma.userDriverLink.create({
      data: {
        userId,
        driverId,
        status: status as "confirmed" | "rejected",
        similarityScore: eventDriverLink.similarityScore,
        matchedAt: eventDriverLink.matchedAt,
        confirmedAt: status === "confirmed" ? new Date() : null,
        rejectedAt: status === "rejected" ? new Date() : null,
        matcherId: "manual",
        matcherVersion: "1.0.0",
      },
      include: {
        driver: true,
        events: {
          select: {
            id: true,
            matchType: true,
          },
        },
      },
    })

    // Update EventDriverLink to reference the new UserDriverLink
    await prisma.eventDriverLink.updateMany({
      where: {
        userId,
        driverId,
        userDriverLinkId: null,
      },
      data: {
        userDriverLinkId: userDriverLink.id,
      },
    })
  } else {
    // Update existing UserDriverLink
    const updateData: {
      status: "confirmed" | "rejected"
      confirmedAt?: Date | null
      rejectedAt?: Date | null
    } = {
      status: status as "confirmed" | "rejected",
    }

    if (status === "confirmed") {
      updateData.confirmedAt = new Date()
      updateData.rejectedAt = null
    } else {
      updateData.rejectedAt = new Date()
      updateData.confirmedAt = null
    }

    userDriverLink = await prisma.userDriverLink.update({
      where: {
        userId_driverId: {
          userId,
          driverId,
        },
      },
      data: updateData,
      include: {
        driver: true,
        events: {
          select: {
            id: true,
            matchType: true,
          },
        },
      },
    })

    // Link any orphaned EventDriverLink records to this UserDriverLink
    // This ensures events added after the UserDriverLink was created are properly linked
    const linkResult = await prisma.eventDriverLink.updateMany({
      where: {
        userId,
        driverId,
        userDriverLinkId: null,
      },
      data: {
        userDriverLinkId: userDriverLink.id,
      },
    })

    if (linkResult.count > 0) {
      console.log(
        `[updateDriverLinkStatus] Linked ${linkResult.count} orphaned EventDriverLink records to UserDriverLink ${userDriverLink.id}`
      )
    }
  }

  // Get match type from events
  let matchType: DriverLinkStatus["matchType"] = "fuzzy"
  if (userDriverLink.events.length > 0) {
    const transponderEvent = userDriverLink.events.find((e) => e.matchType === "transponder")
    const exactEvent = userDriverLink.events.find((e) => e.matchType === "exact")
    if (transponderEvent) {
      matchType = "transponder"
    } else if (exactEvent) {
      matchType = "exact"
    } else {
      matchType = "fuzzy"
    }
  }

  return {
    driverId: userDriverLink.driverId,
    driverName: userDriverLink.driver.displayName,
    status: userDriverLink.status.toLowerCase() as DriverLinkStatus["status"],
    similarityScore: userDriverLink.similarityScore,
    matchedAt: userDriverLink.matchedAt,
    confirmedAt: userDriverLink.confirmedAt,
    rejectedAt: userDriverLink.rejectedAt,
    conflictReason: userDriverLink.conflictReason,
    eventCount: userDriverLink.events.length,
    matchType,
  }
}

/**
 * Update EventDriverLink status based on event ID.
 *
 * This function updates the per-event status for a specific user-event link.
 * Each event can have its own status (confirmed/rejected/suggested) independent
 * of other events for the same driver.
 *
 * Handles two cases:
 * 1. If an EventDriverLink exists, update its status directly
 * 2. If no EventDriverLink exists but there's an EventEntry matching the user's driver name,
 *    create an EventDriverLink with the requested status
 *
 * @param userId - User ID
 * @param eventId - Event ID
 * @param status - New status ("confirmed" or "rejected")
 * @returns Updated driver link status
 */
export async function updateDriverLinkStatusByEvent(
  userId: string,
  eventId: string,
  status: "confirmed" | "rejected"
): Promise<DriverLinkStatus> {
  console.log("[updateDriverLinkStatusByEvent] Called with:", { userId, eventId, status })

  // Find EventDriverLink for this user and event
  let eventDriverLink = await prisma.eventDriverLink.findFirst({
    where: {
      userId,
      eventId,
    },
    include: {
      driver: true,
    },
  })

  console.log("[updateDriverLinkStatusByEvent] EventDriverLink lookup result:", {
    found: !!eventDriverLink,
    eventDriverLinkId: eventDriverLink?.id,
    driverId: eventDriverLink?.driverId,
    matchType: eventDriverLink?.matchType,
    currentStatus: eventDriverLink?.status,
  })

  // If no EventDriverLink exists, try to find one through EventEntry
  if (!eventDriverLink) {
    console.log(
      "[updateDriverLinkStatusByEvent] No EventDriverLink found, trying EventEntry lookup"
    )

    // Get user's normalized driver name
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        driverName: true,
        normalizedName: true,
      },
    })

    console.log("[updateDriverLinkStatusByEvent] User lookup result:", {
      found: !!user,
      driverName: user?.driverName,
      normalizedName: user?.normalizedName,
    })

    if (!user) {
      console.error("[updateDriverLinkStatusByEvent] User not found")
      throw new Error("User not found")
    }

    const normalizedDriverName = user.normalizedName || normalizeDriverName(user.driverName)
    console.log("[updateDriverLinkStatusByEvent] Normalized driver name:", normalizedDriverName)

    // Find EventEntry for this event with matching driver name
    const eventEntry = await prisma.eventEntry.findFirst({
      where: {
        eventId,
        driver: {
          normalizedName: normalizedDriverName,
        },
      },
      include: {
        driver: true,
      },
    })

    console.log("[updateDriverLinkStatusByEvent] EventEntry lookup result:", {
      found: !!eventEntry,
      driverId: eventEntry?.driverId,
      driverName: eventEntry?.driver?.displayName,
    })

    if (!eventEntry) {
      console.error("[updateDriverLinkStatusByEvent] No EventEntry found for user and event")
      throw new Error("No driver link found for this user and event")
    }

    // Create EventDriverLink based on EventEntry with the requested status
    eventDriverLink = await prisma.eventDriverLink.create({
      data: {
        userId,
        eventId,
        driverId: eventEntry.driverId,
        matchType: "exact",
        similarityScore: 1.0,
        matchedAt: new Date(),
        status: status,
        confirmedAt: status === "confirmed" ? new Date() : null,
        rejectedAt: status === "rejected" ? new Date() : null,
      },
      include: {
        driver: true,
      },
    })

    console.log("[updateDriverLinkStatusByEvent] Created new EventDriverLink:", {
      id: eventDriverLink.id,
      status: eventDriverLink.status,
    })
  } else {
    // Update the existing EventDriverLink's per-event status
    const updateData: {
      status: "confirmed" | "rejected"
      confirmedAt?: Date | null
      rejectedAt?: Date | null
    } = {
      status: status,
    }

    if (status === "confirmed") {
      updateData.confirmedAt = new Date()
      updateData.rejectedAt = null
    } else {
      updateData.rejectedAt = new Date()
      updateData.confirmedAt = null
    }

    eventDriverLink = await prisma.eventDriverLink.update({
      where: {
        id: eventDriverLink.id,
      },
      data: updateData,
      include: {
        driver: true,
      },
    })

    console.log("[updateDriverLinkStatusByEvent] Updated EventDriverLink:", {
      id: eventDriverLink.id,
      status: eventDriverLink.status,
      confirmedAt: eventDriverLink.confirmedAt,
      rejectedAt: eventDriverLink.rejectedAt,
    })
  }

  // Return a DriverLinkStatus object for API compatibility
  // Note: This returns the per-event status, not the overall driver link status
  return {
    driverId: eventDriverLink.driverId,
    driverName: eventDriverLink.driver.displayName,
    status: eventDriverLink.status.toLowerCase() as DriverLinkStatus["status"],
    similarityScore: eventDriverLink.similarityScore,
    matchedAt: eventDriverLink.matchedAt,
    confirmedAt: eventDriverLink.confirmedAt,
    rejectedAt: eventDriverLink.rejectedAt,
    conflictReason: null,
    eventCount: 1, // This is for a single event
    matchType: eventDriverLink.matchType as DriverLinkStatus["matchType"],
  }
}
