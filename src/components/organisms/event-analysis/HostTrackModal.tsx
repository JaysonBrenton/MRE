/**
 * Per-event host track: pick a catalogue track as the physical host (LiveRC venue may be organiser office).
 */

"use client"

import { useCallback, useEffect, useState } from "react"
import Modal from "@/components/molecules/Modal"
import StandardButton from "@/components/atoms/StandardButton"
import { parseApiResponse } from "@/lib/api-response-helper"
import { useAppDispatch } from "@/store/hooks"
import { fetchEventAnalysisData } from "@/store/slices/dashboardSlice"
import type { EventAnalysisDataApiResponse } from "@/types/event-analysis-api"

type SearchTrack = {
  id: string
  trackName: string
  sourceTrackSlug: string
  city: string | null
  state: string | null
  country: string | null
  trackUrl: string
  address: string | null
}

function formatTrackLine(t: SearchTrack): string {
  const parts = [t.city, t.state, t.country].filter(Boolean)
  return [t.trackName, parts.length ? parts.join(", ") : null].filter(Boolean).join(" · ")
}

export default function HostTrackModal({
  isOpen,
  onClose,
  eventId,
  analysisData,
}: {
  isOpen: boolean
  onClose: () => void
  eventId: string | null
  analysisData: EventAnalysisDataApiResponse | null
}) {
  const dispatch = useAppDispatch()
  const [q, setQ] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [results, setResults] = useState<SearchTrack[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selected, setSelected] = useState<SearchTrack | null>(null)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setQ("")
    setDebouncedQ("")
    setResults([])
    setSelected(null)
  }, [isOpen, eventId])

  useEffect(() => {
    if (!isOpen || debouncedQ.trim().length < 2) {
      setResults([])
      setSearchLoading(false)
      return
    }
    let cancelled = false
    setSearchLoading(true)
    void (async () => {
      const res = await fetch(
        `/api/v1/tracks/search?q=${encodeURIComponent(debouncedQ)}&limit=30`,
        { credentials: "include" }
      )
      const parsed = await parseApiResponse<{ tracks: SearchTrack[] }>(res)
      if (cancelled) return
      if (parsed.success && parsed.data?.tracks) {
        setResults(parsed.data.tracks)
      } else {
        setResults([])
      }
      setSearchLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, debouncedQ])

  const refreshAnalysis = useCallback(() => {
    if (eventId) void dispatch(fetchEventAnalysisData(eventId))
  }, [dispatch, eventId])

  const handleSave = useCallback(async () => {
    if (!eventId || !selected) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/user/events/${eventId}/host-track`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostTrackId: selected.id }),
      })
      const parsed = await parseApiResponse(res)
      if (!parsed.success) {
        setError(parsed.error.message)
        return
      }
      refreshAnalysis()
      onClose()
    } catch {
      setError("Could not save host track")
    } finally {
      setSaving(false)
    }
  }, [eventId, selected, onClose, refreshAnalysis])

  const handleClear = useCallback(async () => {
    if (!eventId) return
    setClearing(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/user/events/${eventId}/host-track`, {
        method: "DELETE",
        credentials: "include",
      })
      const parsed = await parseApiResponse(res)
      if (!parsed.success) {
        setError(parsed.error.message)
        return
      }
      refreshAnalysis()
      onClose()
    } catch {
      setError("Could not clear host track")
    } finally {
      setClearing(false)
    }
  }, [eventId, onClose, refreshAnalysis])

  const current = analysisData?.userHostTrack ?? null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Host track"
      subtitle={
        <span className="text-sm text-[var(--token-text-secondary)]">
          Choose the physical track where this event was held. Venue info above stays as LiveRC
          linked data.
        </span>
      }
      maxWidth="lg"
      doubleClickHeaderFullscreen
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StandardButton type="button" onClick={onClose}>
            Cancel
          </StandardButton>
          <StandardButton
            type="button"
            onClick={() => void handleClear()}
            disabled={!current || clearing || saving || !eventId}
          >
            {clearing ? "Clearing…" : "Clear host track"}
          </StandardButton>
          <StandardButton
            type="button"
            className="!border-[var(--token-accent)] !bg-[var(--token-accent)] !text-[var(--token-on-accent)] hover:!bg-[var(--token-accent)]/90"
            onClick={() => void handleSave()}
            disabled={!selected || saving || clearing || !eventId}
          >
            {saving ? "Saving…" : "Save"}
          </StandardButton>
        </div>
      }
    >
      <div
        className="flex min-h-0 flex-col gap-4"
        style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
      >
        {error && (
          <p className="text-sm text-[var(--token-error-text)]" role="alert">
            {error}
          </p>
        )}

        {current && (
          <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-raised)]/40 px-3 py-2 text-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]">
              Current host track
            </div>
            <div className="mt-1 font-medium text-[var(--token-text-primary)]">
              {current.trackName}
            </div>
            {current.address && (
              <div className="mt-0.5 text-[var(--token-text-secondary)]">{current.address}</div>
            )}
          </div>
        )}

        <div>
          <label
            htmlFor="host-track-search"
            className="mb-1 block text-sm text-[var(--token-text-secondary)]"
          >
            Search tracks
          </label>
          <input
            id="host-track-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type at least 2 characters (name, city, slug)…"
            className="w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2 text-sm text-[var(--token-text-primary)]"
            autoComplete="off"
          />
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[var(--token-border-muted)]"
          style={{ maxHeight: "min(50vh, 320px)" }}
        >
          {searchLoading && debouncedQ.trim().length >= 2 && (
            <p className="p-3 text-sm text-[var(--token-text-muted)]">Searching…</p>
          )}
          {!searchLoading && debouncedQ.trim().length >= 2 && results.length === 0 && (
            <p className="p-3 text-sm text-[var(--token-text-muted)]">No tracks found.</p>
          )}
          {debouncedQ.trim().length < 2 && (
            <p className="p-3 text-sm text-[var(--token-text-muted)]">
              Enter at least 2 characters to search.
            </p>
          )}
          <ul className="divide-y divide-[var(--token-border-muted)]">
            {results.map((t) => {
              const active = selected?.id === t.id
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(t)}
                    className={`w-full px-3 py-2.5 text-left text-sm transition hover:bg-[var(--token-surface-raised)]/80 ${
                      active ? "bg-[var(--token-accent-soft)]/30" : ""
                    }`}
                  >
                    <div className="font-medium text-[var(--token-text-primary)]">
                      {t.trackName}
                    </div>
                    <div className="text-xs text-[var(--token-text-muted)]">
                      {formatTrackLine(t)}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {selected && (
          <div className="rounded-lg border border-[var(--token-border-accent-soft)] bg-[var(--token-surface-elevated)]/60 px-3 py-2 text-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]">
              Selected
            </div>
            <div className="mt-1 font-medium">{selected.trackName}</div>
            {selected.address && (
              <div className="mt-0.5 text-[var(--token-text-secondary)]">{selected.address}</div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
