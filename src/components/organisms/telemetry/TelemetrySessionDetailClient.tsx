"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { typography } from "@/lib/typography"

type SessionDetail = {
  id: string
  name: string | null
  status: string
  startTimeUtc: string
  endTimeUtc: string
  createdAt: string
  updatedAt: string
  datasets: Array<{
    id: string
    datasetType: string
    sensorType: string | null
    sampleRateHz: number | null
    parquetRelativePath: string | null
  }>
  failure?: { code: string; message: string }
}

type MapResponse = {
  meta: {
    level: string
    pointCount: number
    rowCount: number
    timeBounds: { tUnixMsMin: number; tUnixMsMax: number }
  }
  data: { lat_deg: number[]; lon_deg: number[] }
}

async function parseJson<T>(
  res: Response
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  const json = (await res.json()) as {
    success?: boolean
    data?: T
    error?: { message?: string; code?: string }
  }
  if (!res.ok || json.success === false) {
    return {
      ok: false,
      message: json.error?.message || res.statusText || "Request failed",
    }
  }
  return { ok: true, data: json.data as T }
}

function buildPolylineSvgPoints(lat: number[], lon: number[]): string {
  if (lat.length === 0) return ""
  let minLat = lat[0]
  let maxLat = lat[0]
  let minLon = lon[0]
  let maxLon = lon[0]
  for (let i = 1; i < lat.length; i++) {
    minLat = Math.min(minLat, lat[i])
    maxLat = Math.max(maxLat, lat[i])
    minLon = Math.min(minLon, lon[i])
    maxLon = Math.max(maxLon, lon[i])
  }
  const dLat = maxLat - minLat || 1e-9
  const dLon = maxLon - minLon || 1e-9
  const pts: string[] = []
  for (let i = 0; i < lat.length; i++) {
    const x = ((lat[i] - minLat) / dLat) * 100
    const y = (1 - (lon[i] - minLon) / dLon) * 100
    pts.push(`${x},${y}`)
  }
  return pts.join(" ")
}

export default function TelemetrySessionDetailClient({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mapData, setMapData] = useState<MapResponse | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)

  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/v1/telemetry/sessions/${sessionId}`, { credentials: "include" })
    const parsed = await parseJson<{ session: SessionDetail }>(res)
    if (!parsed.ok) {
      setLoadError(parsed.message)
      setSession(null)
      return
    }
    setSession(parsed.data.session)
    setLoadError(null)
  }, [sessionId])

  useEffect(() => {
    queueMicrotask(() => {
      void loadSession()
    })
  }, [loadSession])

  useEffect(() => {
    if (!session || session.status !== "ready" || session.id !== sessionId) {
      return
    }
    let cancelled = false
    void (async () => {
      const res = await fetch(`/api/v1/telemetry/sessions/${sessionId}/map`, {
        credentials: "include",
      })
      const parsed = await parseJson<MapResponse>(res)
      if (cancelled) return
      if (!parsed.ok) {
        setMapError(parsed.message)
        setMapData(null)
        return
      }
      setMapData(parsed.data)
      setMapError(null)
    })()
    return () => {
      cancelled = true
    }
  }, [session, sessionId])

  useEffect(() => {
    if (!session) return
    if (session.status !== "processing") return
    const t = window.setInterval(() => {
      void loadSession()
    }, 2500)
    return () => window.clearInterval(t)
  }, [session, loadSession])

  const polylinePoints = useMemo(() => {
    if (!mapData) return ""
    return buildPolylineSvgPoints(mapData.data.lat_deg, mapData.data.lon_deg)
  }, [mapData])

  if (loadError) {
    return (
      <div style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}>
        <p className="text-[var(--token-error)]">{loadError}</p>
        <Link
          href="/eventAnalysis/my-telemetry"
          className="mt-4 inline-block text-[var(--token-accent)] hover:underline"
        >
          Back to sessions
        </Link>
      </div>
    )
  }

  if (!session) {
    return <p className={typography.bodySecondary}>Loading…</p>
  }

  return (
    <div
      className="box-border w-full min-w-full max-w-full space-y-8"
      style={{ minWidth: "20rem" }}
    >
      <header className="block w-full max-w-full text-left">
        <Link
          href="/eventAnalysis/my-telemetry"
          className={`${typography.bodySecondary} text-[var(--token-accent)] hover:underline`}
        >
          ← Sessions
        </Link>
        <h1 className={`${typography.h1} mt-4 w-full max-w-none text-[var(--token-text-primary)]`}>
          {session.name || "Telemetry session"}
        </h1>
        <p className={`${typography.bodySecondary} mt-2 w-full max-w-none capitalize`}>
          Status: {session.status}
        </p>
      </header>

      {session.status === "failed" && session.failure ? (
        <div
          className="rounded-xl border border-[var(--token-error)]/40 bg-[var(--token-surface-elevated)] p-4"
          role="alert"
        >
          <p className="font-medium text-[var(--token-text-primary)]">Import failed</p>
          <p className={`${typography.bodySecondary} mt-2 text-[var(--token-text-primary)]`}>
            {session.failure.message}
          </p>
          <p className={`${typography.bodySecondary} mt-2 text-[var(--token-text-muted)]`}>
            Code: {session.failure.code}
          </p>
        </div>
      ) : null}

      {session.status === "processing" ? (
        <p className={typography.bodySecondary}>
          Processing your session… This page updates automatically.
        </p>
      ) : null}

      <section
        className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6"
        style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
      >
        <h2 className={`${typography.h3} text-[var(--token-text-primary)]`}>Time range (UTC)</h2>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <dt className="text-[var(--token-text-muted)]">Start</dt>
            <dd className="text-[var(--token-text-primary)]">
              {new Date(session.startTimeUtc).toLocaleString()}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-[var(--token-text-muted)]">End</dt>
            <dd className="text-[var(--token-text-primary)]">
              {new Date(session.endTimeUtc).toLocaleString()}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-[var(--token-text-muted)]">Created</dt>
            <dd className="text-[var(--token-text-primary)]">
              {new Date(session.createdAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </section>

      <section style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}>
        <h2 className={`${typography.h3} text-[var(--token-text-primary)]`}>Datasets</h2>
        {session.datasets.length === 0 ? (
          <p className={`${typography.bodySecondary} mt-2`}>
            {session.status === "failed"
              ? "No GNSS dataset was produced — the import did not complete successfully."
              : session.status === "processing"
                ? "No datasets yet. A GNSS dataset will appear here when parsing succeeds."
                : "No datasets linked to this session."}
          </p>
        ) : (
          <ul className="mt-4 list-inside list-disc space-y-2 text-[var(--token-text-secondary)]">
            {session.datasets.map((d) => (
              <li key={d.id}>
                {d.datasetType}
                {d.sampleRateHz != null ? ` · ~${d.sampleRateHz} Hz` : ""}
                {d.parquetRelativePath ? (
                  <span className="block text-xs text-[var(--token-text-muted)]">
                    {d.parquetRelativePath}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}>
        <h2 className={`${typography.h3} text-[var(--token-text-primary)]`}>Path preview</h2>
        {session.status === "failed" ? (
          <p className={`${typography.bodySecondary} mt-2`}>
            Path preview is not available — there is no canonical GNSS track for a failed import.
          </p>
        ) : session.status !== "ready" ? (
          <p className={`${typography.bodySecondary} mt-2`}>
            Preview is available when the session is ready.
          </p>
        ) : mapError ? (
          <p className={`${typography.bodySecondary} mt-2 text-[var(--token-error)]`}>{mapError}</p>
        ) : !mapData ? (
          <p className={`${typography.bodySecondary} mt-2`}>Loading preview…</p>
        ) : (
          <div className="mt-4">
            <svg
              viewBox="0 0 100 100"
              className="h-64 w-full max-w-3xl rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-raised)]"
              preserveAspectRatio="xMidYMid meet"
              aria-label="GNSS path preview"
            >
              <polyline
                fill="none"
                stroke="var(--token-accent)"
                strokeWidth="0.8"
                points={polylinePoints}
              />
            </svg>
            <p className={`${typography.bodySecondary} mt-2`}>
              {mapData.meta.pointCount} points (from {mapData.meta.rowCount} rows), downsampled for
              display.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
