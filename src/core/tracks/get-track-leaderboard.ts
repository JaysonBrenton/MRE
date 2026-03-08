/**
 * @fileoverview Track leaderboard - aggregate main-race results by points
 *
 * @description Fetches main-race results at a track across events, applies
 *              racing-style points (1st=25, 2nd=18, etc.), groups by driver+class,
 *              and returns sorted leaderboard. Main detection: sessionType='main'
 *              or raceLabel contains 'main'.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/MainPodiumCard.tsx (main detection)
 * - src/app/api/v1/events/[eventId]/track-leaderboard/route.ts (API)
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

export interface GetTrackLeaderboardOptions {
  className?: string | null
  startDate?: Date
  endDate?: Date
  /** When true, only fetch classes; skip driver aggregation. Returns empty drivers. */
  classesOnly?: boolean
}

export interface TrackLeaderboardDriver {
  driverId: string
  driverName: string
  className: string
  points: number
  wins: number
  podiums: number
}

export interface TrackLeaderboardResult {
  trackName: string
  drivers: TrackLeaderboardDriver[]
  classes: string[]
}

/**
 * Get track leaderboard: drivers ranked by points from main races at the track.
 * One row per (driver, class). Sort: points desc, wins desc, podiums desc.
 */
export async function getTrackLeaderboard(
  trackId: string,
  opts?: GetTrackLeaderboardOptions
): Promise<TrackLeaderboardResult | null> {
  const { className, startDate, endDate, classesOnly } = opts ?? {}

  const track = await prisma.track.findUnique({
    where: { id: trackId },
    select: { trackName: true },
  })

  if (!track) {
    return null
  }

  const eventWhere: Prisma.EventWhereInput = {
    trackId,
    // Exclude practice days - they typically don't have mains in the same way
    sourceEventId: {
      not: {
        contains: "-practice-",
      },
    },
  }

  if (startDate != null && endDate != null) {
    eventWhere.eventDate = {
      gte: startDate,
      lte: endDate,
    }
  }

  const baseRaceWhere: Prisma.RaceWhereInput = {
    event: eventWhere,
    OR: [
      { sessionType: "main" },
      {
        raceLabel: {
          contains: "main",
          mode: "insensitive",
        },
      },
    ],
  }

  const raceWhere: Prisma.RaceWhereInput = {
    ...baseRaceWhere,
    ...(className != null && className !== "" ? { className } : {}),
  }

  // Fetch full class list (unfiltered by className)
  const allClassRows = await prisma.race.findMany({
    where: baseRaceWhere,
    select: { className: true },
    distinct: ["className"],
  })

  const allClasses = Array.from(new Set(allClassRows.map((r) => r.className))).sort((a, b) =>
    a.localeCompare(b)
  )

  if (classesOnly) {
    return {
      trackName: track.trackName,
      drivers: [],
      classes: allClasses,
    }
  }

  // Fetch filtered results
  const results = await prisma.raceResult.findMany({
    where: {
      race: raceWhere,
    },
    select: {
      positionFinal: true,
      raceDriver: {
        select: {
          driverId: true,
          displayName: true,
        },
      },
      race: {
        select: {
          className: true,
        },
      },
    },
  })

  const byDriverClass = new Map<
    string,
    {
      driverId: string
      driverName: string
      className: string
      points: number
      wins: number
      podiums: number
    }
  >()

  for (const r of results) {
    const driverId = r.raceDriver.driverId
    const driverName = r.raceDriver.displayName ?? "Unknown"
    const cn = r.race.className

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
      })
    } else {
      existing.points += pts
      existing.wins += win
      existing.podiums += podium
    }
  }

  const drivers: TrackLeaderboardDriver[] = Array.from(byDriverClass.values()).sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points
    if (a.wins !== b.wins) return b.wins - a.wins
    return b.podiums - a.podiums
  })

  return {
    trackName: track.trackName,
    drivers,
    classes: allClasses,
  }
}
