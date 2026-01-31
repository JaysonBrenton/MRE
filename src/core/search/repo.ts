/**
 * @fileoverview Search repository - all Prisma queries for search domain
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description Contains all database access functions for unified search operations
 *
 * @purpose This file centralizes all Prisma queries related to search, following
 *          the mobile-safe architecture requirement that all database access must
 *          exist only in src/core/<domain>/repo.ts files.
 */

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import type {
  SearchEventsParams,
  SearchSessionsParams,
  SearchEventsResult,
  SearchSessionsResult,
  EventSearchResult,
  SessionSearchResult,
  SessionType,
} from "./types"

/**
 * Search events with optional filters
 */
export async function searchEvents(params: SearchEventsParams): Promise<SearchEventsResult> {
  const { query, driverIds, startDate, endDate, page, itemsPerPage } = params

  const whereClause: Prisma.EventWhereInput = {}

  // Text search on event name
  if (query && query.trim() !== "") {
    whereClause.eventName = {
      contains: query.trim(),
      mode: "insensitive",
    }
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

  // Driver filter - events where driver participated
  if (driverIds && driverIds.length > 0) {
    whereClause.OR = [
      {
        entries: {
          some: {
            driverId: {
              in: driverIds,
            },
          },
        },
      },
      {
        races: {
          some: {
            drivers: {
              some: {
                driverId: {
                  in: driverIds,
                },
              },
            },
          },
        },
      },
    ]
  }

  // Get total count
  const total = await prisma.event.count({
    where: whereClause,
  })

  // Get paginated results
  const skip = (page - 1) * itemsPerPage
  const events = await prisma.event.findMany({
    where: whereClause,
    select: {
      id: true,
      eventName: true,
      eventDate: true,
      source: true,
      sourceEventId: true,
      eventUrl: true,
      ingestDepth: true,
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
    skip,
    take: itemsPerPage,
  })

  const results: EventSearchResult[] = events.map((event) => ({
    id: event.id,
    eventName: event.eventName,
    eventDate: event.eventDate ? event.eventDate.toISOString() : null,
    trackName: event.track.trackName,
    trackId: event.track.id,
    source: event.source,
    sourceEventId: event.sourceEventId,
    eventUrl: event.eventUrl,
    ingestDepth: event.ingestDepth,
  }))

  return {
    events: results,
    total,
  }
}

/**
 * Search sessions (races) with optional filters
 */
export async function searchSessions(params: SearchSessionsParams): Promise<SearchSessionsResult> {
  const { query, driverIds, sessionType, startDate, endDate, page, itemsPerPage } = params

  const whereClause: Prisma.RaceWhereInput = {}

  // Text search on race label or class name
  if (query && query.trim() !== "") {
    const searchTerm = query.trim()
    whereClause.OR = [
      {
        raceLabel: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        className: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
      {
        event: {
          eventName: {
            contains: searchTerm,
            mode: "insensitive",
          },
        },
      },
    ]
  }

  // Session type filter
  if (sessionType) {
    whereClause.sessionType = sessionType
  }

  // Date range filter (via event date)
  if (startDate || endDate) {
    whereClause.event = {
      eventDate: {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate }),
      },
    }
  }

  // Driver filter - sessions where driver participated and has valid laps
  if (driverIds && driverIds.length > 0) {
    whereClause.drivers = {
      some: {
        driverId: {
          in: driverIds,
        },
        results: {
          some: {
            laps: {
              some: {
                lapTimeSeconds: {
                  gt: 0,
                },
              },
            },
          },
        },
      },
    }
  }

  // Get total count
  const total = await prisma.race.count({
    where: whereClause,
  })

  // Get paginated results
  const skip = (page - 1) * itemsPerPage
  const races = await prisma.race.findMany({
    where: whereClause,
    select: {
      id: true,
      raceLabel: true,
      className: true,
      sessionType: true,
      startTime: true,
      durationSeconds: true,
      raceOrder: true,
      event: {
        select: {
          id: true,
          eventName: true,
          eventDate: true,
          track: {
            select: {
              trackName: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        event: {
          eventDate: "desc",
        },
      },
      {
        raceOrder: "asc",
      },
    ],
    skip,
    take: itemsPerPage,
  })

  const results: SessionSearchResult[] = races.map((race) => ({
    id: race.id,
    raceId: race.id,
    raceLabel: race.raceLabel,
    className: race.className,
    sessionType: (race.sessionType ?? "race") as SessionType, // Backward compatibility: default to "race" if null in database
    eventId: race.event.id,
    eventName: race.event.eventName,
    eventDate: race.event.eventDate ? race.event.eventDate.toISOString() : null,
    trackName: race.event.track.trackName,
    startTime: race.startTime ? race.startTime.toISOString() : null, // Convert to ISO string for serialization
    durationSeconds: race.durationSeconds,
    raceOrder: race.raceOrder,
  }))

  return {
    sessions: results,
    total,
  }
}
