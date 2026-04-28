/**
 * @fileoverview Derive “event highlights” for Event Overview (session mix, podiums, closest finishes, etc.)
 *
 * @purpose Pure functions over `EventAnalysisData` for a compact, non-table summary.
 */

import type { EventAnalysisData } from "./get-event-analysis-data"
import {
  baseClassFromMultiMainLabel,
  listMultiMainBlocksForCanonicalClass,
  pickBestMultiMainBlockForClass,
} from "./class-winners-multi-main"
import { formatClassName } from "@/lib/format-class-name"
import { getLadderRank } from "./infer-bump-ups"
import { isEventMainSession } from "./main-bracket-overall"
import { compareP1P2FinishMetrics, computeP1P2FinishMetrics } from "./event-closest-battles"
import {
  sessionTypeFilterChipLabel,
  sessionTypeFilterKeyForRace,
  sortSessionTypeFilterKeys,
} from "./session-type-filter"
import { formatLapTime, formatLapsSlashTime } from "@/lib/format-session-data"

const CHART_COLOR_VARS = [
  "var(--token-chart-series-1)",
  "var(--token-chart-series-2)",
  "var(--token-chart-series-3)",
  "var(--token-chart-series-4)",
  "var(--token-chart-series-5)",
  "var(--token-chart-series-6)",
  "var(--token-chart-series-7)",
  "var(--token-chart-series-8)",
  "var(--token-chart-series-9)",
  "var(--token-chart-series-10)",
  "var(--token-chart-series-11)",
  "var(--token-chart-series-12)",
] as const

function lapTimeValid(t: number | null | undefined): t is number {
  return typeof t === "number" && Number.isFinite(t) && t > 0
}

function sortRacesChronologically<T extends { startTime: Date | null; raceOrder: number | null }>(
  races: T[]
): T[] {
  return [...races].sort((a, b) => {
    const hasA = a.startTime != null
    const hasB = b.startTime != null
    if (hasA && hasB) {
      const ta =
        a.startTime instanceof Date
          ? a.startTime.getTime()
          : new Date(a.startTime as unknown as string).getTime()
      const tb =
        b.startTime instanceof Date
          ? b.startTime.getTime()
          : new Date(b.startTime as unknown as string).getTime()
      if (ta !== tb) return ta - tb
    }
    if (hasA && !hasB) return -1
    if (!hasA && hasB) return 1
    const orderA = a.raceOrder ?? 0
    const orderB = b.raceOrder ?? 0
    return orderA - orderB
  })
}

function pickFeaturedMainRace(
  races: EventAnalysisData["races"],
  className: string
): (typeof races)[number] | null {
  const mains = races.filter((r) => r.className === className && isEventMainSession(r))
  if (mains.length === 0) return null
  return mains.reduce((best, r) => {
    const ra = getLadderRank(r.raceLabel, r.sessionType, r.sectionHeader)
    const rb = getLadderRank(best.raceLabel, best.sessionType, best.sectionHeader)
    const scoreA = ra ?? -1
    const scoreB = rb ?? -1
    if (scoreA !== scoreB) return scoreA > scoreB ? r : best
    const oa = r.raceOrder ?? -1
    const ob = best.raceOrder ?? -1
    if (oa !== ob) return oa > ob ? r : best
    const ta = r.startTime?.getTime() ?? 0
    const tb = best.startTime?.getTime() ?? 0
    return ta >= tb ? r : best
  })
}

export interface SessionMixSegment {
  key: string
  label: string
  count: number
  pct: number
  colorVar: string
}

export interface ClassWinnerHighlight {
  /** Raw class name from schedule / results (stable key). */
  className: string
  classDisplay: string
  winnerName: string
  /** P2 in the same result set as the class winner (null if not in data). */
  secondPlaceName: string | null
  /** P3 in the same result set as the class winner (null if not in data). */
  thirdPlaceName: string | null
  raceLabel: string
}

/** Body content for the Event Overview class-winner detail modal (imported results). */
export type ClassWinnerModalDetail =
  | {
      kind: "multiMain"
      classLabel: string
      /** Event-level: LiveRC “Completed: X of Y” for the class (all mains run for the schedule). */
      completedMains: number
      totalMains: number
      tieBreaker: string | null
      /** Sorted per-main column keys (A1, A2, A3, …) from all entries’ `mainBreakdown`. */
      mainColumnLabels: string[]
      /** Full class table: overall finishing order with one column per final / main. */
      standingsRows: Array<{
        position: number
        driverName: string
        points: number
        seededPosition: number | null
        mainCells: string[]
        /** True when this row is the class winner the user opened from. */
        highlight: boolean
      }>
    }
  | {
      kind: "featuredMain"
      /** Featured main / final name for this class. */
      sessionRaceLabel: string
      /** All drivers in that main, in finishing order. */
      standingsRows: Array<{
        position: number
        driverName: string
        lapsTimeLine: string | null
        fastLapFormatted: string | null
        highlight: boolean
      }>
    }

/** Same normalization as class-winner modal / LiveRC name matching. */
export function driverNamesMatchForClassWinner(a: string, b: string): boolean {
  const na = a.trim().replace(/\s+/g, " ").toLowerCase()
  const nb = b.trim().replace(/\s+/g, " ").toLowerCase()
  return na === nb
}

function sortMultiMainColumnLabels(labels: string[]): string[] {
  return [...labels].sort((a, b) => {
    const ma = /(\d+)\s*$/.exec(a)
    const mb = /(\d+)\s*$/.exec(b)
    const na = ma ? parseInt(ma[1]!, 10) : 0
    const nb = mb ? parseInt(mb[1]!, 10) : 0
    if (na !== nb) return na - nb
    return a.localeCompare(b, undefined, { sensitivity: "base" })
  })
}

/** LiveRC-style sit-out or empty result cell. */
function isMultiMainCellSitOutOrEmpty(lapsTime: string): boolean {
  const t = lapsTime.trim()
  if (t === "" || t === "—") return true
  return /^0\/0(\.0+)?$/.test(t) || t === "0/0.000"
}

/**
 * One per-main cell for the class standings table: prefer imported laps/total time string;
 * if missing or 0/0, show "—" (sit-out) instead of a misleading P-value.
 */
function formatMultiMainStandingsCell(
  cell: { position: number; points: number; lapsTime: string } | undefined
): string {
  if (!cell) return "—"
  const raw = (cell.lapsTime ?? "").trim()
  if (raw && !isMultiMainCellSitOutOrEmpty(raw)) {
    return raw
  }
  if (isMultiMainCellSitOutOrEmpty(raw)) {
    return "—"
  }
  if (Number.isFinite(cell.position) && cell.position > 0) {
    return `P${cell.position}`
  }
  return "—"
}

function buildMultiMainStandings(
  entries: Array<{
    position: number
    seededPosition: number | null
    driverName: string
    points: number
    mainBreakdown: Record<string, { position: number; points: number; lapsTime: string }> | null
  }>,
  mainColumnLabels: string[],
  highlightName: string
): Array<{
  position: number
  driverName: string
  points: number
  seededPosition: number | null
  mainCells: string[]
  highlight: boolean
}> {
  const byPlace = [...entries].sort((a, b) => a.position - b.position)
  return byPlace.map((e) => ({
    position: e.position,
    driverName: e.driverName,
    points: e.points,
    seededPosition: e.seededPosition,
    mainCells: mainColumnLabels.map((label) =>
      formatMultiMainStandingsCell(e.mainBreakdown?.[label])
    ),
    highlight: driverNamesMatchForClassWinner(e.driverName, highlightName),
  }))
}

/**
 * Resolve imported standings for the class-winner modal: multi-main block (same selection as
 * {@link buildClassWinners}) or featured main P1 race result.
 */
export function resolveClassWinnerModalDetail(
  highlight: ClassWinnerHighlight,
  data: Pick<EventAnalysisData, "races" | "multiMainResults">
): ClassWinnerModalDetail | null {
  const mmCandidates = listMultiMainBlocksForCanonicalClass(
    data.multiMainResults,
    highlight.className
  )
  const mm = pickBestMultiMainBlockForClass(mmCandidates, highlight.className)
  if (mm && mm.entries.length > 0) {
    const sorted = [...mm.entries].sort((a, b) => a.position - b.position)
    const atFirst = sorted.filter((e) => e.position === 1)
    const entry =
      atFirst.find((e) => driverNamesMatchForClassWinner(e.driverName, highlight.winnerName)) ??
      atFirst[0]
    if (entry && entry.position === 1) {
      const labelSet = new Set<string>()
      for (const e of mm.entries) {
        if (e.mainBreakdown) {
          for (const k of Object.keys(e.mainBreakdown)) {
            labelSet.add(k)
          }
        }
      }
      const mainColumnLabels = sortMultiMainColumnLabels([...labelSet])
      const standingsRows = buildMultiMainStandings(
        mm.entries,
        mainColumnLabels,
        highlight.winnerName
      )
      return {
        kind: "multiMain",
        classLabel: mm.classLabel,
        completedMains: mm.completedMains,
        totalMains: mm.totalMains,
        tieBreaker: mm.tieBreaker,
        mainColumnLabels,
        standingsRows,
      }
    }
  }

  const mainRace = pickFeaturedMainRace(data.races, highlight.className)
  if (!mainRace) return null
  const sortedResults = [...mainRace.results].sort((a, b) => a.positionFinal - b.positionFinal)
  const atFirst = sortedResults.filter((r) => r.positionFinal === 1)
  const winner =
    atFirst.find((r) => driverNamesMatchForClassWinner(r.driverName, highlight.winnerName)) ??
    atFirst[0]
  if (!winner || winner.positionFinal !== 1) return null

  const standingsRows = sortedResults.map((r) => ({
    position: r.positionFinal,
    driverName: r.driverName,
    lapsTimeLine:
      r.lapsCompleted > 0 || r.totalTimeSeconds != null
        ? formatLapsSlashTime(r.lapsCompleted, r.totalTimeSeconds)
        : null,
    fastLapFormatted:
      r.fastLapTime != null && Number.isFinite(r.fastLapTime) ? formatLapTime(r.fastLapTime) : null,
    highlight: driverNamesMatchForClassWinner(r.driverName, highlight.winnerName),
  }))

  return {
    kind: "featuredMain",
    sessionRaceLabel: mainRace.raceLabel,
    standingsRows,
  }
}

export interface ClosestFinishHighlight {
  raceLabel: string
  classDisplay: string
  p1Name: string
  p2Name: string
  /** Same-lap clock gap in seconds, or null when 2nd is down lap(s). */
  gapSeconds: number | null
  /** Pre-formatted gap for UI (seconds or e.g. “1 lap”). */
  gapDisplay: string
}

export interface EventHighlightsModel {
  /** True when there is anything worth rendering beyond the practice-day note */
  hasHighlights: boolean
  isPracticeDay: boolean
  sessionMix: SessionMixSegment[]
  /** Entry counts per class (share of event entry list) */
  classMixByDrivers: SessionMixSegment[]
  /** Sum of laps completed in results, grouped by race class */
  classMixByLaps: SessionMixSegment[]
  classWinners: ClassWinnerHighlight[]
  /** Highest event-wide average consistency among drivers with consistency data */
  mostConsistentDriver: {
    driverName: string
    consistency: number
    racesParticipated: number
  } | null
  /** Top three drivers by event-wide average consistency */
  topConsistentDrivers: Array<{
    driverName: string
    consistency: number
    racesParticipated: number
  }>
  /** Lowest event-wide average lap time among drivers with avg lap data */
  fastestAvgLapDriver: {
    driverName: string
    avgLapTime: number
    racesParticipated: number
  } | null
  /** Top three drivers by event-wide average lap time (fastest first) */
  topFastestAvgLapDrivers: Array<{
    driverName: string
    avgLapTime: number
    racesParticipated: number
  }>
  closestFinishes: ClosestFinishHighlight[]
  /** Top three driver/class rows by progression (first→last race in class), best first */
  topProgression: Array<{ driverName: string; classDisplay: string; summary: string }>
  /** Top three drivers by total laps completed across all race results */
  topLapsCompleted: Array<{ driverName: string; totalLaps: number }>
  /** Top three fastest single laps (per race result) across the event */
  topFastLaps: Array<{
    raceResultId: string
    driverName: string
    fastLapTime: number
    raceLabel: string
    classDisplay: string
  }>
}

function uniqueClassesForWinners(
  data: Pick<EventAnalysisData, "races" | "multiMainResults">
): string[] {
  const fromMm = new Set<string>()
  for (const m of data.multiMainResults) {
    const base = baseClassFromMultiMainLabel(m.classLabel)
    if (base) fromMm.add(base)
  }
  const fromRaces = new Set<string>()
  data.races.forEach((r) => {
    if (isEventMainSession(r) && r.className?.trim()) {
      fromRaces.add(r.className.trim())
    }
  })
  const merged = new Set<string>([...fromMm, ...fromRaces])
  return Array.from(merged).sort((a, b) =>
    formatClassName(a).localeCompare(formatClassName(b), undefined, { sensitivity: "base" })
  )
}

/**
 * Counts entry-list rows per trimmed class name (event registration).
 * Used to order highlight cards: most entries first, then class name.
 */
export function classEntryCountByClassName(
  entryList: EventAnalysisData["entryList"] | undefined
): Map<string, number> {
  const counts = new Map<string, number>()
  if (!entryList) return counts
  for (const e of entryList) {
    const c = e.className?.trim()
    if (!c) continue
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return counts
}

function sortClassNamesByEntryCountDesc(
  classNames: string[],
  entryCounts: Map<string, number>
): string[] {
  return [...classNames].sort((a, b) => {
    const ca = entryCounts.get(a.trim()) ?? 0
    const cb = entryCounts.get(b.trim()) ?? 0
    if (cb !== ca) return cb - ca
    return formatClassName(a).localeCompare(formatClassName(b), undefined, {
      sensitivity: "base",
    })
  })
}

/** Same class list as Class Winners (registration classes, or derived from multi-main / mains). */
export function canonicalClassesForClassWinners(
  data: Pick<EventAnalysisData, "races" | "multiMainResults" | "registrationClassNames">
): string[] {
  const reg = (data.registrationClassNames ?? []).map((c) => c.trim()).filter(Boolean)
  if (reg.length > 0) {
    return [...new Set(reg)].sort((a, b) =>
      formatClassName(a).localeCompare(formatClassName(b), undefined, { sensitivity: "base" })
    )
  }
  return uniqueClassesForWinners(data)
}

/**
 * Per-class overall class champion: prefers combined LiveRC multi-main standings when present
 * (registration class list + best matching block; B-main-only splits excluded), else P1 of the
 * featured main for that class. See docs/architecture/event-overview-class-winners-liverc-overall-final-ranking.md
 *
 * When `entryList` is non-empty, cards are ordered by most class entries to fewest, then
 * `classDisplay` (same as Event mix “by entries”).
 */
export function buildClassWinners(
  data: Pick<EventAnalysisData, "races" | "multiMainResults" | "registrationClassNames"> & {
    entryList?: EventAnalysisData["entryList"]
  }
): ClassWinnerHighlight[] {
  const out: ClassWinnerHighlight[] = []
  for (const rawClass of canonicalClassesForClassWinners(data)) {
    const display = formatClassName(rawClass)
    const mmCandidates = listMultiMainBlocksForCanonicalClass(data.multiMainResults, rawClass)
    const mm = pickBestMultiMainBlockForClass(mmCandidates, rawClass)
    if (mm && mm.entries.length > 0) {
      const sorted = [...mm.entries].sort((a, b) => a.position - b.position)
      const first = sorted[0]
      if (first) {
        out.push({
          className: rawClass,
          classDisplay: display,
          winnerName: first.driverName,
          secondPlaceName: sorted[1]?.driverName ?? null,
          thirdPlaceName: sorted[2]?.driverName ?? null,
          raceLabel:
            mm.totalMains > 1
              ? `Overall (${mm.completedMains}/${mm.totalMains} mains)`
              : "Overall standings",
        })
      }
      continue
    }
    const mainRace = pickFeaturedMainRace(data.races, rawClass)
    if (!mainRace) continue
    const winner = mainRace.results.find((x) => x.positionFinal === 1)
    if (!winner) continue
    const second = mainRace.results.find((x) => x.positionFinal === 2)
    const third = mainRace.results.find((x) => x.positionFinal === 3)
    out.push({
      className: rawClass,
      classDisplay: display,
      winnerName: winner.driverName,
      secondPlaceName: second?.driverName ?? null,
      thirdPlaceName: third?.driverName ?? null,
      raceLabel: mainRace.raceLabel,
    })
  }
  if (out.length > 0 && data.entryList && data.entryList.length > 0) {
    const counts = classEntryCountByClassName(data.entryList)
    if (counts.size > 0) {
      return sortClassNamesByEntryCountDesc(
        out.map((h) => h.className),
        counts
      ).map((cn) => out.find((h) => h.className === cn)!)
    }
  }
  return out
}

function buildSessionMix(data: EventAnalysisData): SessionMixSegment[] {
  const counts = new Map<string, number>()
  for (const race of data.races) {
    const key = sessionTypeFilterKeyForRace(race)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const total = data.races.length
  if (total === 0) return []
  const keys = sortSessionTypeFilterKeys(Array.from(counts.keys()))
  return keys.map((key, i) => {
    const count = counts.get(key) ?? 0
    return {
      key,
      label: sessionTypeFilterChipLabel(key),
      count,
      pct: (count / total) * 100,
      colorVar: CHART_COLOR_VARS[i % CHART_COLOR_VARS.length]!,
    }
  })
}

function buildClassMixByDrivers(data: EventAnalysisData): SessionMixSegment[] {
  if (data.entryList.length === 0) return []
  const counts = new Map<string, number>()
  for (const e of data.entryList) {
    const c = e.className?.trim()
    if (!c) continue
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  if (total === 0) return []
  const sorted = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return formatClassName(a[0]).localeCompare(formatClassName(b[0]), undefined, {
      sensitivity: "base",
    })
  })
  return sorted.map(([rawClass, count], i) => ({
    key: rawClass,
    label: formatClassName(rawClass),
    count,
    pct: (count / total) * 100,
    colorVar: CHART_COLOR_VARS[i % CHART_COLOR_VARS.length]!,
  }))
}

function buildClassMixByLaps(data: EventAnalysisData): SessionMixSegment[] {
  const counts = new Map<string, number>()
  for (const race of data.races) {
    const c = race.className?.trim()
    if (!c) continue
    for (const r of race.results) {
      const laps =
        typeof r.lapsCompleted === "number" &&
        Number.isFinite(r.lapsCompleted) &&
        r.lapsCompleted >= 0
          ? r.lapsCompleted
          : 0
      counts.set(c, (counts.get(c) ?? 0) + laps)
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  if (total === 0) return []
  const sorted = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return formatClassName(a[0]).localeCompare(formatClassName(b[0]), undefined, {
      sensitivity: "base",
    })
  })
  return sorted.map(([rawClass, count], i) => ({
    key: rawClass,
    label: formatClassName(rawClass),
    count,
    pct: (count / total) * 100,
    colorVar: CHART_COLOR_VARS[i % CHART_COLOR_VARS.length]!,
  }))
}

/** Top three drivers by event-wide average consistency (see `getEventAnalysisData` aggregates). */
function buildTopConsistentDrivers(
  data: EventAnalysisData
): EventHighlightsModel["topConsistentDrivers"] {
  const withConsistency = data.drivers.filter(
    (d): d is typeof d & { consistency: number } =>
      d.consistency !== null && typeof d.consistency === "number" && Number.isFinite(d.consistency)
  )
  if (withConsistency.length === 0) return []

  const sorted = [...withConsistency].sort((a, b) => {
    if (b.consistency !== a.consistency) return b.consistency - a.consistency
    if (b.racesParticipated !== a.racesParticipated) {
      return b.racesParticipated - a.racesParticipated
    }
    return a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" })
  })
  return sorted.slice(0, 3).map((d) => ({
    driverName: d.driverName,
    consistency: d.consistency,
    racesParticipated: d.racesParticipated,
  }))
}

/** Top three drivers by lowest event-wide average lap (mean of per-race avg laps). */
function buildTopFastestAvgLapDrivers(
  data: EventAnalysisData
): EventHighlightsModel["topFastestAvgLapDrivers"] {
  const withAvg = data.drivers.filter(
    (d): d is typeof d & { avgLapTime: number } =>
      d.avgLapTime !== null &&
      typeof d.avgLapTime === "number" &&
      Number.isFinite(d.avgLapTime) &&
      d.avgLapTime > 0
  )
  if (withAvg.length === 0) return []

  const sorted = [...withAvg].sort((a, b) => {
    if (a.avgLapTime !== b.avgLapTime) return a.avgLapTime - b.avgLapTime
    if (b.racesParticipated !== a.racesParticipated) {
      return b.racesParticipated - a.racesParticipated
    }
    return a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" })
  })
  return sorted.slice(0, 3).map((d) => ({
    driverName: d.driverName,
    avgLapTime: d.avgLapTime,
    racesParticipated: d.racesParticipated,
  }))
}

function buildTopLapsCompleted(data: EventAnalysisData): EventHighlightsModel["topLapsCompleted"] {
  const byDriver = new Map<string, { driverName: string; totalLaps: number }>()
  for (const race of data.races) {
    for (const r of race.results) {
      const laps =
        typeof r.lapsCompleted === "number" &&
        Number.isFinite(r.lapsCompleted) &&
        r.lapsCompleted >= 0
          ? r.lapsCompleted
          : 0
      const key = r.driverId
      const existing = byDriver.get(key)
      if (existing) {
        existing.totalLaps += laps
      } else {
        byDriver.set(key, { driverName: r.driverName, totalLaps: laps })
      }
    }
  }
  const rows = [...byDriver.values()].filter((x) => x.totalLaps > 0)
  rows.sort((a, b) => {
    if (b.totalLaps !== a.totalLaps) return b.totalLaps - a.totalLaps
    return a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" })
  })
  return rows.slice(0, 3)
}

function buildTopFastLaps(data: EventAnalysisData): EventHighlightsModel["topFastLaps"] {
  type Row = {
    raceResultId: string
    driverName: string
    fastLapTime: number
    raceLabel: string
    classDisplay: string
    raceOrder: number
  }
  const rows: Row[] = []
  for (const race of data.races) {
    const classDisplay = formatClassName(race.className)
    const raceOrder = race.raceOrder ?? 0
    for (const r of race.results) {
      if (!lapTimeValid(r.fastLapTime)) continue
      rows.push({
        raceResultId: r.raceResultId,
        driverName: r.driverName,
        fastLapTime: r.fastLapTime,
        raceLabel: race.raceLabel,
        classDisplay,
        raceOrder,
      })
    }
  }
  rows.sort((a, b) => {
    if (a.fastLapTime !== b.fastLapTime) return a.fastLapTime - b.fastLapTime
    const nameCmp = a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" })
    if (nameCmp !== 0) return nameCmp
    if (a.raceOrder !== b.raceOrder) return a.raceOrder - b.raceOrder
    return a.raceResultId.localeCompare(b.raceResultId)
  })
  return rows.slice(0, 3).map((row) => ({
    raceResultId: row.raceResultId,
    driverName: row.driverName,
    fastLapTime: row.fastLapTime,
    raceLabel: row.raceLabel,
    classDisplay: row.classDisplay,
  }))
}

function buildClosestFinishes(data: EventAnalysisData): ClosestFinishHighlight[] {
  type Cand = ClosestFinishHighlight & {
    lapsDown: number
    p2SecondsBehind: number | null
  }
  const candidates: Cand[] = []
  for (const race of data.races) {
    const sorted = [...race.results].sort((a, b) => a.positionFinal - b.positionFinal)
    const p1 = sorted.find((x) => x.positionFinal === 1)
    const p2 = sorted.find((x) => x.positionFinal === 2)
    if (!p1 || !p2) continue
    const metrics = computeP1P2FinishMetrics(p1, p2)
    if (!metrics) continue
    candidates.push({
      raceLabel: race.raceLabel,
      classDisplay: formatClassName(race.className),
      p1Name: p1.driverName,
      p2Name: p2.driverName,
      gapSeconds: metrics.gapSeconds,
      gapDisplay: metrics.gapDisplay,
      lapsDown: metrics.lapsDown,
      p2SecondsBehind: metrics.p2SecondsBehind,
    })
  }
  candidates.sort((a, b) => compareP1P2FinishMetrics(a, b))
  return candidates.slice(0, 3).map(({ lapsDown: _ld, p2SecondsBehind: _sb, ...pub }) => pub)
}

function progressionSummaryLines(posDelta: number, lapDeltaPositive: number | null): string | null {
  const parts: string[] = []
  if (posDelta > 0) {
    parts.push(`+${posDelta} position${posDelta === 1 ? "" : "s"}`)
  }
  if (lapDeltaPositive !== null && lapDeltaPositive > 0) {
    parts.push(`${formatLapTime(lapDeltaPositive)} faster best lap`)
  }
  if (parts.length === 0) return null
  return parts.join(", ")
}

function buildTopProgression(data: EventAnalysisData): EventHighlightsModel["topProgression"] {
  type Row = {
    driverId: string
    driverName: string
    className: string
    races: Array<{ positionFinal: number; fastLapTime: number | null }>
  }
  const byKey = new Map<string, Row>()

  const orderedRaces = sortRacesChronologically(data.races)
  for (const race of orderedRaces) {
    for (const res of race.results) {
      const key = `${res.driverId}\0${race.className}`
      let row = byKey.get(key)
      if (!row) {
        row = {
          driverId: res.driverId,
          driverName: res.driverName,
          className: race.className,
          races: [],
        }
        byKey.set(key, row)
      }
      row.races.push({
        positionFinal: res.positionFinal,
        fastLapTime: res.fastLapTime,
      })
    }
  }

  const candidates: Array<{
    driverName: string
    className: string
    posDelta: number
    lapDelta: number | null
    summary: string
  }> = []

  for (const row of byKey.values()) {
    if (row.races.length < 2) continue
    const first = row.races[0]!
    const last = row.races[row.races.length - 1]!
    const posDelta = first.positionFinal - last.positionFinal
    let lapDelta: number | null = null
    if (lapTimeValid(first.fastLapTime) && lapTimeValid(last.fastLapTime)) {
      lapDelta = first.fastLapTime! - last.fastLapTime!
    }
    const improved = posDelta > 0 || (lapDelta !== null && lapDelta > 0)
    if (!improved) continue

    const lapForSummary = lapDelta !== null && lapDelta > 0 ? lapDelta : null
    const summary = progressionSummaryLines(posDelta, lapForSummary)
    if (summary === null) continue

    candidates.push({
      driverName: row.driverName,
      className: row.className,
      posDelta,
      lapDelta: lapForSummary,
      summary,
    })
  }

  candidates.sort((a, b) => {
    if (b.posDelta !== a.posDelta) return b.posDelta - a.posDelta
    const la = a.lapDelta ?? -1
    const lb = b.lapDelta ?? -1
    if (lb !== la) return lb - la
    return a.driverName.localeCompare(b.driverName, undefined, { sensitivity: "base" })
  })

  return candidates.slice(0, 3).map((c) => ({
    driverName: c.driverName,
    classDisplay: formatClassName(c.className),
    summary: c.summary,
  }))
}

/**
 * Build highlight model for Event Overview. Safe to call on every render (pure).
 */
export function buildEventHighlights(data: EventAnalysisData): EventHighlightsModel {
  const isPracticeDay = data.isPracticeDay === true
  const sessionMix = buildSessionMix(data)
  const classMixByDrivers = buildClassMixByDrivers(data)
  const classMixByLaps = buildClassMixByLaps(data)
  const classWinners = buildClassWinners(data)
  const topConsistentDrivers = buildTopConsistentDrivers(data)
  const mostConsistentDriver = topConsistentDrivers[0] ?? null
  const topFastestAvgLapDrivers = buildTopFastestAvgLapDrivers(data)
  const fastestAvgLapDriver = topFastestAvgLapDrivers[0] ?? null
  const closestFinishes = buildClosestFinishes(data)
  const topProgression = buildTopProgression(data)
  const topLapsCompleted = buildTopLapsCompleted(data)
  const topFastLaps = buildTopFastLaps(data)

  const hasHighlights =
    classWinners.length > 0 ||
    mostConsistentDriver != null ||
    fastestAvgLapDriver != null ||
    closestFinishes.length > 0 ||
    topProgression.length > 0 ||
    topLapsCompleted.length > 0 ||
    topFastLaps.length > 0

  return {
    hasHighlights,
    isPracticeDay,
    sessionMix,
    classMixByDrivers,
    classMixByLaps,
    classWinners,
    mostConsistentDriver,
    topConsistentDrivers,
    fastestAvgLapDriver,
    topFastestAvgLapDrivers,
    closestFinishes,
    topProgression,
    topLapsCompleted,
    topFastLaps,
  }
}

export function formatClosestFinishGap(h: ClosestFinishHighlight): string {
  return h.gapDisplay
}
