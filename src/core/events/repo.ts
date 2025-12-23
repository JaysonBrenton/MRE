/**
 * @fileoverview Event repository - all Prisma queries for event domain
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Contains all database access functions for event operations
 * 
 * @purpose This file centralizes all Prisma queries related to events, following
 *          the mobile-safe architecture requirement that all database access must
 *          exist only in src/core/<domain>/repo.ts files. This ensures business
 *          logic is separated from API routes and can be reused by mobile clients.
 * 
 * @relatedFiles
 * - src/lib/prisma.ts (Prisma client)
 * - src/core/events/search-events.ts (uses this repo)
 */

import { prisma } from "@/lib/prisma"
import type { Event, Track, Race } from "@prisma/client"

export interface SearchEventsParams {
  trackId: string
  startDate?: Date
  endDate?: Date
}

export interface SearchEventsResult {
  track: Pick<Track, "id" | "source" | "sourceTrackSlug" | "trackName">
  events: Array<{
    id: string
    source: string
    sourceEventId: string
    eventName: string
    eventDate: string | null // ISO string or null
    eventEntries: number
    eventDrivers: number
    eventUrl: string
    ingestDepth: string
    lastIngestedAt: string | null // ISO string or null
  }>
}

/**
 * Search events by track and date range
 * 
 * @param params - Search parameters (trackId, startDate, endDate)
 * @returns Search result with track info and matching events
 */
export async function searchEvents(params: SearchEventsParams): Promise<SearchEventsResult> {
  const { trackId, startDate, endDate } = params

  // Get track first to ensure it exists
  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: {
      id: true,
      source: true,
      sourceTrackSlug: true,
      trackName: true,
    },
  })

  if (!track) {
    throw new Error("Track not found")
  }

  // Build where clause conditionally based on whether dates are provided
  const whereClause: any = {
    trackId: trackId,
  }

  // Only apply date filters if both dates are provided
  if (startDate && endDate) {
    whereClause.eventDate = {
      gte: startDate,
      lte: endDate,
    }
  }

  // Search events (with optional date range)
  const events = await prisma.event.findMany({
    where: whereClause,
    orderBy: {
      eventDate: "desc",
    },
  })

  return {
    track: {
      id: track.id,
      source: track.source,
      sourceTrackSlug: track.sourceTrackSlug,
      trackName: track.trackName,
    },
    events: events.map((event) => ({
      id: event.id,
      source: event.source,
      sourceEventId: event.sourceEventId,
      eventName: event.eventName,
      eventDate: event.eventDate ? event.eventDate.toISOString() : null as string | null,
      eventEntries: event.eventEntries,
      eventDrivers: event.eventDrivers,
      eventUrl: event.eventUrl,
      ingestDepth: event.ingestDepth,
      lastIngestedAt: event.lastIngestedAt?.toISOString() || null,
    })),
  }
}

/**
 * Get an event by ID
 * 
 * @param id - Event's unique identifier
 * @returns Event object or null if not found
 */
export async function getEventById(id: string): Promise<Event | null> {
  return prisma.event.findUnique({
    where: { id },
  })
}

/**
 * Get an event by ID with track and races
 * 
 * @param eventId - Event's unique identifier
 * @returns Event object with track and races (ordered) or null if not found
 */
export async function getEventWithRaces(
  eventId: string
): Promise<
  | (Event & {
      track: Track
      races: Race[]
    })
  | null
> {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: {
      track: true,
      races: {
        orderBy: {
          raceOrder: "asc",
        },
      },
    },
  })
}

export interface ImportedEvent {
  id: string
  source: string
  sourceEventId: string
  eventName: string
  eventDate: string | null // ISO string or null
  eventEntries: number
  eventDrivers: number
  eventUrl: string
  ingestDepth: string
  lastIngestedAt: string | null // ISO string or null
  track: {
    id: string
    trackName: string
  }
}

/**
 * Get all fully imported events (ingestDepth = 'laps_full')
 * 
 * @returns Array of imported events with track information, ordered by eventDate descending
 */
export async function getAllImportedEvents(): Promise<ImportedEvent[]> {
  const events = await prisma.event.findMany({
    where: {
      ingestDepth: "laps_full",
    },
    include: {
      track: {
        select: {
          id: true,
          trackName: true,
        },
      },
    },
    orderBy: {
      eventDate: "desc",
    },
  })

  return events.map((event) => ({
    id: event.id,
    source: event.source,
    sourceEventId: event.sourceEventId,
    eventName: event.eventName,
    eventDate: event.eventDate ? event.eventDate.toISOString() : null,
    eventEntries: event.eventEntries,
    eventDrivers: event.eventDrivers,
    eventUrl: event.eventUrl,
    ingestDepth: event.ingestDepth,
    lastIngestedAt: event.lastIngestedAt?.toISOString() || null,
    track: {
      id: event.track.id,
      trackName: event.track.trackName,
    },
  }))
}

