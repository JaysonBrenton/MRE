/**
 * Per-main participation vs event-level “mains completed” for triple/double main standings.
 * See docs/architecture/event-overview-class-winners-liverc-overall-final-ranking.md §7.5.
 */

/**
 * True when a multi-main cell indicates the driver did **not** run that main (DNS / sit-out).
 * Common in RC when the overall is already decided before the last main — the driver may skip
 * A3; LiveRC often shows `0/0.000` or an empty cell for that main.
 */
export function isMultiMainCellSitOut(lapsTimeRaw: string | undefined | null): boolean {
  const t = lapsTimeRaw?.trim() ?? ""
  if (t === "") return true
  const compact = t.replace(/\s+/g, " ").trim()
  const lower = compact.toLowerCase()
  if (lower.includes("(dns")) return true
  if (/\bdns\b/i.test(compact)) return true
  // Zero laps and zero elapsed time (typical DNS line)
  if (/^0+\s*\/\s*0+(?:\.\d+)?(?:\s*\([^)]*\))?$/i.test(compact)) return true
  return false
}

/**
 * Count main columns where the driver has a non–sit-out result (actually ran the main).
 */
export function countDriverParticipatedMains(
  rawLapsTimes: Array<string | undefined | null>
): number {
  let n = 0
  for (const raw of rawLapsTimes) {
    if (!isMultiMainCellSitOut(raw)) n += 1
  }
  return n
}
