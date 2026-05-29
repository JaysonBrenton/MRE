/**
 * @fileoverview Default driver for Event Level Analysis “Driver Analysis” lap card
 *
 * Seeding order (first match wins) — see Driver event lap graph plan:
 * 1. Multi-main overall P1 → 2. Overall final rankings P1 → 3. A-bracket mains P1 →
 * 4. Best finish among ladder-ish sessions → 5. Qual points #1 →
 * 6. First alphabetical driver (caller may restrict via lapEligibleDriverIds).
 */

import type { EventAnalysisData } from "./get-event-analysis-data"
import { isEventMainSession, parseMainBracketLeg } from "./main-bracket-overall"
import { multiMainResultMatchesClassFilter } from "./multi-main-class-match"

type RaceRow = EventAnalysisData["races"][number]

function raceScheduleInstant(race: RaceRow): number | null {
  const raw = race.startTime ?? race.completedAt ?? null
  if (raw == null) return null
  const d = raw instanceof Date ? raw : new Date(raw as unknown as string)
  const t = d.getTime()
  return Number.isNaN(t) ? null : t
}

function sortRacesChronologicallyAsc(races: RaceRow[]): RaceRow[] {
  return [...races].sort((a, b) => {
    const ta = raceScheduleInstant(a)
    const tb = raceScheduleInstant(b)
    const hasA = ta != null && !Number.isNaN(ta)
    const hasB = tb != null && !Number.isNaN(tb)
    if (hasA && hasB && ta !== tb) return ta - tb
    if (hasA && !hasB) return -1
    if (!hasA && hasB) return 1
    const oa = a.raceOrder ?? 0
    const ob = b.raceOrder ?? 0
    return oa - ob
  })
}

/** True when session looks like mains ladder flow (semi / lcq / lettered mains). */
function ladderishSessionFields(race: RaceRow): boolean {
  if (parseMainBracketLeg(race.raceLabel) != null) return true
  const lab = race.raceLabel.toLowerCase()
  if (/\blcq\b/.test(lab) || /last\s*chance/.test(lab)) return true
  if (/\bsemi\b/.test(lab)) return true
  return isEventMainSession(race)
}

function winnerDriverIdSingleRace(race: RaceRow | undefined): string | null {
  if (!race?.results?.length) return null
  const rows = [...race.results].filter(
    (r) => typeof r.positionFinal === "number" && r.positionFinal >= 1
  )
  const top = rows.find((r) => r.positionFinal === 1)
  return top?.driverId ?? null
}

/** Latest chronological A-shell main winner, else latest main session winner in class. */
function aBracketMainWinner(classMainRaces: RaceRow[]): string | null {
  if (classMainRaces.length === 0) return null
  const chronological = sortRacesChronologicallyAsc(classMainRaces)
  const aBracketCandidates = chronological.filter(
    (r) => parseMainBracketLeg(r.raceLabel)?.bracket === "A"
  )
  const pool = aBracketCandidates.length > 0 ? aBracketCandidates : chronological
  const latest = pool[pool.length - 1]
  return winnerDriverIdSingleRace(latest)
}

function multiMainWinner(data: EventAnalysisData, className: string): string | null {
  for (const mm of data.multiMainResults ?? []) {
    if (!multiMainResultMatchesClassFilter(mm.classLabel, className)) continue
    const first = [...mm.entries]
      .sort((a, b) => a.position - b.position)
      .find((e) => e.position === 1)
    if (first) return first.driverId
  }
  return null
}

function overallFinalRankingWinner(data: EventAnalysisData, className: string): string | null {
  const want = className.trim().toLowerCase()
  for (const blk of data.overallFinalRankings ?? []) {
    if (blk.className.trim().toLowerCase() !== want) continue
    const first = [...blk.entries]
      .sort((a, b) => a.position - b.position)
      .find((e) => e.position === 1)
    if (first) return first.driverId
  }
  return null
}

/** Best numeric finish among ladder-ish sessions only. */
function bestFinishAmongLadderishSessions(
  classRaces: RaceRow[],
  predicate: (id: string) => boolean
): string | null {
  type Best = { driverId: string; pos: number; latestRound: number }
  const bestMap = new Map<string, Best>()
  let roundIndex = 0
  const ordered = sortRacesChronologicallyAsc(classRaces)
  for (const race of ordered) {
    if (!ladderishSessionFields(race)) continue
    roundIndex += 1
    for (const row of race.results) {
      if (typeof row.positionFinal !== "number" || row.positionFinal < 1) continue
      if (!predicate(row.driverId)) continue
      const prev = bestMap.get(row.driverId)
      if (
        !prev ||
        row.positionFinal < prev.pos ||
        (row.positionFinal === prev.pos && roundIndex > prev.latestRound)
      ) {
        bestMap.set(row.driverId, {
          driverId: row.driverId,
          pos: row.positionFinal,
          latestRound: roundIndex,
        })
      }
    }
  }
  const candidates = [...bestMap.values()]
  if (candidates.length === 0) return null
  candidates.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos
    if (b.latestRound !== a.latestRound) return b.latestRound - a.latestRound
    return a.driverId.localeCompare(b.driverId)
  })
  return candidates[0]?.driverId ?? null
}

function qualPointsLeader(data: EventAnalysisData, className: string): string | null {
  const q = data.qualPointsTopQualifiers
  if (!q?.standings?.length) return null
  const want = className.trim().toLowerCase()
  const rows = q.standings.filter((s) => s.className.trim().toLowerCase() === want)
  const top = [...rows].sort((a, b) => a.position - b.position)[0]
  return top?.driverId ?? null
}

function firstAlphaDriver(
  lapEligible: ReadonlySet<string> | undefined,
  classRaces: RaceRow[]
): string | null {
  const ids = new Set<string>()
  for (const race of classRaces) {
    for (const row of race.results) ids.add(row.driverId)
  }
  const narrowed = [...ids].filter((id) => (lapEligible ? lapEligible.has(id) : true))
  if (narrowed.length === 0) return null
  narrowed.sort((a, b) => a.localeCompare(b))
  return narrowed[0] ?? null
}

function filteredByLaps(
  id: string | null | undefined,
  lapEligible?: ReadonlySet<string>
): string | null {
  if (!id) return null
  if (lapEligible != null && !lapEligible.has(id)) return null
  return id
}

export function pickEventLevelDriverAnalysisDefaultDriver(params: {
  data: Pick<
    EventAnalysisData,
    "races" | "multiMainResults" | "overallFinalRankings" | "qualPointsTopQualifiers"
  >
  className: string | null | undefined
  lapEligibleDriverIds?: ReadonlySet<string>
}): string | null {
  const cn = typeof params.className === "string" ? params.className.trim() : ""
  if (!cn) return null

  const el = params.lapEligibleDriverIds
  const fullData = params.data as EventAnalysisData
  const racesInClass = params.data.races.filter((r) => r.className === cn)
  const mainsInClass = racesInClass.filter((r) => isEventMainSession(r))

  const picks: Array<() => string | null> = [
    () => filteredByLaps(multiMainWinner(fullData, cn), el),
    () => filteredByLaps(overallFinalRankingWinner(fullData, cn), el),
    () => filteredByLaps(aBracketMainWinner(mainsInClass), el),
    () =>
      filteredByLaps(
        bestFinishAmongLadderishSessions(racesInClass, (id) => (el ? el.has(id) : true)),
        el
      ),
    () => filteredByLaps(qualPointsLeader(fullData, cn), el),
    () => filteredByLaps(firstAlphaDriver(el, racesInClass), el),
  ]

  for (const p of picks) {
    const id = p()
    if (id) return id
  }
  return null
}
