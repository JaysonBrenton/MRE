/**
 * @fileoverview Helpers for deriving driver availability notices in Event Analysis
 *
 * @created 2025-12-27
 * @creator Codex (AI Assistant)
 * @lastModified 2025-12-27
 *
 * @description Utility helpers that determine which selected drivers are missing
 *              the timing metrics required by Event Analysis charts.
 *
 * @purpose Keeps notice logic pure/testable so UI components can focus on
 *          rendering. Each helper returns driver IDs so callers can map names
 *          however they prefer.
 */

import type { GapEvolutionSeries } from "./calculate-gap-evolution"

export interface DriverMetricSnapshot {
  driverId: string
  bestLapTime: number | null
  avgLapTime: number | null
}

/**
 * Deduplicate driver IDs while preserving their original order.
 */
function dedupe(driverIds: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of driverIds) {
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    result.push(id)
  }
  return result
}

function isValidLapTime(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0
}

function getRelevantDriverIds(selectedDriverIds: Iterable<string>): string[] {
  const result: string[] = []
  for (const driverId of selectedDriverIds) {
    result.push(driverId)
  }
  return result
}

/**
 * Identify selected drivers that lack a usable fastest lap.
 */
export function getDriversMissingBestLap(
  selectedDriverIds: Iterable<string>,
  stats: DriverMetricSnapshot[]
): string[] {
  const relevantIds = getRelevantDriverIds(selectedDriverIds)
  if (relevantIds.length === 0) {
    return []
  }

  const statsMap = new Map(stats.map((entry) => [entry.driverId, entry]))
  const missing: string[] = []

  for (const driverId of relevantIds) {
    const entry = statsMap.get(driverId)
    if (!entry || !isValidLapTime(entry.bestLapTime)) {
      missing.push(driverId)
    }
  }

  return dedupe(missing)
}

/**
 * Identify selected drivers that cannot be plotted on Avg vs Fastest chart.
 */
export function getDriversMissingAvgVsFastest(
  selectedDriverIds: Iterable<string>,
  stats: DriverMetricSnapshot[]
): string[] {
  const relevantIds = getRelevantDriverIds(selectedDriverIds)
  if (relevantIds.length === 0) {
    return []
  }

  const statsMap = new Map(stats.map((entry) => [entry.driverId, entry]))
  const missing: string[] = []

  for (const driverId of relevantIds) {
    const entry = statsMap.get(driverId)
    const hasFastest = entry && isValidLapTime(entry.bestLapTime)
    const hasAverage = entry && isValidLapTime(entry.avgLapTime)
    if (!entry || !hasFastest || !hasAverage) {
      missing.push(driverId)
    }
  }

  return dedupe(missing)
}

/**
 * Identify selected drivers that have no lap telemetry for gap evolution.
 */
export function getDriversMissingGapSeries(
  selectedDriverIds: Iterable<string>,
  series: GapEvolutionSeries[]
): string[] {
  const relevantIds = getRelevantDriverIds(selectedDriverIds)
  if (relevantIds.length === 0) {
    return []
  }

  const seriesMap = new Map(series.map((entry) => [entry.driverId, entry]))
  const missing: string[] = []

  for (const driverId of relevantIds) {
    const entry = seriesMap.get(driverId)
    if (!entry || entry.gaps.length === 0) {
      missing.push(driverId)
    }
  }

  return dedupe(missing)
}

