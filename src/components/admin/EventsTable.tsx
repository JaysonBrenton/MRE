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
import { useCallback, useEffect, useMemo, useState } from "react"
import DeleteConfirmationDialog from "./DeleteConfirmationDialog"
import Modal from "@/components/ui/Modal"
import ListPagination from "../event-analysis/ListPagination"
import ChartContainer from "../event-analysis/ChartContainer"

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
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [reingestEvent, setReingestEvent] = useState<Event | null>(null)
  const [deleteEvent, setDeleteEvent] = useState<Event | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: itemsPerPage.toString(),
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
  }, [ingestDepthFilter, page, itemsPerPage])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

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

  const handleReingest = async () => {
    if (!reingestEvent) return

    setActionLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/admin/events/${reingestEvent.id}/reingest`, {
        method: "POST",
      })

      const data = await response.json()
      if (data.success) {
        setReingestEvent(null)
        fetchEvents() // Refresh events
      } else {
        setError(data.error?.message || "Failed to mark event for re-ingestion")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteEvent) return

    setActionLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/v1/admin/events/${deleteEvent.id}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (data.success) {
        setDeleteEvent(null)
        fetchEvents() // Refresh events
      } else {
        setError(data.error?.message || "Failed to delete event")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading && events.length === 0) {
    return (
      <ChartContainer
        title="Events"
        aria-label="Events table - loading"
      >
        <div className="flex items-center justify-center h-64 text-[var(--token-text-secondary)]">
          Loading events...
        </div>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer
      title="Events"
      aria-label="Events table with search, filtering, sorting, and management actions"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-[var(--token-border-error)] bg-[var(--token-surface-elevated)] p-3">
            <p className="text-sm text-[var(--token-text-error)]">{error}</p>
          </div>
        )}

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
          <label
            htmlFor="ingest-depth-filter"
            className="text-sm text-[var(--token-text-secondary)]"
          >
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
              <th
                className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                aria-sort={
                  sortField === "eventName"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button
                  type="button"
                  onClick={() => handleSort("eventName")}
                  className="text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
                  aria-label={`Sort by event name ${sortField === "eventName" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
                >
                  Event
                  {sortField === "eventName" && (
                    <span className="ml-2" aria-hidden="true">
                      {sortDirection === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                aria-sort={
                  sortField === "trackName"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button
                  type="button"
                  onClick={() => handleSort("trackName")}
                  className="text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
                  aria-label={`Sort by track name ${sortField === "trackName" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
                >
                  Track
                  {sortField === "trackName" && (
                    <span className="ml-2" aria-hidden="true">
                      {sortDirection === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                aria-sort={
                  sortField === "eventDate"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button
                  type="button"
                  onClick={() => handleSort("eventDate")}
                  className="text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
                  aria-label={`Sort by event date ${sortField === "eventDate" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
                >
                  Date
                  {sortField === "eventDate" && (
                    <span className="ml-2" aria-hidden="true">
                      {sortDirection === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                aria-sort={
                  sortField === "ingestDepth"
                    ? sortDirection === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button
                  type="button"
                  onClick={() => handleSort("ingestDepth")}
                  className="text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
                  aria-label={`Sort by status ${sortField === "ingestDepth" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
                >
                  Status
                  {sortField === "ingestDepth" && (
                    <span className="ml-2" aria-hidden="true">
                      {sortDirection === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedEvents.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[var(--token-text-secondary)]"
                >
                  {searchQuery ? "No events match your search." : "No events found."}
                </td>
              </tr>
            ) : (
              filteredAndSortedEvents.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)]"
                >
                  <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)]">{e.eventName}</td>
                  <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-secondary)]">
                    {e.track.trackName}
                  </td>
                  <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-secondary)]">
                    {new Date(e.eventDate).toLocaleDateString()}
                  </td>
                  <td className={`px-4 py-3 text-sm font-normal ${getStatusColor(e.ingestDepth)}`}>
                    {getStatusLabel(e.ingestDepth)}
                  </td>
                  <td className="px-4 py-3 text-sm font-normal">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setReingestEvent(e)}
                        className="text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md px-2 py-1"
                        aria-label={`Re-ingest ${e.eventName}`}
                      >
                        Re-ingest
                      </button>
                      <button
                        onClick={() => setDeleteEvent(e)}
                        className="text-[var(--token-text-error)] hover:text-[var(--token-text-error)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md px-2 py-1"
                        aria-label={`Delete ${e.eventName}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
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
        itemLabel="events"
        rowsPerPageOptions={[5, 10, 25, 50, 100]}
        onRowsPerPageChange={(newRowsPerPage) => {
          setItemsPerPage(newRowsPerPage)
          setPage(1)
        }}
      />

      {/* Re-ingest Modal */}
      <Modal
        isOpen={reingestEvent !== null}
        onClose={() => setReingestEvent(null)}
        title="Re-ingest Event"
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setReingestEvent(null)}
              disabled={actionLoading}
              className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReingest}
              disabled={actionLoading}
              className="rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? "Marking..." : "Mark for Re-ingestion"}
            </button>
          </div>
        }
      >
        <div className="px-4 py-4">
          <p className="text-sm text-[var(--token-text-primary)]">
            Are you sure you want to mark this event for re-ingestion?
          </p>
          {reingestEvent && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-[var(--token-text-primary)]">
                {reingestEvent.eventName}
              </p>
              <p className="text-sm text-[var(--token-text-secondary)]">
                Track: {reingestEvent.track.trackName}
              </p>
              <p className="text-sm text-[var(--token-text-secondary)]">
                Date: {new Date(reingestEvent.eventDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteEvent !== null}
        onClose={() => setDeleteEvent(null)}
        onConfirm={handleDelete}
        title="Delete Event"
        message="Are you sure you want to delete this event? This will permanently delete the event and all associated data including races, results, and lap data. This action cannot be undone."
        itemName={
          deleteEvent ? `${deleteEvent.eventName} (${deleteEvent.track.trackName})` : undefined
        }
        loading={actionLoading}
      />
      </div>
    </ChartContainer>
  )
}
