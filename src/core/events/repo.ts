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
    // Log the track ID that wasn't found for debugging
    console.error("Track not found in database", {
      trackId,
      trackIdType: typeof trackId,
      trackIdLength: trackId?.length,
    })
    throw new Error("Track not found")
  }

  // Build where clause conditionally based on whether dates are provided
  const whereClause: Prisma.EventWhereInput = {
    trackId,
    // Exclude practice days from regular event search (they have their own search interface)
    // Practice days have sourceEventId pattern: {track-slug}-practice-{YYYY-MM-DD}
    sourceEventId: {
      not: {
        contains: "-practice-",
      },
    },
    // Only apply date filters if both dates are provided
    ...(startDate && endDate
      ? {
          eventDate: {
            gte: startDate,
            lte: endDate,
          },
        }
      : {}),
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
      eventDate: event.eventDate ? event.eventDate.toISOString() : (null as string | null),
      eventEntries: event.eventEntries,
      eventDrivers: event.eventDrivers,
      eventUrl: event.eventUrl,
      ingestDepth: event.ingestDepth,
      lastIngestedAt: event.lastIngestedAt?.toISOString() || null,
    })),
  }
}

export interface BrowseEventsInDatabaseParams {
  startDate?: Date
  endDate?: Date
  page: number
  pageSize: number
  /** When true, only return events with full lap data (laps_full). */
  databaseOnly: boolean
}

export interface BrowsedEventRow {
  id: string
  source: string
  sourceEventId: string
  eventName: string
  eventDate: string | null
  eventEntries: number
  eventDrivers: number
  eventUrl: string
  ingestDepth: string
  lastIngestedAt: string | null
  trackId: string
  trackName: string
}

export interface BrowseEventsInDatabaseResult {
  events: BrowsedEventRow[]
  total: number
  page: number
  pageSize: number
}

/**
 * Paginated cross-track event browse for Event Search (database-only).
 *
 * Excludes synthetic practice-day rows. Optionally restricts to laps_full when
 * the UI is in database-only mode (Search LiveRC off).
 */
export async function browseEventsInDatabase(
  params: BrowseEventsInDatabaseParams
): Promise<BrowseEventsInDatabaseResult> {
  const { startDate, endDate, page, pageSize, databaseOnly } = params

  const whereClause: Prisma.EventWhereInput = {
    sourceEventId: {
      not: {
        contains: "-practice-",
      },
    },
    ...(databaseOnly ? { ingestDepth: "laps_full" } : {}),
    ...(startDate && endDate
      ? {
          eventDate: {
            gte: startDate,
            lte: endDate,
          },
        }
      : {}),
  }

  const skip = (page - 1) * pageSize

  const [events, total] = await Promise.all([
    prisma.event.findMany({
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
        trackId: true,
        track: {
          select: {
            trackName: true,
          },
        },
      },
      orderBy: [{ eventDate: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.event.count({ where: whereClause }),
  ])

  return {
    events: events.map((event) => ({
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
      trackId: event.trackId,
      trackName: event.track.trackName,
    })),
    total,
    page,
    pageSize,
  }
}

export interface TrackSuggestion {
  id: string
  trackName: string
  sourceTrackSlug: string
  city: string | null
  state: string | null
  country: string | null
}

export interface EventSuggestion {
  id: string
  eventName: string
  eventDate: string | null
  trackId: string
  trackName: string
  ingestDepth: string
}

/** Candidate row shape for {@link rankTrackSuggestions}. */
export type TrackSuggestionCandidate = TrackSuggestion

/**
 * Relevance score for omnibox track ranking (higher = better match).
 * Exact / prefix track names beat substring slug matches (e.g. "rcra" → RCRA).
 */
export function scoreTrackSuggestionMatch(
  track: Pick<TrackSuggestionCandidate, "trackName" | "sourceTrackSlug" | "city">,
  query: string
): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0

  const name = track.trackName.toLowerCase()
  const slug = track.sourceTrackSlug.toLowerCase()
  const city = (track.city ?? "").toLowerCase()

  if (name === q) return 1000
  if (name.startsWith(q)) return 500
  if (name.includes(q)) return 300
  if (city.includes(q)) return 200
  if (slug.includes(q)) return 50
  return 0
}

/**
 * Rank track candidates for type-ahead: best matches first, then name A–Z.
 */
export function rankTrackSuggestions<T extends TrackSuggestionCandidate>(
  tracks: T[],
  query: string,
  limit: number
): T[] {
  return [...tracks]
    .map((track) => ({ track, score: scoreTrackSuggestionMatch(track, query) }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.track.trackName.localeCompare(b.track.trackName, undefined, { sensitivity: "base" })
    )
    .slice(0, limit)
    .map(({ track }) => track)
}

/**
 * Type-ahead track suggestions for Event Search (database-only).
 *
 * Matches active tracks by name, city, or source slug (case-insensitive), then
 * ranks by relevance so exact name matches (e.g. RCRA) are not crowded out by
 * slug substring hits (e.g. *rcra* in grcraceway).
 */
export async function suggestTracksByText(
  query: string,
  limit: number
): Promise<TrackSuggestion[]> {
  const q = query.trim()
  const poolSize = Math.min(100, Math.max(limit * 15, 40))

  const select = {
    id: true,
    trackName: true,
    sourceTrackSlug: true,
    city: true,
    state: true,
    country: true,
  } as const

  // Fetch name matches separately from city/slug-only matches. Otherwise a query
  // like "rcra" (which appears inside many slugs, e.g. *rcra* in "grcraceway")
  // can flood an unordered pool and push out the exact-name match ("RCRA").
  const [nameMatches, otherMatches] = await Promise.all([
    prisma.track.findMany({
      where: {
        isActive: true,
        trackName: { contains: q, mode: "insensitive" },
      },
      select,
      orderBy: [{ trackName: "asc" }],
      take: poolSize,
    }),
    prisma.track.findMany({
      where: {
        isActive: true,
        NOT: { trackName: { contains: q, mode: "insensitive" } },
        OR: [
          { city: { contains: q, mode: "insensitive" } },
          { sourceTrackSlug: { contains: q, mode: "insensitive" } },
        ],
      },
      select,
      orderBy: [{ trackName: "asc" }],
      take: poolSize,
    }),
  ])

  const ranked = rankTrackSuggestions(
    [...nameMatches, ...otherMatches].map((track) => ({
      id: track.id,
      trackName: track.trackName,
      sourceTrackSlug: track.sourceTrackSlug,
      city: track.city ?? null,
      state: track.state ?? null,
      country: track.country ?? null,
    })),
    q,
    limit
  )

  return ranked
}

/**
 * Type-ahead event suggestions for Event Search (database-only).
 *
 * Matches events by name (case-insensitive). Excludes synthetic practice-day
 * rows (sourceEventId containing "-practice-") and non-ingested placeholders
 * (ingest_depth = none) so every suggestion is actionable.
 */
export async function suggestEventsByText(
  query: string,
  limit: number
): Promise<EventSuggestion[]> {
  const events = await prisma.event.findMany({
    where: {
      eventName: { contains: query, mode: "insensitive" },
      sourceEventId: { not: { contains: "-practice-" } },
      ingestDepth: { not: "none" },
    },
    select: {
      id: true,
      eventName: true,
      eventDate: true,
      trackId: true,
      ingestDepth: true,
      track: {
        select: {
          trackName: true,
        },
      },
    },
    orderBy: [{ eventDate: "desc" }],
    take: limit,
  })

  return events.map((event) => ({
    id: event.id,
    eventName: event.eventName,
    eventDate: event.eventDate ? event.eventDate.toISOString() : null,
    trackId: event.trackId,
    trackName: event.track.trackName,
    ingestDepth: event.ingestDepth,
  }))
}

export interface SearchPracticeDayEventsParams {
  trackId: string
  startDate?: Date
  endDate?: Date
}

export interface PracticeDayEventResult {
  id: string
  eventName: string
  eventDate: string | null
  sourceEventId: string
  trackId: string
  ingestDepth: string
}

/**
 * Search practice day events by track and optional date range.
 * Practice days have sourceEventId containing "-practice-".
 */
export async function searchPracticeDayEvents(
  params: SearchPracticeDayEventsParams
): Promise<{ track: SearchEventsResult["track"]; practiceDays: PracticeDayEventResult[] }> {
  const { trackId, startDate, endDate } = params

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

  const whereClause: Prisma.EventWhereInput = {
    trackId,
    sourceEventId: { contains: "-practice-" },
    ...(startDate && endDate
      ? {
          eventDate: {
            gte: startDate,
            lte: endDate,
          },
        }
      : {}),
  }

  const events = await prisma.event.findMany({
    where: whereClause,
    select: {
      id: true,
      sourceEventId: true,
      eventName: true,
      eventDate: true,
      trackId: true,
      ingestDepth: true,
    },
    orderBy: { eventDate: "desc" },
    take: 1000,
  })

  return {
    track: {
      id: track.id,
      source: track.source,
      sourceTrackSlug: track.sourceTrackSlug,
      trackName: track.trackName,
    },
    practiceDays: events.map((e) => ({
      id: e.id,
      eventName: e.eventName,
      eventDate: e.eventDate ? e.eventDate.toISOString() : null,
      sourceEventId: e.sourceEventId,
      trackId: e.trackId,
      ingestDepth: e.ingestDepth,
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
 * Get an event by ID with track information
 *
 * @param id - Event's unique identifier
 * @returns Event object with track or null if not found
 */
export async function getEventWithTrack(id: string): Promise<(Event & { track: Track }) | null> {
  return prisma.event.findUnique({
    where: { id },
    include: {
      track: true,
    },
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
export async function getEventWithRaces(eventId: string): Promise<
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
  status?: "imported" | "all" // imported = laps_full, all = any ingestDepth
  orderBy?: "eventDate" | "eventName" | "trackName" | "eventEntries" | "eventDrivers"
  orderDirection?: "asc" | "desc"
  userId?: string // When provided, filter events to only those where user has EventDriverLink
}

export interface GetAllImportedEventsResult {
  events: ImportedEvent[]
  total: number
}

// Maximum limit for pagination to prevent memory issues
const MAX_PAGINATION_LIMIT = 1000

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
    limit: requestedLimit = 20,
    offset = 0,
    trackId,
    startDate,
    endDate,
    status = "imported",
    orderBy = "eventDate",
    orderDirection = "desc",
    userId,
  } = params || {}

  // Enforce maximum limit to prevent memory issues and slow queries
  const limit = Math.min(requestedLimit, MAX_PAGINATION_LIMIT)

  // If userId is provided, get event IDs from EventDriverLink
  // Note: This uses two separate queries (EventDriverLink, then Event) which may
  // result in eventual consistency if database state changes between queries.
  // This is acceptable for read operations where slight inconsistencies are tolerable.
  // For strict consistency requirements, consider using a single query with joins
  // or database transactions.
  let userEventIds: string[] | undefined
  if (userId) {
    const eventDriverLinks = await prisma.eventDriverLink.findMany({
      where: {
        userId,
        userDriverLink: {
          status: {
            in: ["confirmed", "suggested"],
          },
        },
      },
      select: {
        eventId: true,
      },
      distinct: ["eventId"],
    })
    userEventIds = eventDriverLinks.map((link) => link.eventId)

    // If user has no events, return empty result
    if (userEventIds.length === 0) {
      return {
        events: [],
        total: 0,
      }
    }
  }

  // Build where clause
  const whereClause: Prisma.EventWhereInput = {
    // Exclude practice days from regular event listings (they have their own search interface)
    // Practice days have sourceEventId pattern: {track-slug}-practice-{YYYY-MM-DD}
    sourceEventId: {
      not: {
        contains: "-practice-",
      },
    },
  }

  // User filter: only events where user has EventDriverLink
  if (userEventIds) {
    whereClause.id = {
      in: userEventIds,
    }
  }

  // Status filter: imported = only laps_full, all = any ingestDepth
  if (status === "imported") {
    whereClause.ingestDepth = "laps_full"
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

  // Validate orderBy and orderDirection parameters
  const validOrderBy = [
    "eventDate",
    "eventName",
    "trackName",
    "eventEntries",
    "eventDrivers",
  ] as const
  const validOrderDirection = ["asc", "desc"] as const

  const validatedOrderBy = validOrderBy.includes(orderBy as (typeof validOrderBy)[number])
    ? (orderBy as (typeof validOrderBy)[number])
    : "eventDate"

  const validatedOrderDirection = validOrderDirection.includes(
    orderDirection as (typeof validOrderDirection)[number]
  )
    ? (orderDirection as (typeof validOrderDirection)[number])
    : "desc"

  // Build orderBy clause
  // For trackName, we need to use Prisma's nested ordering or fetch all and sort
  let orderByClause: Prisma.EventOrderByWithRelationInput | Prisma.EventOrderByWithRelationInput[]

  switch (validatedOrderBy) {
    case "eventName":
      orderByClause = { eventName: validatedOrderDirection }
      break
    case "trackName":
      // Use Prisma's nested ordering capability
      // This allows proper pagination with track name sorting
      orderByClause = [
        { track: { trackName: validatedOrderDirection } },
        { eventDate: "desc" }, // Secondary sort for consistent pagination
      ]
      break
    case "eventEntries":
      orderByClause = { eventEntries: validatedOrderDirection }
      break
    case "eventDrivers":
      orderByClause = { eventDrivers: validatedOrderDirection }
      break
    case "eventDate":
    default:
      orderByClause = { eventDate: validatedOrderDirection }
      break
  }

  // Fetch paginated events with all required fields
  // For trackName sorting, Prisma will handle the nested ordering correctly
  const events = await prisma.event.findMany({
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

/**
 * Check if a driver name appears in database events by checking EventEntry records
 *
 * @param eventIds - Array of event IDs to check
 * @param normalizedDriverName - Normalized driver name to search for
 * @returns Map of event ID to boolean (true if driver found, false if not found)
 */
export async function checkDbEventsForDriver(
  eventIds: string[],
  normalizedDriverName: string
): Promise<Record<string, boolean>> {
  if (eventIds.length === 0 || !normalizedDriverName) {
    return {}
  }

  // Find all EventEntry records for these events where the driver's normalized name matches
  const eventEntries = await prisma.eventEntry.findMany({
    where: {
      eventId: {
        in: eventIds,
      },
      driver: {
        normalizedName: normalizedDriverName,
      },
    },
    select: {
      eventId: true,
    },
    distinct: ["eventId"],
  })

  // Build result map - default to false, set to true if found
  const result: Record<string, boolean> = {}
  for (const eventId of eventIds) {
    result[eventId] = false
  }
  for (const entry of eventEntries) {
    result[entry.eventId] = true
  }

  return result
}
