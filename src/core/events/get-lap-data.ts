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

      // Add race data to driver
      driverData.races.push({
        raceId: race.id,
        raceLabel: race.raceLabel,
        className: race.className,
        laps: lapData,
        bestLapTime,
        avgLapTime,
        totalLaps: lapData.length,
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
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    })
    throw error
  }
}
