/**
 * @fileoverview Per-class “lap heroes”: most laps completed event-wide, with combined session
 *             finish time as the tie-break (shortest sum wins among drivers at the max lap count).
 */

import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface MostLapsLeaderEntry {
  driverId: string
  driverName: string
  totalLaps: number
  /** Sum of per-session `totalTimeSeconds` when present (event-wide, this class). */
  totalRaceTimeSeconds: number
  /** Whether any session contributed a usable finish time (otherwise tie-break falls back to name). */
  hasRaceTimeData: boolean
}

export interface ClassMostLapsLeader {
  className: string
  /** Best score: max laps, then min combined time when lap counts tie. */
  leader: MostLapsLeaderEntry
}

function safeLapsCompleted(raw: number | null | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
    return 0
  }
  return raw
}

function safeSessionRaceTime(raw: number | null | undefined): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return null
  }
  return raw
}

type DriverAgg = {
  driverName: string
  totalLaps: number
  totalRaceTimeSeconds: number
  hasRaceTimeData: boolean
}

/**
 * Compare for “lap hero” ranking: more laps first, then shorter combined race time,
 * then name, then id. Drivers with no time data lose time-based ties vs drivers who have times.
 */
export function compareLapHeroEntries(a: MostLapsLeaderEntry, b: MostLapsLeaderEntry): number {
  if (b.totalLaps !== a.totalLaps) return b.totalLaps - a.totalLaps
  const ta = a.hasRaceTimeData ? a.totalRaceTimeSeconds : Number.POSITIVE_INFINITY
  const tb = b.hasRaceTimeData ? b.totalRaceTimeSeconds : Number.POSITIVE_INFINITY
  if (ta !== tb) return ta - tb
  const byName = a.driverName.localeCompare(b.driverName)
  if (byName !== 0) return byName
  return a.driverId.localeCompare(b.driverId)
}

/**
 * Sum laps and session finish times per driver within each class across every race.
 */
export function aggregateLapsAndRaceTimeByDriverPerClass(
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
      const laps = safeLapsCompleted(result.lapsCompleted)
      const sessionTime = safeSessionRaceTime(result.totalTimeSeconds)

      const existing = driverMap.get(result.driverId)
      if (!existing) {
        driverMap.set(result.driverId, {
          driverName: result.driverName,
          totalLaps: laps,
          totalRaceTimeSeconds: sessionTime ?? 0,
          hasRaceTimeData: sessionTime !== null,
        })
      } else {
        existing.totalLaps += laps
        if (sessionTime !== null) {
          existing.totalRaceTimeSeconds += sessionTime
          existing.hasRaceTimeData = true
        }
      }
    }
  }

  return byClass
}

function toLeaderEntry(driverId: string, d: DriverAgg): MostLapsLeaderEntry {
  return {
    driverId,
    driverName: d.driverName,
    totalLaps: d.totalLaps,
    totalRaceTimeSeconds: d.totalRaceTimeSeconds,
    hasRaceTimeData: d.hasRaceTimeData,
  }
}

/**
 * For each class, the top driver: highest lap total; ties broken by shortest sum of session times.
 */
export function computeMostLapsLeadersPerClass(
  races: EventAnalysisData["races"]
): ClassMostLapsLeader[] {
  const byClass = aggregateLapsAndRaceTimeByDriverPerClass(races)
  const out: ClassMostLapsLeader[] = []

  for (const [className, driverMap] of byClass.entries()) {
    const entries = Array.from(driverMap.entries()).map(([driverId, d]) =>
      toLeaderEntry(driverId, d)
    )
    if (entries.length === 0) continue

    const maxLaps = Math.max(...entries.map((e) => e.totalLaps))
    if (maxLaps <= 0) continue

    const sorted = [...entries].sort(compareLapHeroEntries)
    const leader = sorted[0]!
    out.push({ className, leader })
  }

  out.sort((a, b) => a.className.localeCompare(b.className))
  return out
}

/**
 * All drivers in a class, ranked by laps then combined time (same rule as card leader).
 */
export function computeLapTotalsRankedForClass(
  races: EventAnalysisData["races"],
  className: string
): MostLapsLeaderEntry[] {
  const byClass = aggregateLapsAndRaceTimeByDriverPerClass(races)
  const driverMap = byClass.get(className)
  if (!driverMap) return []

  const rows = Array.from(driverMap.entries()).map(([driverId, d]) => toLeaderEntry(driverId, d))

  return [...rows].sort(compareLapHeroEntries)
}
