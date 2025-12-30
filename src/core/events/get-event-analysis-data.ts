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

import { prisma } from "@/lib/prisma"

function sanitizeLapTime(value: number | null | undefined): number | null {
  if (typeof value !== "number") {
    return null
  }
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
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

export interface EventSummary {
  event: {
    id: string
    eventName: string
    eventDate: Date
    trackName: string
  }
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

export interface EventAnalysisData {
  event: {
    id: string
    eventName: string
    eventDate: Date
    trackName: string
  }
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
      avgLapTime: number | null
      consistency: number | null
      laps: Array<{
        lapNumber: number
        lapTimeSeconds: number
        elapsedRaceTime: number
        positionOnLap: number
      }>
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
 * @returns Event summary with aggregated statistics or null if event not found
 */
export async function getEventSummary(
  eventId: string
): Promise<EventSummary | null> {
  // Fetch event metadata only
  const event = await prisma.event.findUnique({
    where: { id: eventId },
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
  })

  if (!event) {
    return null
  }

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

  return {
    event: {
      id: event.id,
      eventName: event.eventName,
      eventDate: event.eventDate,
      trackName: event.track.trackName,
    },
    summary: {
      totalRaces: raceStats._count.id,
      totalDrivers: distinctDrivers.length,
      totalLaps: lapStats._count.id,
      dateRange: {
        earliest: raceStats._min.startTime,
        latest: raceStats._max.startTime,
      },
    },
  }
}

/**
 * Get comprehensive event analysis data
 * 
 * @param eventId - Event's unique identifier
 * @returns Structured event analysis data or null if event not found
 */
export async function getEventAnalysisData(
  eventId: string
): Promise<EventAnalysisData | null> {
  // Fetch event with all related data
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      track: true,
      races: {
        include: {
          results: {
            include: {
              raceDriver: true,
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

  let totalLaps = 0
  const raceDates: Date[] = []

  // Process each race
  const racesData = event.races.map((race) => {
    if (race.startTime) {
      raceDates.push(race.startTime)
    }

    const resultsData = race.results.map((result) => {
      totalLaps += result.laps.length

      // Derive lap metrics when LiveRC omits aggregate columns
      const derivedMetrics = deriveLapMetrics(result.laps)
      const normalizedFastLap =
        sanitizeLapTime(result.fastLapTime) ?? derivedMetrics.bestLap
      const normalizedAvgLap =
        sanitizeLapTime(result.avgLapTime) ?? derivedMetrics.averageLap

      // Track driver stats using normalized Driver ID (not raceDriverId)
      const driverId = result.raceDriver.driverId
      // Use denormalized displayName from RaceDriver (no need to join Driver table)
      const driverName = result.raceDriver.displayName
      
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
        if (
          driverData.bestLapTime === null ||
          normalizedFastLap < driverData.bestLapTime
        ) {
          driverData.bestLapTime = normalizedFastLap
        }
      }

      if (normalizedAvgLap !== null) {
        driverData.avgLapTimes.push(normalizedAvgLap)
      }

      if (result.consistency !== null) {
        driverData.consistencies.push(result.consistency)
      }

      return {
        raceResultId: result.id,
        raceDriverId: result.raceDriverId,
        driverId: driverId,
        driverName: driverName,
        positionFinal: result.positionFinal,
        lapsCompleted: result.lapsCompleted,
        totalTimeSeconds: result.totalTimeSeconds,
        fastLapTime: normalizedFastLap,
        avgLapTime: normalizedAvgLap,
        consistency: result.consistency,
        laps: result.laps.map((lap) => ({
          lapNumber: lap.lapNumber,
          lapTimeSeconds: lap.lapTimeSeconds,
          elapsedRaceTime: lap.elapsedRaceTime,
          positionOnLap: lap.positionOnLap,
        })),
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
        ? driver.avgLapTimes.reduce((a, b) => a + b, 0) /
          driver.avgLapTimes.length
        : null

    const consistency =
      driver.consistencies.length > 0
        ? driver.consistencies.reduce((a, b) => a + b, 0) /
          driver.consistencies.length
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

  // Calculate date range
  const earliestDate = raceDates.length > 0 ? new Date(Math.min(...raceDates.map(d => d.getTime()))) : null
  const latestDate = raceDates.length > 0 ? new Date(Math.max(...raceDates.map(d => d.getTime()))) : null

  return {
    event: {
      id: event.id,
      eventName: event.eventName,
      eventDate: event.eventDate,
      trackName: event.track.trackName,
    },
    races: racesData,
    drivers: driversData,
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
