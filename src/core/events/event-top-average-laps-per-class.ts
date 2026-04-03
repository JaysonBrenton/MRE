/**
 * @fileoverview Event-wide top distinct average laps per class (shared by cards and tables)
 *
 * Per class: each driver's event-wide average (total time / total laps), then top 3 distinct
 * averages with ties included at each rank.
 */

import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface EventTopAverageLapEntry {
  driverId: string
  driverName: string
  avgLapSeconds: number
  raceCount: number
  totalLaps: number
  rank: number
}

export interface ClassTopAverageLapsGroup {
  className: string
  entries: EventTopAverageLapEntry[]
}

export function computeTopAverageLapsPerClass(
  races: EventAnalysisData["races"]
): ClassTopAverageLapsGroup[] {
  const byClass = new Map<
    string,
    Map<string, { driverName: string; totalTimeSeconds: number; totalLaps: number }>
  >()

  for (const race of races) {
    for (const result of race.results) {
      if (
        result.totalTimeSeconds == null ||
        result.lapsCompleted == null ||
        result.lapsCompleted <= 0
      ) {
        continue
      }

      let driverMap = byClass.get(race.className)
      if (!driverMap) {
        driverMap = new Map()
        byClass.set(race.className, driverMap)
      }

      const existing = driverMap.get(result.driverId)
      if (!existing) {
        driverMap.set(result.driverId, {
          driverName: result.driverName,
          totalTimeSeconds: result.totalTimeSeconds,
          totalLaps: result.lapsCompleted,
        })
      } else {
        existing.totalTimeSeconds += result.totalTimeSeconds
        existing.totalLaps += result.lapsCompleted
      }
    }
  }

  const result: ClassTopAverageLapsGroup[] = []

  for (const [className, driverMap] of byClass.entries()) {
    const withAvg = Array.from(driverMap.entries())
      .map(([driverId, data]) => ({
        driverId,
        driverName: data.driverName,
        avgLapSeconds: data.totalTimeSeconds / data.totalLaps,
        totalLaps: data.totalLaps,
        raceCount: 0,
      }))
      .filter((e) => e.totalLaps > 0)

    for (const e of withAvg) {
      e.raceCount = races.filter(
        (r) => r.className === className && r.results.some((res) => res.driverId === e.driverId)
      ).length
    }

    const sorted = [...withAvg].sort((a, b) => a.avgLapSeconds - b.avgLapSeconds)

    const distinctAvgs: number[] = []
    for (const e of sorted) {
      const last = distinctAvgs[distinctAvgs.length - 1]
      if (last === undefined || Math.abs(e.avgLapSeconds - last) > 0.001) {
        distinctAvgs.push(e.avgLapSeconds)
        if (distinctAvgs.length >= 3) break
      }
    }
    const topSet = new Set(distinctAvgs)

    let rank = 1
    let prevAvg: number | null = null
    const topEntries: EventTopAverageLapEntry[] = []

    for (const e of sorted) {
      if (!topSet.has(e.avgLapSeconds)) continue

      const isNewRank = prevAvg === null || Math.abs(e.avgLapSeconds - prevAvg) > 0.001
      if (isNewRank && prevAvg !== null) {
        rank++
      }
      prevAvg = e.avgLapSeconds

      topEntries.push({
        driverId: e.driverId,
        driverName: e.driverName,
        avgLapSeconds: e.avgLapSeconds,
        raceCount: e.raceCount,
        totalLaps: e.totalLaps,
        rank,
      })
    }

    if (topEntries.length > 0) {
      result.push({ className, entries: topEntries })
    }
  }

  result.sort((a, b) => a.className.localeCompare(b.className))
  return result
}
