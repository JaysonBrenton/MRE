/**
 * @fileoverview Mean session average lap for each class’s overall winner (same person as
 *             {@link buildClassWinners}), for Event Overview “Fastest Average Laps” cards.
 */

import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import type { ClassWinnerHighlight } from "@/core/events/build-event-highlights"
import { driverNamesMatchForClassWinner } from "@/core/events/build-event-highlights"

export interface ClassWinnerAvgLapSessionRow {
  raceId: string
  raceLabel: string
  raceOrder: number | null
  startTimeMs: number | null
  avgLapTimeSeconds: number
}

export interface ClassWinnerMeanAvgLapCard {
  className: string
  classDisplay: string
  winnerName: string
  /** Mean of per-session `avgLapTime` for this winner in this class; null if no sessions have data. */
  meanAvgLapSeconds: number | null
  sessionsWithAvgLap: number
  sessionRows: ClassWinnerAvgLapSessionRow[]
}

function avgLapValid(t: number | null | undefined): t is number {
  return typeof t === "number" && Number.isFinite(t) && t > 0
}

function sortSessionRowsChronologically(
  rows: ClassWinnerAvgLapSessionRow[]
): ClassWinnerAvgLapSessionRow[] {
  return [...rows].sort((a, b) => {
    const hasA = a.startTimeMs != null
    const hasB = b.startTimeMs != null
    if (hasA && hasB && a.startTimeMs !== b.startTimeMs) {
      return a.startTimeMs! - b.startTimeMs!
    }
    if (hasA && !hasB) return -1
    if (!hasA && hasB) return 1
    const oa = a.raceOrder ?? 0
    const ob = b.raceOrder ?? 0
    if (oa !== ob) return oa - ob
    return a.raceLabel.localeCompare(b.raceLabel, undefined, { sensitivity: "base" })
  })
}

/**
 * One card per class winner (caller should pass {@link ClassWinnerHighlight} list in display order).
 */
export function computeClassWinnerMeanAvgLapCards(
  winnersOrdered: ClassWinnerHighlight[],
  races: EventAnalysisData["races"]
): ClassWinnerMeanAvgLapCard[] {
  return winnersOrdered.map((w) => {
    const cn = w.className.trim()
    const avgLaps: number[] = []
    const sessionRows: ClassWinnerAvgLapSessionRow[] = []

    for (const race of races) {
      if (race.className.trim() !== cn) continue
      const startTimeMs = race.startTime ? race.startTime.getTime() : null
      for (const res of race.results) {
        if (!driverNamesMatchForClassWinner(res.driverName, w.winnerName)) continue
        if (!avgLapValid(res.avgLapTime)) continue
        avgLaps.push(res.avgLapTime)
        sessionRows.push({
          raceId: race.raceId,
          raceLabel: race.raceLabel,
          raceOrder: race.raceOrder,
          startTimeMs,
          avgLapTimeSeconds: res.avgLapTime,
        })
      }
    }

    const meanAvgLapSeconds =
      avgLaps.length > 0 ? avgLaps.reduce((a, b) => a + b, 0) / avgLaps.length : null

    return {
      className: w.className,
      classDisplay: w.classDisplay,
      winnerName: w.winnerName,
      meanAvgLapSeconds,
      sessionsWithAvgLap: avgLaps.length,
      sessionRows: sortSessionRowsChronologically(sessionRows),
    }
  })
}
