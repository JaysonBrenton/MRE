/**
 * @fileoverview Per-class fastest lap: best single fast lap time per driver in the class for the
 *             event (min across sessions), then class leader is the driver with the lowest time.
 */

import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface FastestLapLeaderEntry {
  driverId: string
  driverName: string
  /** Best (minimum) fast lap time in seconds across sessions in this class. */
  bestFastLapSeconds: number
  /** Sessions in this class where a valid fast lap was recorded for this driver. */
  sessionsWithFastLap: number
}

export interface ClassFastestLapLeader {
  className: string
  leader: FastestLapLeaderEntry
}

type DriverAgg = {
  driverName: string
  bestFastLapSeconds: number
  sessionsWithFastLap: number
}

function fastLapValid(t: number | null | undefined): t is number {
  return typeof t === "number" && Number.isFinite(t) && t > 0
}

/**
 * Track each driver’s best fast lap and session count per class.
 */
export function aggregateBestFastLapByDriverPerClass(
  races: EventAnalysisData["races"]
): Map<string, Map<string, DriverAgg>> {
  const byClass = new Map<string, Map<string, DriverAgg>>()

  for (const race of races) {
    const cn = race.className?.trim()
    if (!cn) continue

    let driverMap = byClass.get(cn)
    if (!driverMap) {
      driverMap = new Map()
      byClass.set(cn, driverMap)
    }

    for (const result of race.results) {
      if (!fastLapValid(result.fastLapTime)) continue

      const t = result.fastLapTime
      const existing = driverMap.get(result.driverId)
      if (!existing) {
        driverMap.set(result.driverId, {
          driverName: result.driverName,
          bestFastLapSeconds: t,
          sessionsWithFastLap: 1,
        })
      } else {
        existing.bestFastLapSeconds = Math.min(existing.bestFastLapSeconds, t)
        existing.sessionsWithFastLap += 1
      }
    }
  }

  return byClass
}

function toLeaderEntry(driverId: string, d: DriverAgg): FastestLapLeaderEntry {
  return {
    driverId,
    driverName: d.driverName,
    bestFastLapSeconds: d.bestFastLapSeconds,
    sessionsWithFastLap: d.sessionsWithFastLap,
  }
}

/**
 * Lower lap time wins; ties (same best time): more sessions with a recorded fast lap, then name.
 */
export function compareFastestLapEntries(
  a: FastestLapLeaderEntry,
  b: FastestLapLeaderEntry
): number {
  if (a.bestFastLapSeconds !== b.bestFastLapSeconds) {
    return a.bestFastLapSeconds - b.bestFastLapSeconds
  }
  if (b.sessionsWithFastLap !== a.sessionsWithFastLap) {
    return b.sessionsWithFastLap - a.sessionsWithFastLap
  }
  const byName = a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" })
  if (byName !== 0) return byName
  return a.driverId.localeCompare(b.driverId)
}

/**
 * For each class with fast-lap data, the driver with the lowest best single lap time.
 */
export function computeFastestLapLeadersPerClass(
  races: EventAnalysisData["races"]
): ClassFastestLapLeader[] {
  const byClass = aggregateBestFastLapByDriverPerClass(races)
  const out: ClassFastestLapLeader[] = []

  for (const [className, driverMap] of byClass.entries()) {
    const entries = Array.from(driverMap.entries()).map(([driverId, d]) =>
      toLeaderEntry(driverId, d)
    )
    if (entries.length === 0) continue

    const sorted = [...entries].sort(compareFastestLapEntries)
    out.push({ className, leader: sorted[0]! })
  }

  out.sort((a, b) => a.className.localeCompare(b.className, undefined, { sensitivity: "base" }))
  return out
}

/**
 * All drivers in a class with fast-lap data, ranked fastest first.
 */
export function computeFastestLapRankedForClass(
  races: EventAnalysisData["races"],
  className: string
): FastestLapLeaderEntry[] {
  const byClass = aggregateBestFastLapByDriverPerClass(races)
  const driverMap = byClass.get(className)
  if (!driverMap) return []

  const rows = Array.from(driverMap.entries()).map(([driverId, d]) => toLeaderEntry(driverId, d))
  return [...rows].sort(compareFastestLapEntries)
}
