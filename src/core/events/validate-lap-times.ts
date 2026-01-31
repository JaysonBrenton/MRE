/**
 * @fileoverview Lap time validation utility - validates lap times against class averages
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Validates lap times by comparing them against the average lap time
 *              for each race class. Lap times that are more than 80% faster than
 *              the class average (i.e., less than 20% of the average) are considered invalid.
 *
 * @purpose Provides validation logic to exclude impossibly fast lap times from calculations
 *          and display, preventing data quality issues from affecting race analysis.
 */

/**
 * Interface for race result data needed for validation
 */
export interface RaceResultForValidation {
  fastLapTime: number | null
  className: string
}

/**
 * Calculate class thresholds based on average lap times per class
 *
 * Threshold is set to 20% of the average (meaning lap times 80% faster than average are invalid).
 *
 * @param results - Array of race results with fastLapTime and className
 * @returns Map of className -> threshold (minimum valid lap time in seconds)
 */
export function calculateClassThresholds(results: RaceResultForValidation[]): Map<string, number> {
  const thresholds = new Map<string, number>()

  // Group results by className
  const classGroups = new Map<string, number[]>()

  for (const result of results) {
    // Only include valid, non-null lap times
    if (result.fastLapTime === null || result.fastLapTime <= 0) {
      continue
    }

    if (!Number.isFinite(result.fastLapTime)) {
      continue
    }

    const className = result.className || ""
    if (!classGroups.has(className)) {
      classGroups.set(className, [])
    }
    classGroups.get(className)!.push(result.fastLapTime)
  }

  // Calculate average per class and set threshold
  for (const [className, lapTimes] of classGroups.entries()) {
    if (lapTimes.length === 0) {
      continue
    }

    // Calculate average
    const sum = lapTimes.reduce((a, b) => a + b, 0)
    const average = sum / lapTimes.length

    // Threshold is 20% of average (80% faster = invalid)
    // But ensure minimum threshold of 5 seconds to handle edge cases
    const threshold = Math.max(average * 0.2, 5)

    thresholds.set(className, threshold)
  }

  return thresholds
}

/**
 * Check if a lap time is valid for a given class
 *
 * @param lapTime - Lap time in seconds (can be null)
 * @param className - Race class name
 * @param thresholds - Map of className -> threshold from calculateClassThresholds
 * @returns true if lap time is valid, false otherwise
 */
export function isValidLapTime(
  lapTime: number | null,
  className: string,
  thresholds: Map<string, number>
): boolean {
  // Null or invalid lap times are not valid
  if (lapTime === null || !Number.isFinite(lapTime) || lapTime <= 0) {
    return false
  }

  // If no threshold exists for this class, consider it valid
  // (edge case: class with no valid lap times to calculate threshold)
  const threshold = thresholds.get(className)
  if (threshold === undefined) {
    return true
  }

  // Lap time must be >= threshold to be valid
  return lapTime >= threshold
}

/**
 * Filter race results to exclude invalid lap times
 *
 * @param results - Array of race results
 * @param thresholds - Map of className -> threshold
 * @returns Array of results with invalid fastLapTime set to null
 */
export function filterInvalidLapTimes<T extends RaceResultForValidation>(
  results: T[],
  thresholds: Map<string, number>
): T[] {
  return results.map((result) => {
    const isValid = isValidLapTime(result.fastLapTime, result.className, thresholds)

    if (!isValid) {
      return {
        ...result,
        fastLapTime: null,
      }
    }

    return result
  })
}
