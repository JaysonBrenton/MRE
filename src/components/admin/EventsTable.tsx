/**
 * @fileoverview Admin events table component with sorting, filtering, search, and pagination
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Enhanced events table for admin console
 * 
 * @purpose Provides comprehensive event management with search, filtering, sorting, and pagination
 * 
 * @relatedFiles
 * - src/app/api/v1/admin/events/route.ts (API endpoint)
 */

"use client"
import { useEffect, useState, useMemo } from "react"

interface Event {
  id: string
  eventName: string
  eventDate: string
  ingestDepth: string
  track: { id: string; trackName: string }
}

interface EventsResponse {
  events: Event[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type SortField = "eventName" | "eventDate" | "trackName" | "ingestDepth"
type SortDirection = "asc" | "desc"
type IngestDepthFilter = "all" | "none" | "laps_full"

function getStatusLabel(ingestDepth: string): string {
  const normalized = ingestDepth?.trim().toLowerCase() || ""
  switch (normalized) {
    case "laps_full":
    case "lapsfull":
      return "Ready"
    case "none":
    case "":
      return "Not imported"
    default:
      return ingestDepth || "Unknown"
  }
}

function getStatusColor(ingestDepth: string): string {
  const normalized = ingestDepth?.trim().toLowerCase() || ""
  if (normalized === "laps_full" || normalized === "lapsfull") {
    return "text-[var(--token-status-success-text)]"
  }
  if (normalized === "none" || normalized === "") {
    return "text-[var(--token-status-info-text)]"
  }
  return "text-[var(--token-text-secondary)]"
}

export default function EventsTable() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("eventDate")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [ingestDepthFilter, setIngestDepthFilter] = useState<IngestDepthFilter>("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })
      
      if (ingestDepthFilter !== "all") {
        params.append("ingestDepth", ingestDepthFilter)
      }

      const response = await fetch(`/api/v1/admin/events?${params.toString()}`)
      const data = await response.json()
      
      if (data.success && data.data) {
        const result = data.data as EventsResponse
        setEvents(result.events || [])
        setTotalPages(result.totalPages || 1)
        setTotal(result.total || 0)
      }
    } catch (error) {
      console.error("Error fetching events:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [page, ingestDepthFilter])

  // Client-side search and sorting
  const filteredAndSortedEvents = useMemo(() => {
    let filtered = events

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (e) =>
          e.eventName.toLowerCase().includes(query) ||
          e.track.trackName.toLowerCase().includes(query)
      )
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case "eventName":
          comparison = a.eventName.localeCompare(b.eventName)
          break
        case "eventDate":
          comparison = new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
          break
        case "trackName":
          comparison = a.track.trackName.localeCompare(b.track.trackName)
          break
        case "ingestDepth":
          comparison = a.ingestDepth.localeCompare(b.ingestDepth)
          break
      }
      
      return sortDirection === "asc" ? comparison : -comparison
    })

    return sorted
  }, [events, searchQuery, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  if (loading && events.length === 0) {
    return (
      <div className="py-8 text-center text-[var(--token-text-secondary)] w-full min-w-0">
        Loading events...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <label htmlFor="events-search" className="sr-only">
            Search events or tracks
          </label>
          <input
            id="events-search"
            type="search"
            placeholder="Search events or tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
            aria-label="Search events or tracks"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="ingest-depth-filter" className="text-sm text-[var(--token-text-secondary)]">
            Status:
          </label>
          <select
            id="ingest-depth-filter"
            value={ingestDepthFilter}
            onChange={(e) => {
              setIngestDepthFilter(e.target.value as IngestDepthFilter)
              setPage(1)
            }}
            className="rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            <option value="all">All</option>
            <option value="none">Not imported</option>
            <option value="laps_full">Ready</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--token-border-default)]">
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  onClick={() => handleSort("eventName")}
                  className="text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
                  aria-label={`Sort by event name ${sortField === "eventName" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
                  aria-sort={sortField === "eventName" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                >
                  Event
                  {sortField === "eventName" && (
                    <span className="ml-2" aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  onClick={() => handleSort("trackName")}
                  className="text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
                  aria-label={`Sort by track name ${sortField === "trackName" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
                  aria-sort={sortField === "trackName" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                >
                  Track
                  {sortField === "trackName" && (
                    <span className="ml-2" aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  onClick={() => handleSort("eventDate")}
                  className="text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
                  aria-label={`Sort by event date ${sortField === "eventDate" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
                  aria-sort={sortField === "eventDate" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                >
                  Date
                  {sortField === "eventDate" && (
                    <span className="ml-2" aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  type="button"
                  onClick={() => handleSort("ingestDepth")}
                  className="text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
                  aria-label={`Sort by status ${sortField === "ingestDepth" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
                  aria-sort={sortField === "ingestDepth" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                >
                  Status
                  {sortField === "ingestDepth" && (
                    <span className="ml-2" aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedEvents.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[var(--token-text-secondary)]">
                  {searchQuery ? "No events match your search." : "No events found."}
                </td>
              </tr>
            ) : (
              filteredAndSortedEvents.map((e) => (
                <tr key={e.id} className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface)]">
                  <td className="px-4 py-3 text-[var(--token-text-primary)]">{e.eventName}</td>
                  <td className="px-4 py-3 text-[var(--token-text-secondary)]">{e.track.trackName}</td>
                  <td className="px-4 py-3 text-[var(--token-text-secondary)]">
                    {new Date(e.eventDate).toLocaleDateString()}
                  </td>
                  <td className={`px-4 py-3 ${getStatusColor(e.ingestDepth)}`}>
                    {getStatusLabel(e.ingestDepth)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--token-text-secondary)]">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} events
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="flex items-center px-3 py-2 text-sm text-[var(--token-text-secondary)]">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

