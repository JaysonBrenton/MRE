/**
 * Helpers for deriving overall class winners from LiveRC multi-main standings rows.
 * Aligns with docs/architecture/event-overview-class-winners-liverc-overall-final-ranking.md:
 * one winner per registration class; B-main-only / per-main split pages are not used for overall.
 */

import type { EventAnalysisData } from "./get-event-analysis-data"

/** e.g. "1/8 " prefix on some LiveRC class labels */
const SCALE_PREFIX = /^\d+\/\d+\s*/i

/** "Ep Buggy Triple A-Main", "1/8 Buggy Double B-Main" → base vehicle/class name */
const TRIPLE_DOUBLE_MAIN_SUFFIX = /\s+(?:Triple|Double)\s+[AB]-Main$/i
/** Single " A-Main" / " B-Main" suffix (after triple/double stripped) */
const SINGLE_MAIN_SUFFIX = /\s+[AB]-Main$/i

/**
 * Strip the same leading scale segment as {@link baseClassFromMultiMainLabel} so
 * registration names like "1/8 EP Buggy" match multi-main bases like "Ep Buggy".
 */
export function canonicalClassBaseForWinnerMatch(canonicalClass: string): string {
  return canonicalClass.trim().replace(SCALE_PREFIX, "").trim()
}

/**
 * Strip LiveRC multi-main link labels down to the registration-style class name
 * (e.g. "Ep Buggy Triple A-Main" → "Ep Buggy").
 */
export function baseClassFromMultiMainLabel(classLabel: string): string {
  let s = classLabel.trim().replace(SCALE_PREFIX, "").trim()
  s = s.replace(TRIPLE_DOUBLE_MAIN_SUFFIX, "")
  s = s.replace(SINGLE_MAIN_SUFFIX, "")
  return s.trim()
}

/**
 * True if this multi-main block is a B-main-only (or otherwise main-split) results page.
 * Winners there are per-race results, not the overall class champion row.
 */
export function isMainSplitOnlyLabel(classLabel: string): boolean {
  const s = classLabel.trim()
  if (/\bTriple\s+B-Main\b/i.test(s)) return true
  if (/\bDouble\s+B-Main\b/i.test(s)) return true
  if (/\bB-Main\b/i.test(s) && !/\bA-Main\b/i.test(s)) return true
  return false
}

export type MultiMainBlock = EventAnalysisData["multiMainResults"][number]

/**
 * Among multi-main rows for the same base class, prefer the combined overall standings
 * table (typically more rows than a single-main split). Excludes B-main-only pages.
 * If only B-main (or other split) blocks exist, returns null so callers can fall back to P1 of a main race.
 */
export function pickBestMultiMainBlockForClass(
  blocks: MultiMainBlock[],
  canonicalClass: string
): MultiMainBlock | null {
  if (blocks.length === 0) return null
  const canon = canonicalClass.trim().toLowerCase()
  const canonBase = canonicalClassBaseForWinnerMatch(canonicalClass).toLowerCase()
  const overallCandidates = blocks.filter((b) => !isMainSplitOnlyLabel(b.classLabel))
  const pool = overallCandidates.length > 0 ? overallCandidates : []

  if (pool.length === 0) return null

  const sorted = [...pool].sort((a, b) => {
    const na = a.entries?.length ?? 0
    const nb = b.entries?.length ?? 0
    if (nb !== na) return nb - na
    const labelRank = (classLabel: string) => {
      const t = classLabel.trim().toLowerCase()
      if (t === canon) return 2
      if (baseClassFromMultiMainLabel(classLabel).toLowerCase() === canonBase) return 1
      return 0
    }
    const aExact = labelRank(a.classLabel)
    const bExact = labelRank(b.classLabel)
    if (bExact !== aExact) return bExact - aExact
    return a.classLabel.localeCompare(b.classLabel, undefined, { sensitivity: "base" })
  })
  return sorted[0] ?? null
}

export function multiMainBlockMatchesCanonicalClass(
  mm: MultiMainBlock,
  canonicalClass: string
): boolean {
  const base = baseClassFromMultiMainLabel(mm.classLabel)
  const canonBase = canonicalClassBaseForWinnerMatch(canonicalClass)
  return base.localeCompare(canonBase, undefined, { sensitivity: "base" }) === 0
}

export function listMultiMainBlocksForCanonicalClass(
  multiMainResults: EventAnalysisData["multiMainResults"],
  canonicalClass: string
): MultiMainBlock[] {
  return multiMainResults.filter((m) => multiMainBlockMatchesCanonicalClass(m, canonicalClass))
}
