/**
 * @fileoverview Admin log viewer component
 *
 * @created 2025-01-29
 * @creator System
 * @lastModified 2025-01-29
 *
 * @description Displays application logs with search, filters, and pagination
 *
 * @purpose Provides log viewing capabilities for troubleshooting and monitoring
 *
 * @relatedFiles
 * - src/app/api/v1/admin/logs/route.ts (API endpoint)
 * - src/app/api/v1/admin/logs/sources/route.ts (log sources endpoint)
 */

"use client"
import { useEffect, useState, useCallback } from "react"

interface LogEntry {
  timestamp: string
  level: string
  service: string
  message: string
  metadata?: unknown
}

interface LogSource {
  id: string
  name: string
  description: string
}

export default function LogViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [sources, setSources] = useState<LogSource[]>([])
  const [selectedSource, setSelectedSource] = useState<string>("all")
  const [levelFilter, setLevelFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const pageSize = 50

  const fetchSources = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/admin/logs/sources")
      const data = await response.json()
      if (data.success) {
        setSources(data.data.sources || [])
      }
    } catch (err) {
      console.error("Failed to fetch log sources:", err)
    }
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })

      if (levelFilter !== "all") {
        params.append("level", levelFilter)
      }

      if (selectedSource !== "all") {
        params.append("source", selectedSource)
      }

      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim())
      }

      if (startDate) {
        params.append("startDate", new Date(startDate).toISOString())
      }

      if (endDate) {
        params.append("endDate", new Date(endDate).toISOString())
      }

      const response = await fetch(`/api/v1/admin/logs?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.data.logs || [])
        setTotalPages(Math.ceil((data.data.total || 0) / pageSize))
        setTotal(data.data.total || 0)
      } else {
        setError(data.error?.message || "Failed to fetch logs")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [page, levelFilter, selectedSource, searchQuery, startDate, endDate])

  useEffect(() => {
    fetchSources()
  }, [fetchSources])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Get unique levels for filters
  const uniqueLevels = Array.from(new Set(logs.map((log) => log.level))).sort()

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "error":
        return "text-[var(--token-text-error)]"
      case "warn":
      case "warning":
        return "text-[var(--token-status-warning-text)]"
      case "info":
        return "text-[var(--token-text-primary)]"
      case "debug":
        return "text-[var(--token-text-muted)]"
      default:
        return "text-[var(--token-text-secondary)]"
    }
  }

  if (loading && logs.length === 0) {
    return (
      <div className="py-8 text-center text-[var(--token-text-secondary)] w-full min-w-0">
        Loading logs...
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

      {/* Filters */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label
            htmlFor="log-search"
            className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
          >
            Search
          </label>
          <input
            id="log-search"
            type="search"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          />
        </div>

        <div>
          <label
            htmlFor="level-filter"
            className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
          >
            Log Level
          </label>
          <select
            id="level-filter"
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            <option value="all">All levels</option>
            {uniqueLevels.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        {sources.length > 0 && (
          <div>
            <label
              htmlFor="source-filter"
              className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
            >
              Source
            </label>
            <select
              id="source-filter"
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
            >
              <option value="all">All sources</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label
            htmlFor="log-start-date"
            className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
          >
            Start Date
          </label>
          <input
            id="log-start-date"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          />
        </div>

        <div>
          <label
            htmlFor="log-end-date"
            className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
          >
            End Date
          </label>
          <input
            id="log-end-date"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          />
        </div>
      </div>

      {/* Logs Display */}
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6">
        {logs.length === 0 ? (
          <p className="text-sm text-[var(--token-text-secondary)]">No logs found.</p>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {logs.map((log, index) => (
              <div
                key={index}
                className="border-b border-[var(--token-border-muted)] pb-2 last:border-b-0"
              >
                <div className="flex items-start gap-2 text-xs">
                  <span className="text-[var(--token-text-muted)]">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span className={`font-medium ${getLevelColor(log.level)}`}>{log.level}</span>
                  <span className="text-[var(--token-text-secondary)]">{log.service}</span>
                </div>
                <p className="mt-1 text-sm text-[var(--token-text-primary)]">{log.message}</p>
                {log.metadata ? (
                  <pre className="mt-2 p-2 rounded-md bg-[var(--token-surface)] text-xs text-[var(--token-text-primary)] overflow-x-auto">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--token-text-secondary)]">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}{" "}
            logs
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="flex items-center px-3 py-2 text-sm text-[var(--token-text-secondary)]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
