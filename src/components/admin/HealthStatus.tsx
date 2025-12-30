"use client"
import { useEffect, useState } from "react"

interface HealthCheck {
  component: string
  status: "healthy" | "degraded" | "unhealthy"
  message: string
  responseTime?: number
}

export default function HealthStatus() {
  const [checks, setChecks] = useState<HealthCheck[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch("/api/v1/admin/health")
      .then((r) => r.json())
      .then((d) => d.success && setChecks(d.data))
      .finally(() => setLoading(false))
  }, [])
  if (loading) return <div className="py-8 text-center w-full min-w-0">Loading...</div>
  return (
    <div className="space-y-4">
      {checks.map((check) => (
        <div key={check.component} className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold capitalize">{check.component}</h3>
              <p className="text-sm text-[var(--token-text-secondary)]">{check.message}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              check.status === "healthy" ? "bg-green-500/20 text-green-500" :
              check.status === "degraded" ? "bg-yellow-500/20 text-yellow-500" :
              "bg-red-500/20 text-red-500"
            }`}>
              {check.status}
            </div>
          </div>
          {check.responseTime && (
            <p className="mt-2 text-xs text-[var(--token-text-muted)]">Response time: {check.responseTime}ms</p>
          )}
        </div>
      ))}
    </div>
  )
}

