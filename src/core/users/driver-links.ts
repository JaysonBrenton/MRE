/**
 * @fileoverview Core business logic for user-driver links (read-only)
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Read-only functions for retrieving user-driver link status
 * 
 * @purpose Provides core domain logic for reading driver links, following
 *          mobile-safe architecture guidelines. All functions are read-only
 *          as link creation/confirmation happens automatically server-side.
 * 
 * @relatedFiles
 * - src/core/users/repo.ts (database access)
 * - src/app/api/v1/users/[userId]/driver-links/route.ts (API endpoint)
 */

import { prisma } from "@/lib/prisma"

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
  status: "confirmed" | "suggested" | "rejected" | "conflict",
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
  return links.filter((link) => 
    link.status === "confirmed" || link.status === "suggested"
  )
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
  driverId: string,
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
  return links.filter((link) => 
    link.status === "conflict" || link.status === "rejected"
  )
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
