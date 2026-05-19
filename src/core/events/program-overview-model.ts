/**
 * Schedule-oriented program flow model for Event Level Analysis —
 * phases (practice → seeding → qualifying → heats → miscellaneous rows) feeding
 * one or more **main** finals. Edges denote **scheduled program order**, not
 * bump-through mains progression (contrast {@link buildMainBracketLadderModel}).
 */

import type { EventAnalysisData } from "./get-event-analysis-data"
import { isEventMainSession } from "./main-bracket-overall"
import { sessionTypeFilterChipLabel, sessionTypeFilterKeyForRace } from "./session-type-filter"

type RaceSummary = EventAnalysisData["races"][number]

const PHASE_BUCKET_ORDER = ["practice", "seeding", "qualifying", "heat", "race"] as const

type PracticeBucketPhase = (typeof PHASE_BUCKET_ORDER)[number]

function labelLooksLikeScheduleBreakOrPlaceholder(text: string): boolean {
  if (/\*{3,}/.test(text)) return true
  const L = text.toLowerCase()
  if (/\bintermission\b/.test(L)) return true
  if (/\b(?:\d+\s*)?min(?:ute)?s?\s*break\b/.test(L)) return true
  return false
}

function excludeFromProgramFlow(race: RaceSummary): boolean {
  const label = race.raceLabel?.trim() ?? ""
  const cn = race.className?.trim() ?? ""
  for (const t of [label, cn]) {
    if (!t) continue
    if (labelLooksLikeScheduleBreakOrPlaceholder(t)) return true
  }
  return false
}

/** Drops LiveRC heat-sheet boilerplate tails (Length / Timed / Status). */
export function shortenProgramOverviewRaceTitle(raceLabel: string): string {
  let t = raceLabel.trim()
  if (!t.length) return t

  const cutAt = (s: string, re: RegExp): string => {
    const match = re.exec(s)
    if (!match || match.index == null || match.index <= 0) return s
    return s.slice(0, match.index).trim()
  }
  t = cutAt(t, /\s+Length\s*:/i)
  t = cutAt(t, /\s+Timed\b/i)
  t = cutAt(t, /\s+Status\s*:/i)
  return t.trim() || raceLabel.trim()
}

function bucketPracticeFamily(key: string): PracticeBucketPhase {
  const k = key.toLowerCase()
  if (k === "practiceday" || k === "practice") return "practice"
  if (PHASE_BUCKET_ORDER.includes(k as PracticeBucketPhase)) return k as PracticeBucketPhase
  return "race"
}

function phaseAggregateTitle(key: PracticeBucketPhase): string {
  if (key === "practice") return "Practice"
  return sessionTypeFilterChipLabel(key === "race" ? "race" : key === "heat" ? "heat" : key)
}

export interface ProgramOverviewSessionPreview {
  id: string
  raceLabelRaw: string
  raceLabelShort: string
  raceUrl: string
  raceOrder: number | null
  startTime: Date | null
}

export interface ProgramOverviewPhaseAggregate {
  phaseKey: PracticeBucketPhase
  title: string
  sessions: ProgramOverviewSessionPreview[]
}

export type ProgramOverviewMainPreview = ProgramOverviewSessionPreview

export interface ProgramOverviewModel {
  className: string
  aggregates: ProgramOverviewPhaseAggregate[]
  mains: ProgramOverviewMainPreview[]
}

function compareRaceChronological(a: RaceSummary, b: RaceSummary): number {
  const oa = a.raceOrder
  const ob = b.raceOrder
  if (oa != null && ob != null && oa !== ob) return oa - ob
  if (oa != null && ob == null) return -1
  if (oa == null && ob != null) return 1

  const sa = a.startTime?.getTime() ?? NaN
  const sb = b.startTime?.getTime() ?? NaN
  if (Number.isFinite(sa) && Number.isFinite(sb) && sa !== sb) return sa - sb
  if (Number.isFinite(sa) && !Number.isFinite(sb)) return -1
  if (!Number.isFinite(sa) && Number.isFinite(sb)) return 1

  const la = a.raceLabel?.trim() ?? ""
  const lb = b.raceLabel?.trim() ?? ""
  return la.localeCompare(lb, undefined, { numeric: true, sensitivity: "base" })
}

function toPreview(r: RaceSummary): ProgramOverviewSessionPreview {
  const raw = r.raceLabel?.trim() ?? r.id
  return {
    id: r.id,
    raceLabelRaw: raw,
    raceLabelShort: shortenProgramOverviewRaceTitle(raw),
    raceUrl: r.raceUrl,
    raceOrder: r.raceOrder,
    startTime: r.startTime,
  }
}

/** Null when nothing schedule-like exists for the class after filtering. */
export function buildProgramOverviewModel(
  data: EventAnalysisData,
  className: string | null
): ProgramOverviewModel | null {
  const resolved = className?.trim()
  if (!resolved) return null

  const candidates = data.races.filter(
    (r) => !excludeFromProgramFlow(r) && r.className?.trim() === resolved
  )
  if (candidates.length === 0) return null

  const aggregatesByBucket = new Map<PracticeBucketPhase, RaceSummary[]>()
  const mains: RaceSummary[] = []

  for (const race of candidates) {
    if (isEventMainSession(race)) {
      mains.push(race)
      continue
    }
    const key = sessionTypeFilterKeyForRace(race)
    const bucket = bucketPracticeFamily(key)
    const list = aggregatesByBucket.get(bucket) ?? []
    list.push(race)
    aggregatesByBucket.set(bucket, list)
  }

  const aggregates: ProgramOverviewPhaseAggregate[] = []
  for (const phaseKey of PHASE_BUCKET_ORDER) {
    const races = aggregatesByBucket.get(phaseKey)
    if (!races || races.length === 0) continue
    races.sort(compareRaceChronological)
    aggregates.push({
      phaseKey,
      title: phaseAggregateTitle(phaseKey),
      sessions: races.map(toPreview),
    })
  }

  mains.sort(compareRaceChronological)

  if (aggregates.length === 0 && mains.length === 0) return null

  return {
    className: resolved,
    aggregates,
    mains: mains.map(toPreview),
  }
}

export interface ProgramLayoutNode {
  id: string
  kind: "aggregate" | "main"
  phaseKey?: PracticeBucketPhase
  sessionId?: string
  x: number
  y: number
  width: number
  height: number
  titleLines: string[]
  subtitleLines: string[]
}

export interface ProgramLayoutEdge {
  id: string
  d: string
  label: string
}

export interface ProgramOverviewLayout {
  width: number
  height: number
  tierGap: number
  nodes: ProgramLayoutNode[]
  edges: ProgramLayoutEdge[]
}

const NODE_WIDTH = 188
const NODE_HEIGHT = 82
const COL_GAP = NODE_WIDTH + 56
const CANVAS_PAD_X = 44
const CANVAS_PAD_Y = 36
const CANVAS_MIN_INNER_H = 228
const MAIN_STACK_GAP = 14

function wrapTitle(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const w = text.trim()
  if (!w) return []
  if (w.length <= maxCharsPerLine) return [w]

  const words = w.split(/\s+/)
  const lines: string[] = []
  let cur = ""
  for (const token of words) {
    const next = cur.length ? `${cur} ${token}` : token
    if (next.length <= maxCharsPerLine) {
      cur = next
      continue
    }
    if (cur) {
      lines.push(cur)
      if (lines.length >= maxLines) {
        lines[maxLines - 1] =
          lines[maxLines - 1]!.slice(0, Math.max(1, maxCharsPerLine - 1)).trimEnd() + "…"
        return lines
      }
    }
    cur = token.length > maxCharsPerLine ? token.slice(0, maxCharsPerLine - 1) + "…" : token
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  return lines
}

/** Horizontal phase columns with parallel mains stacked in the last column when present. */
export function computeProgramOverviewLayout(
  model: ProgramOverviewModel | null
): ProgramOverviewLayout | null {
  if (!model) return null

  const aggregates = model.aggregates
  const mains = model.mains

  const nAgg = aggregates.length

  let totalColsUsed = 0
  if (nAgg > 0) totalColsUsed = nAgg + (mains.length > 0 ? 1 : 0)
  else if (mains.length > 0) totalColsUsed = 1

  if (totalColsUsed === 0) return null

  const mainsColIdx = Math.max(0, nAgg)

  const mainStackHeight =
    mains.length === 0
      ? 0
      : mains.length * NODE_HEIGHT + Math.max(0, mains.length - 1) * MAIN_STACK_GAP
  const innerHeight = Math.max(NODE_HEIGHT, mainStackHeight, CANVAS_MIN_INNER_H)
  const height = CANVAS_PAD_Y * 2 + innerHeight

  let width = CANVAS_PAD_X * 2 + Math.max(0, totalColsUsed - 1) * COL_GAP + NODE_WIDTH

  /** Mains-only: single timeline column stays compact horizontally. */
  if (aggregates.length === 0 && mains.length > 0) {
    width = CANVAS_PAD_X * 2 + NODE_WIDTH
  }

  const aggCenterY = CANVAS_PAD_Y + innerHeight / 2 - NODE_HEIGHT / 2
  const mainYs: number[] = []
  if (mains.length > 0) {
    const stackTop = CANVAS_PAD_Y + (innerHeight - mainStackHeight) / 2
    for (let i = 0; i < mains.length; i++) {
      mainYs.push(stackTop + i * (NODE_HEIGHT + MAIN_STACK_GAP))
    }
  }

  const nodes: ProgramLayoutNode[] = []

  aggregates.forEach((agg, idx) => {
    const cx = CANVAS_PAD_X + idx * COL_GAP
    nodes.push({
      id: `phase:${agg.phaseKey}`,
      kind: "aggregate",
      phaseKey: agg.phaseKey,
      x: cx,
      y: aggCenterY,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      titleLines: wrapTitle(agg.title, 22, 2),
      subtitleLines: [`${agg.sessions.length} session${agg.sessions.length === 1 ? "" : "s"}`],
    })
  })

  mains.forEach((m, idx) => {
    const mx = aggregates.length === 0 ? CANVAS_PAD_X : CANVAS_PAD_X + mainsColIdx * COL_GAP
    const my = mains.length <= 1 ? aggCenterY : (mainYs[idx] ?? aggCenterY)
    const tl = shortenProgramOverviewRaceTitle(m.raceLabelRaw)
    nodes.push({
      id: `main:${m.id}`,
      kind: "main",
      sessionId: m.id,
      x: mx,
      y: my,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      titleLines: wrapTitle(tl, 26, 2),
      subtitleLines: [],
    })
  })

  const edges: ProgramLayoutEdge[] = []
  const nodeRight = (n: ProgramLayoutNode) => n.x + NODE_WIDTH
  const aggNodes = nodes.filter((n) => n.kind === "aggregate")
  const mainNodes = nodes.filter((n) => n.kind === "main")

  for (let i = 0; i < aggNodes.length - 1; i++) {
    const from = aggNodes[i]!
    const to = aggNodes[i + 1]!
    const y1 = from.y + NODE_HEIGHT / 2
    const y2 = to.y + NODE_HEIGHT / 2
    const x1 = nodeRight(from)
    const x2 = to.x
    const mid = (x1 + x2) / 2
    const d = `M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`
    edges.push({
      id: `${from.id}->${to.id}`,
      d,
      label: "Scheduled phase order",
    })
  }

  if (aggNodes.length > 0 && mainNodes.length > 0) {
    const from = aggNodes[aggNodes.length - 1]!
    const xr = nodeRight(from)
    const yf = from.y + NODE_HEIGHT / 2
    mainNodes.forEach((to, idx) => {
      const xl = to.x
      const yt = to.y + NODE_HEIGHT / 2
      const mid = (xr + xl) / 2
      edges.push({
        id: `${from.id}->fan-${idx}`,
        d: `M ${xr} ${yf} H ${mid} V ${yt} H ${xl}`,
        label: "Program feeds main finals",
      })
    })
  }

  return { width, height, tierGap: COL_GAP, nodes, edges }
}
