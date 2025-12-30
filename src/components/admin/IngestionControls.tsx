"use client"
import { useState } from "react"

export default function IngestionControls() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function triggerTrackSync() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch("/api/v1/admin/ingestion/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "track_sync" }),
      })
      const data = await res.json()
      setMessage(data.success ? data.message : data.error?.message || "Failed")
    } catch {
      setMessage("Error triggering track sync")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)] p-6">
        <h2 className="text-xl font-semibold mb-4">Track Sync</h2>
        <p className="text-sm text-[var(--token-text-secondary)] mb-4">
          Synchronize the track catalogue from LiveRC
        </p>
        <button
          onClick={triggerTrackSync}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)] px-5 text-base font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Triggering..." : "Trigger Track Sync"}
        </button>
        {message && <p className="mt-2 text-sm text-[var(--token-text-secondary)]">{message}</p>}
      </div>
    </div>
  )
}
