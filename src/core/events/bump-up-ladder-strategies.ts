/**
 * @fileoverview Tier ranking for bump-up inference: bracket-style finals, Main Events scoping.
 *
 * @see docs/plans/bump-ups-liverc-main-events-solution.md
 */

import { parseMainBracketLeg } from "./main-bracket-overall"

/** LiveRC "Main Events" heat sheet section (case-insensitive). */
export function isMainEventsSection(sectionHeader: string | null | undefined): boolean {
  const s = (sectionHeader ?? "").trim().toLowerCase()
  return s.includes("main event")
}

/**
 * Parse bracket finals like "Buggy 1/4 Odd Final" or "Buggy 1/1 Even Final".
 * Returns denominator of the fraction (16, 8, 4, 2, 1) — smaller denominator = closer to championship.
 */
export function parseBracketFinalDenominator(raceLabel: string): number | null {
  const L = raceLabel.trim()
  if (!/\bfinal\b/i.test(L)) return null
  // Require bracket fraction + Final (excludes "Heat 1/7" — no Final)
  const m = /\b(\d+)\s*\/\s*(\d+)\s*(?:even|odd)?\s*final\b/i.exec(L)
  if (!m) return null
  const num = parseInt(m[1]!, 10)
  const denom = parseInt(m[2]!, 10)
  if (!Number.isFinite(denom) || denom < 1) return null
  // Typical pattern is 1/n (numerator 1); allow small numerators only
  if (num > 4) return null
  const allowed = new Set([1, 2, 4, 8, 16, 32])
  if (!allowed.has(denom)) return null
  return denom
}

/**
 * Rank for bracket finals: higher = closer to championship (1/1).
 * Uses scale disjoint from lettered ladder (A=8 …) so strategies do not mix across unrelated labels.
 */
export function getBracketFinalLadderRank(
  raceLabel: string,
  sectionHeader: string | null,
  sessionType: string | null
): number | null {
  const denom = parseBracketFinalDenominator(raceLabel)
  if (denom == null) return null

  const L = raceLabel.toLowerCase()
  if (/(qualif|seed|practice|timed\s*practice)/i.test(L) && !/\bfinal\b/i.test(L)) return null
  const st = (sessionType ?? "").toLowerCase()
  if (st === "practice" || st === "seeding" || (st.includes("qualif") && !/\bfinal\b/i.test(L))) {
    return null
  }

  // "Semi … Practice" rows are not championship bracket finals
  if (/\bsemi\b/i.test(L) && /practice/i.test(L)) return null

  // Scope to Main Events when section is present (avoid qualifier-round noise)
  if (sectionHeader && sectionHeader.trim() !== "" && !isMainEventsSection(sectionHeader)) {
    return null
  }

  // denom 16 -> 60, 8 -> 70, 4 -> 80, 2 -> 90, 1 -> 100
  const log = Math.log2(denom)
  const base = 100 - log * 10

  const branch = /\bodd\b/i.test(raceLabel) ? 0.02 : /\beven\b/i.test(raceLabel) ? 0.01 : 0
  return base + branch
}
