import "server-only"

export type ChGnssTimeseriesResult = {
  columns: {
    t_ns: number[]
    lat_deg: number[]
    lon_deg: number[]
    alt_m: (number | null)[]
    speed_mps: (number | null)[]
  }
  meta: { rowCount: number; filteredCount: number; source: "clickhouse" }
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function safeInt(n: number | undefined): string {
  if (n === undefined) return ""
  if (!Number.isFinite(n)) return ""
  const x = Math.floor(n)
  if (x < -9e15 || x > 9e15) return ""
  return String(x)
}

/**
 * Reads GNSS samples from materialised ClickHouse cache when CLICKHOUSE_URL is set.
 * Uses POST with query body to avoid oversized GET URLs.
 */
export async function queryGnssTimeseriesFromClickhouse(params: {
  sessionId: string
  datasetId: string
  tNsMin?: number
  tNsMax?: number
  maxRows: number
}): Promise<ChGnssTimeseriesResult | null> {
  const base = process.env.CLICKHOUSE_URL?.trim()
  if (!base || !isUuid(params.sessionId) || !isUuid(params.datasetId)) {
    return null
  }

  const sid = params.sessionId.toLowerCase()
  const did = params.datasetId.toLowerCase()
  const conds = [`session_id = toUUID('${sid}')`, `dataset_id = toUUID('${did}')`]
  const tMin = safeInt(params.tNsMin)
  const tMax = safeInt(params.tNsMax)
  if (params.tNsMin !== undefined && tMin === "") return null
  if (params.tNsMax !== undefined && tMax === "") return null
  if (tMin) conds.push(`t_ns >= ${tMin}`)
  if (tMax) conds.push(`t_ns <= ${tMax}`)
  const lim = Math.min(Math.max(1, params.maxRows), 500_000)
  const q = `
    SELECT t_ns, lat_deg, lon_deg, alt_m, speed_mps
    FROM telemetry_gnss_v1
    WHERE ${conds.join(" AND ")}
    ORDER BY t_ns ASC
    LIMIT ${lim}
  `

  try {
    const url = `${base.replace(/\/$/, "")}/`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: q.trim(),
    })
    if (!res.ok) return null
    const text = await res.text()
    const lines = text.trim().split("\n").filter(Boolean)
    const t_ns: number[] = []
    const lat_deg: number[] = []
    const lon_deg: number[] = []
    const alt_m: (number | null)[] = []
    const speed_mps: (number | null)[] = []
    for (const line of lines) {
      const row = JSON.parse(line) as Record<string, unknown>
      t_ns.push(Number(row.t_ns))
      lat_deg.push(Number(row.lat_deg))
      lon_deg.push(Number(row.lon_deg))
      alt_m.push(row.alt_m == null ? null : Number(row.alt_m))
      speed_mps.push(row.speed_mps == null ? null : Number(row.speed_mps))
    }
    if (t_ns.length === 0) return null
    return {
      columns: { t_ns, lat_deg, lon_deg, alt_m, speed_mps },
      meta: { rowCount: lines.length, filteredCount: lines.length, source: "clickhouse" },
    }
  } catch {
    return null
  }
}

/**
 * Best-effort ClickHouse cleanup when a telemetry session is deleted (derived cache only).
 */
export async function deleteTelemetrySessionClickhouseRows(sessionId: string): Promise<void> {
  const base = process.env.CLICKHOUSE_URL?.trim()
  if (!base) return
  if (!isUuid(sessionId)) return
  const sid = sessionId.toLowerCase()
  const query = `DELETE FROM telemetry_gnss_v1 WHERE session_id = toUUID('${sid}')`
  try {
    const url = `${base.replace(/\/$/, "")}/`
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: query,
    })
  } catch {
    // best-effort
  }
}
