/**
 * @fileoverview Admin health status component
 * 
 * @created 2025-01-29
 * @creator System
 * @lastModified 2025-01-29
 * 
 * @description Displays system health checks with refresh capability
 * 
 * @purpose Provides health monitoring with manual refresh and status indicators
 * 
 * @relatedFiles
 * - src/app/api/v1/admin/health/route.ts (API endpoint)
 */

"use client"
import { useEffect, useState, useCallback } from "react"

interface HealthCheck {
  component: string
  status: "healthy" | "degraded" | "unhealthy"
  message: string
  responseTime?: number
}

export default function HealthStatus() {
  const [checks, setChecks] = useState<HealthCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/v1/admin/health")
      const data = await response.json()
      if (data.success) {
        // The API returns an array of health checks, not an object
        const healthChecks = data.data as Array<{
          component: string
          status: "healthy" | "degraded" | "unhealthy"
          message: string
          responseTime?: number
        }>
        
        // Transform the array to match our interface
        const checksArray: HealthCheck[] = healthChecks.map((check) => ({
          component: check.component
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '), // Convert "ingestion_service" to "Ingestion Service"
          status: check.status,
          message: check.message,
          responseTime: check.responseTime,
        }))

        setChecks(checksArray)
      } else {
        setError(data.error?.message || "Failed to fetch health status")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  // Calculate overall health
  const overallStatus =
    checks.length === 0
      ? "unknown"
      : checks.every((c) => c.status === "healthy")
        ? "healthy"
        : checks.some((c) => c.status === "unhealthy")
          ? "unhealthy"
          : "degraded"

  if (loading && checks.length === 0) {
    return (
      <div className="py-8 text-center text-[var(--token-text-secondary)] w-full min-w-0">
        Loading health status...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-[var(--token-border-error)] bg-[var(--token-surface-elevated)] p-3">
          <p className="text-sm text-[var(--token-text-error)]">{error}</p>
        </div>
      )}

      {/* Overall Health Summary */}
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[var(--token-text-primary)]">Overall Status</h2>
            <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
              {checks.length} component{checks.length !== 1 ? "s" : ""} checked
            </p>
          </div>
          <div
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              overallStatus === "healthy"
                ? "bg-[var(--token-status-success-bg)] text-[var(--token-status-success-text)]"
                : overallStatus === "degraded"
                  ? "bg-[var(--token-status-warning-bg)] text-[var(--token-status-warning-text)]"
                  : overallStatus === "unhealthy"
                    ? "bg-[var(--token-status-error-bg)] text-[var(--token-status-error-text)]"
                    : "bg-[var(--token-surface)] text-[var(--token-text-secondary)]"
            }`}
          >
            {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1)}
          </div>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="mt-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Individual Health Checks */}
      <div className="space-y-4">
        {checks.map((check) => (
          <div
            key={check.component}
            className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--token-text-primary)] capitalize">
                  {check.component}
                </h3>
                <p className="mt-1 text-sm text-[var(--token-text-secondary)]">{check.message}</p>
              </div>
              <div
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  check.status === "healthy"
                    ? "bg-[var(--token-status-success-bg)] text-[var(--token-status-success-text)]"
                    : check.status === "degraded"
                      ? "bg-[var(--token-status-warning-bg)] text-[var(--token-status-warning-text)]"
                      : "bg-[var(--token-status-error-bg)] text-[var(--token-status-error-text)]"
                }`}
              >
                {check.status}
              </div>
            </div>
            {check.responseTime !== undefined && (
              <p className="mt-2 text-xs text-[var(--token-text-muted)]">
                Response time: {check.responseTime}ms
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

