/**
 * @fileoverview Calculate most improved drivers - determines drivers with greatest improvement
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Calculates driver improvement metrics by comparing first race vs last race performance
 *
 * @purpose Provides improvement calculation logic for identifying drivers who showed the most
 *          improvement over the course of an event. Uses position and lap time improvements
 *          to create a combined improvement score.
 *
 * @relatedFiles
 * - src/core/events/get-event-analysis-data.ts (uses this)
 * - src/core/events/validate-lap-times.ts (lap time validation)
 */

import { prisma } from "@/lib/prisma"
import {
  calculateClassThresholds,
  isValidLapTime,
  type RaceResultForValidation,
} from "./validate-lap-times"

function sanitizeLapTime(value: number | null | undefined): number | null {
  if (typeof value !== "number") {
    return null
  }
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

export interface MostImprovedDriver {
  driverId: string
  driverName: string
  className: string
  firstRacePosition: number
  lastRacePosition: number
  positionImprovement: number // positive = improved
  firstRaceFastLap: number | null
  lastRaceFastLap: number | null
  lapTimeImprovement: number | null // positive = improved (seconds)
  improvementScore: number // 0-100, higher = more improved
  firstRaceId: string
  lastRaceId: string
  raceLabel: string // from last race
}

/**
 * Normalize position improvement to 0-100 scale
 *
 * Position improvement is measured as: firstPosition - lastPosition
 * Positive values mean improvement (moved up in position).
 *
 * Normalization: We assume max improvement is moving from last to first position.
 * For a race with N drivers, max improvement = N - 1.
 * Score = (improvement / maxPossibleImprovement) * 100
 *
 * @param positionImprovement - Position improvement (positive = improved)
 * @param maxPosition - Maximum position in the race (number of drivers)
 * @returns Normalized score 0-100
 */
function normalizePositionImprovement(positionImprovement: number, maxPosition: number): number {
  if (positionImprovement <= 0) {
    return 0
  }
  const maxPossibleImprovement = maxPosition - 1
  if (maxPossibleImprovement <= 0) {
    return 0
  }
  const normalized = (positionImprovement / maxPossibleImprovement) * 100
  return Math.min(100, Math.max(0, normalized))
}

/**
 * Normalize lap time improvement to 0-100 scale
 *
 * Lap time improvement is measured as: firstFastLap - lastFastLap (in seconds)
 * Positive values mean improvement (faster lap time).
 *
 * Normalization: We use a percentage-based approach.
 * Improvement percentage = (improvement / firstFastLap) * 100
 * Then scale to 0-100 range, capping at reasonable maximum (e.g., 20% improvement = 100 score)
 *
 * @param lapTimeImprovement - Lap time improvement in seconds (positive = improved)
 * @param firstFastLap - First race fast lap time in seconds
 * @returns Normalized score 0-100
 */
function normalizeLapTimeImprovement(lapTimeImprovement: number, firstFastLap: number): number {
  if (lapTimeImprovement <= 0 || firstFastLap <= 0) {
    return 0
  }
  // Calculate improvement as percentage
  const improvementPercent = (lapTimeImprovement / firstFastLap) * 100
  // Scale: 20% improvement = 100 score, linear scaling
  const normalized = Math.min(100, (improvementPercent / 20) * 100)
  return Math.max(0, normalized)
}

/**
 * Calculate most improved drivers for an event
 *
 * Compares first race vs last race (by raceOrder) for each driver:
 * - Position improvement: firstPosition - lastPosition
 * - Lap time improvement: firstFastLap - lastFastLap
 *
 * Creates a combined improvement score (50% position, 50% lap time).
 * Returns top 3 drivers per class.
 *
 * @param eventId - Event ID
 * @returns Array of most improved drivers, grouped by class, top 3 per class
 */
export async function calculateMostImprovedDrivers(eventId: string): Promise<MostImprovedDriver[]> {
  // Get all race results for the event, ordered by raceOrder then startTime
  // startTime is needed as fallback since some events have all races with raceOrder=1
  const raceResults = await prisma.raceResult.findMany({
    where: {
      race: {
        eventId,
      },
    },
    include: {
      race: {
        select: {
          id: true,
          raceOrder: true,
          raceLabel: true,
          className: true,
          startTime: true,
        },
      },
      raceDriver: {
        select: {
          driverId: true,
          displayName: true,
        },
      },
    },
    orderBy: [
      { race: { raceOrder: "asc" } },
      { race: { startTime: "asc" } },
    ],
  })

  if (raceResults.length === 0) {
    return []
  }

  // Calculate class thresholds for validation
  const resultsForValidation: RaceResultForValidation[] = raceResults.map((result) => ({
    fastLapTime: result.fastLapTime,
    className: result.race.className,
  }))
  const classThresholds = calculateClassThresholds(resultsForValidation)

  // Group results by driver and class
  // Map: driverId -> className -> race results (ordered by raceOrder)
  const driverResultsByClass = new Map<string, Map<string, Array<(typeof raceResults)[0]>>>()

  for (const result of raceResults) {
    const driverId = result.raceDriver.driverId
    const className = result.race.className

    if (!driverResultsByClass.has(driverId)) {
      driverResultsByClass.set(driverId, new Map())
    }

    const classMap = driverResultsByClass.get(driverId)!
    if (!classMap.has(className)) {
      classMap.set(className, [])
    }

    classMap.get(className)!.push(result)
  }

  // Calculate improvement for each driver-class combination
  const improvements: MostImprovedDriver[] = []

  for (const [driverId, classMap] of driverResultsByClass.entries()) {
    for (const [className, results] of classMap.entries()) {
      // Need at least 2 races to calculate improvement
      if (results.length < 2) {
        continue
      }

      // Sort by raceOrder, then by startTime as fallback (some events have all raceOrder=1)
      const sortedResults = [...results].sort((a, b) => {
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

      const firstResult = sortedResults[0]
      const lastResult = sortedResults[sortedResults.length - 1]

      // Get position improvement
      const firstPosition = firstResult.positionFinal
      const lastPosition = lastResult.positionFinal
      const positionImprovement = firstPosition - lastPosition // positive = improved

      // Get lap time improvement
      const firstFastLap = sanitizeLapTime(firstResult.fastLapTime)
      const lastFastLap = sanitizeLapTime(lastResult.fastLapTime)

      // Validate lap times against class thresholds
      let validFirstFastLap: number | null = null
      let validLastFastLap: number | null = null

      if (firstFastLap !== null) {
        if (isValidLapTime(firstFastLap, className, classThresholds)) {
          validFirstFastLap = firstFastLap
        }
      }

      if (lastFastLap !== null) {
        if (isValidLapTime(lastFastLap, className, classThresholds)) {
          validLastFastLap = lastFastLap
        }
      }

      // Calculate lap time improvement (only if both are valid)
      let lapTimeImprovement: number | null = null
      if (validFirstFastLap !== null && validLastFastLap !== null) {
        lapTimeImprovement = validFirstFastLap - validLastFastLap // positive = improved
      }

      // Calculate improvement scores
      // Find max position in this class for normalization
      const maxPosition = Math.max(...sortedResults.map((r) => r.positionFinal))

      const positionScore = normalizePositionImprovement(positionImprovement, maxPosition)

      let lapTimeScore = 0
      if (lapTimeImprovement !== null && validFirstFastLap !== null) {
        lapTimeScore = normalizeLapTimeImprovement(lapTimeImprovement, validFirstFastLap)
      }

      // Combined score: 50% position, 50% lap time
      // If lap time data is missing, use 100% position score
      const improvementScore =
        lapTimeScore > 0 ? positionScore * 0.5 + lapTimeScore * 0.5 : positionScore

      // Only include drivers with positive improvement
      if (positionImprovement > 0 || (lapTimeImprovement !== null && lapTimeImprovement > 0)) {
        improvements.push({
          driverId,
          driverName: firstResult.raceDriver.displayName,
          className,
          firstRacePosition: firstPosition,
          lastRacePosition: lastPosition,
          positionImprovement,
          firstRaceFastLap: validFirstFastLap,
          lastRaceFastLap: validLastFastLap,
          lapTimeImprovement,
          improvementScore,
          firstRaceId: firstResult.race.id,
          lastRaceId: lastResult.race.id,
          raceLabel: lastResult.race.raceLabel,
        })
      }
    }
  }

  // Group by class and get top 3 per class
  const improvementsByClass = new Map<string, MostImprovedDriver[]>()

  for (const improvement of improvements) {
    if (!improvementsByClass.has(improvement.className)) {
      improvementsByClass.set(improvement.className, [])
    }
    improvementsByClass.get(improvement.className)!.push(improvement)
  }

  // Sort within each class by improvement score (descending) and take top 4
  const topImprovements: MostImprovedDriver[] = []

  for (const [className, classImprovements] of improvementsByClass.entries()) {
    const sorted = classImprovements.sort((a, b) => b.improvementScore - a.improvementScore)
    topImprovements.push(...sorted.slice(0, 4))
  }

  // Sort all by improvement score for consistent ordering
  return topImprovements.sort((a, b) => b.improvementScore - a.improvementScore)
}
