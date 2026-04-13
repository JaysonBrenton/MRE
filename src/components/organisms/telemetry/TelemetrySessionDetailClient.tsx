"use client"

import { Group } from "@visx/group"
import { LinePath } from "@visx/shape"
import { scaleLinear } from "@visx/scale"
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
  trackId: string | null
  track: { id: string; trackName: string; hasStartFinishLine: boolean } | null
  userSflLineGeoJson: unknown
  datasets: Array<{
    id: string
    datasetType: string
    sensorType: string | null
    sampleRateHz: number | null
    parquetRelativePath: string | null
  }>
  laps: Array<{
    lapNumber: number
    startTimeUtc: string
    endTimeUtc: string
    durationMs: number
    validity: string
  }>
  segments: unknown[]
  shareEnabled?: boolean
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

type TrackSearchHit = {
  id: string
  trackName: string
  city: string | null
  state: string | null
  country: string | null
}

type QualityApiPayload = {
  pipelineVersion: string | null
  fusionVersion: string | null
  lapDetectorVersion: string | null
  quality: unknown
  rawQualitySummary?: unknown
}

type CoachingPayload = {
  lapCount: number
  cornerSegmentCount: number
  straightSegmentCount: number
  tips: string[]
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

function clickToLatLon(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  lat: number[],
  lon: number[]
): { lat: number; lon: number } {
  const minLat = Math.min(...lat)
  const maxLat = Math.max(...lat)
  const minLon = Math.min(...lon)
  const maxLon = Math.max(...lon)
  const dLat = maxLat - minLat || 1e-9
  const dLon = maxLon - minLon || 1e-9
  const x = ((clientX - rect.left) / rect.width) * 100
  const y = ((clientY - rect.top) / rect.height) * 100
  const latOut = minLat + (x / 100) * dLat
  const lonOut = minLon + (1 - y / 100) * dLon
  return { lat: latOut, lon: lonOut }
}

function sflLineSvgPoints(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  lat: number[],
  lon: number[]
): string {
  const minLat = Math.min(...lat)
  const maxLat = Math.max(...lat)
  const minLon = Math.min(...lon)
  const maxLon = Math.max(...lon)
  const dLat = maxLat - minLat || 1e-9
  const dLon = maxLon - minLon || 1e-9
  const x0 = ((a.lat - minLat) / dLat) * 100
  const y0 = (1 - (a.lon - minLon) / dLon) * 100
  const x1 = ((b.lat - minLat) / dLat) * 100
  const y1 = (1 - (b.lon - minLon) / dLon) * 100
  return `${x0},${y0} ${x1},${y1}`
}

export default function TelemetrySessionDetailClient({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mapData, setMapData] = useState<MapResponse | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [retryBusy, setRetryBusy] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [sflPickMode, setSflPickMode] = useState(false)
  const [sflPoints, setSflPoints] = useState<{ lat: number; lon: number }[]>([])
  const [patchBusy, setPatchBusy] = useState(false)
  const [patchMessage, setPatchMessage] = useState<string | null>(null)
  const [reprocessBusy, setReprocessBusy] = useState(false)
  const [reprocessError, setReprocessError] = useState<string | null>(null)
  const [trackQuery, setTrackQuery] = useState("")
  const [trackHits, setTrackHits] = useState<TrackSearchHit[]>([])
  const [quality, setQuality] = useState<QualityApiPayload | null>(null)
  const [qualityError, setQualityError] = useState<string | null>(null)
  const [coaching, setCoaching] = useState<CoachingPayload | null>(null)
  const [coachingError, setCoachingError] = useState<string | null>(null)
  const [compareOtherId, setCompareOtherId] = useState("")
  const [compareBusy, setCompareBusy] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [compareRows, setCompareRows] = useState<
    Array<{
      sessionId: string
      name: string | null
      trackName: string | null
      lapCount: number
      bestLapMs: number | null
    }>
  >([])
  const [shareBusy, setShareBusy] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [speedPts, setSpeedPts] = useState<{ x: number; y: number }[]>([])
  const [speedError, setSpeedError] = useState<string | null>(null)

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

  const retryImport = useCallback(async () => {
    setRetryBusy(true)
    setRetryError(null)
    try {
      const res = await fetch(`/api/v1/telemetry/sessions/${sessionId}/retry`, {
        method: "POST",
        credentials: "include",
      })
      const parsed = await parseJson<{ runId: string }>(res)
      if (!parsed.ok) {
        setRetryError(parsed.message)
        return
      }
      await loadSession()
    } finally {
      setRetryBusy(false)
    }
  }, [sessionId, loadSession])

  const reprocess = useCallback(async () => {
    setReprocessBusy(true)
    setReprocessError(null)
    try {
      const res = await fetch(`/api/v1/telemetry/sessions/${sessionId}/reprocess`, {
        method: "POST",
        credentials: "include",
      })
      const parsed = await parseJson<{ runId: string }>(res)
      if (!parsed.ok) {
        setReprocessError(parsed.message)
        return
      }
      await loadSession()
    } finally {
      setReprocessBusy(false)
    }
  }, [sessionId, loadSession])

  const runCompare = useCallback(async () => {
    const other = compareOtherId.trim()
    if (!other) {
      setCompareError("Enter another session id")
      return
    }
    setCompareBusy(true)
    setCompareError(null)
    try {
      const q = `ids=${encodeURIComponent(sessionId)},${encodeURIComponent(other)}`
      const res = await fetch(`/api/v1/telemetry/sessions/compare?${q}`, {
        credentials: "include",
      })
      const parsed = await parseJson<{
        sessions: Array<{
          sessionId: string
          name: string | null
          trackName: string | null
          lapCount: number
          bestLapMs: number | null
        }>
      }>(res)
      if (!parsed.ok) {
        setCompareError(parsed.message)
        setCompareRows([])
        return
      }
      setCompareRows(parsed.data.sessions)
    } finally {
      setCompareBusy(false)
    }
  }, [sessionId, compareOtherId])

  const createShare = useCallback(async () => {
    setShareBusy(true)
    setShareMessage(null)
    try {
      const res = await fetch(`/api/v1/telemetry/sessions/${sessionId}/share`, {
        method: "POST",
        credentials: "include",
      })
      const parsed = await parseJson<{ token: string; shareUrl: string | null }>(res)
      if (!parsed.ok) {
        setShareMessage(parsed.message)
        return
      }
      const u =
        parsed.data.shareUrl ||
        (typeof window !== "undefined"
          ? `${window.location.origin}/api/v1/telemetry/share/${parsed.data.token}`
          : null)
      setShareUrl(u)
      setShareMessage("Share link created. Anyone with the link can view summary and map.")
      await loadSession()
    } finally {
      setShareBusy(false)
    }
  }, [sessionId, loadSession])

  const revokeShare = useCallback(async () => {
    setShareBusy(true)
    setShareMessage(null)
    try {
      const res = await fetch(`/api/v1/telemetry/sessions/${sessionId}/share`, {
        method: "DELETE",
        credentials: "include",
      })
      const parsed = await parseJson<{ revoked: boolean }>(res)
      if (!parsed.ok) {
        setShareMessage(parsed.message)
        return
      }
      setShareUrl(null)
      setShareMessage("Share link revoked.")
      await loadSession()
    } finally {
      setShareBusy(false)
    }
  }, [sessionId, loadSession])

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
    if (!session || session.status !== "ready") return
    let cancelled = false
    void (async () => {
      const [qRes, cRes] = await Promise.all([
        fetch(`/api/v1/telemetry/sessions/${sessionId}/quality`, { credentials: "include" }),
        fetch(`/api/v1/telemetry/sessions/${sessionId}/coaching`, { credentials: "include" }),
      ])
      const qParsed = await parseJson<QualityApiPayload>(qRes)
      const cParsed = await parseJson<{ coaching: CoachingPayload }>(cRes)
      if (cancelled) return
      if (qParsed.ok) {
        setQuality(qParsed.data)
        setQualityError(null)
      } else {
        setQuality(null)
        setQualityError(qParsed.message)
      }
      if (cParsed.ok) {
        setCoaching(cParsed.data.coaching)
        setCoachingError(null)
      } else {
        setCoaching(null)
        setCoachingError(cParsed.message)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session, sessionId])

  useEffect(() => {
    if (!session || session.status !== "ready" || session.id !== sessionId) {
      setSpeedPts([])
      return
    }
    let cancelled = false
    void (async () => {
      const res = await fetch(
        `/api/v1/telemetry/sessions/${sessionId}/timeseries?max_rows=6000&stride=8`,
        { credentials: "include" }
      )
      const parsed = await parseJson<{
        columns: { speed_mps: (number | null)[] }
      }>(res)
      if (cancelled) return
      if (!parsed.ok) {
        setSpeedError(parsed.message)
        setSpeedPts([])
        return
      }
      const sp = parsed.data.columns?.speed_mps ?? []
      const pts: { x: number; y: number }[] = []
      for (let i = 0; i < sp.length; i++) {
        const v = sp[i]
        if (v != null && Number.isFinite(v)) {
          pts.push({ x: i, y: v })
        }
      }
      setSpeedPts(pts.slice(0, 4000))
      setSpeedError(null)
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

  useEffect(() => {
    const q = trackQuery.trim()
    if (q.length < 2) {
      setTrackHits([])
      return
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const res = await fetch(`/api/v1/tracks/search?q=${encodeURIComponent(q)}&limit=12`, {
          credentials: "include",
        })
        const parsed = await parseJson<{ tracks: TrackSearchHit[] }>(res)
        if (parsed.ok) setTrackHits(parsed.data.tracks)
        else setTrackHits([])
      })()
    }, 300)
    return () => window.clearTimeout(t)
  }, [trackQuery])

  const polylinePoints = useMemo(() => {
    if (!mapData) return ""
    return buildPolylineSvgPoints(mapData.data.lat_deg, mapData.data.lon_deg)
  }, [mapData])

  const speedChart = useMemo(() => {
    if (speedPts.length < 2) return null
    const w = 400
    const h = 120
    const ys = speedPts.map((p) => p.y)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const pad = (maxY - minY) * 0.05 || 1
    const xScale = scaleLinear<number>({
      domain: [speedPts[0].x, speedPts[speedPts.length - 1].x],
      range: [0, w],
    })
    const yScale = scaleLinear<number>({
      domain: [minY - pad, maxY + pad],
      range: [h, 0],
    })
    return (
      <svg width={w} height={h} className="max-w-full" aria-label="GNSS speed profile">
        <Group>
          <LinePath
            data={speedPts}
            x={(d) => xScale(d.x) ?? 0}
            y={(d) => yScale(d.y) ?? 0}
            stroke="var(--token-accent)"
            strokeWidth={1.2}
          />
        </Group>
      </svg>
    )
  }, [speedPts])

  const userSflOverlay = useMemo(() => {
    if (!mapData || sflPoints.length !== 2) return ""
    return sflLineSvgPoints(sflPoints[0], sflPoints[1], mapData.data.lat_deg, mapData.data.lon_deg)
  }, [mapData, sflPoints])

  const saveUserSfl = useCallback(async () => {
    if (sflPoints.length !== 2) return
    setPatchBusy(true)
    setPatchMessage(null)
    try {
      const geojson = {
        type: "LineString",
        coordinates: [
          [sflPoints[0].lon, sflPoints[0].lat],
          [sflPoints[1].lon, sflPoints[1].lat],
        ],
      }
      const res = await fetch(`/api/v1/telemetry/sessions/${sessionId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userSflLineGeoJson: geojson }),
      })
      const parsed = await parseJson<{ session: SessionDetail }>(res)
      if (!parsed.ok) {
        setPatchMessage(parsed.message)
        return
      }
      setSession(parsed.data.session)
      setPatchMessage("Start/finish line saved. Reprocess to apply lap detection.")
      setSflPickMode(false)
    } finally {
      setPatchBusy(false)
    }
  }, [sessionId, sflPoints])

  const linkTrack = useCallback(
    async (trackId: string | null) => {
      setPatchBusy(true)
      setPatchMessage(null)
      try {
        const res = await fetch(`/api/v1/telemetry/sessions/${sessionId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId }),
        })
        const parsed = await parseJson<{ session: SessionDetail }>(res)
        if (!parsed.ok) {
          setPatchMessage(parsed.message)
          return
        }
        setSession(parsed.data.session)
        setTrackQuery("")
        setTrackHits([])
        setPatchMessage(
          trackId
            ? "Track linked. Reprocess to use catalogue start/finish when available."
            : "Track unlinked."
        )
      } finally {
        setPatchBusy(false)
      }
    },
    [sessionId]
  )

  const onSvgPointer = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!sflPickMode || !mapData) return
      const svg = e.currentTarget
      const rect = svg.getBoundingClientRect()
      const { lat, lon } = clickToLatLon(
        e.clientX,
        e.clientY,
        rect,
        mapData.data.lat_deg,
        mapData.data.lon_deg
      )
      setSflPoints((prev) => {
        if (prev.length >= 2) return [{ lat, lon }]
        return [...prev, { lat, lon }]
      })
    },
    [sflPickMode, mapData]
  )

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

  const segList = Array.isArray(session.segments) ? session.segments : []
  const cornerSegs = segList.filter((s) => {
    if (s && typeof s === "object" && s !== null) {
      return (s as { type?: string }).type === "corner"
    }
    return false
  }).length

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
          <p className={`${typography.bodySecondary} mt-3 text-[var(--token-text-secondary)]`}>
            If the problem was a server-side issue (for example telemetry cache), you can retry
            processing without uploading again.
          </p>
          <button
            type="button"
            onClick={() => {
              void retryImport()
            }}
            disabled={retryBusy}
            className="mt-4 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] hover:bg-[var(--token-surface-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {retryBusy ? "Retrying…" : "Retry import"}
          </button>
          {retryError ? (
            <p className={`${typography.bodySecondary} mt-2 text-[var(--token-error)]`}>
              {retryError}
            </p>
          ) : null}
        </div>
      ) : null}

      {session.status === "processing" ? (
        <p className={typography.bodySecondary}>
          Processing your session… This page updates automatically.
        </p>
      ) : null}

      {session.status === "ready" ? (
        <section
          className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6"
          style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
        >
          <h2 className={`${typography.h3} text-[var(--token-text-primary)]`}>
            Track and start/finish
          </h2>
          <p className={`${typography.bodySecondary} mt-2 text-[var(--token-text-secondary)]`}>
            Link a catalogue track to use its start/finish line, or draw your own on the path
            preview. Reprocess after changing either so laps are recomputed.
          </p>
          <div className="mt-4 space-y-2">
            <p className="text-sm text-[var(--token-text-muted)]">Linked track</p>
            {session.track ? (
              <p className="text-[var(--token-text-primary)]">
                {session.track.trackName}
                {session.track.hasStartFinishLine
                  ? " · catalogue SFL available"
                  : " · no catalogue SFL"}
              </p>
            ) : (
              <p className={typography.bodySecondary}>None</p>
            )}
            <input
              type="search"
              value={trackQuery}
              onChange={(e) => setTrackQuery(e.target.value)}
              placeholder="Search tracks by name or city…"
              className="mt-2 w-full max-w-2xl rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] px-3 py-2 text-sm text-[var(--token-text-primary)]"
            />
            {trackHits.length > 0 ? (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] p-2 text-sm">
                {trackHits.map((tr) => (
                  <li key={tr.id}>
                    <button
                      type="button"
                      className="w-full text-left text-[var(--token-accent)] hover:underline"
                      disabled={patchBusy}
                      onClick={() => {
                        void linkTrack(tr.id)
                      }}
                    >
                      {tr.trackName}
                      {tr.city ? ` — ${tr.city}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {session.trackId ? (
              <button
                type="button"
                disabled={patchBusy}
                onClick={() => {
                  void linkTrack(null)
                }}
                className="text-sm text-[var(--token-text-muted)] hover:text-[var(--token-text-primary)]"
              >
                Unlink track
              </button>
            ) : null}
          </div>
          <div className="mt-6">
            <button
              type="button"
              disabled={reprocessBusy || session.status !== "ready"}
              onClick={() => {
                void reprocess()
              }}
              className="rounded-lg border border-[var(--token-accent)] bg-[var(--token-surface-raised)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] hover:bg-[var(--token-surface-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reprocessBusy ? "Reprocessing…" : "Reprocess session"}
            </button>
            {reprocessError ? (
              <p className={`${typography.bodySecondary} mt-2 text-[var(--token-error)]`}>
                {reprocessError}
              </p>
            ) : null}
            {patchMessage ? (
              <p className={`${typography.bodySecondary} mt-2 text-[var(--token-text-secondary)]`}>
                {patchMessage}
              </p>
            ) : null}
          </div>
        </section>
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
        <h2 className={`${typography.h3} text-[var(--token-text-primary)]`}>Laps</h2>
        {session.status === "ready" && session.laps.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--token-border-default)] text-[var(--token-text-muted)]">
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2">Validity</th>
                </tr>
              </thead>
              <tbody>
                {session.laps.map((l) => (
                  <tr
                    key={l.lapNumber}
                    className="border-b border-[var(--token-border-default)]/60"
                  >
                    <td className="py-2 pr-4 text-[var(--token-text-primary)]">{l.lapNumber}</td>
                    <td className="py-2 pr-4 text-[var(--token-text-primary)]">
                      {(l.durationMs / 1000).toFixed(3)}s
                    </td>
                    <td className="py-2 text-[var(--token-text-secondary)]">{l.validity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={`${typography.bodySecondary} mt-2`}>
            {session.status === "ready"
              ? "No laps yet. Set a track or draw a start/finish line, then reprocess."
              : "Laps appear when the session is ready."}
          </p>
        )}
      </section>

      <section style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}>
        <h2 className={`${typography.h3} text-[var(--token-text-primary)]`}>
          Quality and segments
        </h2>
        {session.status === "ready" ? (
          <div className="mt-4 space-y-3 text-sm">
            {quality?.quality && typeof quality.quality === "object" && quality.quality !== null ? (
              <p className="text-[var(--token-text-secondary)]">
                Overall{" "}
                {typeof (quality.quality as { overall?: unknown }).overall === "number"
                  ? ((quality.quality as { overall: number }).overall as number).toFixed(1)
                  : "—"}{" "}
                / 100
              </p>
            ) : null}
            {qualityError ? <p className="text-[var(--token-error)]">{qualityError}</p> : null}
            <p className="text-[var(--token-text-secondary)]">
              Heuristic {cornerSegs} corner segments (from GNSS heading rate).
            </p>
          </div>
        ) : (
          <p className={`${typography.bodySecondary} mt-2`}>Available when the session is ready.</p>
        )}
      </section>

      <section style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}>
        <h2 className={`${typography.h3} text-[var(--token-text-primary)]`}>Coaching hints</h2>
        {session.status === "ready" ? (
          <div className="mt-4">
            {coachingError ? (
              <p className="text-[var(--token-error)]">{coachingError}</p>
            ) : coaching && coaching.tips.length > 0 ? (
              <ul className="list-inside list-disc space-y-2 text-[var(--token-text-secondary)]">
                {coaching.tips.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ) : (
              <p className={typography.bodySecondary}>No hints yet.</p>
            )}
          </div>
        ) : (
          <p className={`${typography.bodySecondary} mt-2`}>Available when the session is ready.</p>
        )}
      </section>

      {session.status === "ready" ? (
        <section
          className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6"
          style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
        >
          <h2 className={`${typography.h3} text-[var(--token-text-primary)]`}>Export</h2>
          <p className={`${typography.bodySecondary} mt-2 text-[var(--token-text-secondary)]`}>
            Canonical GNSS Parquet (system of record). Arrow IPC is not implemented (501 if
            requested).
          </p>
          <a
            href={`/api/v1/telemetry/sessions/${sessionId}/export`}
            className="mt-4 inline-block rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] px-4 py-2 text-sm font-medium text-[var(--token-accent)] hover:underline"
            download
          >
            Download GNSS Parquet
          </a>
        </section>
      ) : null}

      {session.status === "ready" ? (
        <section
          className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6"
          style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
        >
          <h2 className={`${typography.h3} text-[var(--token-text-primary)]`}>Compare sessions</h2>
          <p className={`${typography.bodySecondary} mt-2 text-[var(--token-text-secondary)]`}>
            Enter another READY session UUID (same account) to compare lap counts and best lap.
          </p>
          <input
            type="text"
            value={compareOtherId}
            onChange={(e) => setCompareOtherId(e.target.value)}
            placeholder="Other session UUID"
            className="mt-3 w-full max-w-xl rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] px-3 py-2 font-mono text-sm text-[var(--token-text-primary)]"
          />
          <button
            type="button"
            disabled={compareBusy}
            onClick={() => {
              void runCompare()
            }}
            className="mt-3 rounded-lg border border-[var(--token-accent)] bg-[var(--token-surface-raised)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)]"
          >
            {compareBusy ? "Loading…" : "Compare"}
          </button>
          {compareError ? (
            <p className={`${typography.bodySecondary} mt-2 text-[var(--token-error)]`}>
              {compareError}
            </p>
          ) : null}
          {compareRows.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--token-border-default)] text-[var(--token-text-muted)]">
                    <th className="py-2 pr-4">Session</th>
                    <th className="py-2 pr-4">Laps</th>
                    <th className="py-2">Best lap</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((r) => (
                    <tr
                      key={r.sessionId}
                      className="border-b border-[var(--token-border-default)]/60"
                    >
                      <td className="py-2 pr-4 font-mono text-xs text-[var(--token-text-primary)]">
                        {r.name || r.sessionId.slice(0, 8)}
                      </td>
                      <td className="py-2 pr-4 text-[var(--token-text-primary)]">{r.lapCount}</td>
                      <td className="py-2 text-[var(--token-text-primary)]">
                        {r.bestLapMs != null ? `${(r.bestLapMs / 1000).toFixed(3)}s` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {session.status === "ready" ? (
        <section
          className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6"
          style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
        >
          <h2 className={`${typography.h3} text-[var(--token-text-primary)]`}>Share (read-only)</h2>
          <p className={`${typography.bodySecondary} mt-2 text-[var(--token-text-secondary)]`}>
            Creates a public URL for session summary and map (no sign-in). Revoke anytime.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={shareBusy}
              onClick={() => {
                void createShare()
              }}
              className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] px-3 py-1.5 text-sm text-[var(--token-text-primary)]"
            >
              {shareBusy ? "Working…" : session.shareEnabled ? "Rotate link" : "Create link"}
            </button>
            {session.shareEnabled || shareUrl ? (
              <button
                type="button"
                disabled={shareBusy}
                onClick={() => {
                  void revokeShare()
                }}
                className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] px-3 py-1.5 text-sm text-[var(--token-text-muted)]"
              >
                Revoke
              </button>
            ) : null}
          </div>
          {shareUrl ? (
            <p className="mt-3 break-all font-mono text-xs text-[var(--token-text-secondary)]">
              {shareUrl}
            </p>
          ) : null}
          {shareMessage ? (
            <p className={`${typography.bodySecondary} mt-2 text-[var(--token-text-secondary)]`}>
              {shareMessage}
            </p>
          ) : null}
        </section>
      ) : null}

      {session.status === "ready" ? (
        <section
          className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6"
          style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
        >
          <h2 className={`${typography.h3} text-[var(--token-text-primary)]`}>Speed (GNSS)</h2>
          {speedError ? (
            <p className={`${typography.bodySecondary} mt-2 text-[var(--token-error)]`}>
              {speedError}
            </p>
          ) : speedChart ? (
            <div className="mt-4">{speedChart}</div>
          ) : (
            <p className={`${typography.bodySecondary} mt-2`}>Loading or no speed data…</p>
          )}
        </section>
      ) : null}

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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSflPickMode((v) => !v)
                  setSflPoints([])
                }}
                className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] px-3 py-1.5 text-sm text-[var(--token-text-primary)]"
              >
                {sflPickMode ? "Cancel drawing" : "Draw start/finish (two clicks)"}
              </button>
              {sflPoints.length === 2 ? (
                <button
                  type="button"
                  disabled={patchBusy}
                  onClick={() => {
                    void saveUserSfl()
                  }}
                  className="rounded-lg border border-[var(--token-accent)] bg-[var(--token-surface-raised)] px-3 py-1.5 text-sm text-[var(--token-text-primary)]"
                >
                  Save line
                </button>
              ) : null}
            </div>
            {sflPickMode ? (
              <p className={`${typography.bodySecondary} mt-2`}>
                Click two points on the track. Points: {sflPoints.length}/2
              </p>
            ) : null}
            <svg
              viewBox="0 0 100 100"
              className="mt-2 h-64 w-full max-w-3xl cursor-crosshair rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-raised)]"
              preserveAspectRatio="xMidYMid meet"
              aria-label="GNSS path preview"
              onClick={onSvgPointer}
            >
              <polyline
                fill="none"
                stroke="var(--token-accent)"
                strokeWidth="0.8"
                points={polylinePoints}
              />
              {userSflOverlay ? (
                <polyline
                  fill="none"
                  stroke="var(--token-accent)"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                  points={userSflOverlay}
                />
              ) : null}
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
