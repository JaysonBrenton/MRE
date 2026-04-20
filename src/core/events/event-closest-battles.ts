/**
 * @fileoverview Closest battles for Event Overview: per-class tightest P1–P2 main finishes
 *             and per-driver tightest adjacent gap in main sessions.
 */

import type { EventAnalysisData } from "./get-event-analysis-data"
import { isEventMainSession } from "./main-bracket-overall"
import { formatClassName } from "@/lib/format-class-name"

type RaceSummary = EventAnalysisData["races"][number]
type RaceResult = RaceSummary["results"][number]

function totalTimeValid(t: number | null | undefined): t is number {
  return typeof t === "number" && Number.isFinite(t) && t > 0
}

/** Same display rules as {@link formatClosestFinishGap} in build-event-highlights. */
export function formatGapSecondsLabel(gap: number): string {
  if (gap < 1) {
    return `${Math.round(gap * 1000)} ms`
  }
  if (gap < 60) {
    return `${gap.toFixed(2)} s`
  }
  const m = Math.floor(gap / 60)
  const s = gap - m * 60
  return `${m}m ${s.toFixed(1)}s`
}

export interface ClosestBattleClassSummary {
  className: string
  classDisplay: string
  raceLabel: string
  p1Name: string
  p2Name: string
  /**
   * Finishing gap in seconds when P1 and P2 completed the same lap count (comparable clock times).
   * Null when P2 is down lap(s) — use {@link gapDisplay} instead.
   */
  gapSeconds: number | null
  /** Seconds or non-time label (e.g. “1 lap”) for the overview card gap line. */
  gapDisplay: string
}

function lapDownGapDisplay(p1: RaceResult, p2: RaceResult): string {
  const raw = p2.behindDisplay?.trim()
  if (raw) return raw
  const d = p1.lapsCompleted - p2.lapsCompleted
  if (d > 0) {
    return `${d} lap${d === 1 ? "" : "s"}`
  }
  return "Lap down"
}

/** P1 vs P2 headline metrics for a single main (shared with event highlights). */
export type P1P2FinishMetrics = {
  gapSeconds: number | null
  gapDisplay: string
  lapsDown: number
  p2SecondsBehind: number | null
}

/**
 * Comparable P1–P2 gap for display: same-lap uses clock delta; if the winner ran more laps than
 * 2nd, total times are not comparable — use lap-down label from LiveRC when present.
 */
export function computeP1P2FinishMetrics(p1: RaceResult, p2: RaceResult): P1P2FinishMetrics | null {
  if (!p1.driverName?.trim() || !p2.driverName?.trim()) return null

  const laps1 = p1.lapsCompleted
  const laps2 = p2.lapsCompleted
  const sb =
    typeof p2.secondsBehind === "number" &&
    Number.isFinite(p2.secondsBehind) &&
    p2.secondsBehind >= 0
      ? p2.secondsBehind
      : null

  if (laps1 === laps2) {
    if (!totalTimeValid(p1.totalTimeSeconds) || !totalTimeValid(p2.totalTimeSeconds)) return null
    const gap = p2.totalTimeSeconds! - p1.totalTimeSeconds!
    if (!Number.isFinite(gap) || gap < 0) return null
    return {
      gapSeconds: gap,
      gapDisplay: formatGapSecondsLabel(gap),
      lapsDown: 0,
      p2SecondsBehind: sb,
    }
  }

  if (laps1 > laps2) {
    return {
      gapSeconds: null,
      gapDisplay: lapDownGapDisplay(p1, p2),
      lapsDown: laps1 - laps2,
      p2SecondsBehind: sb,
    }
  }

  if (!totalTimeValid(p1.totalTimeSeconds) || !totalTimeValid(p2.totalTimeSeconds)) return null
  const gap = p2.totalTimeSeconds! - p1.totalTimeSeconds!
  if (!Number.isFinite(gap) || gap < 0) return null
  return {
    gapSeconds: gap,
    gapDisplay: formatGapSecondsLabel(gap),
    lapsDown: 0,
    p2SecondsBehind: sb,
  }
}

export function compareP1P2FinishMetrics(
  a: P1P2FinishMetrics & { raceLabel: string },
  b: P1P2FinishMetrics & { raceLabel: string }
): number {
  const aSame = a.gapSeconds != null
  const bSame = b.gapSeconds != null
  if (aSame !== bSame) return aSame ? -1 : 1
  if (aSame && bSame && a.gapSeconds != null && b.gapSeconds != null) {
    if (a.gapSeconds !== b.gapSeconds) return a.gapSeconds - b.gapSeconds
  }
  if (a.lapsDown !== b.lapsDown) return a.lapsDown - b.lapsDown
  const sa = a.p2SecondsBehind ?? Number.POSITIVE_INFINITY
  const sb = b.p2SecondsBehind ?? Number.POSITIVE_INFINITY
  if (sa !== sb) return sa - sb
  return a.raceLabel.localeCompare(b.raceLabel, undefined, { sensitivity: "base" })
}

type P1P2Candidate = ClosestBattleClassSummary & P1P2FinishMetrics

function buildP1P2MainCandidate(
  race: RaceSummary,
  className: string,
  p1: RaceResult,
  p2: RaceResult
): P1P2Candidate | null {
  const metrics = computeP1P2FinishMetrics(p1, p2)
  if (!metrics) return null

  return {
    className,
    classDisplay: formatClassName(className),
    raceLabel: race.raceLabel,
    p1Name: p1.driverName,
    p2Name: p2.driverName,
    ...metrics,
  }
}

function compareP1P2Candidates(a: P1P2Candidate, b: P1P2Candidate): number {
  return compareP1P2FinishMetrics(a, b)
}

/**
 * For each class, the main session with the closest P1–P2 headline (same-lap time gap when
 * comparable; otherwise lap-down label when the winner finished more laps than 2nd).
 */
export function computeClosestP1P2PerClass(races: RaceSummary[]): ClosestBattleClassSummary[] {
  const bestByClass = new Map<string, P1P2Candidate>()

  for (const race of races) {
    if (!isEventMainSession(race)) continue
    const className = race.className?.trim()
    if (!className) continue

    const sorted = [...race.results].sort((a, b) => a.positionFinal - b.positionFinal)
    const p1 = sorted.find((x) => x.positionFinal === 1)
    const p2 = sorted.find((x) => x.positionFinal === 2)
    const candidate = p1 && p2 ? buildP1P2MainCandidate(race, className, p1, p2) : null
    if (!candidate) continue

    const prev = bestByClass.get(className)
    if (!prev || compareP1P2Candidates(candidate, prev) < 0) {
      bestByClass.set(className, candidate)
    }
  }

  return Array.from(bestByClass.values())
    .map(({ lapsDown: _l, p2SecondsBehind: _s, ...pub }) => pub)
    .sort((a, b) =>
      a.classDisplay.localeCompare(b.classDisplay, undefined, { sensitivity: "base" })
    )
}

export interface DriverClosestBattleRow {
  driverId: string
  driverName: string
  /** Schedule class for this row (one row per driver per class). */
  className: string
  classDisplay: string
  raceLabel: string
  positionFinal: number
  opponentName: string
  opponentPosition: number
  gapSeconds: number
}

/** Smallest adjacent gap (vs position ahead or behind) and that opponent. */
function adjacentBattle(
  sorted: RaceResult[],
  index: number
): { gapSeconds: number; opponentName: string; opponentPosition: number } | null {
  const self = sorted[index]
  if (!self || !totalTimeValid(self.totalTimeSeconds)) return null
  const t = self.totalTimeSeconds
  const options: Array<{
    gapSeconds: number
    opponentName: string
    opponentPosition: number
  }> = []
  if (index > 0) {
    const prev = sorted[index - 1]!
    if (prev.lapsCompleted === self.lapsCompleted && totalTimeValid(prev.totalTimeSeconds)) {
      options.push({
        gapSeconds: t - prev.totalTimeSeconds,
        opponentName: prev.driverName,
        opponentPosition: prev.positionFinal,
      })
    }
  }
  if (index < sorted.length - 1) {
    const next = sorted[index + 1]!
    if (next.lapsCompleted === self.lapsCompleted && totalTimeValid(next.totalTimeSeconds)) {
      options.push({
        gapSeconds: next.totalTimeSeconds - t,
        opponentName: next.driverName,
        opponentPosition: next.positionFinal,
      })
    }
  }
  if (options.length === 0) return null
  let best = options[0]!
  for (const o of options) {
    if (o.gapSeconds < best.gapSeconds) best = o
  }
  return best
}

/**
 * For each driver **in each class**, the tightest adjacent finishing gap (total time) in any main
 * session for that class. (Multi-class drivers get one row per class.)
 */
export function computeDriverClosestBattles(races: RaceSummary[]): DriverClosestBattleRow[] {
  type Best = DriverClosestBattleRow
  const bestByDriverAndClass = new Map<string, Best>()

  for (const race of races) {
    if (!isEventMainSession(race)) continue
    const className = race.className?.trim()
    if (!className) continue
    const classDisplay = formatClassName(className)
    const sorted = [...race.results].sort((a, b) => a.positionFinal - b.positionFinal)

    for (let i = 0; i < sorted.length; i++) {
      const res = sorted[i]!
      const battle = adjacentBattle(sorted, i)
      if (!battle || !Number.isFinite(battle.gapSeconds) || battle.gapSeconds < 0) continue

      const candidate: Best = {
        driverId: res.driverId,
        driverName: res.driverName,
        className,
        classDisplay,
        raceLabel: race.raceLabel,
        positionFinal: res.positionFinal,
        opponentName: battle.opponentName,
        opponentPosition: battle.opponentPosition,
        gapSeconds: battle.gapSeconds,
      }

      const key = `${res.driverId}\0${className}`
      const prev = bestByDriverAndClass.get(key)
      if (!prev || candidate.gapSeconds < prev.gapSeconds) {
        bestByDriverAndClass.set(key, candidate)
      }
    }
  }

  return Array.from(bestByDriverAndClass.values()).sort((a, b) => {
    const nameCmp = a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" })
    if (nameCmp !== 0) return nameCmp
    return a.classDisplay.localeCompare(b.classDisplay, undefined, { sensitivity: "base" })
  })
}
