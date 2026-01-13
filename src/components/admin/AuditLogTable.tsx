/**
 * @fileoverview Admin audit log table component with filters, expandable rows, and pagination
 *
 * @created 2025-01-29
 * @creator System
 * @lastModified 2025-01-29
 *
 * @description Displays audit logs in a table with filtering and expandable details
 *
 * @purpose Provides comprehensive audit log viewing with search, filters, and detailed view
 *
 * @relatedFiles
 * - src/app/api/v1/admin/audit/route.ts (API endpoint)
 */

"use client"
import { useEffect, useState, useCallback } from "react"
import ListPagination from "../event-analysis/ListPagination"
import ChartContainer from "../event-analysis/ChartContainer"

interface AuditLog {
  id: string
  userId: string | null
  action: string
  resourceType: string
  resourceId: string | null
  details: unknown
  createdAt: string
  user?: { email: string } | null
}

export default function AuditLogTable() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [actionFilter, setActionFilter] = useState("")
  const [resourceTypeFilter, setResourceTypeFilter] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: itemsPerPage.toString(),
      })

      if (actionFilter) {
        params.append("action", actionFilter)
      }

      if (resourceTypeFilter) {
        params.append("resourceType", resourceTypeFilter)
      }

      if (startDate) {
        params.append("startDate", new Date(startDate).toISOString())
      }

      if (endDate) {
        params.append("endDate", new Date(endDate).toISOString())
      }

      const response = await fetch(`/api/v1/admin/audit?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setLogs(data.data.logs || [])
        setTotalPages(data.data.totalPages || 1)
        setTotal(data.data.total || 0)
      } else {
        setError(data.error?.message || "Failed to fetch audit logs")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [page, itemsPerPage, actionFilter, resourceTypeFilter, startDate, endDate])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const toggleRow = (logId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpandedRows(newExpanded)
  }

  // Get unique action types and resource types for filters
  const uniqueActions = Array.from(new Set(logs.map((log) => log.action))).sort()
  const uniqueResourceTypes = Array.from(new Set(logs.map((log) => log.resourceType))).sort()

  if (loading && logs.length === 0) {
    return (
      <ChartContainer
        title="Audit Log"
        aria-label="Audit log table - loading"
      >
        <div className="flex items-center justify-center h-64 text-[var(--token-text-secondary)]">
          Loading audit logs...
        </div>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer
      title="Audit Log"
      aria-label="Audit log table with filtering and expandable details"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-[var(--token-border-error)] bg-[var(--token-surface-elevated)] p-3">
            <p className="text-sm text-[var(--token-text-error)]">{error}</p>
          </div>
        )}

        {/* Filters */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor="action-filter"
            className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
          >
            Action Type
          </label>
          <select
            id="action-filter"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            <option value="">All actions</option>
            {uniqueActions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="resource-type-filter"
            className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
          >
            Resource Type
          </label>
          <select
            id="resource-type-filter"
            value={resourceTypeFilter}
            onChange={(e) => {
              setResourceTypeFilter(e.target.value)
              setPage(1)
            }}
            className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            <option value="">All resources</option>
            {uniqueResourceTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="start-date"
            className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
          >
            Start Date
          </label>
          <input
            id="start-date"
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
            htmlFor="end-date"
            className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
          >
            End Date
          </label>
          <input
            id="end-date"
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--token-border-default)]">
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Time
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                User
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Action
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Resource
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[var(--token-text-secondary)]"
                >
                  No audit logs found.
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const isExpanded = expandedRows.has(log.id)
                return (
                  <>
                    <tr
                      key={log.id}
                      className="border-b border-[var(--token-border-muted)] hover:bg-[var(--token-surface-raised)] cursor-pointer"
                      onClick={() => toggleRow(log.id)}
                    >
                      <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)]">
                        {log.user?.email || "System"}
                      </td>
                      <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)]">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-secondary)]">
                        {log.resourceType}
                        {log.resourceId ? ` (${log.resourceId.substring(0, 8)}...)` : ""}
                      </td>
                      <td className="px-4 py-3 text-sm font-normal">
                        <button
                          className="text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                          aria-label={isExpanded ? "Collapse details" : "Expand details"}
                        >
                          {isExpanded ? "▼" : "▶"}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr
                        key={`${log.id}-details`}
                        className="border-b border-[var(--token-border-muted)]"
                      >
                        <td colSpan={5} className="px-4 py-4 bg-[var(--token-surface-elevated)]">
                          <div className="space-y-2">
                            <div>
                              <span className="text-sm font-medium text-[var(--token-text-primary)]">
                                Full Details:
                              </span>
                              <pre className="mt-2 p-3 rounded-md bg-[var(--token-surface)] text-xs text-[var(--token-text-primary)] overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                            {log.resourceId && (
                              <div className="text-sm text-[var(--token-text-secondary)]">
                                Resource ID: {log.resourceId}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <ListPagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        itemsPerPage={itemsPerPage}
        totalItems={total}
        itemLabel="logs"
        rowsPerPageOptions={[5, 25, 50, 100, 200]}
        onRowsPerPageChange={(newRowsPerPage) => {
          setItemsPerPage(newRowsPerPage)
          setPage(1)
        }}
      />
      </div>
    </ChartContainer>
  )
}
