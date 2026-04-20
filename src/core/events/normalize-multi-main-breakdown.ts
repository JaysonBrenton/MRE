/**
 * Multi-main `main_breakdown_json` from ingestion uses snake_case (`laps_time`);
 * EventAnalysisData uses camelCase (`lapsTime`). Normalize at the API boundary.
 */

export function normalizeMultiMainBreakdownJson(
  raw: unknown
): Record<string, { position: number; points: number; lapsTime: string }> | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null
  }
  const src = raw as Record<string, unknown>
  const out: Record<string, { position: number; points: number; lapsTime: string }> = {}
  for (const [key, val] of Object.entries(src)) {
    if (val == null || typeof val !== "object" || Array.isArray(val)) continue
    const v = val as Record<string, unknown>
    const position = typeof v.position === "number" ? v.position : Number(v.position)
    const points = typeof v.points === "number" ? v.points : Number(v.points)
    if (!Number.isFinite(position) || !Number.isFinite(points)) continue
    const lapsTime =
      typeof v.lapsTime === "string"
        ? v.lapsTime
        : typeof v.laps_time === "string"
          ? v.laps_time
          : ""
    out[key] = { position, points, lapsTime }
  }
  return Object.keys(out).length > 0 ? out : null
}
