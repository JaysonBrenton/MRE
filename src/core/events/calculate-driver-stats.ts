/**
 * @fileoverview Calculate driver statistics - driver performance metrics
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Calculates driver performance metrics from race results
 *
 * @purpose Provides driver statistics for analysis and comparison.
 *          Pure business logic, no database access.
 *
 * @relatedFiles
 * - src/core/events/get-event-analysis-data.ts (uses this)
 */

export interface DriverStats {
  raceDriverId: string
  driverName: string
  racesParticipated: number
  bestLapTime: number | null
  avgLapTime: number | null
  consistency: number | null
  totalLaps: number
  positions: number[]
  avgPosition: number | null
}

export interface RaceResultData {
  raceDriverId: string
  driverName: string
  positionFinal: number
  lapsCompleted: number
  fastLapTime: number | null
  avgLapTime: number | null
  consistency: number | null
  laps: Array<{
    lapNumber: number
    lapTimeSeconds: number
    elapsedRaceTime: number
  }>
}

/**
 * Calculate driver statistics from race results
 *
 * @param raceResults - Array of race results for a driver
 * @returns Calculated driver statistics
 */
export function calculateDriverStats(raceResults: RaceResultData[]): DriverStats {
  if (raceResults.length === 0) {
    throw new Error("Cannot calculate stats for empty race results")
  }

  const driverName = raceResults[0].driverName
  const raceDriverId = raceResults[0].raceDriverId

  // Aggregate data
  let bestLapTime: number | null = null
  const avgLapTimes: number[] = []
  const consistencies: number[] = []
  const positions: number[] = []
  let totalLaps = 0

  for (const result of raceResults) {
    // Best lap time
    if (result.fastLapTime !== null) {
      if (bestLapTime === null || result.fastLapTime < bestLapTime) {
        bestLapTime = result.fastLapTime
      }
    }

    // Average lap times
    if (result.avgLapTime !== null) {
      avgLapTimes.push(result.avgLapTime)
    }

    // Consistency scores
    if (result.consistency !== null) {
      consistencies.push(result.consistency)
    }

    // Positions
    positions.push(result.positionFinal)

    // Total laps
    totalLaps += result.lapsCompleted
  }

  // Calculate averages
  const avgLapTime =
    avgLapTimes.length > 0 ? avgLapTimes.reduce((a, b) => a + b, 0) / avgLapTimes.length : null

  const consistency =
    consistencies.length > 0
      ? consistencies.reduce((a, b) => a + b, 0) / consistencies.length
      : null

  const avgPosition =
    positions.length > 0 ? positions.reduce((a, b) => a + b, 0) / positions.length : null

  return {
    raceDriverId,
    driverName,
    racesParticipated: raceResults.length,
    bestLapTime,
    avgLapTime,
    consistency,
    totalLaps,
    positions,
    avgPosition,
  }
}
