/**
 * LiveRC-authored stats stored on race_results.raw_fields_json (ingestion only; not computed in MRE).
 */

export interface LiveRcRaceResultStats {
  avgTop5: number | null
  avgTop10: number | null
  avgTop15: number | null
  top2Consecutive: number | null
  top3Consecutive: number | null
  stdDeviation: number | null
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Narrow Prisma Json / API unknown to LiveRC stats. Unknown keys ignored.
 */
export function parseLiveRcRaceResultStats(raw: unknown): LiveRcRaceResultStats | null {
  if (raw === null || raw === undefined) {
    return null
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return null
  }
  const o = raw as Record<string, unknown>
  const avgTop5 = num(o.avg_top_5)
  const avgTop10 = num(o.avg_top_10)
  const avgTop15 = num(o.avg_top_15)
  const top2Consecutive = num(o.top_2_consecutive)
  const top3Consecutive = num(o.top_3_consecutive)
  const stdDeviation = num(o.std_deviation)

  const hasAny =
    avgTop5 !== null ||
    avgTop10 !== null ||
    avgTop15 !== null ||
    top2Consecutive !== null ||
    top3Consecutive !== null ||
    stdDeviation !== null

  if (!hasAny) {
    return null
  }

  return {
    avgTop5,
    avgTop10,
    avgTop15,
    top2Consecutive,
    top3Consecutive,
    stdDeviation,
  }
}
