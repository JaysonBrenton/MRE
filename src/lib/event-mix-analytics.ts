/**
 * @fileoverview Pure helpers for Event mix UI (percents, copy, formatting)
 */

import type { SessionMixSegment } from "@/core/events/build-event-highlights"

export type MixInsightMetric = "session" | "drivers" | "laps"

export function formatMixInteger(value: number): string {
  if (!Number.isFinite(value)) return "—"
  return Math.round(value).toLocaleString("en-US")
}

/** Safe percentage of `part` of `total`; 0 when total is 0 or invalid. */
export function safePctPart(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0
  return (part / total) * 100
}

/** For display — one decimal, bounded. */
export function formatPctOneDecimal(pct: number): string {
  if (!Number.isFinite(pct)) return "—"
  return `${pct.toFixed(1)}%`
}

export function plural(count: number, singular: string, pluralForm: string): string {
  const n = Math.abs(Math.trunc(count))
  return n === 1 ? singular : pluralForm
}

export function sessionsWord(n: number): string {
  return `${formatMixInteger(n)} ${plural(n, "session", "sessions")}`
}

export function driversWord(n: number): string {
  return `${formatMixInteger(n)} ${plural(n, "driver", "drivers")}`
}

export function lapsWord(n: number): string {
  return `${formatMixInteger(n)} ${plural(n, "lap", "laps")}`
}

/** Sort segments by count desc, then label. */
export function rankSegmentsDesc(segments: SessionMixSegment[]): SessionMixSegment[] {
  return [...segments].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  })
}

export function dominantLineForSessionSummary(segments: SessionMixSegment[]): string {
  if (segments.length === 0) return "No sessions yet."
  const ranked = rankSegmentsDesc(segments)
  const top = ranked[0]!
  if (segments.length === 1) {
    return `${top.label} only`
  }
  const second = ranked[1]!
  if (top.count > second.count) {
    if (top.key === "main") return "Main sessions dominate"
    return `${top.label} sessions are most common`
  }
  return `Tied largest share (${top.label} and ${second.label})`
}

export function insightForMetric(
  metric: MixInsightMetric,
  sessionMix: SessionMixSegment[],
  classMixByDrivers: SessionMixSegment[],
  classMixByLaps: SessionMixSegment[]
): string {
  if (metric === "session") {
    if (sessionMix.length === 0) return "No session mix data for this event."
    const ranked = rankSegmentsDesc(sessionMix)
    const top = ranked[0]!
    return `${top.label} sessions make up ${formatPctOneDecimal(top.pct)} of this event.`
  }
  if (metric === "drivers") {
    if (classMixByDrivers.length === 0) return "No driver counts by class for this event."
    const top = rankSegmentsDesc(classMixByDrivers)[0]!
    const cls = displayClassLabel(top.label, top.key)
    return `${cls} has the largest field with ${driversWord(top.count)} (${formatPctOneDecimal(top.pct)} of entries).`
  }
  if (classMixByLaps.length === 0) return "No laps-by-class totals for this event."
  const top = rankSegmentsDesc(classMixByLaps)[0]!
  const cls = displayClassLabel(top.label, top.key)
  return `${cls} accounts for the most completed laps (${lapsWord(top.count)}; ${formatPctOneDecimal(top.pct)} of total laps).`
}

function displayClassLabel(label: string, fallbackKey: string): string {
  const t = label.trim()
  if (t) return t
  const k = fallbackKey.trim()
  return k || "—"
}

/** CSS variable token for semantic session bucket colours (aligned with session-type-filter keys). */
export function sessionTypeColorVar(sessionKey: string): string {
  const k = sessionKey.toLowerCase()
  switch (k) {
    case "main":
      return "var(--token-chart-series-1)"
    case "qualifying":
      return "var(--token-chart-series-3)"
    case "heat":
      return "var(--token-chart-series-2)"
    case "practice":
      return "var(--token-chart-series-5)"
    case "practiceday":
      return "var(--token-chart-series-4)"
    case "seeding":
      return "var(--token-chart-series-9)"
    case "race":
      return "var(--token-chart-series-6)"
    default:
      return "var(--token-chart-series-8)"
  }
}
