/**
 * @fileoverview Admin ingestion controls component
 *
 * @created 2025-01-29
 * @creator System
 * @lastModified 2025-01-29
 *
 * @description Controls for triggering ingestion jobs (track sync, event ingestion)
 *
 * @purpose Provides UI for admins to manually trigger ingestion operations
 *
 * @relatedFiles
 * - src/app/api/v1/admin/ingestion/route.ts (API endpoint)
 */

"use client"
import { useEffect, useState } from "react"
import type { TrackSyncJobStatus } from "@/core/admin/ingestion"

export default function IngestionControls() {
  const [trackSyncLoading, setTrackSyncLoading] = useState(false)
  const [eventIngestionLoading, setEventIngestionLoading] = useState(false)
  const [trackSyncMessage, setTrackSyncMessage] = useState<string | null>(null)
  const [eventIngestionMessage, setEventIngestionMessage] = useState<string | null>(null)
  const [eventId, setEventId] = useState("")
  const [trackSyncJobId, setTrackSyncJobId] = useState<string | null>(null)
  const [trackSyncStatus, setTrackSyncStatus] = useState<TrackSyncJobStatus | null>(null)

  async function triggerTrackSync() {
    setTrackSyncLoading(true)
    setTrackSyncMessage(null)
    setTrackSyncStatus(null)
    try {
      const res = await fetch("/api/v1/admin/ingestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "track_sync" }),
      })

      if (!res.ok) {
        try {
          const errorData = await res.json()
          const errorMessage = errorData.error?.message || `Error: ${res.status} ${res.statusText}`
          setTrackSyncMessage(errorMessage)
        } catch {
          setTrackSyncMessage(`Error: ${res.status} ${res.statusText}`)
        }
        return
      }

      const data = await res.json()
      if (!data.success) {
        setTrackSyncMessage(data.error?.message || "Failed to trigger track sync")
        return
      }

      const jobId = data.data?.jobId as string | undefined
      if (!jobId) {
        setTrackSyncMessage("Track sync response missing jobId")
        return
      }

      setTrackSyncJobId(jobId)
      setTrackSyncMessage("Track sync job queued. Monitoring progress…")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setTrackSyncMessage(`Error triggering track sync: ${errorMessage}`)
    } finally {
      setTrackSyncLoading(false)
    }
  }

  async function triggerEventIngestion() {
    if (!eventId.trim()) {
      setEventIngestionMessage("Event ID is required")
      return
    }

    setEventIngestionLoading(true)
    setEventIngestionMessage(null)
    try {
      const res = await fetch("/api/v1/admin/ingestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "event_ingestion",
          eventId: eventId.trim(),
        }),
      })

      if (!res.ok) {
        // Try to parse error response
        try {
          const errorData = await res.json()
          const errorMessage = errorData.error?.message || `Error: ${res.status} ${res.statusText}`
          setEventIngestionMessage(errorMessage)
        } catch {
          setEventIngestionMessage(`Error: ${res.status} ${res.statusText}`)
        }
        return
      }

      const data = await res.json()
      if (!data.success) {
        setEventIngestionMessage(data.error?.message || "Failed to trigger event ingestion")
        return
      }
      setEventIngestionMessage(data.message || "Event ingestion triggered successfully")
      if (data.success) {
        setEventId("")
      }
    } catch (error) {
      // Network error or other fetch errors
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setEventIngestionMessage(`Error triggering event ingestion: ${errorMessage}`)
    } finally {
      setEventIngestionLoading(false)
    }
  }

  useEffect(() => {
    if (!trackSyncJobId) {
      return
    }

    let cancelled = false

    const pollJob = async () => {
      try {
        const res = await fetch(`/api/v1/admin/track-sync/jobs/${trackSyncJobId}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        })
        if (!res.ok) {
          throw new Error(`Status ${res.status}`)
        }
        const payload = await res.json()
        if (!payload.success) {
          throw new Error(payload.error?.message || "Failed to fetch job status")
        }
        if (cancelled) return
        const status = payload.data as TrackSyncJobStatus
        setTrackSyncStatus(status)
        if (status.status === "success") {
          setTrackSyncMessage(
            `Track sync completed. Added ${status.tracksAdded ?? 0}, Updated ${status.tracksUpdated ?? 0}, Deactivated ${status.tracksDeactivated ?? 0}`
          )
          setTrackSyncJobId(null)
        } else if (status.status === "error") {
          setTrackSyncMessage(status.error || "Track sync failed")
          setTrackSyncJobId(null)
        }
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : "Unknown error"
        setTrackSyncMessage(`Failed to fetch track sync status: ${message}`)
      }
    }

    pollJob()
    const interval = setInterval(pollJob, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [trackSyncJobId])

  return (
    <div className="space-y-6">
      {/* Track Sync */}
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6">
        <h2 className="text-xl font-semibold mb-4 text-[var(--token-text-primary)]">Track Sync</h2>
        <p className="text-sm text-[var(--token-text-secondary)] mb-4">
          Synchronize the track catalogue from LiveRC. This will refresh the list of available
          tracks.
        </p>
        <button
          onClick={triggerTrackSync}
          disabled={trackSyncLoading}
          className="inline-flex items-center justify-center rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)] px-5 text-base font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {trackSyncLoading ? "Triggering..." : "Trigger Track Sync"}
        </button>
        {(trackSyncMessage || trackSyncStatus) && (
          <div className="mt-3 space-y-1 text-sm">
            {trackSyncMessage && (
              <p
                className={
                  trackSyncMessage.includes("Error") || trackSyncMessage.includes("Failed")
                    ? "text-[var(--token-text-error)]"
                    : "text-[var(--token-text-success)]"
                }
              >
                {trackSyncMessage}
              </p>
            )}
            {trackSyncStatus && (
              <div className="text-[var(--token-text-secondary)]">
                <p>
                  Status: {trackSyncStatus.status} ({trackSyncStatus.stage})
                  {trackSyncStatus.total
                    ? ` — ${trackSyncStatus.processed}/${trackSyncStatus.total}`
                    : null}
                </p>
                {trackSyncStatus.reportPath && trackSyncStatus.status === "success" && (
                  <p>Report: {trackSyncStatus.reportPath}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event Ingestion */}
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6">
        <h2 className="text-xl font-semibold mb-4 text-[var(--token-text-primary)]">
          Event Ingestion
        </h2>
        <p className="text-sm text-[var(--token-text-secondary)] mb-4">
          Trigger ingestion for a specific event by providing the event ID.
        </p>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="event-id"
              className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
            >
              Event ID
            </label>
            <input
              id="event-id"
              type="text"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="Enter event UUID"
              className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
            />
          </div>
          <button
            onClick={triggerEventIngestion}
            disabled={eventIngestionLoading || !eventId.trim()}
            className="inline-flex items-center justify-center rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)] px-5 text-base font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {eventIngestionLoading ? "Triggering..." : "Trigger Event Ingestion"}
          </button>
          {eventIngestionMessage && (
            <p
              className={`text-sm ${
                eventIngestionMessage.includes("Error") ||
                eventIngestionMessage.includes("Failed") ||
                eventIngestionMessage.includes("Cannot read") ||
                eventIngestionMessage.includes("undefined")
                  ? "text-[var(--token-text-error)]"
                  : "text-[var(--token-text-success)]"
              }`}
            >
              {eventIngestionMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
