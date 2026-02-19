/**
 * @fileoverview Get event analysis data - aggregates event data for analysis
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Fetches and aggregates event data including races, results, drivers, and lap data
 *
 * @purpose Provides structured data for event analysis charts and visualizations.
 *          All database access is delegated to repo.ts following mobile-safe architecture.
 *
 * @relatedFiles
 * - src/core/events/repo.ts (database access)
 * - src/core/events/calculate-driver-stats.ts (driver statistics)
 */

import { toDateOnlyUTC } from "@/lib/date-utils"
import { prisma } from "@/lib/prisma"
import {
  calculateClassThresholds,
  isValidLapTime,
  type RaceResultForValidation,
} from "./validate-lap-times"
import { calculateMostImprovedDrivers } from "./calculate-driver-improvement"

function sanitizeLapTime(value: number | null | undefined): number | null {
  if (typeof value !== "number") {
    return null
  }
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

function sanitizeDuration(value: number | null | undefined): number | null {
  if (typeof value !== "number") {
    return null
  }
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

const LAP_TIME_TOLERANCE = 0.001

function findFastLapLapNumber(
  laps: Array<{ lapNumber: number; lapTimeSeconds: number }>,
  fastLapTime: number
): number | null {
  if (!laps || laps.length === 0) return null
  const match = laps.find(
    (lap) =>
      lap.lapTimeSeconds != null &&
      Number.isFinite(lap.lapTimeSeconds) &&
      Math.abs(lap.lapTimeSeconds - fastLapTime) < LAP_TIME_TOLERANCE
  )
  return match?.lapNumber ?? null
}

function deriveLapMetrics(
  laps: Array<{
    lapTimeSeconds: number
  }>
): { bestLap: number | null; averageLap: number | null } {
  if (!laps || laps.length === 0) {
    return { bestLap: null, averageLap: null }
  }

  let best = Infinity
  let total = 0
  let count = 0

  for (const lap of laps) {
    const time = sanitizeLapTime(lap.lapTimeSeconds)
    if (time === null) {
      continue
    }
    if (time < best) {
      best = time
    }
    total += time
    count += 1
  }

  if (count === 0) {
    return { bestLap: null, averageLap: null }
  }

  return {
    bestLap: Number.isFinite(best) ? best : null,
    averageLap: total / count,
  }
}

function calculateTotalTimeFromLaps(laps: Array<{ lapTimeSeconds: number }>): number | null {
  if (!laps || laps.length === 0) {
    return null
  }

  let total = 0
  let hasValidLap = false

  for (const lap of laps) {
    const sanitized = sanitizeLapTime(lap.lapTimeSeconds)
    if (sanitized === null) {
      continue
    }
    hasValidLap = true
    total += sanitized
  }

  if (!hasValidLap) {
    return null
  }

  return total
}

export interface EventSummary {
  event: {
    id: string
    eventName: string
    eventDate: Date
    trackName: string
  }
  /** True when event.sourceEventId contains '-practice-' (practice day). */
  isPracticeDay?: boolean
  summary: {
    totalRaces: number
    totalDrivers: number
    totalLaps: number
    dateRange: {
      earliest: Date | null
      latest: Date | null
    }
  }
  topDrivers?: Array<{
    driverId: string
    driverName: string
    fastestLapTime: number
    raceLabel: string
    className: string
    raceId: string
  }>
  mostConsistentDrivers?: Array<{
    driverId: string
    driverName: string
    consistency: number
    raceLabel: string
    className: string
    raceId: string
  }>
  bestAvgLapDrivers?: Array<{
    driverId: string
    driverName: string
    avgLapTime: number
    raceLabel: string
    className: string
    raceId: string
  }>
  mostImprovedDrivers?: Array<{
    driverId: string
    driverName: string
    className: string
    firstRacePosition: number
    lastRacePosition: number
    positionImprovement: number
    firstRaceFastLap: number | null
    lastRaceFastLap: number | null
    lapTimeImprovement: number | null
    improvementScore: number
    firstRaceId: string
    lastRaceId: string
    raceLabel: string
  }>
  userBestLap?: {
    lapTime: number
    position: number
    gapToFastest: number
  }
  userBestConsistency?: {
    consistency: number
    position: number
    gapToBest: number
  }
  userBestAvgLap?: {
    avgLapTime: number
    position: number
    gapToBest: number
  }
  userBestImprovement?: {
    positionImprovement: number
    lapTimeImprovement: number | null
    position: number
    gapToBest: number
    firstRacePosition: number
    lastRacePosition: number
    className: string
    raceLabel: string
  }
}

export interface EventAnalysisData {
  event: {
    id: string
    eventName: string
    eventDate: Date
    trackName: string
  }
  /** True when event.sourceEventId contains '-practice-' (practice day). */
  isPracticeDay?: boolean
  races: Array<{
    id: string
    raceId: string
    className: string
    raceLabel: string
    raceOrder: number | null
    startTime: Date | null
    durationSeconds: number | null
    results: Array<{
      raceResultId: string
      raceDriverId: string
      driverId: string
      driverName: string
      positionFinal: number
      lapsCompleted: number
      totalTimeSeconds: number | null
      fastLapTime: number | null
      /** Lap number (1-based) that produced fastLapTime, when lap data available. Optional for API compatibility. */
      fastLapLapNumber?: number | null
      avgLapTime: number | null
      consistency: number | null
      // laps array removed - not used by any components, only needed for metric derivation
    }>
  }>
  drivers: Array<{
    driverId: string
    driverName: string
    racesParticipated: number
    bestLapTime: number | null
    avgLapTime: number | null
    consistency: number | null
  }>
  entryList: Array<{
    id: string
    driverId: string
    driverName: string
    className: string
    transponderNumber: string | null
    carNumber: string | null
  }>
  raceClasses: Map<
    string,
    {
      vehicleType: string | null
      vehicleTypeNeedsReview: boolean
    }
  >
  /** Multi-main overall results (triple/double main standings) from LiveRC */
  multiMainResults: Array<{
    id: string
    classLabel: string
    tieBreaker: string | null
    completedMains: number
    totalMains: number
    entries: Array<{
      position: number
      seededPosition: number | null
      driverName: string
      points: number
      mainBreakdown: Record<string, { position: number; points: number; lapsTime: string }> | null
    }>
  }>
  summary: {
    totalRaces: number
    totalDrivers: number
    totalLaps: number
    dateRange: {
      earliest: Date | null
      latest: Date | null
    }
  }
}

/**
 * Get lightweight event summary using database aggregations
 *
 * This function uses Prisma aggregations to compute summary statistics
 * without loading the full event graph (races, results, laps).
 *
 * @param eventId - Event's unique identifier
 * @param userId - Optional user ID to include user's best lap comparison
 * @returns Event summary with aggregated statistics or null if event not found
 */
export async function getEventSummary(
  eventId: string,
  userId?: string
): Promise<EventSummary | null> {
  // Fetch event metadata only
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      eventName: true,
      eventDate: true,
      sourceEventId: true,
      track: {
        select: {
          trackName: true,
        },
      },
    },
  })

  if (!event) {
    return null
  }

  const isPracticeDay = event.sourceEventId?.includes("-practice-") ?? false

  // Get race count and date range using aggregations
  const raceStats = await prisma.race.aggregate({
    where: { eventId },
    _count: {
      id: true,
    },
    _min: {
      startTime: true,
    },
    _max: {
      startTime: true,
    },
  })

  // Get distinct driver count (using raceDriver.driverId)
  const distinctDrivers = await prisma.raceDriver.groupBy({
    by: ["driverId"],
    where: {
      race: {
        eventId,
      },
    },
  })

  // Get total lap count using aggregation
  const lapStats = await prisma.lap.aggregate({
    where: {
      raceResult: {
        race: {
          eventId,
        },
      },
    },
    _count: {
      id: true,
    },
  })

  // Get top 3 fastest drivers
  const allResults = await prisma.raceResult.findMany({
    where: {
      race: { eventId },
      fastLapTime: { not: null },
    },
    select: {
      fastLapTime: true,
      race: {
        select: {
          raceLabel: true,
          className: true,
          id: true,
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

  // Calculate class thresholds for validation
  const resultsForValidation: RaceResultForValidation[] = allResults.map((result) => ({
    fastLapTime: result.fastLapTime,
    className: result.race.className,
  }))
  const classThresholds = calculateClassThresholds(resultsForValidation)

  // Group by driverId to get each driver's best lap
  const driverBestLaps = new Map<
    string,
    {
      driverId: string
      driverName: string
      fastestLapTime: number
      raceLabel: string
      className: string
      raceId: string
    }
  >()

  for (const result of allResults) {
    const lapTime = sanitizeLapTime(result.fastLapTime)
    if (lapTime === null) continue

    // Validate lap time against class threshold
    if (!isValidLapTime(lapTime, result.race.className, classThresholds)) {
      continue
    }

    const driverId = result.raceDriver.driverId
    const existing = driverBestLaps.get(driverId)

    if (!existing || lapTime < existing.fastestLapTime) {
      driverBestLaps.set(driverId, {
        driverId,
        driverName: result.raceDriver.displayName,
        fastestLapTime: lapTime,
        raceLabel: result.race.raceLabel,
        className: result.race.className,
        raceId: result.race.id,
      })
    }
  }

  // Group drivers by className, keeping all drivers per class
  const driversByClass = new Map<
    string,
    Array<{
      driverId: string
      driverName: string
      fastestLapTime: number
      raceLabel: string
      className: string
      raceId: string
    }>
  >()

  for (const driver of driverBestLaps.values()) {
    const classDrivers = driversByClass.get(driver.className) || []
    classDrivers.push(driver)
    driversByClass.set(driver.className, classDrivers)
  }

  // Sort drivers within each class by fastest lap time
  for (const [className, drivers] of driversByClass.entries()) {
    drivers.sort((a, b) => a.fastestLapTime - b.fastestLapTime)
  }

  // Sort classes by their fastest driver's lap time and take top 3 classes
  const topClasses = Array.from(driversByClass.entries())
    .map(([className, drivers]) => ({
      className,
      fastestLapTime: drivers[0].fastestLapTime,
      drivers,
    }))
    .sort((a, b) => a.fastestLapTime - b.fastestLapTime)
    .slice(0, 3)

  // Flatten to get top 3 drivers from each of the top 3 classes
  const topDrivers: Array<{
    driverId: string
    driverName: string
    fastestLapTime: number
    raceLabel: string
    className: string
    raceId: string
  }> = []

  for (const classData of topClasses) {
    // Take top 3 drivers from each class
    const topDriversFromClass = classData.drivers.slice(0, 3)
    topDrivers.push(...topDriversFromClass)
  }

  // Sort all drivers by fastest lap time to maintain overall ranking
  topDrivers.sort((a, b) => a.fastestLapTime - b.fastestLapTime)

  // Get top 3 most consistent drivers (highest consistency score)
  const allResultsWithConsistency = await prisma.raceResult.findMany({
    where: {
      race: { eventId },
      consistency: { not: null },
    },
    select: {
      consistency: true,
      race: {
        select: {
          raceLabel: true,
          className: true,
          id: true,
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

  const driverBestConsistency = new Map<
    string,
    {
      driverId: string
      driverName: string
      consistency: number
      raceLabel: string
      className: string
      raceId: string
    }
  >()

  for (const result of allResultsWithConsistency) {
    const consistency = result.consistency
    if (consistency === null) continue

    const driverId = result.raceDriver.driverId
    const existing = driverBestConsistency.get(driverId)

    if (!existing || consistency > existing.consistency) {
      driverBestConsistency.set(driverId, {
        driverId,
        driverName: result.raceDriver.displayName,
        consistency,
        raceLabel: result.race.raceLabel,
        className: result.race.className,
        raceId: result.race.id,
      })
    }
  }

  const mostConsistentDrivers = Array.from(driverBestConsistency.values())
    .sort((a, b) => b.consistency - a.consistency)
    .slice(0, 3)

  // Get top 3 drivers by best average lap time (lowest average from any single race)
  const allResultsWithAvgLap = await prisma.raceResult.findMany({
    where: {
      race: { eventId },
      avgLapTime: { not: null },
    },
    select: {
      avgLapTime: true,
      race: {
        select: {
          raceLabel: true,
          className: true,
          id: true,
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

  const driverBestAvgLap = new Map<
    string,
    {
      driverId: string
      driverName: string
      avgLapTime: number
      raceLabel: string
      className: string
      raceId: string
    }
  >()

  for (const result of allResultsWithAvgLap) {
    const avgLapTime = sanitizeLapTime(result.avgLapTime)
    if (avgLapTime === null) continue

    const driverId = result.raceDriver.driverId
    const existing = driverBestAvgLap.get(driverId)

    if (!existing || avgLapTime < existing.avgLapTime) {
      driverBestAvgLap.set(driverId, {
        driverId,
        driverName: result.raceDriver.displayName,
        avgLapTime,
        raceLabel: result.race.raceLabel,
        className: result.race.className,
        raceId: result.race.id,
      })
    }
  }

  const bestAvgLapDrivers = Array.from(driverBestAvgLap.values())
    .sort((a, b) => a.avgLapTime - b.avgLapTime)
    .slice(0, 3)

  // Get most improved drivers (lap-time-only for practice days)
  const mostImprovedDrivers = await calculateMostImprovedDrivers(eventId, isPracticeDay)

  // Get user's best lap if userId provided
  let userBestLap: { lapTime: number; position: number; gapToFastest: number } | undefined
  let userBestConsistency: { consistency: number; position: number; gapToBest: number } | undefined
  let userBestAvgLap: { avgLapTime: number; position: number; gapToBest: number } | undefined
  let userBestImprovement:
    | {
        positionImprovement: number
        lapTimeImprovement: number | null
        position: number
        gapToBest: number
        firstRacePosition: number
        lastRacePosition: number
        className: string
        raceLabel: string
      }
    | undefined

  if (userId) {
    // Find user's driver link for this event
    const userDriverLink = await prisma.eventDriverLink.findFirst({
      where: {
        userId,
        eventId,
      },
      include: {
        driver: {
          include: {
            raceDrivers: {
              where: {
                race: { eventId },
              },
              include: {
                results: {
                  where: {
                    race: { eventId },
                    fastLapTime: { not: null },
                  },
                  select: {
                    fastLapTime: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (userDriverLink) {
      // Find user's best lap across all their race results (if we have topDrivers data)
      if (topDrivers.length > 0) {
        const userResultsWithRace = await prisma.raceResult.findMany({
          where: {
            raceDriver: {
              driverId: userDriverLink.driverId,
              race: { eventId },
            },
            fastLapTime: { not: null },
          },
          select: {
            fastLapTime: true,
            race: {
              select: {
                className: true,
              },
            },
          },
        })

        let userBestLapTime: number | null = null
        for (const result of userResultsWithRace) {
          const lapTime = sanitizeLapTime(result.fastLapTime)
          if (lapTime === null) continue

          // Validate lap time against class threshold
          if (!isValidLapTime(lapTime, result.race.className, classThresholds)) {
            continue
          }

          if (userBestLapTime === null || lapTime < userBestLapTime) {
            userBestLapTime = lapTime
          }
        }

        if (userBestLapTime !== null) {
          // Find user's position among all drivers
          const allDriverTimes = Array.from(driverBestLaps.values())
            .map((d) => d.fastestLapTime)
            .sort((a, b) => a - b)

          // Count how many drivers have faster lap times
          const fasterCount = allDriverTimes.filter((time) => time < userBestLapTime!).length
          const position = fasterCount + 1

          const fastestLapTime = topDrivers[0]?.fastestLapTime ?? userBestLapTime
          const gapToFastest = userBestLapTime - fastestLapTime

          userBestLap = {
            lapTime: userBestLapTime,
            position,
            gapToFastest,
          }
        }
      }

      // Calculate user's best consistency if we have consistency data
      if (mostConsistentDrivers.length > 0) {
        const userConsistencyResults = await prisma.raceResult.findMany({
          where: {
            raceDriver: {
              driverId: userDriverLink.driverId,
              race: { eventId },
            },
            consistency: { not: null },
          },
          select: {
            consistency: true,
          },
        })

        let userBestConsistencyScore: number | null = null
        for (const result of userConsistencyResults) {
          if (result.consistency !== null) {
            if (
              userBestConsistencyScore === null ||
              result.consistency > userBestConsistencyScore
            ) {
              userBestConsistencyScore = result.consistency
            }
          }
        }

        if (userBestConsistencyScore !== null) {
          // Find user's position among all drivers' best consistency scores
          const allDriverConsistencies = Array.from(driverBestConsistency.values())
            .map((d) => d.consistency)
            .sort((a, b) => b - a) // Sort descending for consistency

          // Count how many drivers have higher consistency scores
          const betterCount = allDriverConsistencies.filter(
            (consistency) => consistency > userBestConsistencyScore!
          ).length
          const position = betterCount + 1

          const bestConsistency = mostConsistentDrivers[0]?.consistency ?? userBestConsistencyScore
          const gapToBest = bestConsistency - userBestConsistencyScore

          userBestConsistency = {
            consistency: userBestConsistencyScore,
            position,
            gapToBest,
          }
        }
      }

      // Calculate user's best average lap time if we have average lap data
      if (bestAvgLapDrivers.length > 0) {
        const userAvgLapResults = await prisma.raceResult.findMany({
          where: {
            raceDriver: {
              driverId: userDriverLink.driverId,
              race: { eventId },
            },
            avgLapTime: { not: null },
          },
          select: {
            avgLapTime: true,
          },
        })

        let userBestAvgLapTime: number | null = null
        for (const result of userAvgLapResults) {
          const avgLapTime = sanitizeLapTime(result.avgLapTime)
          if (avgLapTime === null) continue

          if (userBestAvgLapTime === null || avgLapTime < userBestAvgLapTime) {
            userBestAvgLapTime = avgLapTime
          }
        }

        if (userBestAvgLapTime !== null) {
          // Find user's position among all drivers' best average lap times
          const allDriverAvgLaps = Array.from(driverBestAvgLap.values())
            .map((d) => d.avgLapTime)
            .sort((a, b) => a - b) // Sort ascending for lap times

          // Count how many drivers have better (lower) average lap times
          const betterCount = allDriverAvgLaps.filter(
            (avgLap) => avgLap < userBestAvgLapTime!
          ).length
          const position = betterCount + 1

          const bestAvgLap = bestAvgLapDrivers[0]?.avgLapTime ?? userBestAvgLapTime
          const gapToBest = userBestAvgLapTime - bestAvgLap

          userBestAvgLap = {
            avgLapTime: userBestAvgLapTime,
            position,
            gapToBest,
          }
        }
      }

      // Calculate user's improvement - always show if user has race data
      // First check if user is in the top improved drivers list
      const userInMostImproved = mostImprovedDrivers.find(
        (d) => d.driverId === userDriverLink.driverId
      )

      if (userInMostImproved) {
        // User is in the top improved list - calculate their position
        const allImprovedSorted = [...mostImprovedDrivers].sort(
          (a, b) => b.positionImprovement - a.positionImprovement
        )
        const userPosition =
          allImprovedSorted.findIndex((d) => d.driverId === userDriverLink.driverId) + 1

        const bestImprovement =
          allImprovedSorted[0]?.positionImprovement ?? userInMostImproved.positionImprovement
        const gapToBest = bestImprovement - userInMostImproved.positionImprovement

        userBestImprovement = {
          positionImprovement: userInMostImproved.positionImprovement,
          lapTimeImprovement: userInMostImproved.lapTimeImprovement,
          position: userPosition,
          gapToBest,
          firstRacePosition: userInMostImproved.firstRacePosition,
          lastRacePosition: userInMostImproved.lastRacePosition,
          className: userInMostImproved.className,
          raceLabel: userInMostImproved.raceLabel,
        }
      } else {
        // User is not in top improved - calculate their improvement from race data
        // Get all user's race results ordered by race time to find first and last races
        const userRaceResults = await prisma.raceResult.findMany({
          where: {
            raceDriver: {
              driverId: userDriverLink.driverId,
              race: { eventId },
            },
          },
          select: {
            positionFinal: true,
            fastLapTime: true,
            race: {
              select: {
                id: true,
                startTime: true,
                raceOrder: true,
                className: true,
                raceLabel: true,
              },
            },
          },
          orderBy: [{ race: { raceOrder: "asc" } }, { race: { startTime: "asc" } }],
        })

        if (userRaceResults.length >= 2) {
          // Sort by raceOrder, then by startTime as fallback (some events have all raceOrder=1)
          const sortedResults = [...userRaceResults].sort((a, b) => {
            const orderA = a.race.raceOrder ?? 0
            const orderB = b.race.raceOrder ?? 0
            if (orderA !== orderB) {
              return orderA - orderB
            }
            // Fallback to startTime when raceOrder is the same
            const timeA = a.race.startTime?.getTime() ?? 0
            const timeB = b.race.startTime?.getTime() ?? 0
            return timeA - timeB
          })

          const firstRace = sortedResults[0]
          const lastRace = sortedResults[sortedResults.length - 1]

          const positionImprovement = firstRace.positionFinal - lastRace.positionFinal

          // Only calculate lap time improvement if both have valid lap times
          let lapTimeImprovement: number | null = null
          if (firstRace.fastLapTime !== null && lastRace.fastLapTime !== null) {
            lapTimeImprovement = firstRace.fastLapTime - lastRace.fastLapTime
          }

          // Always show improvement data (positive, zero, or negative)
          // Find position among all improved drivers (only count those with positive improvement)
          const allImprovedSorted = [...mostImprovedDrivers].sort(
            (a, b) => b.positionImprovement - a.positionImprovement
          )

          // Count how many drivers have better improvement than user
          const betterCount = allImprovedSorted.filter(
            (d) => d.positionImprovement > positionImprovement
          ).length
          // Position is betterCount + 1, but if user didn't improve, they're after all improved drivers
          const position = positionImprovement > 0 ? betterCount + 1 : allImprovedSorted.length + 1

          const bestImprovement =
            allImprovedSorted[0]?.positionImprovement ?? Math.max(0, positionImprovement)
          const gapToBest = bestImprovement - positionImprovement

          userBestImprovement = {
            positionImprovement,
            lapTimeImprovement,
            position,
            gapToBest,
            firstRacePosition: firstRace.positionFinal,
            lastRacePosition: lastRace.positionFinal,
            className: lastRace.race.className,
            raceLabel: lastRace.race.raceLabel,
          }
        }
      }
    }
  }

  return {
    event: {
      id: event.id,
      eventName: event.eventName,
      eventDate: event.eventDate,
      trackName: event.track.trackName,
    },
    isPracticeDay,
    summary: {
      totalRaces: raceStats._count.id,
      totalDrivers: distinctDrivers.length,
      totalLaps: lapStats._count.id,
      dateRange: {
        // Use event date for range so display matches official event dates (no timezone shift)
        earliest: toDateOnlyUTC(event.eventDate),
        latest: toDateOnlyUTC(
          raceStats._max.startTime != null
            ? new Date(
                Math.max(event.eventDate.getTime(), raceStats._max.startTime.getTime())
              )
            : event.eventDate
        ),
      },
    },
    topDrivers: topDrivers.length > 0 ? topDrivers : undefined,
    mostConsistentDrivers: mostConsistentDrivers.length > 0 ? mostConsistentDrivers : undefined,
    bestAvgLapDrivers: bestAvgLapDrivers.length > 0 ? bestAvgLapDrivers : undefined,
    mostImprovedDrivers: mostImprovedDrivers.length > 0 ? mostImprovedDrivers : undefined,
    userBestLap,
    userBestConsistency,
    userBestAvgLap,
    userBestImprovement,
  }
}

/**
 * Get comprehensive event analysis data
 *
 * @param eventId - Event's unique identifier
 * @returns Structured event analysis data or null if event not found
 */
export async function getEventAnalysisData(eventId: string): Promise<EventAnalysisData | null> {
  // Fetch event with all related data
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      track: true,
      multiMainResults: {
        include: {
          entries: {
            include: {
              driver: {
                select: {
                  displayName: true,
                },
              },
            },
            orderBy: {
              position: "asc",
            },
          },
        },
      },
      races: {
        include: {
          results: {
            include: {
              raceDriver: {
                select: {
                  id: true,
                  raceId: true,
                  driverId: true,
                  displayName: true,
                  sourceDriverId: true,
                  driver: {
                    select: {
                      displayName: true,
                    },
                  },
                },
              },
              laps: {
                orderBy: {
                  lapNumber: "asc",
                },
              },
            },
            orderBy: {
              positionFinal: "asc",
            },
          },
        },
        orderBy: {
          raceOrder: "asc",
        },
      },
    },
  })

  if (!event) {
    return null
  }

  // Calculate class thresholds for validation
  // Collect all race results with fastLapTime for threshold calculation
  const allResultsForValidation: RaceResultForValidation[] = []
  for (const race of event.races) {
    for (const result of race.results) {
      if (result.fastLapTime !== null) {
        allResultsForValidation.push({
          fastLapTime: result.fastLapTime,
          className: race.className,
        })
      }
    }
  }
  const classThresholds = calculateClassThresholds(allResultsForValidation)

  // Aggregate driver data across all races using normalized Driver ID
  const driverMap = new Map<
    string,
    {
      driverId: string
      driverName: string
      racesParticipated: number
      bestLapTime: number | null
      avgLapTimes: number[]
      consistencies: number[]
    }
  >()

  const raceDates: Date[] = []

  // Get total laps count using database aggregation (more efficient than loading all laps)
  const totalLapsResult = await prisma.lap.count({
    where: {
      raceResult: {
        race: {
          eventId: eventId,
        },
      },
    },
  })
  const totalLaps = totalLapsResult

  // Process each race
  const racesData = event.races.map((race) => {
    if (race.startTime) {
      raceDates.push(race.startTime)
    }

    const resultsData = race.results.map((result) => {
      // Derive lap metrics when LiveRC omits aggregate columns
      const derivedMetrics = deriveLapMetrics(result.laps)
      let normalizedFastLap = sanitizeLapTime(result.fastLapTime) ?? derivedMetrics.bestLap

      // Validate fast lap time against class threshold
      if (
        normalizedFastLap !== null &&
        !isValidLapTime(normalizedFastLap, race.className, classThresholds)
      ) {
        normalizedFastLap = null
      }

      const normalizedAvgLap = sanitizeLapTime(result.avgLapTime) ?? derivedMetrics.averageLap

      const derivedTotalTime = calculateTotalTimeFromLaps(result.laps)
      const totalTimeSeconds = sanitizeDuration(result.totalTimeSeconds) ?? derivedTotalTime

      // Track driver stats using normalized Driver ID (not raceDriverId)
      const driverId = result.raceDriver.driverId
      const linkedDriverName = result.raceDriver.driver?.displayName?.trim()
      const raceDriverName = result.raceDriver.displayName?.trim()

      // CRITICAL: Use raceDriverName FIRST (actual race data from RaceDriver.displayName)
      // This is the name that was actually used in the race, not a fuzzy-matched lookup
      // Only fall back to linkedDriverName (Driver.displayName) if race data is missing
      let driverName: string
      if (raceDriverName && raceDriverName.length > 0) {
        driverName = raceDriverName
      } else if (linkedDriverName && linkedDriverName.length > 0) {
        driverName = linkedDriverName
        console.warn(
          "[get-event-analysis-data] Using linked driver name (fuzzy match) instead of race data:",
          {
            raceId: race.id,
            raceLabel: race.raceLabel,
            driverId: driverId,
            raceDriverName: raceDriverName,
            linkedDriverName: linkedDriverName,
          }
        )
      } else {
        driverName = "Unknown Driver"
      }

      // Fix any malformed duplicated names (e.g., "TURNER, HARRISONHARRISON TURNER")
      const fixMalformedName = (name: string): string => {
        // Pattern: "LASTNAME, FIRSTNAMEFIRSTNAME LASTNAME"
        const pattern = /^([A-Z][A-Z\s,]+?),\s*([A-Z]+)\2\s+\1$/
        const match = name.match(pattern)
        if (match && match[1] && match[2]) {
          return `${match[1]}, ${match[2]}`
        }
        // Pattern 2: First name duplicated
        const pattern2 = /^([A-Z][A-Z\s,]+?),\s*([A-Z]+)\2/
        const match2 = name.match(pattern2)
        if (match2 && match2[1] && match2[2]) {
          return `${match2[1]}, ${match2[2]}`
        }
        return name
      }

      const originalName = driverName
      driverName = fixMalformedName(driverName)
      if (driverName !== originalName) {
        console.warn("[get-event-analysis-data] Fixed malformed driver name:", {
          original: originalName,
          fixed: driverName,
          raceId: race.id,
          raceLabel: race.raceLabel,
          driverId: driverId,
        })
      }

      if (!driverMap.has(driverId)) {
        driverMap.set(driverId, {
          driverId: driverId,
          driverName: driverName,
          racesParticipated: 0,
          bestLapTime: null,
          avgLapTimes: [],
          consistencies: [],
        })
      }

      const driverData = driverMap.get(driverId)!
      driverData.racesParticipated++

      if (normalizedFastLap !== null) {
        if (driverData.bestLapTime === null || normalizedFastLap < driverData.bestLapTime) {
          driverData.bestLapTime = normalizedFastLap
        }
      }

      if (normalizedAvgLap !== null) {
        driverData.avgLapTimes.push(normalizedAvgLap)
      }

      if (result.consistency !== null) {
        driverData.consistencies.push(result.consistency)
      }

      const fastLapLapNumber =
        normalizedFastLap !== null && result.laps?.length
          ? findFastLapLapNumber(result.laps, normalizedFastLap)
          : null

      return {
        raceResultId: result.id,
        raceDriverId: result.raceDriverId,
        driverId: driverId,
        driverName: driverName,
        positionFinal: result.positionFinal,
        lapsCompleted: result.lapsCompleted,
        totalTimeSeconds,
        fastLapTime: normalizedFastLap,
        fastLapLapNumber,
        avgLapTime: normalizedAvgLap,
        consistency: result.consistency,
        // Note: laps array removed from response to reduce payload size
        // Individual lap data is not used by any components
        // Laps are only loaded to derive metrics when aggregates are missing
      }
    })

    return {
      id: race.id,
      raceId: race.id,
      className: race.className,
      raceLabel: race.raceLabel,
      raceOrder: race.raceOrder,
      startTime: race.startTime,
      durationSeconds: race.durationSeconds,
      results: resultsData,
    }
  })

  // Calculate driver aggregates
  const driversData = Array.from(driverMap.values()).map((driver) => {
    const avgLapTime =
      driver.avgLapTimes.length > 0
        ? driver.avgLapTimes.reduce((a, b) => a + b, 0) / driver.avgLapTimes.length
        : null

    const consistency =
      driver.consistencies.length > 0
        ? driver.consistencies.reduce((a, b) => a + b, 0) / driver.consistencies.length
        : null

    return {
      driverId: driver.driverId,
      driverName: driver.driverName,
      racesParticipated: driver.racesParticipated,
      bestLapTime: driver.bestLapTime,
      avgLapTime,
      consistency,
    }
  })

  // Use event date for range so display matches official event dates (no timezone shift).
  // Earliest is always the event's date; latest is the later of event date and last race start.
  const earliestDate = toDateOnlyUTC(event.eventDate)
  const latestDate = toDateOnlyUTC(
    raceDates.length > 0
      ? new Date(
          Math.max(
            event.eventDate.getTime(),
            ...raceDates.map((d) => d.getTime())
          )
        )
      : event.eventDate
  )

  // Fetch entry list (EventEntry records)
  const eventEntries = await prisma.eventEntry.findMany({
    where: { eventId },
    include: {
      driver: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
    orderBy: { className: "asc" },
  })

  // Fetch EventRaceClass records for vehicle type information
  const eventRaceClasses = await prisma.eventRaceClass.findMany({
    where: { eventId },
    select: {
      className: true,
      vehicleType: true,
      vehicleTypeNeedsReview: true,
    },
  })

  // Create map of race classes to vehicle type info
  const raceClassesMap = new Map<
    string,
    { vehicleType: string | null; vehicleTypeNeedsReview: boolean }
  >()
  eventRaceClasses.forEach((rc) => {
    raceClassesMap.set(rc.className, {
      vehicleType: rc.vehicleType,
      vehicleTypeNeedsReview: rc.vehicleTypeNeedsReview,
    })
  })

  // Sort by className first, then by driver name
  const sortedEntries = [...eventEntries].sort((a, b) => {
    const classNameCompare = a.className.localeCompare(b.className)
    if (classNameCompare !== 0) return classNameCompare
    return a.driver.displayName.localeCompare(b.driver.displayName)
  })

  const entryListData = sortedEntries.map((entry) => ({
    id: entry.id,
    driverId: entry.driverId,
    driverName: entry.driver.displayName,
    className: entry.className,
    transponderNumber: entry.transponderNumber,
    carNumber: entry.carNumber,
  }))

  const isPracticeDay = event.sourceEventId?.includes("-practice-") ?? false

  const multiMainResultsData = (event.multiMainResults ?? []).map((mm) => ({
    id: mm.id,
    classLabel: mm.classLabel,
    tieBreaker: mm.tieBreaker,
    completedMains: mm.completedMains,
    totalMains: mm.totalMains,
    entries: mm.entries.map((e) => ({
      position: e.position,
      seededPosition: e.seededPosition,
      driverName: e.driver.displayName,
      points: e.points,
      mainBreakdown: e.mainBreakdownJson as Record<
        string,
        { position: number; points: number; lapsTime: string }
      > | null,
    })),
  }))

  return {
    event: {
      id: event.id,
      eventName: event.eventName,
      eventDate: event.eventDate,
      trackName: event.track.trackName,
    },
    isPracticeDay,
    races: racesData,
    drivers: driversData,
    entryList: entryListData,
    raceClasses: raceClassesMap,
    multiMainResults: multiMainResultsData,
    summary: {
      totalRaces: event.races.length,
      totalDrivers: driversData.length,
      totalLaps,
      dateRange: {
        earliest: earliestDate,
        latest: latestDate,
      },
    },
  }
}
