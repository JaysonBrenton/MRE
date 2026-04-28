/**
 * @fileoverview Rich session name for Session Analysis table (round, race # in round, class, heat).
 */

import type { SessionData } from "@/core/events/get-sessions-data"
import { formatClassName } from "@/lib/format-class-name"

/** Fields required to build the composite session/race label (SessionData and event races both satisfy this). */
export type SessionLabelInput = Pick<
  SessionData,
  "id" | "raceLabel" | "className" | "sectionHeader" | "startTime" | "raceOrder"
>

/** LiveRC-style section heading → short prefix (e.g. Qualifier Round 1 → Q1). */
export function abbreviateSectionHeader(sectionHeader: string | null | undefined): string | null {
  const t = sectionHeader?.trim()
  if (!t) return null

  let m = t.match(/qualifier\s+round\s+(\d+)/i)
  if (m?.[1]) return `Q${m[1]}`

  m = t.match(/seeding\s+round\s+(\d+)/i)
  if (m?.[1]) return `S${m[1]}`

  if (/main\s+events?/i.test(t)) return "Mains"
  if (/^practice$/i.test(t)) return "Practice"

  return null
}

export function parseHeatFractionFromLabel(raceLabel: string): { n: number; d: number } | null {
  const m = raceLabel.match(/\(?Heat\s+(\d+)\s*\/\s*(\d+)\)?/i)
  if (!m?.[1] || !m?.[2]) return null
  const n = Number.parseInt(m[1], 10)
  const d = Number.parseInt(m[2], 10)
  if (!Number.isFinite(n) || !Number.isFinite(d) || n < 1 || d < 1) return null
  return { n, d }
}

function sessionSortKey(s: SessionLabelInput): number {
  const ms = s.startTime?.getTime()
  if (ms != null && !Number.isNaN(ms)) return ms
  if (s.raceOrder != null && Number.isFinite(s.raceOrder)) return s.raceOrder * 1e15
  return Number.MAX_SAFE_INTEGER
}

function isHeatLikeSession(s: SessionLabelInput): boolean {
  if (/\bheat\b/i.test(s.raceLabel)) return true
  return parseHeatFractionFromLabel(s.raceLabel) !== null
}

function orderedHeatCohortForRoundClass(
  session: SessionLabelInput,
  contextSessions: SessionLabelInput[]
): SessionLabelInput[] | null {
  const sh = session.sectionHeader?.trim() ?? ""
  const cn = session.className?.trim() ?? ""
  const cohort = contextSessions.filter(
    (s) => (s.sectionHeader?.trim() ?? "") === sh && (s.className?.trim() ?? "") === cn
  )
  const heatCohort = cohort.filter(isHeatLikeSession)
  if (heatCohort.length < 2) return null
  return [...heatCohort].sort((a, b) => {
    const ka = sessionSortKey(a)
    const kb = sessionSortKey(b)
    if (ka !== kb) return ka - kb
    const ro = (a.raceOrder ?? 0) - (b.raceOrder ?? 0)
    if (ro !== 0) return ro
    return (a.raceLabel || "").localeCompare(b.raceLabel || "", undefined, {
      numeric: true,
      sensitivity: "base",
    })
  })
}

/**
 * When several heats exist for the same LiveRC round + class, use schedule order and cohort size
 * so denominators match the block (e.g. three Q3 heats → "of 3"), not a stale/wrong (Heat 1/7).
 */
function heatPhraseForSession(
  session: SessionLabelInput,
  contextSessions: SessionLabelInput[]
): string | null {
  const orderedHeats = orderedHeatCohortForRoundClass(session, contextSessions)
  if (orderedHeats) {
    const idx = orderedHeats.findIndex((s) => s.id === session.id)
    if (idx < 0) return null
    return `(Heat ${idx + 1} of ${orderedHeats.length})`
  }

  const parsed = parseHeatFractionFromLabel(session.raceLabel)
  if (parsed) return `(Heat ${parsed.n} of ${parsed.d})`
  return null
}

/**
 * 1-based index among all sessions in the same LiveRC round (`sectionHeader`), in schedule order.
 * Matches LiveRC "Race N" / "Race N of M" within a block (e.g. Qualifier Round 1 → 12 races).
 */
export function computeSessionIndexInRound(
  contextSessions: SessionLabelInput[],
  session: SessionLabelInput
): { index: number; total: number } | null {
  const sh = session.sectionHeader?.trim() ?? ""
  const cohort = contextSessions.filter((s) => (s.sectionHeader?.trim() ?? "") === sh)
  if (cohort.length <= 1) return null

  const sorted = [...cohort].sort((a, b) => {
    const ka = sessionSortKey(a)
    const kb = sessionSortKey(b)
    if (ka !== kb) return ka - kb
    const ro = (a.raceOrder ?? 0) - (b.raceOrder ?? 0)
    if (ro !== 0) return ro
    return (a.raceLabel || "").localeCompare(b.raceLabel || "", undefined, {
      numeric: true,
      sensitivity: "base",
    })
  })

  const idx = sorted.findIndex((s) => s.id === session.id)
  if (idx < 0) return null
  return { index: idx + 1, total: sorted.length }
}

function buildHead(
  round: string | null,
  pos: { index: number; total: number } | null
): string | null {
  const parts: string[] = []
  if (round) parts.push(round)
  if (pos && pos.total > 1) parts.push(`[${pos.index}/${pos.total}]`)
  return parts.length > 0 ? parts.join(" ") : null
}

function raceLabelRedundantWithClass(raceLabel: string, className: string, classFormatted: string) {
  const rl = raceLabel.trim().toLowerCase()
  if (!rl) return true
  if (rl === className.trim().toLowerCase()) return true
  if (rl === classFormatted.toLowerCase()) return true
  return false
}

/**
 * @param contextSessions Full event sessions so [i/n] is race index / race count within the round (LiveRC-style).
 */
export function formatSessionRaceDisplayLabel(
  session: SessionLabelInput,
  contextSessions: SessionLabelInput[]
): string {
  const round = abbreviateSectionHeader(session.sectionHeader)
  const pos = computeSessionIndexInRound(contextSessions, session)
  const head = buildHead(round, pos)
  const cls = formatClassName(session.className)
  const heatPart = heatPhraseForSession(session, contextSessions)

  let label: string
  if (head && heatPart) label = `${head} - ${cls} ${heatPart}`
  else if (head && !heatPart) {
    if (raceLabelRedundantWithClass(session.raceLabel, session.className, cls)) {
      label = `${head} - ${cls}`
    } else {
      label = `${head} - ${cls} - ${session.raceLabel.trim()}`
    }
  } else if (!head && heatPart) label = `${cls} ${heatPart}`
  else label = session.raceLabel

  return label.replace(/\u2014/g, "-")
}

export function buildSessionDisplayLabelLookup(
  contextSessions: SessionLabelInput[]
): Map<string, string> {
  const map = new Map<string, string>()
  for (const s of contextSessions) {
    map.set(s.id, formatSessionRaceDisplayLabel(s, contextSessions))
  }
  return map
}
