/**
 * @fileoverview Per-class “most consistent drivers”: highest mean session consistency score
 *             within each class across the event (same averaging rule as event-wide driver stats).
 */

import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface MostConsistentLeaderEntry {
  driverId: string
  driverName: string
  /** Mean of per-session consistency scores in this class (higher is better). */
  avgConsistency: number
  sessionsWithConsistency: number
}

export interface ClassMostConsistentLeader {
  className: string
  leader: MostConsistentLeaderEntry
}

type DriverAgg = {
  driverName: string
  sumConsistency: number
  count: number
}

function safeConsistency(raw: number | null | undefined): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return null
  }
  return raw
}

/**
 * Sum per-session consistency per driver within each class across every race.
 */
export function aggregateConsistencyByDriverPerClass(
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
      const c = safeConsistency(result.consistency)
      if (c === null) continue

      const existing = driverMap.get(result.driverId)
      if (!existing) {
        driverMap.set(result.driverId, {
          driverName: result.driverName,
          sumConsistency: c,
          count: 1,
        })
      } else {
        existing.sumConsistency += c
        existing.count += 1
      }
    }
  }

  return byClass
}

function toLeaderEntry(driverId: string, d: DriverAgg): MostConsistentLeaderEntry {
  return {
    driverId,
    driverName: d.driverName,
    avgConsistency: d.sumConsistency / d.count,
    sessionsWithConsistency: d.count,
  }
}

/**
 * Higher average consistency wins; ties broken by more sessions with data, then name, then id.
 */
export function compareMostConsistentEntries(
  a: MostConsistentLeaderEntry,
  b: MostConsistentLeaderEntry
): number {
  if (b.avgConsistency !== a.avgConsistency) return b.avgConsistency - a.avgConsistency
  if (b.sessionsWithConsistency !== a.sessionsWithConsistency) {
    return b.sessionsWithConsistency - a.sessionsWithConsistency
  }
  const byName = a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" })
  if (byName !== 0) return byName
  return a.driverId.localeCompare(b.driverId)
}

/**
 * For each class with consistency data, the driver with the highest mean session score.
 */
export function computeMostConsistentLeadersPerClass(
  races: EventAnalysisData["races"]
): ClassMostConsistentLeader[] {
  const byClass = aggregateConsistencyByDriverPerClass(races)
  const out: ClassMostConsistentLeader[] = []

  for (const [className, driverMap] of byClass.entries()) {
    const entries = Array.from(driverMap.entries()).map(([driverId, d]) =>
      toLeaderEntry(driverId, d)
    )
    if (entries.length === 0) continue

    const sorted = [...entries].sort(compareMostConsistentEntries)
    out.push({ className, leader: sorted[0]! })
  }

  out.sort((a, b) => a.className.localeCompare(b.className, undefined, { sensitivity: "base" }))
  return out
}

/**
 * All drivers in a class with consistency data, ranked (same rule as card leader).
 */
export function computeConsistencyRankedForClass(
  races: EventAnalysisData["races"],
  className: string
): MostConsistentLeaderEntry[] {
  const byClass = aggregateConsistencyByDriverPerClass(races)
  const driverMap = byClass.get(className)
  if (!driverMap) return []

  const rows = Array.from(driverMap.entries()).map(([driverId, d]) => toLeaderEntry(driverId, d))
  return [...rows].sort(compareMostConsistentEntries)
}
