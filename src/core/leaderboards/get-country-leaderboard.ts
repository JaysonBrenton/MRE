/**
 * @fileoverview Country leaderboard - aggregate main-race results by points
 *
 * @description Fetches main-race results for all tracks in a given country,
 *              within a calendar year, applies racing-style points
 *              (1st=25, 2nd=18, etc.), groups by driver+class, and returns a
 *              sorted leaderboard plus available classes.
 *
 * @relatedFiles
 * - src/core/tracks/get-track-leaderboard.ts (track-scoped leaderboard)
 * - src/app/api/v1/leaderboards/country/route.ts (API)
 */

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

/** Points by position (1st=25, 2nd=18, ... 10th=1) */
const POINTS_BY_POSITION: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
}

function pointsForPosition(position: number): number {
  return POINTS_BY_POSITION[position] ?? 0
}

export type CountryLeaderboardSortBy = "points" | "name"

export interface GetCountryLeaderboardOptions {
  countryQuery: string
  year: number
  className?: string | null
  /** 0-based offset into the sorted results */
  offset?: number
  /** Maximum number of rows to return (server may enforce an upper bound) */
  limit?: number
  sortBy?: CountryLeaderboardSortBy
}

export interface CountryLeaderboardRow {
  driverId: string
  driverName: string
  className: string
  points: number
  wins: number
  podiums: number
  eventsCount: number
}

export interface CountryLeaderboardResult {
  countryQuery: string
  year: number
  rows: CountryLeaderboardRow[]
  totalCount: number
  classes: string[]
}

/**
 * Compute the start/end dates for a calendar year.
 */
function getYearBounds(year: number): { start: Date; end: Date } {
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31, 23, 59, 59, 999)
  return { start, end }
}

/**
 * Get country leaderboard: drivers ranked by points from main races in a country.
 * One row per (driver, class). Sort defaults to: points desc, wins desc, podiums desc.
 */
export async function getCountryLeaderboard(
  opts: GetCountryLeaderboardOptions
): Promise<CountryLeaderboardResult> {
  const { countryQuery, year, className, offset = 0, limit = 100, sortBy = "points" } = opts

  const trimmedCountry = countryQuery.trim()
  if (!trimmedCountry) {
    return {
      countryQuery: countryQuery,
      year,
      rows: [],
      totalCount: 0,
      classes: [],
    }
  }

  const { start, end } = getYearBounds(year)

  // Reuse the same main-race detection logic as the track leaderboard:
  // sessionType='main' OR raceLabel contains 'main' (case-insensitive).
  const baseRaceWhere: Prisma.RaceWhereInput = {
    OR: [
      { sessionType: "main" },
      {
        raceLabel: {
          contains: "main",
          mode: "insensitive",
        },
      },
    ],
    event: {
      // Exclude practice days by convention in sourceEventId
      sourceEventId: {
        not: {
          contains: "-practice-",
        },
      },
      eventDate: {
        gte: start,
        lte: end,
      },
      track: {
        // Match country by case-insensitive substring to handle values like
        // "Australia", "AU", or "Sydney, Australia".
        country: {
          contains: trimmedCountry,
          mode: "insensitive",
        },
      },
    },
  }

  const raceWhere: Prisma.RaceWhereInput = {
    ...baseRaceWhere,
    ...(className != null && className !== "" ? { className } : {}),
  }

  // Fetch full class list (unfiltered by className) for this country+year filter.
  const allClassRows = await prisma.race.findMany({
    where: baseRaceWhere,
    select: {
      className: true,
    },
    distinct: ["className"],
  })

  const allClasses = Array.from(new Set(allClassRows.map((r) => r.className))).sort((a, b) =>
    a.localeCompare(b)
  )

  // Fetch filtered main-race results for aggregation.
  const results = await prisma.raceResult.findMany({
    where: {
      race: raceWhere,
    },
    select: {
      positionFinal: true,
      race: {
        select: {
          className: true,
          event: {
            select: {
              id: true,
            },
          },
        },
      },
      raceDriver: {
        select: {
          driverId: true,
          displayName: true,
        },
      },
    },
  })

  type AggregateKey = string
  type AggregateValue = {
    driverId: string
    driverName: string
    className: string
    points: number
    wins: number
    podiums: number
    eventIds: Set<string>
  }

  const byDriverClass: Map<AggregateKey, AggregateValue> = new Map()

  for (const r of results) {
    const driverId = r.raceDriver.driverId
    const driverName = r.raceDriver.displayName ?? "Unknown"
    const cn = r.race.className
    const eventId = r.race.event.id

    const key = `${driverId}:${cn}`
    const existing = byDriverClass.get(key)

    const pos = r.positionFinal
    const pts = pointsForPosition(pos)
    const win = pos === 1 ? 1 : 0
    const podium = pos === 2 || pos === 3 ? 1 : 0

    if (!existing) {
      byDriverClass.set(key, {
        driverId,
        driverName,
        className: cn,
        points: pts,
        wins: win,
        podiums: podium,
        eventIds: new Set(eventId ? [eventId] : []),
      })
    } else {
      existing.points += pts
      existing.wins += win
      existing.podiums += podium
      if (eventId) {
        existing.eventIds.add(eventId)
      }
    }
  }

  let rows: CountryLeaderboardRow[] = Array.from(byDriverClass.values()).map((value) => ({
    driverId: value.driverId,
    driverName: value.driverName,
    className: value.className,
    points: value.points,
    wins: value.wins,
    podiums: value.podiums,
    eventsCount: value.eventIds.size,
  }))

  // Sort: default by points, then wins, then podiums, then driver name.
  rows.sort((a, b) => {
    if (sortBy === "name") {
      const nameCmp = a.driverName.localeCompare(b.driverName)
      if (nameCmp !== 0) return nameCmp
    }
    if (a.points !== b.points) return b.points - a.points
    if (a.wins !== b.wins) return b.wins - a.wins
    if (a.podiums !== b.podiums) return b.podiums - a.podiums
    return a.driverName.localeCompare(b.driverName)
  })

  const totalCount = rows.length

  // Enforce an upper bound on page size to avoid very large responses.
  const safeLimit = Math.min(Math.max(limit, 1), 500)
  const safeOffset = Math.max(offset, 0)

  rows = rows.slice(safeOffset, safeOffset + safeLimit)

  return {
    countryQuery: trimmedCountry,
    year,
    rows,
    totalCount,
    classes: allClasses,
  }
}
