/**
 * @fileoverview Calculate gap evolution - time gaps between drivers over race duration
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Calculates time gaps between drivers over race duration
 * 
 * @purpose Provides gap evolution data for line charts showing driver performance over time.
 *          Pure business logic, no database access.
 * 
 * @relatedFiles
 * - src/core/events/get-event-analysis-data.ts (uses this)
 */

export interface LapData {
  lapNumber: number
  lapTimeSeconds: number
  elapsedRaceTime: number
  positionOnLap: number
}

export interface DriverLapSeries {
  driverId: string
  driverName: string
  laps: LapData[]
}

export interface GapDataPoint {
  lapNumber: number
  elapsedRaceTime: number
  gapToLeader: number
}

export interface GapEvolutionSeries {
  driverId: string
  driverName: string
  gaps: GapDataPoint[]
}

/**
 * Calculate gap evolution for drivers relative to race leader
 * 
 * Algorithm:
 * 1. For each lap number, find all drivers who completed that lap
 * 2. Determine the leader at that lap (driver with minimum elapsed time)
 * 3. Calculate each driver's gap to the leader at that lap
 * 4. Gaps are calculated as: driverElapsedTime - leaderElapsedTime
 * 5. Gaps are clamped to 0 (cannot be negative)
 * 
 * Note: This handles drivers with different lap counts correctly. If a driver
 * hasn't completed a lap, they are skipped for that lap. The leader at each
 * lap is determined from all drivers who actually completed that lap.
 * 
 * @param driverSeries - Array of driver lap series data
 * @returns Gap evolution series for each driver
 */
export function calculateGapEvolution(
  driverSeries: DriverLapSeries[]
): GapEvolutionSeries[] {
  if (driverSeries.length === 0) {
    return []
  }

  // Collect all laps from all drivers for leader determination
  const allLaps = driverSeries.flatMap((driver) =>
    driver.laps.map((lap) => ({
      driverId: driver.driverId,
      driverName: driver.driverName,
      lapNumber: lap.lapNumber,
      elapsedRaceTime: lap.elapsedRaceTime,
    }))
  )

  // Find maximum lap number across all drivers
  const maxLap = Math.max(
    ...driverSeries.map((driver) =>
      driver.laps.length > 0
        ? Math.max(...driver.laps.map((lap) => lap.lapNumber))
        : 0
    )
  )

  // Calculate gaps for each driver
  return driverSeries.map((driver) => {
    const gaps: GapDataPoint[] = []

    for (let lapNum = 1; lapNum <= maxLap; lapNum++) {
      // Find this driver's lap (skip if driver didn't complete this lap)
      const driverLap = driver.laps.find((lap) => lap.lapNumber === lapNum)
      if (!driverLap) {
        continue
      }

      // Find all drivers who completed this lap number
      const leaderLaps = allLaps.filter((lap) => lap.lapNumber === lapNum)
      if (leaderLaps.length === 0) {
        // No drivers completed this lap (shouldn't happen, but handle gracefully)
        continue
      }

      // Leader is the driver with minimum elapsed time at this lap number
      const leaderElapsedTime = Math.min(
        ...leaderLaps.map((lap) => lap.elapsedRaceTime)
      )

      // Calculate gap: positive means behind leader, 0 means leading
      const gapToLeader = driverLap.elapsedRaceTime - leaderElapsedTime

      gaps.push({
        lapNumber: lapNum,
        elapsedRaceTime: driverLap.elapsedRaceTime,
        gapToLeader: Math.max(0, gapToLeader), // Gap cannot be negative (safety check)
      })
    }

    return {
      driverId: driver.driverId,
      driverName: driver.driverName,
      gaps,
    }
  })
}

/**
 * Calculate gap evolution for top N drivers
 * 
 * @param driverSeries - Array of driver lap series data
 * @param topN - Number of top drivers to include (default: 3)
 * @returns Gap evolution series for top N drivers
 */
export function calculateTopNGapEvolution(
  driverSeries: DriverLapSeries[],
  topN: number = 3
): GapEvolutionSeries[] {
  if (driverSeries.length === 0) {
    return []
  }

  // Sort drivers by their best lap time (fastest first)
  const sortedDrivers = [...driverSeries].sort((a, b) => {
    const aBestLap = Math.min(
      ...a.laps.map((lap) => lap.lapTimeSeconds),
      Infinity
    )
    const bBestLap = Math.min(
      ...b.laps.map((lap) => lap.lapTimeSeconds),
      Infinity
    )
    return aBestLap - bBestLap
  })

  // Take top N
  const topDrivers = sortedDrivers.slice(0, topN)

  return calculateGapEvolution(topDrivers)
}

