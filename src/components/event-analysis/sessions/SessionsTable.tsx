/**
 * @fileoverview Sessions table - table view of all sessions with results
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Full results table showing sessions with expandable rows for detailed results
 * 
 * @purpose Provides table view of sessions with sorting, filtering, and links to detailed results.
 * 
 * @relatedFiles
 * - src/components/event-analysis/SessionsTab.tsx (parent)
 * - src/core/events/get-sessions-data.ts (data source)
 */

"use client"

import { useState, useMemo } from "react"
import type { SessionData } from "@/core/events/get-sessions-data"

export interface SessionsTableProps {
  sessions: SessionData[]
  selectedDriverIds: string[]
  className?: string
}

type SortDirection = "asc" | "desc"

/**
 * Format duration in seconds to MM:SS format
 */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return "N/A"
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

/**
 * Format date/time
 */
function formatDateTime(date: Date | null): string {
  if (date === null) return "N/A"
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

/**
 * Format lap time in seconds to MM:SS.mmm format
 */
function formatLapTime(seconds: number | null): string {
  if (seconds === null) return "N/A"
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  const wholeSecs = Math.floor(secs)
  const millis = Math.floor((secs - wholeSecs) * 1000)
  return `${minutes}:${wholeSecs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`
}

export default function SessionsTable({
  sessions,
  selectedDriverIds,
  className = "",
}: SessionsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  // Sort sessions by race label
  const sortedSessions = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => {
      const labelA = a.raceLabel || ""
      const labelB = b.raceLabel || ""
      const comparison = labelA.localeCompare(labelB, undefined, {
        numeric: true,
        sensitivity: "base",
      })
      return sortDirection === "asc" ? comparison : -comparison
    })
    return sorted
  }, [sessions, sortDirection])

  const toggleRow = (sessionId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedRows(newExpanded)
  }

  const toggleSort = () => {
    setSortDirection(sortDirection === "asc" ? "desc" : "asc")
  }

  // Check if session has selected drivers
  const hasSelectedDrivers = (session: SessionData): boolean => {
    if (selectedDriverIds.length === 0) return false
    return session.results.some((result) =>
      selectedDriverIds.includes(result.driverId)
    )
  }

  if (sessions.length === 0) {
    return (
      <div
        className={`text-center py-12 text-[var(--token-text-secondary)] ${className}`}
      >
        No sessions available
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--token-border-default)]">
              <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--token-text-primary)]">
                <button
                  type="button"
                  onClick={toggleSort}
                  className="flex items-center gap-2 hover:text-[var(--token-accent)] transition-colors"
                >
                  Race Label
                  <span className="text-xs">
                    {sortDirection === "asc" ? "↑" : "↓"}
                  </span>
                </button>
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--token-text-primary)]">
                Class
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--token-text-primary)]">
                Start Time
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--token-text-primary)]">
                Duration
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--token-text-primary)]">
                Participants
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--token-text-primary)]">
                Top Finishers
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-[var(--token-text-primary)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedSessions.map((session) => {
              const isExpanded = expandedRows.has(session.id)
              const hasSelected = hasSelectedDrivers(session)

              return (
                <tr
                  key={session.id}
                  className={`border-b border-[var(--token-border-default)] ${
                    hasSelected
                      ? "bg-[var(--token-surface-elevated)]"
                      : "hover:bg-[var(--token-surface-elevated)]"
                  } transition-colors`}
                >
                  <td className="py-3 px-4 text-sm text-[var(--token-text-primary)]">
                    <button
                      type="button"
                      onClick={() => toggleRow(session.id)}
                      className="flex items-center gap-2 hover:text-[var(--token-accent)] transition-colors"
                    >
                      <span>{session.raceLabel}</span>
                      <span className="text-xs">
                        {isExpanded ? "▼" : "▶"}
                      </span>
                    </button>
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--token-text-secondary)]">
                    {session.className}
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--token-text-secondary)]">
                    {formatDateTime(session.startTime)}
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--token-text-secondary)]">
                    {formatDuration(session.durationSeconds)}
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--token-text-secondary)]">
                    {session.participantCount}
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--token-text-secondary)]">
                    <div className="space-y-1">
                      {session.topFinishers.slice(0, 3).map((finisher) => (
                        <div key={finisher.driverId}>
                          {finisher.position}. {finisher.driverName}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-[var(--token-text-secondary)]">
                    Click to expand
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded rows for full results */}
      {sortedSessions.map((session) => {
        if (!expandedRows.has(session.id)) {
          return null
        }

        return (
          <div
            key={`expanded-${session.id}`}
            className="border border-[var(--token-border-default)] rounded p-4 bg-[var(--token-surface-elevated)]"
          >
            <h4 className="text-sm font-semibold text-[var(--token-text-primary)] mb-3">
              Full Results - {session.raceLabel}
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--token-border-default)]">
                    <th className="text-left py-2 px-3 font-semibold text-[var(--token-text-primary)]">
                      Position
                    </th>
                    <th className="text-left py-2 px-3 font-semibold text-[var(--token-text-primary)]">
                      Driver
                    </th>
                    <th className="text-left py-2 px-3 font-semibold text-[var(--token-text-primary)]">
                      Laps
                    </th>
                    <th className="text-left py-2 px-3 font-semibold text-[var(--token-text-primary)]">
                      Best Lap
                    </th>
                    <th className="text-left py-2 px-3 font-semibold text-[var(--token-text-primary)]">
                      Avg Lap
                    </th>
                    <th className="text-left py-2 px-3 font-semibold text-[var(--token-text-primary)]">
                      Consistency
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {session.results.map((result) => {
                    const isSelected = selectedDriverIds.includes(
                      result.driverId
                    )
                    return (
                      <tr
                        key={result.raceResultId}
                        className={`border-b border-[var(--token-border-default)] ${
                          isSelected
                            ? "bg-[var(--token-surface-elevated)]"
                            : ""
                        }`}
                      >
                        <td className="py-2 px-3 text-[var(--token-text-secondary)]">
                          {result.positionFinal}
                        </td>
                        <td className="py-2 px-3 text-[var(--token-text-primary)]">
                          {result.driverName}
                        </td>
                        <td className="py-2 px-3 text-[var(--token-text-secondary)]">
                          {result.lapsCompleted}
                        </td>
                        <td className="py-2 px-3 text-[var(--token-text-secondary)]">
                          {formatLapTime(result.fastLapTime)}
                        </td>
                        <td className="py-2 px-3 text-[var(--token-text-secondary)]">
                          {formatLapTime(result.avgLapTime)}
                        </td>
                        <td className="py-2 px-3 text-[var(--token-text-secondary)]">
                          {result.consistency !== null
                            ? `${result.consistency.toFixed(1)}%`
                            : "N/A"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

