/**
 * @fileoverview Infer driver bump-ups (advancement between ladder rounds) from session results.
 *
 * @see docs/plans/bump-ups-feature-spec.md
 * @see docs/adr/ADR-20260404-bump-ups-inferred-from-results.md
 */

import type { SessionData } from "./get-sessions-data"
import { getBracketFinalLadderRank } from "./bump-up-ladder-strategies"
import { isMainSessionFromFields, parseMainBracketLeg } from "./main-bracket-overall"

export type BumpUpKind = "advance" | "lcq"

export interface BumpUpRow {
  driverId: string
  driverName: string
  fromRaceLabel: string
  toRaceLabel: string
  fromPosition: number | null
  toPosition: number | null
  kind: BumpUpKind
}

/** True if label looks like a last-chance / LCQ race */
export function labelLooksLikeLcq(label: string): boolean {
  const L = label.toLowerCase()
  return /\blcq\b/i.test(L) || /last\s*chance/i.test(L)
}

function labelLooksLikeQualifyingOrPractice(label: string, sessionType: string | null): boolean {
  // Last-chance / LCQ is a mains ladder round, not generic qualifying (label may contain "Qualifier").
  if (labelLooksLikeLcq(label)) return false
  const L = label.toLowerCase()
  if (/(qualif|seed|practice|timed\s*practice)/i.test(L)) return true
  const st = (sessionType ?? "").toLowerCase()
  if (st === "practice" || st === "seeding" || st.includes("qualif")) return true
  return false
}

function labelLooksLikeSemi(label: string): boolean {
  const L = label.toLowerCase()
  if (/\bsemi[\s-]*final/i.test(L)) return true
  if (/\bsemi\b/i.test(L) && !/\ba[\s\d]*[-–]?\s*main/i.test(L)) return true
  return false
}

/**
 * Monotonic ladder rank: higher = closer to the championship main (A).
 * Returns null if the session is not treated as part of the mains ladder (e.g. qualifying).
 *
 * LCQ / last-chance is evaluated **before** generic qualifying detection so labels like
 * "Last Chance Qualifier" are not misclassified (substring "qualif" in "Qualifier").
 *
 * @param sectionHeader - Optional LiveRC round heading (e.g. "Main Events") for bracket finals.
 */
export function getLadderRank(
  label: string,
  sessionType: string | null,
  sectionHeader?: string | null
): number | null {
  if (labelLooksLikeLcq(label)) return 7

  if (labelLooksLikeQualifyingOrPractice(label, sessionType)) return null

  const L = label.toLowerCase()

  if (labelLooksLikeSemi(L)) return 6

  const parsed = parseMainBracketLeg(label)
  if (parsed) {
    const code = parsed.bracket.charCodeAt(0)
    if (code < 65 || code > 90) return null
    if (parsed.bracket === "A") return 8
    // B=5, C=4, D=3, E=2, F=1 (typical lower mains)
    return 5 - (code - 66)
  }

  const bracketRank = getBracketFinalLadderRank(label, sectionHeader ?? null, sessionType)
  if (bracketRank !== null) return bracketRank

  // Unlettered "main" without bracket — weak signal; include with mid rank
  if (/\bmain\b/i.test(L) || (sessionType ?? "").toLowerCase() === "main") {
    return 2.5
  }

  return null
}

/**
 * Bump-ups only occur during mains-ladder sessions (not seeding/qualifying heats).
 * Includes LCQ and semi-finals, which are ladder rounds but may not pass generic "main" label checks.
 */
export function isSessionMainForBumpUps(session: SessionData): boolean {
  const label = session.raceLabel?.trim() ?? ""
  if (labelLooksLikeLcq(label)) return true
  if (labelLooksLikeSemi(label)) return true
  return isMainSessionFromFields({
    sessionType: session.sessionType,
    raceLabel: session.raceLabel,
    sectionHeader: session.sectionHeader,
  })
}

/**
 * Same ladder eligibility as {@link isSessionMainForBumpUps}, for raw `Race` rows (chip filtering).
 */
export function raceMightBeBumpUpLadderRace(race: {
  raceLabel: string
  sessionType: string | null
  sectionHeader: string | null
}): boolean {
  const label = race.raceLabel?.trim() ?? ""
  if (labelLooksLikeLcq(label)) return true
  if (labelLooksLikeSemi(label)) return true
  return isMainSessionFromFields({
    sessionType: race.sessionType,
    raceLabel: race.raceLabel,
    sectionHeader: race.sectionHeader,
  })
}

/**
 * Sort sessions by event order: raceOrder, then start time, then label.
 */
export function sortSessionsForLadder(sessions: SessionData[]): SessionData[] {
  return [...sessions].sort((a, b) => {
    const oa = a.raceOrder
    const ob = b.raceOrder
    if (oa != null && ob != null && oa !== ob) return oa - ob
    if (oa != null && ob == null) return -1
    if (oa == null && ob != null) return 1
    const ta = a.startTime?.getTime() ?? 0
    const tb = b.startTime?.getTime() ?? 0
    if (ta !== tb) return ta - tb
    return (a.raceLabel ?? "").localeCompare(b.raceLabel ?? "", undefined, {
      numeric: true,
      sensitivity: "base",
    })
  })
}

/**
 * Infer bump-up rows for a single class's sessions.
 * Pass sessions already filtered to one class; empty list returns [].
 */
export function inferBumpUpsFromSessions(sessions: SessionData[]): BumpUpRow[] {
  if (sessions.length === 0) return []

  const mainsOnly = sessions.filter(isSessionMainForBumpUps)
  if (mainsOnly.length === 0) return []

  const ordered = sortSessionsForLadder(mainsOnly)
  const sessionOrderIndex = new Map<string, number>()
  ordered.forEach((s, i) => sessionOrderIndex.set(s.id, i))

  const sessionMeta = ordered.map((s) => ({
    session: s,
    rank: getLadderRank(s.raceLabel, s.sessionType, s.sectionHeader),
  }))

  const ladderSessions = sessionMeta.filter((m) => m.rank !== null) as Array<{
    session: SessionData
    rank: number
  }>

  if (ladderSessions.length < 2) return []

  const byDriver = new Map<
    string,
    Array<{ session: SessionData; rank: number; position: number | null; name: string }>
  >()

  for (const { session, rank } of ladderSessions) {
    const seenDriverInSession = new Set<string>()
    for (const r of session.results) {
      if (seenDriverInSession.has(r.driverId)) continue
      seenDriverInSession.add(r.driverId)
      const pos =
        typeof r.positionFinal === "number" && Number.isFinite(r.positionFinal)
          ? r.positionFinal
          : null
      const name = (r.driverName ?? "").trim() || "Unknown Driver"
      if (!byDriver.has(r.driverId)) {
        byDriver.set(r.driverId, [])
      }
      byDriver.get(r.driverId)!.push({
        session,
        rank,
        position: pos,
        name,
      })
    }
  }

  const rows: BumpUpRow[] = []

  for (const [driverId, appearances] of byDriver) {
    const sorted = [...appearances].sort((a, b) => {
      const ia = sessionOrderIndex.get(a.session.id) ?? 0
      const ib = sessionOrderIndex.get(b.session.id) ?? 0
      return ia - ib
    })

    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i]!
      const to = sorted[i + 1]!
      if (from.rank >= to.rank) continue
      const driverName = from.name || to.name
      const kind: BumpUpKind = labelLooksLikeLcq(from.session.raceLabel) ? "lcq" : "advance"
      rows.push({
        driverId,
        driverName,
        fromRaceLabel: from.session.raceLabel,
        toRaceLabel: to.session.raceLabel,
        fromPosition: from.position,
        toPosition: to.position,
        kind,
      })
    }
  }

  rows.sort((a, b) => {
    const nameCmp = a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" })
    if (nameCmp !== 0) return nameCmp
    return a.fromRaceLabel.localeCompare(b.fromRaceLabel, undefined, { numeric: true })
  })

  return rows
}
