export type CompareLapRow = {
  lapNumber: number
  durationMs: number
  validity: string
}

export type CompareSessionSlice = {
  sessionId: string
  name: string | null
  trackName: string | null
  lapCount: number
  bestLapMs: number | null
  laps: CompareLapRow[]
}

/**
 * Build lap comparison payloads for 2–4 READY sessions owned by the same user.
 */
export function buildTelemetryComparePayload(
  sessions: Array<{
    id: string
    name: string | null
    status: string
    track: { trackName: string } | null
    currentRunId: string | null
    laps: Array<{
      lapNumber: number
      durationMs: number
      validity: string
      runId: string
    }>
  }>
): { sessions: CompareSessionSlice[] } {
  const slices: CompareSessionSlice[] = []
  for (const s of sessions) {
    const runId = s.currentRunId
    const laps = s.laps.filter((l) => (runId ? l.runId === runId : true))
    const validDurations = laps
      .filter((l) => l.validity === "VALID" || l.validity === "OUTLAP")
      .map((l) => l.durationMs)
    const best = validDurations.length ? Math.min(...validDurations) : null
    slices.push({
      sessionId: s.id,
      name: s.name,
      trackName: s.track?.trackName ?? null,
      lapCount: laps.length,
      bestLapMs: best,
      laps: laps.map((l) => ({
        lapNumber: l.lapNumber,
        durationMs: l.durationMs,
        validity: l.validity.toLowerCase(),
      })),
    })
  }
  return { sessions: slices }
}

export function parseCompareSessionIdsParam(raw: string | null, max = 4): string[] | null {
  if (!raw || !raw.trim()) return null
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const ids = parts.filter((p) => uuidRe.test(p))
  if (ids.length < 2 || ids.length > max) return null
  return [...new Set(ids)]
}
