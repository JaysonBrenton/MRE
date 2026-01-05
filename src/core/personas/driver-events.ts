/**
 * @fileoverview Driver persona event discovery
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Functions for discovering events where Driver persona participated
 *              using fuzzy matching via UserDriverLink and EventDriverLink
 *
 * @purpose This file contains business logic for Driver persona event discovery,
 *          following the mobile-safe architecture requirement that business logic
 *          must reside in src/core/<domain>/. This logic leverages existing fuzzy
 *          matching infrastructure from the ingestion service.
 *
 * @relatedFiles
 * - prisma/schema.prisma (UserDriverLink, EventDriverLink models)
 * - ingestion/ingestion/driver_matcher.py (fuzzy matching logic)
 */

import { prisma } from "@/lib/prisma"
import type { Event, EventDriverLinkMatchType, UserDriverLinkStatus } from "@prisma/client"
import { normalizeDriverName } from "@/core/users/name-normalizer"

/**
 * Event participation details
 */
export type EventParticipationDetails = {
  eventId: string
  matchType: EventDriverLinkMatchType
  similarityScore: number
  userDriverLinkStatus: UserDriverLinkStatus
}

/**
 * Discover events where Driver persona participated using fuzzy matching
 *
 * This function finds events through two methods:
 * 1. EventDriverLink records (fuzzy/exact/transponder matches)
 * 2. EventEntry records (direct participation in events)
 *
 * Returns all events where the user participated, regardless of UserDriverLink status.
 * The status is included in participation details for UI display (confirmed, suggested, rejected, conflict, or suggested if no UserDriverLink exists).
 *
 * @param userId - User ID
 * @returns List of events with participation details
 */
export async function discoverDriverEvents(userId: string): Promise<{
  events: Event[]
  participationDetails: EventParticipationDetails[]
}> {
  // Get user's normalized driver name
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      driverName: true,
      normalizedName: true,
    },
  })

  if (!user) {
    return { events: [], participationDetails: [] }
  }

  const normalizedDriverName = user.normalizedName || normalizeDriverName(user.driverName)

  // Method 1: Query EventDriverLink records for this user
  // Show all events where there's an EventDriverLink, regardless of UserDriverLink status
  const eventDriverLinks = await prisma.eventDriverLink.findMany({
    where: {
      userId,
    },
    include: {
      event: {
        include: {
          track: {
            select: {
              id: true,
              trackName: true,
            },
          },
        },
      },
      userDriverLink: {
        select: {
          status: true,
        },
      },
    },
    orderBy: {
      matchedAt: "desc",
    },
  })

  // Method 2: Find events through EventEntry records (direct participation)
  // This finds events where the user's driver name appears in the entry list
  const eventEntries = await prisma.eventEntry.findMany({
    where: {
      driver: {
        normalizedName: normalizedDriverName,
      },
    },
    include: {
      event: {
        include: {
          track: {
            select: {
              id: true,
              trackName: true,
            },
          },
        },
      },
    },
    distinct: ["eventId"],
  })

  // Combine both sources
  const eventMap = new Map<string, Event>()
  const participationDetails: EventParticipationDetails[] = []

  // Process EventDriverLink records
  for (const link of eventDriverLinks) {
    if (!eventMap.has(link.eventId)) {
      eventMap.set(link.eventId, link.event)
    }
    participationDetails.push({
      eventId: link.eventId,
      matchType: link.matchType,
      similarityScore: link.similarityScore,
      userDriverLinkStatus: link.userDriverLink?.status || "suggested",
    })
  }

  // Process EventEntry records (only add if not already in EventDriverLink)
  for (const entry of eventEntries) {
    if (!eventMap.has(entry.eventId)) {
      eventMap.set(entry.eventId, entry.event)
      // For EventEntry matches, use "exact" match type with similarity 1.0
      // and default to "suggested" status since there's no UserDriverLink
      participationDetails.push({
        eventId: entry.eventId,
        matchType: "exact",
        similarityScore: 1.0,
        userDriverLinkStatus: "suggested",
      })
    }
  }

  return {
    events: Array.from(eventMap.values()),
    participationDetails,
  }
}

/**
 * Get events for Driver persona with optional filtering
 *
 * @param userId - User ID
 * @param options - Filter options
 * @returns Filtered events with participation details
 */
export async function getDriverEvents(
  userId: string,
  options?: {
    matchType?: EventDriverLinkMatchType[]
    minSimilarityScore?: number
    confirmedOnly?: boolean
  }
): Promise<{
  events: Event[]
  participationDetails: EventParticipationDetails[]
}> {
  const { events, participationDetails } = await discoverDriverEvents(userId)

  // Apply filters
  let filteredDetails = participationDetails

  if (options?.matchType) {
    filteredDetails = filteredDetails.filter((detail) =>
      options.matchType!.includes(detail.matchType)
    )
  }

  if (options?.minSimilarityScore !== undefined) {
    filteredDetails = filteredDetails.filter(
      (detail) => detail.similarityScore >= options.minSimilarityScore!
    )
  }

  if (options?.confirmedOnly) {
    filteredDetails = filteredDetails.filter(
      (detail) => detail.userDriverLinkStatus === "confirmed"
    )
  }

  // Get unique event IDs from filtered details
  const eventIds = new Set(filteredDetails.map((d) => d.eventId))
  const filteredEvents = events.filter((event) => eventIds.has(event.id))

  return {
    events: filteredEvents,
    participationDetails: filteredDetails,
  }
}
