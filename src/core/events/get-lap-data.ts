/**
 * @fileoverview Get lap data - fetches and structures lap data for display
 *
 * @created 2025-01-27
 * @creator Auto-generated
 * @lastModified 2025-01-27
 *
 * @description Fetches lap data from database and structures it by driver and race
 *
 * @purpose Provides structured lap data for the Race Details tab table view.
 *          Groups laps by driver, then by race, with comprehensive lap information.
 *
 * @relatedFiles
 * - src/app/api/v1/events/[eventId]/laps/route.ts (API endpoint)
 * - src/components/event-analysis/sessions/LapDataTable.tsx (consumer)
 */

import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export interface LapData {
  lapId: string
  lapNumber: number
  lapTimeSeconds: number
  lapTimeRaw: string
  positionOnLap: number
  elapsedRaceTime: number
  paceString: string | null
  segmentsJson: Prisma.JsonValue | null
  raceId: string
  raceLabel: string
  className: string
  raceResultId: string
}

export interface RaceLapData {
  raceId: string
  raceLabel: string
  className: string
  laps: LapData[]
  bestLapTime: number | null
  avgLapTime: number | null
  totalLaps: number
  positionFinal: number
}

export interface DriverLapData {
  driverId: string
  driverName: string
  races: RaceLapData[]
  overallBestLap: number | null
  totalLaps: number
}

export interface LapDataResponse {
  drivers: DriverLapData[]
  totalLaps: number
  totalDrivers: number
  totalRaces: number
}

/**
 * Calculate best lap time from array of laps
 */
function calculateBestLapTime(laps: LapData[]): number | null {
  if (laps.length === 0) {
    return null
  }

  const validLaps = laps
    .map((lap) => lap.lapTimeSeconds)
    .filter((time): time is number => time !== null && Number.isFinite(time) && time > 0)

  if (validLaps.length === 0) {
    return null
  }

  return Math.min(...validLaps)
}

/**
 * Calculate average lap time from array of laps
 */
function calculateAvgLapTime(laps: LapData[]): number | null {
  if (laps.length === 0) {
    return null
  }

  const validLaps = laps
    .map((lap) => lap.lapTimeSeconds)
    .filter((time): time is number => time !== null && Number.isFinite(time) && time > 0)

  if (validLaps.length === 0) {
    return null
  }

  const sum = validLaps.reduce((a, b) => a + b, 0)
  return sum / validLaps.length
}

/**
 * Calculate final position from the driver's final lap
 * Returns the positionOnLap from the last lap (highest lapNumber)
 */
function calculatePositionFinal(laps: LapData[]): number {
  if (laps.length === 0) {
    // Fallback: if no laps, return a high number to indicate DNF
    return 999
  }

  // Find the lap with the highest lapNumber (final lap)
  const finalLap = laps.reduce((latest, lap) => (lap.lapNumber > latest.lapNumber ? lap : latest))

  return finalLap.positionOnLap
}

/**
 * Get lap data for an event, optionally filtered by class
 *
 * @param eventId - Event ID
 * @param className - Optional class name to filter by
 * @returns Structured lap data grouped by driver and race
 */
export async function getLapData(
  eventId: string,
  className: string | null = null
): Promise<LapDataResponse | null> {
  try {
    // Build where clause for race filtering
    const raceWhere: Prisma.RaceWhereInput = {
      eventId,
    }

    if (className) {
      raceWhere.className = className
    }

    // Fetch all races with their results and laps
    const races = await prisma.race.findMany({
      where: raceWhere,
      include: {
        results: {
          include: {
            raceDriver: {
              include: {
                driver: {
                  select: {
                    id: true,
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
    })

    if (races.length === 0) {
      return {
        drivers: [],
        totalLaps: 0,
        totalDrivers: 0,
        totalRaces: 0,
      }
    }

    // Group laps by driver
    const driverMap = new Map<string, DriverLapData>()

    for (const race of races) {
      for (const result of race.results) {
        const driverId = result.raceDriver.driverId
        const driverName =
          result.raceDriver.displayName || result.raceDriver.driver.displayName || "Unknown Driver"

        // Initialize driver if not exists
        if (!driverMap.has(driverId)) {
          driverMap.set(driverId, {
            driverId,
            driverName,
            races: [],
            overallBestLap: null,
            totalLaps: 0,
          })
        }

        const driverData = driverMap.get(driverId)!

        // Convert laps to LapData format
        const lapData: LapData[] = result.laps.map((lap) => ({
          lapId: lap.id,
          lapNumber: lap.lapNumber,
          lapTimeSeconds: lap.lapTimeSeconds,
          lapTimeRaw: lap.lapTimeRaw,
          positionOnLap: lap.positionOnLap,
          elapsedRaceTime: lap.elapsedRaceTime,
          paceString: lap.paceString,
          segmentsJson: lap.segmentsJson,
          raceId: race.id,
          raceLabel: race.raceLabel,
          className: race.className,
          raceResultId: result.id,
        }))

        // Calculate best and average lap times for this race
        const bestLapTime = calculateBestLapTime(lapData)
        const avgLapTime = calculateAvgLapTime(lapData)

        // Calculate final position from the driver's final lap
        const positionFinal = calculatePositionFinal(lapData)

        // Add race data to driver
        driverData.races.push({
          raceId: race.id,
          raceLabel: race.raceLabel,
          className: race.className,
          laps: lapData,
          bestLapTime,
          avgLapTime,
          totalLaps: lapData.length,
          positionFinal,
        })

        // Update driver totals
        driverData.totalLaps += lapData.length

        // Update overall best lap
        if (bestLapTime !== null) {
          if (driverData.overallBestLap === null || bestLapTime < driverData.overallBestLap) {
            driverData.overallBestLap = bestLapTime
          }
        }
      }
    }

    // Convert map to array and sort by driver name
    const drivers = Array.from(driverMap.values()).sort((a, b) =>
      a.driverName.localeCompare(b.driverName)
    )

    // Calculate totals
    const totalLaps = drivers.reduce((sum, driver) => sum + driver.totalLaps, 0)
    const totalDrivers = drivers.length
    const totalRaces = new Set(races.map((r) => r.id)).size

    return {
      drivers,
      totalLaps,
      totalDrivers,
      totalRaces,
    }
  } catch (error) {
    console.error("[getLapData] Error fetching lap data:", {
      eventId,
      className,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : String(error),
    })
    throw error
  }
}

/** Single lap point for trend chart (global lap index + time) */
export interface LapTrendPoint {
  lapIndex: number
  raceId: string
  raceLabel: string
  className: string
  lapNumber: number
  lapTimeSeconds: number
  /** Session start time (ISO string) when available */
  raceStartTime?: string | null
}

/** Per-driver lap trend for the event (every lap in order) */
export interface DriverLapTrendSeries {
  driverId: string
  driverName: string
  laps: LapTrendPoint[]
}

export interface EventLapTrendResponse {
  drivers: DriverLapTrendSeries[]
}

/**
 * Get lap-by-lap trend data for selected drivers in an event.
 * Returns every single lap in race order with a global 1-based lap index for charting.
 *
 * @param eventId - Event ID
 * @param driverIds - Driver IDs to include (empty = no drivers)
 */
export async function getEventLapTrend(
  eventId: string,
  driverIds: string[]
): Promise<EventLapTrendResponse> {
  if (driverIds.length === 0) {
    return { drivers: [] }
  }

  const driverIdSet = new Set(driverIds)

  const races = await prisma.race.findMany({
    where: { eventId },
    include: {
      results: {
        where: {
          raceDriver: {
            driverId: { in: driverIds },
          },
        },
        include: {
          raceDriver: {
            include: {
              driver: {
                select: { id: true, displayName: true },
              },
            },
          },
          laps: {
            orderBy: { lapNumber: "asc" },
          },
        },
      },
    },
    orderBy: { raceOrder: "asc" },
  })

  const driverMap = new Map<string, { driverName: string; laps: LapTrendPoint[] }>()

  for (const race of races) {
    for (const result of race.results) {
      const driverId = result.raceDriver.driverId
      if (!driverIdSet.has(driverId)) continue

      const driverName =
        result.raceDriver.displayName ||
        result.raceDriver.driver?.displayName ||
        "Unknown Driver"

      if (!driverMap.has(driverId)) {
        driverMap.set(driverId, { driverName, laps: [] })
      }
      const entry = driverMap.get(driverId)!
      const startIndex = entry.laps.length
      const raceStartTime = race.startTime
        ? race.startTime.toISOString()
        : null
      result.laps.forEach((lap, i) => {
        entry.laps.push({
          lapIndex: startIndex + i + 1,
          raceId: race.id,
          raceLabel: race.raceLabel,
          className: race.className,
          lapNumber: lap.lapNumber,
          lapTimeSeconds: lap.lapTimeSeconds,
          raceStartTime,
        })
      })
    }
  }

  const drivers: DriverLapTrendSeries[] = Array.from(driverMap.entries()).map(
    ([driverId, { driverName, laps }]) => ({
      driverId,
      driverName,
      laps,
    })
  )

  return { drivers }
}
