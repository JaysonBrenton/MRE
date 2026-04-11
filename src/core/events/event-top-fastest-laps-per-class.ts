/**
 * @fileoverview Event-wide top distinct fastest laps per class (shared by cards and tables)
 *
 * Per class: each driver's best lap across all sessions, then top 3 distinct lap times
 * with ties included at each rank.
 */

import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface EventTopFastestLapEntry {
  driverId: string
  driverName: string
  lapTimeSeconds: number
  /** Race / session label where the lap was set (same as race.raceLabel). */
  raceLabel: string
  lapNumber: number | null
  rank: number
  /** LiveRC session results URL for the race where this best lap was set. */
  raceUrl?: string
}

export interface ClassTopFastestLapsGroup {
  className: string
  entries: EventTopFastestLapEntry[]
}

export function computeTopFastestLapsPerClass(
  races: EventAnalysisData["races"]
): ClassTopFastestLapsGroup[] {
  const byClass = new Map<
    string,
    Map<
      string,
      {
        driverId: string
        driverName: string
        lapTimeSeconds: number
        raceLabel: string
        lapNumber: number | null
        raceUrl: string
      }
    >
  >()

  for (const race of races) {
    for (const result of race.results) {
      if (result.fastLapTime == null || result.fastLapTime <= 0) continue

      let driverMap = byClass.get(race.className)
      if (!driverMap) {
        driverMap = new Map()
        byClass.set(race.className, driverMap)
      }

      const existing = driverMap.get(result.driverId)
      const isBetter = !existing || result.fastLapTime < existing.lapTimeSeconds

      if (isBetter) {
        driverMap.set(result.driverId, {
          driverId: result.driverId,
          driverName: result.driverName,
          lapTimeSeconds: result.fastLapTime,
          raceLabel: race.raceLabel,
          lapNumber: result.fastLapLapNumber ?? null,
          raceUrl: race.raceUrl,
        })
      }
    }
  }

  const result: ClassTopFastestLapsGroup[] = []

  for (const [className, driverMap] of byClass.entries()) {
    const entries = Array.from(driverMap.values())
    const sorted = [...entries].sort((a, b) => a.lapTimeSeconds - b.lapTimeSeconds)

    const distinctTimes: number[] = []
    for (const e of sorted) {
      const last = distinctTimes[distinctTimes.length - 1]
      if (last === undefined || Math.abs(e.lapTimeSeconds - last) > 0.001) {
        distinctTimes.push(e.lapTimeSeconds)
        if (distinctTimes.length >= 3) break
      }
    }

    const topTimesSet = new Set(distinctTimes)

    const topEntries: EventTopFastestLapEntry[] = []
    let rank = 1
    let prevTime: number | null = null

    for (const e of sorted) {
      if (!topTimesSet.has(e.lapTimeSeconds)) continue

      const isNewRank = prevTime === null || Math.abs(e.lapTimeSeconds - prevTime) > 0.001
      if (isNewRank && prevTime !== null) {
        rank++
      }
      prevTime = e.lapTimeSeconds

      topEntries.push({
        driverId: e.driverId,
        driverName: e.driverName,
        lapTimeSeconds: e.lapTimeSeconds,
        raceLabel: e.raceLabel,
        lapNumber: e.lapNumber,
        rank,
        raceUrl: e.raceUrl,
      })
    }

    if (topEntries.length > 0) {
      result.push({ className, entries: topEntries })
    }
  }

  result.sort((a, b) => a.className.localeCompare(b.className))

  return result
}

type DriverBestLap = {
  driverId: string
  driverName: string
  lapTimeSeconds: number
  raceLabel: string
  lapNumber: number | null
  raceUrl: string
}

/**
 * Every driver’s best lap in a class (event-wide), sorted fastest-first with rank
 * (ties share a rank). Unlike {@link computeTopFastestLapsPerClass}, this is not limited
 * to the top three distinct lap times.
 */
export function computeAllBestLapsForClass(
  races: EventAnalysisData["races"],
  className: string
): EventTopFastestLapEntry[] {
  const driverMap = new Map<string, DriverBestLap>()

  for (const race of races) {
    if (race.className !== className) continue

    for (const result of race.results) {
      if (result.fastLapTime == null || result.fastLapTime <= 0) continue

      const existing = driverMap.get(result.driverId)
      const isBetter = !existing || result.fastLapTime < existing.lapTimeSeconds

      if (isBetter) {
        driverMap.set(result.driverId, {
          driverId: result.driverId,
          driverName: result.driverName,
          lapTimeSeconds: result.fastLapTime,
          raceLabel: race.raceLabel,
          lapNumber: result.fastLapLapNumber ?? null,
          raceUrl: race.raceUrl,
        })
      }
    }
  }

  const sorted = Array.from(driverMap.values()).sort((a, b) => a.lapTimeSeconds - b.lapTimeSeconds)

  let rank = 1
  let prevTime: number | null = null
  const out: EventTopFastestLapEntry[] = []

  for (const e of sorted) {
    const isNewRank = prevTime === null || Math.abs(e.lapTimeSeconds - prevTime) > 0.001
    if (isNewRank && prevTime !== null) {
      rank++
    }
    prevTime = e.lapTimeSeconds

    out.push({
      driverId: e.driverId,
      driverName: e.driverName,
      lapTimeSeconds: e.lapTimeSeconds,
      raceLabel: e.raceLabel,
      lapNumber: e.lapNumber,
      rank,
      raceUrl: e.raceUrl,
    })
  }

  return out
}
