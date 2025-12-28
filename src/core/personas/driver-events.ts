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
 * This function queries EventDriverLink records where:
 * - userId matches the current user
 * - matchType is transponder, exact, or fuzzy
 * - status is confirmed or suggested (via UserDriverLink)
 * 
 * @param userId - User ID
 * @returns List of events with participation details
 */
export async function discoverDriverEvents(userId: string): Promise<{
  events: Event[]
  participationDetails: EventParticipationDetails[]
}> {
  // Query EventDriverLink records for this user
  const eventDriverLinks = await prisma.eventDriverLink.findMany({
    where: {
      userId,
      userDriverLink: {
        status: {
          in: ["confirmed", "suggested"]
        }
      }
    },
    include: {
      event: true,
      userDriverLink: {
        select: {
          status: true
        }
      }
    },
    orderBy: {
      matchedAt: "desc"
    }
  })

  // Extract unique events and participation details
  const eventMap = new Map<string, Event>()
  const participationDetails: EventParticipationDetails[] = []

  for (const link of eventDriverLinks) {
    // Add event to map (will deduplicate)
    if (!eventMap.has(link.eventId)) {
      eventMap.set(link.eventId, link.event)
    }

    // Add participation details
    participationDetails.push({
      eventId: link.eventId,
      matchType: link.matchType,
      similarityScore: link.similarityScore,
      userDriverLinkStatus: link.userDriverLink?.status || "suggested"
    })
  }

  return {
    events: Array.from(eventMap.values()),
    participationDetails
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
    filteredDetails = filteredDetails.filter(detail =>
      options.matchType!.includes(detail.matchType)
    )
  }

  if (options?.minSimilarityScore !== undefined) {
    filteredDetails = filteredDetails.filter(detail =>
      detail.similarityScore >= options.minSimilarityScore!
    )
  }

  if (options?.confirmedOnly) {
    filteredDetails = filteredDetails.filter(detail =>
      detail.userDriverLinkStatus === "confirmed"
    )
  }

  // Get unique event IDs from filtered details
  const eventIds = new Set(filteredDetails.map(d => d.eventId))
  const filteredEvents = events.filter(event => eventIds.has(event.id))

  return {
    events: filteredEvents,
    participationDetails: filteredDetails
  }
}

