/**
 * @fileoverview Per-driver paths through mains-ladder sessions (semis, LCQ, mains) for one class.
 *
 * @description Uses the same session scope as bump-ups: full class grids from
 *              getSessionsForBumpUpInference, ladder sessions only (not practice qualifiers).
 */

import type { EventAnalysisData } from "./get-event-analysis-data"
import { getRaceClassNamesForBumpUpChips } from "./class-validator"
import { getSessionsForBumpUpInference } from "./get-sessions-data"
import type { SessionData } from "./get-sessions-data"
import {
  getLadderRank,
  isSessionMainForBumpUps,
  labelLooksLikeLcq,
  sortSessionsForLadder,
} from "./infer-bump-ups"
import { parseMainBracketLeg } from "./main-bracket-overall"

export interface MainEventSessionColumn {
  sessionId: string
  raceLabel: string
  roundKind: string
}

export interface DriverMainEventProgressionRow {
  driverId: string
  driverName: string
  /** Positions aligned to `columns` (null = did not appear in that session). */
  positions: (number | null)[]
  /**
   * Ladder tier gain from first to last appearance: `getLadderRank(last) − getLadderRank(first)`.
   * Higher = moved further toward the A-main (e.g. B-main → A-main). Null if ranks unavailable.
   */
  ladderTierGain: number | null
  /**
   * Finish improvement from first to last round: `positionFirst − positionLast` (lower place is better).
   * Positive means they moved up in the order of finish.
   */
  finishPositionGain: number | null
}

export interface DriverMainEventProgressionMatrix {
  columns: MainEventSessionColumn[]
  rows: DriverMainEventProgressionRow[]
}

/** Human-readable ladder round for tooltips / compact badges. */
export function describeMainLadderRound(session: SessionData): string {
  const label = session.raceLabel?.trim() ?? ""
  if (labelLooksLikeLcq(label)) return "LCQ"

  const L = label.toLowerCase()
  if (/\bsemi[\s-]*final/i.test(L)) return "Semi"
  if (/\bsemi\b/i.test(L) && !/\ba[\s\d]*[-–]?\s*main/i.test(L)) return "Semi"

  const parsed = parseMainBracketLeg(label)
  if (parsed && parsed.bracket.length === 1) {
    const code = parsed.bracket.charCodeAt(0)
    if (code >= 65 && code <= 90) {
      return parsed.bracket === "A" ? "A-Main" : `${parsed.bracket}-Main`
    }
  }

  const rank = getLadderRank(label, session.sessionType, session.sectionHeader)
  if (rank === 8) return "A-Main"
  if (rank === 7) return "LCQ"
  if (rank === 6) return "Semi"
  if (/\bmain\b/i.test(L) || (session.sessionType ?? "").toLowerCase() === "main") {
    return "Main"
  }

  return "Round"
}

function ladderRankForSession(s: SessionData): number | null {
  return getLadderRank(s.raceLabel, s.sessionType, s.sectionHeader)
}

/**
 * First/last session indices where the driver has a position; metrics for sorting "most progressed".
 */
function computeProgressionMetrics(
  ladder: SessionData[],
  positions: (number | null)[]
): { ladderTierGain: number | null; finishPositionGain: number | null } {
  const indices: number[] = []
  positions.forEach((p, i) => {
    if (p !== null) indices.push(i)
  })
  if (indices.length === 0) {
    return { ladderTierGain: null, finishPositionGain: null }
  }
  const firstIdx = indices[0]!
  const lastIdx = indices[indices.length - 1]!
  const firstS = ladder[firstIdx]!
  const lastS = ladder[lastIdx]!

  const firstRank = ladderRankForSession(firstS)
  const lastRank = ladderRankForSession(lastS)

  let ladderTierGain: number | null = null
  if (firstRank !== null && lastRank !== null) {
    ladderTierGain = lastRank - firstRank
  } else if (firstRank === null && lastRank !== null) {
    ladderTierGain = lastRank
  } else if (firstRank !== null && lastRank === null) {
    ladderTierGain = -firstRank
  }

  const firstPos = positions[firstIdx]
  const lastPos = positions[lastIdx]
  let finishPositionGain: number | null = null
  if (firstPos !== null && lastPos !== null) {
    finishPositionGain = firstPos - lastPos
  }

  return { ladderTierGain, finishPositionGain }
}

function compareProgressionRows(
  a: DriverMainEventProgressionRow,
  b: DriverMainEventProgressionRow
): number {
  const ga = a.ladderTierGain
  const gb = b.ladderTierGain
  const hasA = ga !== null && !Number.isNaN(ga)
  const hasB = gb !== null && !Number.isNaN(gb)
  if (hasA && hasB && ga !== gb) {
    return gb! - ga!
  }
  if (hasA !== hasB) {
    return hasA ? -1 : 1
  }

  const pa = a.finishPositionGain
  const pb = b.finishPositionGain
  const hasPA = pa !== null && !Number.isNaN(pa)
  const hasPB = pb !== null && !Number.isNaN(pb)
  if (hasPA && hasPB && pa !== pb) {
    return pb! - pa!
  }
  if (hasPA !== hasPB) {
    return hasPA ? -1 : 1
  }

  return a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" })
}

/** Minimum mains-ladder sessions (semi / LCQ / main, etc.) required to show driver progression. */
export const MIN_LADDER_SESSIONS_FOR_DRIVER_PROGRESSION = 2

/**
 * Class names eligible for Driver Progression chips: same scope as bump-up chips, but only classes
 * where ingested data has at least {@link MIN_LADDER_SESSIONS_FOR_DRIVER_PROGRESSION} ladder sessions
 * so a path across rounds exists.
 */
export function getRaceClassNamesForDriverProgressionChips(data: EventAnalysisData): string[] {
  const candidates = getRaceClassNamesForBumpUpChips(data)
  const out: string[] = []
  for (const className of candidates) {
    const sessions = getSessionsForBumpUpInference(data, className)
    const ladder = sortSessionsForLadder(sessions.filter(isSessionMainForBumpUps))
    if (ladder.length >= MIN_LADDER_SESSIONS_FOR_DRIVER_PROGRESSION) {
      out.push(className)
    }
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
}

/**
 * Build a driver × mains-ladder-session matrix for one racing class.
 * Empty matrix when the class name is missing or no ladder sessions exist.
 */
export function buildDriverMainEventProgressionMatrix(
  data: EventAnalysisData,
  className: string | null
): DriverMainEventProgressionMatrix {
  if (className == null || typeof className !== "string" || className.trim() === "") {
    return { columns: [], rows: [] }
  }

  const sessions = getSessionsForBumpUpInference(data, className)
  const ladder = sortSessionsForLadder(sessions.filter(isSessionMainForBumpUps))

  if (ladder.length === 0) {
    return { columns: [], rows: [] }
  }

  const columns: MainEventSessionColumn[] = ladder.map((s) => ({
    sessionId: s.id,
    raceLabel: s.raceLabel?.trim() ?? s.id,
    roundKind: describeMainLadderRound(s),
  }))

  const positionByDriverAndSession = new Map<string, Map<string, number | null>>()

  const ensureDriver = (driverId: string) => {
    if (!positionByDriverAndSession.has(driverId)) {
      positionByDriverAndSession.set(driverId, new Map())
    }
    return positionByDriverAndSession.get(driverId)!
  }

  for (const session of ladder) {
    const seen = new Set<string>()
    for (const r of session.results) {
      if (seen.has(r.driverId)) continue
      seen.add(r.driverId)
      const pos =
        typeof r.positionFinal === "number" && Number.isFinite(r.positionFinal)
          ? r.positionFinal
          : null
      ensureDriver(r.driverId).set(session.id, pos)
    }
  }

  const rows: DriverMainEventProgressionRow[] = Array.from(positionByDriverAndSession.entries())
    .map(([driverId, bySession]) => {
      let driverName = driverId
      for (const session of ladder) {
        const r = session.results.find((x) => x.driverId === driverId)
        if (r?.driverName?.trim()) {
          driverName = r.driverName.trim()
          break
        }
      }
      const positions = columns.map((c) => bySession.get(c.sessionId) ?? null)
      const { ladderTierGain, finishPositionGain } = computeProgressionMetrics(ladder, positions)
      return { driverId, driverName, positions, ladderTierGain, finishPositionGain }
    })
    .sort(compareProgressionRows)

  return { columns, rows }
}
