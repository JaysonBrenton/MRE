/**
 * @fileoverview Admin tracks table component with search, filters, and follow/unfollow toggle
 *
 * @created 2025-01-29
 * @creator System
 * @lastModified 2025-01-29
 *
 * @description Displays tracks in a table with management actions
 *
 * @purpose Provides track management with search, filtering, and follow/unfollow functionality
 *
 * @relatedFiles
 * - src/app/api/v1/admin/tracks/route.ts (API endpoint)
 * - src/app/api/v1/admin/tracks/[trackId]/route.ts (update endpoint)
 */

"use client"
import { useEffect, useState, useCallback } from "react"
import ListPagination from "../event-analysis/ListPagination"
import ChartContainer from "../event-analysis/ChartContainer"

interface Track {
  id: string
  trackName: string
  source: string
  isFollowed: boolean
  isActive: boolean
  eventCount: number
}

export default function TracksTable() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [searchQuery, setSearchQuery] = useState("")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [isFollowedFilter, setIsFollowedFilter] = useState<string>("all")
  const [isActiveFilter, setIsActiveFilter] = useState<string>("all")
  const [updatingTrack, setUpdatingTrack] = useState<string | null>(null)

  const fetchTracks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: itemsPerPage.toString(),
      })

      if (sourceFilter !== "all") {
        params.append("source", sourceFilter)
      }

      if (isFollowedFilter !== "all") {
        params.append("isFollowed", isFollowedFilter === "true" ? "true" : "false")
      }

      if (isActiveFilter !== "all") {
        params.append("isActive", isActiveFilter === "true" ? "true" : "false")
      }

      const response = await fetch(`/api/v1/admin/tracks?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        setTracks(data.data.tracks || [])
        setTotalPages(data.data.totalPages || 1)
        setTotal(data.data.total || 0)
      } else {
        setError(data.error?.message || "Failed to fetch tracks")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [page, itemsPerPage, sourceFilter, isFollowedFilter, isActiveFilter])

  useEffect(() => {
    fetchTracks()
  }, [fetchTracks])

  const handleToggleFollow = async (track: Track) => {
    setUpdatingTrack(track.id)
    try {
      const response = await fetch(`/api/v1/admin/tracks/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isFollowed: !track.isFollowed,
        }),
      })

      const data = await response.json()
      if (data.success) {
        setTracks(tracks.map((t) => (t.id === track.id ? data.data : t)))
      } else {
        setError(data.error?.message || "Failed to update track")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setUpdatingTrack(null)
    }
  }

  // Client-side search
  const filteredTracks = tracks.filter((track) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return track.trackName.toLowerCase().includes(query)
    }
    return true
  })

  // Get unique sources for filter
  const uniqueSources = Array.from(new Set(tracks.map((t) => t.source))).sort()

  if (loading && tracks.length === 0) {
    return (
      <ChartContainer
        title="Tracks"
        aria-label="Tracks table - loading"
      >
        <div className="flex items-center justify-center h-64 text-[var(--token-text-secondary)]">
          Loading tracks...
        </div>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer
      title="Tracks"
      aria-label="Tracks table with search, filtering, and management actions"
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-md border border-[var(--token-border-error)] bg-[var(--token-surface-elevated)] p-3">
            <p className="text-sm text-[var(--token-text-error)]">{error}</p>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="flex-1">
          <label htmlFor="track-search" className="sr-only">
            Search tracks
          </label>
          <input
            id="track-search"
            type="search"
            placeholder="Search by track name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] placeholder-[var(--token-form-placeholder)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="source-filter" className="text-sm text-[var(--token-text-secondary)]">
            Source:
          </label>
          <select
            id="source-filter"
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            <option value="all">All</option>
            {uniqueSources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="followed-filter" className="text-sm text-[var(--token-text-secondary)]">
            Followed:
          </label>
          <select
            id="followed-filter"
            value={isFollowedFilter}
            onChange={(e) => {
              setIsFollowedFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            <option value="all">All</option>
            <option value="true">Followed</option>
            <option value="false">Not followed</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="active-filter" className="text-sm text-[var(--token-text-secondary)]">
            Active:
          </label>
          <select
            id="active-filter"
            value={isActiveFilter}
            onChange={(e) => {
              setIsActiveFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-md border border-[var(--token-form-border)] bg-[var(--token-form-background)] px-3 py-2 text-sm text-[var(--token-text-primary)] focus:border-[var(--token-form-border-focus)] focus:outline-none focus:ring-1 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            <option value="all">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--token-border-default)]">
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Track
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Source
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Events
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Followed
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Active
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-[var(--token-surface)]">
            {filteredTracks.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-[var(--token-text-secondary)]"
                >
                  {searchQuery ? "No tracks match your search." : "No tracks found."}
                </td>
              </tr>
            ) : (
              filteredTracks.map((track) => (
                <tr
                  key={track.id}
                  className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)]"
                >
                  <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)]">
                    {track.trackName}
                  </td>
                  <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-secondary)]">
                    {track.source}
                  </td>
                  <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-secondary)]">
                    {track.eventCount}
                  </td>
                  <td className="px-4 py-3 text-sm font-normal">
                    {track.isFollowed ? (
                      <span className="text-[var(--token-text-success)]">Yes</span>
                    ) : (
                      <span className="text-[var(--token-text-secondary)]">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-normal">
                    {track.isActive ? (
                      <span className="text-[var(--token-text-success)]">Yes</span>
                    ) : (
                      <span className="text-[var(--token-text-secondary)]">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-normal">
                    <button
                      onClick={() => handleToggleFollow(track)}
                      disabled={updatingTrack === track.id}
                      className="text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={track.isFollowed ? "Unfollow track" : "Follow track"}
                    >
                      {updatingTrack === track.id
                        ? "Updating..."
                        : track.isFollowed
                          ? "Unfollow"
                          : "Follow"}
                    </button>
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
        itemLabel="tracks"
        rowsPerPageOptions={[5, 10, 25, 50, 100]}
        onRowsPerPageChange={(newRowsPerPage) => {
          setItemsPerPage(newRowsPerPage)
          setPage(1)
        }}
      />
      </div>
    </ChartContainer>
  )
}
