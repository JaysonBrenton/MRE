/**
 * @fileoverview Most improved drivers per class for the event (first vs last race in class)
 *
 * Shared by overview cards/tables. Top 3 per class by composite improvement score
 * (position + lap time unless practice day = lap only).
 */

import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface EventMostImprovedEntry {
  driverId: string
  driverName: string
  firstRacePosition: number
  lastRacePosition: number
  positionImprovement: number
  firstRaceFastLap: number | null
  lastRaceFastLap: number | null
  lapTimeImprovement: number | null
  improvementScore: number
  firstRaceLabel: string
  lastRaceLabel: string
  rank: number
}

export interface ClassMostImprovedGroup {
  className: string
  entries: EventMostImprovedEntry[]
}

function sanitizeLapTime(value: number | null | undefined): number | null {
  if (typeof value !== "number") return null
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

function normalizePositionImprovement(positionImprovement: number, maxPosition: number): number {
  if (positionImprovement <= 0) return 0
  const maxPossible = maxPosition - 1
  if (maxPossible <= 0) return 0
  return Math.min(100, Math.max(0, (positionImprovement / maxPossible) * 100))
}

function normalizeLapTimeImprovement(lapTimeImprovement: number, firstFastLap: number): number {
  if (lapTimeImprovement <= 0 || firstFastLap <= 0) return 0
  const improvementPercent = (lapTimeImprovement / firstFastLap) * 100
  return Math.min(100, Math.max(0, (improvementPercent / 20) * 100))
}

export function computeMostImprovedPerClass(
  races: EventAnalysisData["races"],
  isPracticeDay?: boolean
): ClassMostImprovedGroup[] {
  const sortedRaces = [...races].sort((a, b) => {
    const orderA = a.raceOrder ?? 0
    const orderB = b.raceOrder ?? 0
    if (orderA !== orderB) return orderA - orderB
    const timeA = a.startTime?.getTime?.() ?? 0
    const timeB = b.startTime?.getTime?.() ?? 0
    return timeA - timeB
  })

  const byClassAndDriver = new Map<
    string,
    Map<
      string,
      Array<{
        raceLabel: string
        raceOrder: number
        startTime: number
        positionFinal: number
        fastLapTime: number | null
        driverName: string
      }>
    >
  >()

  for (const race of sortedRaces) {
    const raceOrder = race.raceOrder ?? 0
    const startTime = race.startTime?.getTime?.() ?? 0
    for (const result of race.results) {
      let classMap = byClassAndDriver.get(result.driverId)
      if (!classMap) {
        classMap = new Map()
        byClassAndDriver.set(result.driverId, classMap)
      }
      let list = classMap.get(race.className)
      if (!list) {
        list = []
        classMap.set(race.className, list)
      }
      const fastLap = sanitizeLapTime(result.fastLapTime)
      list.push({
        raceLabel: race.raceLabel,
        raceOrder,
        startTime,
        positionFinal: result.positionFinal,
        fastLapTime: fastLap,
        driverName: result.driverName,
      })
    }
  }

  const improvementsByClass = new Map<string, EventMostImprovedEntry[]>()

  for (const [driverId, classMap] of byClassAndDriver.entries()) {
    for (const [className, results] of classMap.entries()) {
      if (results.length < 2) continue

      const sorted = [...results].sort((a, b) => {
        if (a.raceOrder !== b.raceOrder) return a.raceOrder - b.raceOrder
        return a.startTime - b.startTime
      })

      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const positionImprovement = first.positionFinal - last.positionFinal

      let lapTimeImprovement: number | null = null
      const validFirst = first.fastLapTime
      const validLast = last.fastLapTime
      if (validFirst != null && validLast != null) {
        lapTimeImprovement = validFirst - validLast
      }

      const hasImprovement =
        positionImprovement > 0 || (lapTimeImprovement != null && lapTimeImprovement > 0)
      if (!hasImprovement) continue

      const maxPosition = Math.max(...sorted.map((r) => r.positionFinal))
      const positionScore = normalizePositionImprovement(positionImprovement, maxPosition)
      let lapTimeScore = 0
      if (lapTimeImprovement != null && validFirst != null) {
        lapTimeScore = normalizeLapTimeImprovement(lapTimeImprovement, validFirst)
      }

      const improvementScore = isPracticeDay
        ? lapTimeScore
        : lapTimeScore > 0
          ? positionScore * 0.5 + lapTimeScore * 0.5
          : positionScore

      const entry: EventMostImprovedEntry = {
        driverId,
        driverName: sorted[0]?.driverName ?? "Unknown",
        firstRacePosition: first.positionFinal,
        lastRacePosition: last.positionFinal,
        positionImprovement,
        firstRaceFastLap: validFirst,
        lastRaceFastLap: validLast,
        lapTimeImprovement,
        improvementScore,
        firstRaceLabel: first.raceLabel,
        lastRaceLabel: last.raceLabel,
        rank: 0,
      }

      if (!improvementsByClass.has(className)) {
        improvementsByClass.set(className, [])
      }
      improvementsByClass.get(className)!.push(entry)
    }
  }

  const result: ClassMostImprovedGroup[] = []

  for (const [className, entries] of improvementsByClass.entries()) {
    const sorted = [...entries].sort((a, b) => b.improvementScore - a.improvementScore)
    const top3 = sorted.slice(0, 3).map((e, i) => ({ ...e, rank: i + 1 }))
    result.push({ className, entries: top3 })
  }

  result.sort((a, b) => a.className.localeCompare(b.className))
  return result
}
