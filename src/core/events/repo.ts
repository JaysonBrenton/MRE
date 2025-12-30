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
import type { Event, Track, Race, Prisma } from "@prisma/client"

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
  const whereClause: Prisma.EventWhereInput = {
    trackId,
  }

  // Only apply date filters if both dates are provided
  if (startDate && endDate) {
    whereClause.eventDate = {
      gte: startDate,
      lte: endDate,
    }
  }

  // Query events with a reasonable limit to prevent performance issues
  // If more events are needed, pagination should be implemented
  // Using select to only fetch required fields for better performance
  const events = await prisma.event.findMany({
    where: whereClause,
    select: {
      id: true,
      source: true,
      sourceEventId: true,
      eventName: true,
      eventDate: true,
      eventEntries: true,
      eventDrivers: true,
      eventUrl: true,
      ingestDepth: true,
      lastIngestedAt: true,
      // Exclude: createdAt, updatedAt, trackId (we already have track info)
    },
    orderBy: {
      eventDate: "desc",
    },
    take: 1000, // Limit to prevent loading too many events at once
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
 * Get track metadata without any event queries
 * 
 * @param trackId - Track's unique identifier
 * @returns Track metadata or null if not found
 */
export async function getTrackMetadata(trackId: string) {
  return prisma.track.findUnique({
    where: { id: trackId },
    select: {
      id: true,
      source: true,
      sourceTrackSlug: true,
      trackName: true,
    },
  })
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
 * Get an event by source and source_event_id
 * 
 * @param source - Event source (e.g., "liverc")
 * @param sourceEventId - Source event ID (e.g., LiveRC event ID)
 * @returns Event object or null if not found
 */
export async function getEventBySourceId(
  source: string,
  sourceEventId: string
): Promise<Event | null> {
  return prisma.event.findFirst({
    where: {
      source,
      sourceEventId,
    },
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

export interface GetAllImportedEventsParams {
  limit?: number
  offset?: number
  trackId?: string
  startDate?: Date
  endDate?: Date
  status?: 'imported' | 'all'  // imported = laps_full, all = any ingestDepth
  orderBy?: 'eventDate' | 'eventName' | 'trackName' | 'eventEntries' | 'eventDrivers'
  orderDirection?: 'asc' | 'desc'
}

export interface GetAllImportedEventsResult {
  events: ImportedEvent[]
  total: number
}

/**
 * Get events with filtering, sorting, and pagination
 * 
 * @param params - Filtering, sorting, and pagination parameters
 * @returns Paginated array of events with track information
 */
export async function getAllImportedEvents(
  params?: GetAllImportedEventsParams
): Promise<GetAllImportedEventsResult> {
  const { 
    limit = 20, 
    offset = 0,
    trackId,
    startDate,
    endDate,
    status = 'imported',
    orderBy = 'eventDate',
    orderDirection = 'desc'
  } = params || {}

  // Build where clause
  const whereClause: Prisma.EventWhereInput = {}

  // Status filter: imported = only laps_full, all = any ingestDepth
  if (status === 'imported') {
    whereClause.ingestDepth = 'laps_full'
  }

  // Track filter
  if (trackId) {
    whereClause.trackId = trackId
  }

  // Date range filter
  if (startDate || endDate) {
    whereClause.eventDate = {}
    if (startDate) {
      whereClause.eventDate.gte = startDate
    }
    if (endDate) {
      whereClause.eventDate.lte = endDate
    }
  }

  // Get total count for pagination metadata
  const total = await prisma.event.count({
    where: whereClause,
  })

  // Build orderBy clause
  // Note: trackName ordering is handled in-memory after fetching
  let orderByClause: Prisma.EventOrderByWithRelationInput
  let needsInMemorySort = false
  
  switch (orderBy) {
    case 'eventName':
      orderByClause = { eventName: orderDirection }
      break
    case 'trackName':
      // Prisma doesn't support ordering by nested fields directly
      // We'll sort in memory after fetching
      orderByClause = { eventDate: 'desc' } // Default ordering
      needsInMemorySort = true
      break
    case 'eventEntries':
      orderByClause = { eventEntries: orderDirection }
      break
    case 'eventDrivers':
      orderByClause = { eventDrivers: orderDirection }
      break
    case 'eventDate':
    default:
      orderByClause = { eventDate: orderDirection }
      break
  }

  // Fetch paginated events with all required fields
  let events = await prisma.event.findMany({
    where: whereClause,
    select: {
      id: true,
      eventName: true,
      eventDate: true,
      eventEntries: true,
      eventDrivers: true,
      ingestDepth: true,
      lastIngestedAt: true,
      track: {
        select: {
          id: true,
          trackName: true,
        },
      },
    },
    orderBy: orderByClause,
    take: limit,
    skip: offset,
  })

  // Handle trackName sorting in memory
  if (needsInMemorySort) {
    events = [...events].sort((a, b) => {
      const comparison = a.track.trackName.localeCompare(b.track.trackName)
      return orderDirection === 'asc' ? comparison : -comparison
    })
  }

  return {
    events: events.map((event) => ({
      id: event.id,
      source: "liverc", // All events are from LiveRC in v0.1
      sourceEventId: "", // Not needed for list view
      eventName: event.eventName,
      eventDate: event.eventDate ? event.eventDate.toISOString() : null,
      eventEntries: event.eventEntries,
      eventDrivers: event.eventDrivers,
      eventUrl: "", // Not needed for list view
      ingestDepth: event.ingestDepth,
      lastIngestedAt: event.lastIngestedAt ? event.lastIngestedAt.toISOString() : null,
      track: {
        id: event.track.id,
        trackName: event.track.trackName,
      },
    })),
    total,
  }
}
