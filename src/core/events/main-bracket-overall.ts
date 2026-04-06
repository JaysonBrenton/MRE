/**
 * @fileoverview Group mains by letter bracket (A/B/C) and compute overall podium
 *
 * @see docs/domain/triple-a-main-scoring.md
 */

import type { EventAnalysisData } from "./get-event-analysis-data"

type RaceSummary = EventAnalysisData["races"][number]

function labelLooksLikeStandaloneFinal(raceLabel: string): boolean {
  const lower = raceLabel.toLowerCase().replace(/[\u2010-\u2015]/g, "-")
  if (/\bsemi[\s-]*final\b/i.test(lower)) return false
  return /\bfinal\b/.test(lower)
}

/**
 * Core “is this a main / final session?” check from structured fields + label.
 * Used for event podium filtering and bump-up mains scoping.
 */
export function isMainSessionFromFields(race: {
  sessionType: string | null
  raceLabel: string
  sectionHeader: string | null
}): boolean {
  if (race.sessionType === "main") return true
  const label = race.raceLabel?.trim() ?? ""
  if (label.length > 0) {
    const lower = label.toLowerCase()
    if (lower.includes("main")) return true
    if (labelLooksLikeStandaloneFinal(label)) return true
  }
  const section = race.sectionHeader?.trim() ?? ""
  return section.length > 0 && section.toLowerCase().includes("main event")
}

/**
 * Whether a race counts as a main/final for event podium purposes. Aligns with leaderboard
 * heuristics (`sessionType` main or "main" in the label) and includes LiveRC rounds listed
 * under **Main Events** when the label omits "main" (e.g. "Final" only) but `sessionType`
 * stayed `race`. Also treats standalone **Final** in the label (not semi-final) when section
 * headers are missing.
 */
export function isEventMainSession(race: RaceSummary): boolean {
  return isMainSessionFromFields(race)
}

export interface ParsedMainBracket {
  bracket: string
  leg: number
}

/**
 * Parse LiveRC-style labels such as "1/8 Electric Buggy A1-Main" → bracket A, leg 1.
 */
export function parseMainBracketLeg(raceLabel: string): ParsedMainBracket | null {
  const s = raceLabel.trim()
  // "A1-Main", "A2-Main", "B1–Main"
  const m1 = /\b([A-Z])(\d+)\s*[-–]?\s*Main\b/i.exec(s)
  if (m1) {
    return { bracket: m1[1].toUpperCase(), leg: parseInt(m1[2], 10) }
  }
  // "A-Main" (single)
  const m2 = /\b([A-Z])\s*[-–]?\s*Main\b/i.exec(s)
  if (m2) {
    return { bracket: m2[1].toUpperCase(), leg: 1 }
  }
  return null
}

type LegFinish = {
  position: number
  points: number
  totalTimeSeconds: number | null
}

type DriverAccum = {
  driverId: string
  driverName: string
  legs: LegFinish[]
}

export interface BracketOverallRow {
  className: string
  bracket: string
  /** Display e.g. "A Main" */
  bracketLabel: string
  firstName: string
  secondName: string | null
  thirdName: string | null
  /** Earliest leg start for sort / display */
  startTime: Date | null
  /** Primary race order among legs */
  raceOrder: number | null
  /** First leg URL for "open results" */
  raceUrl: string
  /**
   * `aggregate` = IFMAR-style multi-leg bracket; `single-main` = top 3 from one main when
   * labels are not lettered (A1-Main, …).
   */
  sessionKind?: "aggregate" | "single-main"
}

function legPoints(position: number): number {
  return position
}

/**
 * Compare two drivers under IFMAR-style triple-main rules (best 2 of 3, tie-breaks).
 * Returns negative if `a` ranks above `b`.
 */
function compareOverall(a: DriverAccum, b: DriverAccum): number {
  const scoreA = computeRankingTuple(a)
  const scoreB = computeRankingTuple(b)
  for (let i = 0; i < Math.max(scoreA.length, scoreB.length); i++) {
    const va = scoreA[i] ?? 0
    const vb = scoreB[i] ?? 0
    if (va !== vb) return va < vb ? -1 : 1
  }
  return 0
}

/**
 * Lexicographic tuple; lower = better. Values chosen so primary sort is ascending.
 */
function computeRankingTuple(d: DriverAccum): number[] {
  const legs = d.legs.map((L) => ({
    position: L.position,
    points: L.points,
    time: L.totalTimeSeconds,
  }))
  const n = legs.length
  if (n === 0) return [Number.POSITIVE_INFINITY]

  const pts = legs.map((l) => l.points)

  if (n === 1) {
    return [pts[0]]
  }

  if (n === 2) {
    // IFMAR reduced: best 1 of 2 — primary = min leg points (better single finish)
    const m = Math.min(pts[0], pts[1])
    const worse = Math.max(pts[0], pts[1])
    return [m, worse]
  }

  // n >= 3: best 2 of 3 — sum of two smallest leg points
  const sortedByLegPoints = [...legs].sort((a, b) => a.points - b.points)
  const counting = [sortedByLegPoints[0], sortedByLegPoints[1]]
  const sumTwo = counting[0].points + counting[1].points
  const bestSingle = Math.min(counting[0].position, counting[1].position)
  const worseLeg = counting[0].position <= counting[1].position ? counting[1] : counting[0]
  const timeOnBestLeg =
    (counting[0].position <= counting[1].position ? counting[0] : counting[1]).time ??
    Number.POSITIVE_INFINITY
  const timeOnWorse = worseLeg.time ?? Number.POSITIVE_INFINITY

  return [sumTwo, bestSingle, timeOnBestLeg, timeOnWorse]
}

/**
 * Sort races in a bracket group by leg number, then raceOrder.
 */
function sortBracketRaces(races: RaceSummary[]): RaceSummary[] {
  return [...races].sort((a, b) => {
    const pa = parseMainBracketLeg(a.raceLabel)
    const pb = parseMainBracketLeg(b.raceLabel)
    const la = pa?.leg ?? 0
    const lb = pb?.leg ?? 0
    if (la !== lb) return la - lb
    const oa = a.raceOrder ?? 0
    const ob = b.raceOrder ?? 0
    return oa - ob
  })
}

/**
 * For one class + bracket, merge per-leg results into one driver row per leg (same driver
 * appears once per leg with their finish).
 */
function mergeLegsForBracket(sortedRaces: RaceSummary[]): DriverAccum[] {
  const byDriver = new Map<string, DriverAccum>()

  for (const race of sortedRaces) {
    for (const r of race.results) {
      if (r.positionFinal <= 0) continue
      let acc = byDriver.get(r.driverId)
      if (!acc) {
        acc = { driverId: r.driverId, driverName: r.driverName, legs: [] }
        byDriver.set(r.driverId, acc)
      }
      acc.legs.push({
        position: r.positionFinal,
        points: legPoints(r.positionFinal),
        totalTimeSeconds: r.totalTimeSeconds,
      })
    }
  }

  return Array.from(byDriver.values())
}

/**
 * Compute overall 1–3 for a bracket from its main races (same class, same letter).
 */
export function computeBracketPodium(races: RaceSummary[]): {
  first: { name: string } | null
  second: { name: string } | null
  third: { name: string } | null
} {
  if (races.length === 0) {
    return { first: null, second: null, third: null }
  }

  const sortedRaces = sortBracketRaces(races)
  const drivers = mergeLegsForBracket(sortedRaces)
  if (drivers.length === 0) {
    return { first: null, second: null, third: null }
  }

  drivers.sort(compareOverall)

  return {
    first: drivers[0] ? { name: drivers[0].driverName } : null,
    second: drivers[1] ? { name: drivers[1].driverName } : null,
    third: drivers[2] ? { name: drivers[2].driverName } : null,
  }
}

/**
 * Build bracket-level rows when `raceLabel` parses as a lettered main (A1-Main, B2-Main, …).
 * Applies to any class (e.g. 1/10 Open, nitro, electric); classes without such labels stay per-leg.
 */
export function buildBracketOverallRows(mainsRaces: RaceSummary[]): BracketOverallRow[] {
  type GroupKey = string
  const groups = new Map<GroupKey, RaceSummary[]>()

  for (const race of mainsRaces) {
    const parsed = parseMainBracketLeg(race.raceLabel)
    if (!parsed) continue

    const key = `${race.className}::${parsed.bracket}`
    const list = groups.get(key) ?? []
    list.push(race)
    groups.set(key, list)
  }

  const rows: BracketOverallRow[] = []

  for (const [, bracketRaces] of groups) {
    if (bracketRaces.length === 0) continue

    const sorted = sortBracketRaces(bracketRaces)
    const podium = computeBracketPodium(sorted)
    const firstRace = sorted[0]

    rows.push({
      className: firstRace.className,
      bracket: parseMainBracketLeg(firstRace.raceLabel)?.bracket ?? "?",
      bracketLabel: `${parseMainBracketLeg(firstRace.raceLabel)?.bracket ?? "?"} Main`,
      firstName: podium.first?.name ?? "—",
      secondName: podium.second?.name ?? null,
      thirdName: podium.third?.name ?? null,
      startTime: sorted.reduce<Date | null>((earliest, r) => {
        if (!r.startTime) return earliest
        if (!earliest || r.startTime < earliest) return r.startTime
        return earliest
      }, null),
      raceOrder: sorted[0]?.raceOrder ?? null,
      raceUrl: sorted[0]?.raceUrl ?? "",
      sessionKind: "aggregate",
    })
  }

  rows.sort((a, b) => {
    const c = a.className.localeCompare(b.className)
    if (c !== 0) return c
    return a.bracket.localeCompare(b.bracket)
  })

  return rows
}

/**
 * When multiple non-lettered mains exist for a class, prefer the latest in the schedule
 * (higher `raceOrder`, then later `startTime`).
 */
export function pickPrimaryMainRace(races: RaceSummary[]): RaceSummary | null {
  if (races.length === 0) return null
  return [...races].sort((a, b) => {
    const oa = a.raceOrder ?? 0
    const ob = b.raceOrder ?? 0
    if (ob !== oa) return ob - oa
    const ta = a.startTime?.getTime() ?? 0
    const tb = b.startTime?.getTime() ?? 0
    return tb - ta
  })[0]
}

function podiumFromSingleMainRace(race: RaceSummary): {
  first: { name: string } | null
  second: { name: string } | null
  third: { name: string } | null
} {
  const ordered = [...race.results]
    .filter((r) => r.positionFinal > 0)
    .sort((a, b) => a.positionFinal - b.positionFinal)
  return {
    first: ordered[0] ? { name: ordered[0].driverName } : null,
    second: ordered[1] ? { name: ordered[1].driverName } : null,
    third: ordered[2] ? { name: ordered[2].driverName } : null,
  }
}

/**
 * Top 3 per class from a single main when race labels do not parse as lettered mains
 * (A1-Main, …). Skips classes that already have lettered mains in `mainsRaces` — those are
 * handled by `buildBracketOverallRows`.
 */
export function buildSimpleMainOverallRows(mainsRaces: RaceSummary[]): BracketOverallRow[] {
  const byClass = new Map<string, RaceSummary[]>()
  for (const race of mainsRaces) {
    if (parseMainBracketLeg(race.raceLabel)) continue
    const list = byClass.get(race.className) ?? []
    list.push(race)
    byClass.set(race.className, list)
  }

  const rows: BracketOverallRow[] = []

  for (const [className, nonLettered] of byClass) {
    const classHasLettered = mainsRaces.some(
      (r) => r.className === className && parseMainBracketLeg(r.raceLabel)
    )
    if (classHasLettered) continue

    const chosen = pickPrimaryMainRace(nonLettered)
    if (!chosen) continue

    const podium = podiumFromSingleMainRace(chosen)
    if (!podium.first && !podium.second && !podium.third) continue

    const label = chosen.raceLabel.trim()
    const bracketLabel = label.length > 0 ? label : "Main"

    rows.push({
      className,
      bracket: "SINGLE",
      bracketLabel,
      firstName: podium.first?.name ?? "—",
      secondName: podium.second?.name ?? null,
      thirdName: podium.third?.name ?? null,
      startTime: chosen.startTime,
      raceOrder: chosen.raceOrder,
      raceUrl: chosen.raceUrl ?? "",
      sessionKind: "single-main",
    })
  }

  rows.sort((a, b) => {
    const c = a.className.localeCompare(b.className)
    if (c !== 0) return c
    return a.bracketLabel.localeCompare(b.bracketLabel)
  })

  return rows
}

/**
 * Lettered bracket overalls plus per-class single-main podiums when labels are not split
 * into A/B/C mains.
 */
export function buildEventMainResultRows(mainsRaces: RaceSummary[]): BracketOverallRow[] {
  const bracket = buildBracketOverallRows(mainsRaces)
  const simple = buildSimpleMainOverallRows(mainsRaces)
  const merged = [...bracket, ...simple]
  merged.sort((a, b) => {
    const c = a.className.localeCompare(b.className)
    if (c !== 0) return c
    return a.bracket.localeCompare(b.bracket)
  })
  return merged
}

/** Race IDs that participate in an A/B/C bracket group (exclude from per-leg rows). */
export function getMainBracketGroupedRaceIds(mainsRaces: RaceSummary[]): Set<string> {
  const groups = new Map<string, RaceSummary[]>()
  for (const race of mainsRaces) {
    const p = parseMainBracketLeg(race.raceLabel)
    if (!p) continue
    const key = `${race.className}::${p.bracket}`
    const list = groups.get(key) ?? []
    list.push(race)
    groups.set(key, list)
  }
  const ids = new Set<string>()
  for (const [, list] of groups) {
    for (const r of list) ids.add(r.id)
  }
  return ids
}
