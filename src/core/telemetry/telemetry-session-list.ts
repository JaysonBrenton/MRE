/**
 * Session list cursor encoding and parquet path resolution (no server-only / DB).
 */

export type TelemetrySessionListCursor = {
  createdAt: string
  id: string
}

export function encodeTelemetryListCursor(c: TelemetrySessionListCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url")
}

export function decodeTelemetryListCursor(raw: string | null): TelemetrySessionListCursor | null {
  if (!raw?.trim()) return null
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8")
    const parsed = JSON.parse(json) as { createdAt?: unknown; id?: unknown }
    if (typeof parsed.createdAt === "string" && typeof parsed.id === "string") {
      return { createdAt: parsed.createdAt, id: parsed.id }
    }
  } catch {
    return null
  }
  return null
}

/**
 * Resolve parquet key from processing run quality summary for a dataset row.
 */
export function resolveDatasetParquetRelativePath(params: {
  datasetId: string
  qualitySummary: unknown
  outputDatasetIds: unknown
}): string | null {
  const { datasetId, qualitySummary, outputDatasetIds } = params
  if (!qualitySummary || typeof qualitySummary !== "object") return null
  const qs = qualitySummary as { parquetRelativePath?: unknown; datasetPaths?: unknown }
  if (qs.datasetPaths && typeof qs.datasetPaths === "object" && qs.datasetPaths !== null) {
    const dp = qs.datasetPaths as Record<string, unknown>
    const byId = dp[datasetId]
    if (typeof byId === "string" && byId.trim()) {
      return byId.trim().replace(/^[/\\]+/, "")
    }
  }
  const path = typeof qs.parquetRelativePath === "string" ? qs.parquetRelativePath.trim() : null
  if (!path) return null
  if (path.includes(datasetId)) return path.replace(/^[/\\]+/, "")

  let ids: string[] = []
  if (Array.isArray(outputDatasetIds)) {
    ids = outputDatasetIds.filter((x): x is string => typeof x === "string")
  }
  if (ids.length === 1 && ids[0] === datasetId) {
    return path.replace(/^[/\\]+/, "")
  }
  return null
}
