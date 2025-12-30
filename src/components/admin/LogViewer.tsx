"use client"
import { useEffect, useState } from "react"

export default function LogViewer() {
  const [logs, setLogs] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch("/api/v1/admin/logs?pageSize=50")
      .then((r) => r.json())
      .then((d) => d.success && setLogs(d.data.logs))
      .finally(() => setLoading(false))
  }, [])
  if (loading) return <div className="py-8 text-center w-full min-w-0">Loading...</div>
  return (
    <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)] p-6">
      <p className="text-sm text-[var(--token-text-secondary)]">
        Log aggregation is not yet implemented. This feature requires integration with a log aggregation service.
      </p>
      {logs.length === 0 && (
        <p className="mt-4 text-sm text-[var(--token-text-muted)]">No logs available.</p>
      )}
    </div>
  )
}
