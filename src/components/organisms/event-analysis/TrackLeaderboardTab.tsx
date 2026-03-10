/**
 * @fileoverview Track Leader Board tab – main-race points leaderboard for a track
 *
 * @description Displays drivers ranked by points from main races at the track.
 *              Filterable by class and date range. One row per (driver, class).
 *
 * @relatedFiles
 * - src/core/tracks/get-track-leaderboard.ts (data)
 * - src/app/api/v1/events/[eventId]/track-leaderboard/route.ts (API)
 * - src/components/organisms/event-analysis/ListPagination.tsx (pagination)
 * - src/components/organisms/event-analysis/PracticeClassLeaderboard.tsx (styling reference)
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import ListPagination from "./ListPagination"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import { formatClassName } from "@/lib/format-class-name"

export type DateRangePreset = "all_time" | "this_year" | "last_12_months"

export interface TrackLeaderboardTabProps {
  eventId: string
  trackName: string
  selectedClass?: string | null
  onClassChange?: (className: string | null) => void
}

interface LeaderboardDriver {
  driverId: string
  driverName: string
  className: string
  points: number
  wins: number
  podiums: number
}

interface LeaderboardData {
  trackName: string
  drivers: LeaderboardDriver[]
  classes: string[]
}

export default function TrackLeaderboardTab({
  eventId,
  trackName,
  selectedClass,
  onClassChange,
}: TrackLeaderboardTabProps) {
  const [dateRange, setDateRange] = useState<DateRangePreset>("all_time")
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const fetchLeaderboard = useCallback(async () => {
    const eid = String(eventId ?? "").trim()
    if (!eid || eid === "undefined") {
      setError("Event not available. Please select an event first.")
      setData(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (selectedClass) params.set("class_name", selectedClass)
      else params.set("classes_only", "true")
      if (dateRange !== "all_time") params.set("date_range", dateRange)
      const url = `/api/v1/events/${encodeURIComponent(eid)}/track-leaderboard?${params.toString()}`
      const res = await fetch(url, { cache: "no-store", credentials: "include" })
      if (!res.ok) {
        let errMessage = `Failed to load leaderboard (${res.status})`
        const contentType = res.headers.get("content-type")
        if (contentType?.includes("application/json")) {
          const errData = await res.json().catch(() => ({}))
          const apiMessage = errData?.error?.message ?? errData?.message
          if (typeof apiMessage === "string") errMessage = apiMessage
        }
        throw new Error(errMessage)
      }
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
      } else {
        setData(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leaderboard")
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [eventId, selectedClass, dateRange])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [dateRange, selectedClass])

  const drivers = data?.drivers ?? []
  const classes = data?.classes ?? []

  const totalPages = Math.max(1, Math.ceil(drivers.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedDrivers = drivers.slice(startIndex, startIndex + itemsPerPage)

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setItemsPerPage(newRowsPerPage)
    setCurrentPage(1)
  }

  return (
    <div
      className="space-y-6"
      role="tabpanel"
      id="tabpanel-track-leader-board"
      aria-labelledby="tab-track-leader-board"
    >
      <div className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6">
        <h2 className="text-lg font-medium text-[var(--token-text-primary)] mb-4">
          Track Leader Board: {trackName}
        </h2>
        <p className="text-sm text-[var(--token-text-secondary)] mb-4">
          Drivers ranked by points from main races at {trackName}. Points: 1st=25, 2nd=18, 3rd=15,
          4th=12, 5th=10, then 8–1 for 6th–10th. Points are summed across all main races per driver
          and class. Ranking order: total points, then wins, then podiums.
        </p>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-4 mb-4 pb-3 border-b border-[var(--token-border-default)]">
          <div className="flex items-center gap-2">
            <label
              htmlFor="track-leaderboard-date-range"
              className="text-sm text-[var(--token-text-secondary)]"
            >
              Date range:
            </label>
            <select
              id="track-leaderboard-date-range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
              className="rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1.5 text-sm text-[var(--token-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
            >
              <option value="all_time">All time</option>
              <option value="this_year">This year</option>
              <option value="last_12_months">Last 12 months</option>
            </select>
          </div>
          {onClassChange && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="track-leaderboard-class"
                className="text-sm text-[var(--token-text-secondary)]"
              >
                Class:
              </label>
              <select
                id="track-leaderboard-class"
                value={selectedClass ?? ""}
                onChange={(e) => onClassChange(e.target.value || null)}
                className="rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1.5 text-sm text-[var(--token-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
              >
                <option value="">Select a class</option>
                {classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isLoading && (
          <p className="text-sm text-[var(--token-text-muted)]">Loading leaderboard…</p>
        )}
        {error && <p className="text-sm text-[var(--token-text-error)]">{error}</p>}
        {!isLoading && !error && classes.length === 0 && (
          <p className="text-sm text-[var(--token-text-muted)]">No races found for this track.</p>
        )}
        {!isLoading && !error && classes.length > 0 && !selectedClass && (
          <p className="text-sm text-[var(--token-text-muted)]">
            Select a class to view the track leaderboard.
          </p>
        )}
        {!isLoading && !error && selectedClass && drivers.length === 0 && (
          <p className="text-sm text-[var(--token-text-muted)]">No races found for this track.</p>
        )}
        {!isLoading && !error && selectedClass && drivers.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--token-border-default)] overflow-hidden bg-[var(--token-surface-elevated)]">
              <StandardTable>
                <StandardTableHeader>
                  <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
                    <StandardTableCell header>Rank</StandardTableCell>
                    <StandardTableCell header>Driver</StandardTableCell>
                    <StandardTableCell header>Class</StandardTableCell>
                    <StandardTableCell header>Points</StandardTableCell>
                    <StandardTableCell header>Wins</StandardTableCell>
                    <StandardTableCell header>Podiums</StandardTableCell>
                  </tr>
                </StandardTableHeader>
                <tbody>
                  {paginatedDrivers.map((row, idx) => (
                    <StandardTableRow key={`${row.driverId}:${row.className}`}>
                      <StandardTableCell className="font-medium">
                        {startIndex + idx + 1}
                      </StandardTableCell>
                      <StandardTableCell>{row.driverName}</StandardTableCell>
                      <StandardTableCell>{formatClassName(row.className)}</StandardTableCell>
                      <StandardTableCell>{row.points}</StandardTableCell>
                      <StandardTableCell>{row.wins}</StandardTableCell>
                      <StandardTableCell>{row.podiums}</StandardTableCell>
                    </StandardTableRow>
                  ))}
                </tbody>
              </StandardTable>
            </div>
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={drivers.length}
              itemLabel="drivers"
              rowsPerPageOptions={[5, 10, 25, 50, 100]}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
