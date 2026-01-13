/**
 * @fileoverview Client component for Events list page with filtering and table/grid views
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Enhanced client-side component for displaying events list with comprehensive filtering
 * 
 * @purpose Handles client-side interactivity for the events page with:
 *          - Server-side filtering (track, date range, status, ordering, pagination)
 *          - Client-side name search on fetched page
 *          - Table and grid view toggle
 *          - All event columns displayed
 */

"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import ChartContainer from "../event-analysis/ChartContainer"

interface ImportedEvent {
  id: string
  source: string
  sourceEventId: string
  eventName: string
  eventDate: string | null
  eventEntries: number
  eventDrivers: number
  eventUrl: string
  ingestDepth: string
  lastIngestedAt: string | null
  track: {
    id: string
    trackName: string
  }
}

interface Track {
  id: string
  trackName: string
}

interface EventsResponse {
  success: true
  data: {
    events: ImportedEvent[]
    pagination: {
      total: number
      limit: number
      offset: number
    }
  }
}

interface TracksResponse {
  success: true
  data: {
    tracks: Track[]
  }
}

type ViewMode = 'table' | 'grid'
type OrderBy = 'eventDate' | 'eventName' | 'trackName' | 'eventEntries' | 'eventDrivers'
type OrderDirection = 'asc' | 'desc'

const formatEventDate = (eventDate: string | null): string => {
  if (!eventDate) {
    return "Date TBD"
  }

  const date = new Date(eventDate)
  if (isNaN(date.getTime())) {
    return "Invalid date"
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

const formatDateTime = (dateString: string | null): string => {
  if (!dateString) {
    return "Never"
  }

  const date = new Date(dateString)
  if (isNaN(date.getTime())) {
    return "Invalid date"
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function EventsPageClient() {
  const router = useRouter()
  
  // View state - initialize to 'table' to match server render, then load from localStorage after mount
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  
  // Load view mode preference from localStorage after component mounts (prevents hydration mismatch)
  useEffect(() => {
    const saved = localStorage.getItem('eventsViewMode')
    if (saved === 'table' || saved === 'grid') {
      setViewMode(saved)
    }
  }, [])

  // Server-side filters
  const [trackId, setTrackId] = useState<string>("")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [orderBy, setOrderBy] = useState<OrderBy>('eventDate')
  const [orderDirection, setOrderDirection] = useState<OrderDirection>('desc')
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Client-side filter
  const [nameSearch, setNameSearch] = useState<string>("")

  // Track autocomplete state
  const [trackSearch, setTrackSearch] = useState<string>("")
  const [isTrackDropdownOpen, setIsTrackDropdownOpen] = useState(false)
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number>(-1)

  // Data state
  const [events, setEvents] = useState<ImportedEvent[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch tracks for filter dropdown
  useEffect(() => {
    async function fetchTracks() {
      try {
        // Fetch all active tracks (not just followed ones) for the filter dropdown
        const response = await fetch("/api/v1/tracks?active=true&followed=false")
        if (response.ok) {
          const data: TracksResponse = await response.json()
          if (data.success && data.data.tracks) {
            setTracks(data.data.tracks)
          } else {
            console.warn("Tracks API returned unsuccessful response:", data)
          }
        } else {
          console.error("Failed to fetch tracks:", response.status, response.statusText)
        }
      } catch (err) {
        console.error("Failed to fetch tracks:", err)
      }
    }
    fetchTracks()
  }, [])

  // Fetch events with server-side filters
  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          limit: pageSize.toString(),
          offset: ((page - 1) * pageSize).toString(),
          orderBy: orderBy,
          orderDirection: orderDirection,
        })

        if (trackId) {
          params.append("trackId", trackId)
        }
        if (startDate) {
          params.append("startDate", startDate)
        }
        if (endDate) {
          params.append("endDate", endDate)
        }

        const response = await fetch(`/api/v1/events?${params.toString()}`)

        if (!response.ok) {
          throw new Error("Failed to fetch events")
        }

        const data: EventsResponse = await response.json()

        if (data.success) {
          setEvents(data.data.events)
          setTotal(data.data.pagination.total)
        } else {
          throw new Error("Invalid response format")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [trackId, startDate, endDate, orderBy, orderDirection, page])

  // Client-side name filtering
  const filteredEvents = useMemo(() => {
    if (!nameSearch.trim()) {
      return events
    }

    const query = nameSearch.toLowerCase()
    return events.filter((event) =>
      event.eventName.toLowerCase().includes(query)
    )
  }, [events, nameSearch])

  // Filter tracks for autocomplete
  const filteredTracks = useMemo(() => {
    if (!trackSearch.trim()) {
      return tracks
    }
    const query = trackSearch.toLowerCase()
    return tracks.filter((track) =>
      track.trackName.toLowerCase().includes(query)
    )
  }, [tracks, trackSearch])

  // Sync trackSearch with selected track when trackId changes
  useEffect(() => {
    if (trackId) {
      const track = tracks.find((t) => t.id === trackId)
      if (track) {
        setTrackSearch(track.trackName)
      }
    } else {
      setTrackSearch("")
    }
  }, [trackId, tracks])

  const handleEventClick = (eventId: string) => {
    router.push(`/events/analyse/${eventId}`)
  }

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('eventsViewMode', mode)
    }
  }

  const handleFilterChange = () => {
    setPage(1) // Reset to first page when filters change
  }

  const handleTrackSelect = (track: Track | null) => {
    setTrackId(track?.id || "")
    setTrackSearch(track?.trackName || "")
    setIsTrackDropdownOpen(false)
    setSelectedTrackIndex(-1)
    handleFilterChange()
  }

  const handleTrackInputChange = (value: string) => {
    setTrackSearch(value)
    setIsTrackDropdownOpen(true)
    setSelectedTrackIndex(-1)
    // If input is cleared, clear the selection
    if (!value.trim()) {
      setTrackId("")
    }
  }

  const handleTrackInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isTrackDropdownOpen || filteredTracks.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedTrackIndex((prev) => 
          prev < filteredTracks.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedTrackIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedTrackIndex >= 0 && selectedTrackIndex < filteredTracks.length) {
          handleTrackSelect(filteredTracks[selectedTrackIndex])
        } else if (filteredTracks.length === 1) {
          handleTrackSelect(filteredTracks[0])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsTrackDropdownOpen(false)
        setSelectedTrackIndex(-1)
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.track-autocomplete-container')) {
        setIsTrackDropdownOpen(false)
        setSelectedTrackIndex(-1)
      }
    }

    if (isTrackDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isTrackDropdownOpen])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-semibold text-[var(--token-text-primary)]">
          Events
        </h1>
        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleViewModeChange('table')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-[var(--token-accent)] text-white'
                : 'bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)]'
            }`}
            aria-label="Table view"
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange('grid')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'grid'
                ? 'bg-[var(--token-accent)] text-white'
                : 'bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)]'
            }`}
            aria-label="Grid view"
          >
            Grid
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-4 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Name Search (Client-side) */}
          <div>
            <label htmlFor="name-search" className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1">
              Search by Name
            </label>
            <input
              id="name-search"
              type="text"
              placeholder="Event name..."
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
            />
          </div>

          {/* Track Filter (Server-side) - Type-ahead autocomplete */}
          <div className="track-autocomplete-container relative">
            <label htmlFor="track-filter" className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1">
              Track
            </label>
            <div className="relative">
              <input
                id="track-filter"
                type="text"
                placeholder="Search tracks..."
                value={trackSearch}
                onChange={(e) => handleTrackInputChange(e.target.value)}
                onFocus={() => setIsTrackDropdownOpen(true)}
                onKeyDown={handleTrackInputKeyDown}
                className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
                autoComplete="off"
              />
              {trackId && (
                <button
                  type="button"
                  onClick={() => handleTrackSelect(null)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)] rounded"
                  aria-label="Clear track selection"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {isTrackDropdownOpen && filteredTracks.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-[var(--token-surface-elevated)] border border-[var(--token-border-default)] rounded-md shadow-lg max-h-60 overflow-auto">
                  <button
                    type="button"
                    onClick={() => handleTrackSelect(null)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--token-surface-raised)] focus:bg-[var(--token-surface-raised)] focus:outline-none ${
                      !trackId ? 'bg-[var(--token-surface)]' : 'text-[var(--token-text-primary)]'
                    }`}
                  >
                    All Tracks
                  </button>
                  {filteredTracks.map((track, index) => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => handleTrackSelect(track)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--token-surface-raised)] focus:bg-[var(--token-surface-raised)] focus:outline-none ${
                        selectedTrackIndex === index
                          ? 'bg-[var(--token-surface)]'
                          : trackId === track.id
                          ? 'bg-[var(--token-surface)] font-medium'
                          : 'text-[var(--token-text-primary)]'
                      }`}
                    >
                      {track.trackName}
                    </button>
                  ))}
                </div>
              )}
              {isTrackDropdownOpen && trackSearch.trim() && filteredTracks.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-[var(--token-surface-elevated)] border border-[var(--token-border-default)] rounded-md shadow-lg px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                  No tracks found
                </div>
              )}
            </div>
          </div>

          {/* Order By (Server-side) */}
          <div>
            <label htmlFor="order-by" className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1">
              Sort By
            </label>
            <div className="flex gap-2">
              <select
                id="order-by"
                value={orderBy}
                onChange={(e) => {
                  setOrderBy(e.target.value as OrderBy)
                  handleFilterChange()
                }}
                className="flex-1 rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
              >
                <option value="eventDate">Date</option>
                <option value="eventName">Name</option>
                <option value="trackName">Track</option>
                <option value="eventEntries">Entries</option>
                <option value="eventDrivers">Drivers</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setOrderDirection(orderDirection === 'asc' ? 'desc' : 'asc')
                  handleFilterChange()
                }}
                className="px-3 py-2 rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
                aria-label={`Sort ${orderDirection === 'asc' ? 'ascending' : 'descending'}`}
              >
                {orderDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Date Range Filters */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="start-date" className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                handleFilterChange()
              }}
              className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
            />
          </div>
          <div>
            <label htmlFor="end-date" className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                handleFilterChange()
              }}
              className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
            />
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12 w-full min-w-0">
          <p className="text-[var(--token-text-muted)]">Loading events...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-12 w-full min-w-0">
          <p className="text-red-500">Error: {error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredEvents.length === 0 && (
        <div className="text-center py-12 space-y-4 w-full min-w-0">
          <p className="text-[var(--token-text-muted)]">
            {nameSearch ? "No events match your search." : "No imported events found yet. Use Event Search to discover LiveRC races and import them into your workspace."}
          </p>
          {!nameSearch && (
            <Link
              href="/event-search"
              className="inline-flex items-center justify-center rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-accent)]"
            >
              Search for events
            </Link>
          )}
        </div>
      )}

      {/* Table View */}
      {!loading && !error && filteredEvents.length > 0 && viewMode === 'table' && (
        <ChartContainer
          title="Events"
          aria-label="Events table with sorting, filtering, and pagination"
        >
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--token-border-default)]">
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Event Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Track
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Entries
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Drivers
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Last Ingested
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)] cursor-pointer"
                    onClick={() => handleEventClick(event.id)}
                  >
                    <td className="px-4 py-3 text-[var(--token-text-primary)]">{event.eventName}</td>
                    <td className="px-4 py-3 text-[var(--token-text-secondary)]">{event.track.trackName}</td>
                    <td className="px-4 py-3 text-[var(--token-text-secondary)]">
                      {formatEventDate(event.eventDate)}
                    </td>
                    <td className="px-4 py-3 text-[var(--token-text-secondary)]">{event.eventEntries}</td>
                    <td className="px-4 py-3 text-[var(--token-text-secondary)]">{event.eventDrivers}</td>
                    <td className="px-4 py-3 text-[var(--token-text-secondary)] text-sm">
                      {formatDateTime(event.lastIngestedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mb-8">
              <div className="text-sm text-[var(--token-text-secondary)]">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} events
                {nameSearch && ` (filtered from ${events.length} on this page)`}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
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
                  type="button"
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
        </ChartContainer>
      )}

      {/* Grid View */}
      {!loading && !error && filteredEvents.length > 0 && viewMode === 'grid' && (
        <div className="space-y-4">
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className="group rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)] p-6 transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer"
                onClick={() => handleEventClick(event.id)}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="mb-1 text-lg font-semibold text-[var(--token-text-primary)]">
                      {event.eventName}
                    </h3>
                    <p className="text-sm text-[var(--token-text-secondary)]">
                      {event.track.trackName}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="text-[var(--token-text-muted)]">
                    <span className="font-medium">Date:</span> {formatEventDate(event.eventDate)}
                  </p>
                  <p className="text-[var(--token-text-muted)]">
                    <span className="font-medium">Entries:</span> {event.eventEntries}
                  </p>
                  <p className="text-[var(--token-text-muted)]">
                    <span className="font-medium">Drivers:</span> {event.eventDrivers}
                  </p>
                  <p className="text-[var(--token-text-muted)]">
                    <span className="font-medium">Last Ingested:</span> {formatDateTime(event.lastIngestedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mb-8">
              <div className="text-sm text-[var(--token-text-secondary)]">
                Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, total)} of {total} events
                {nameSearch && ` (filtered from ${events.length} on this page)`}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
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
                  type="button"
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
      )}
    </div>
  )
}
