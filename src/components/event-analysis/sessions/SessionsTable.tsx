/**
 * @fileoverview Professional sessions table with sorting, filtering, and grouping
 * 
 * @created 2025-01-07
 * @creator System
 * @lastModified 2025-01-07
 * 
 * @description Main sessions table component with full feature set
 * 
 * @purpose Replaces OverviewChart with a sortable, filterable, expandable table view
 *
 * @relatedFiles
 * - src/components/event-analysis/sessions/SessionsTableRow.tsx
 * - src/components/event-analysis/sessions/SessionChartTabs.tsx
 */

"use client"

import { useState, useMemo, useCallback, Fragment } from "react"
import ChartContainer from "../ChartContainer"
import SessionsTableRow from "./SessionsTableRow"
import ListPagination from "../ListPagination"
import type { SessionData } from "@/core/events/get-sessions-data"

export interface SessionsTableProps {
  sessions: SessionData[]
  selectedDriverIds?: string[]
  className?: string
  onNavigate?: (sessionId: string) => void
}

type SortField = "raceLabel" | "className" | "startTime" | "durationSeconds" | "participantCount"
type SortDirection = "asc" | "desc"

interface GroupedSessions {
  className: string
  sessions: SessionData[]
  isExpanded: boolean
}

export default function SessionsTable({
  sessions,
  selectedDriverIds = [],
  className = "",
  onNavigate,
}: SessionsTableProps) {
  const [sortField, setSortField] = useState<SortField>("startTime")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [searchTerm, setSearchTerm] = useState("")
  const [isGrouped, setIsGrouped] = useState(false)
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let filtered = [...sessions]

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter((session) =>
        session.raceLabel.toLowerCase().includes(searchLower) ||
        session.className.toLowerCase().includes(searchLower)
      )
    }

    return filtered
  }, [sessions, searchTerm])

  // Sort sessions
  const sortedSessions = useMemo(() => {
    const sorted = [...filteredSessions]

    sorted.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case "raceLabel":
          comparison = a.raceLabel.localeCompare(b.raceLabel, undefined, {
        numeric: true,
        sensitivity: "base",
      })
          break
        case "className":
          comparison = a.className.localeCompare(b.className)
          break
        case "startTime":
          comparison = (a.startTime?.getTime() ?? 0) - (b.startTime?.getTime() ?? 0)
          break
        case "durationSeconds":
          comparison = (a.durationSeconds ?? 0) - (b.durationSeconds ?? 0)
          break
        case "participantCount":
          comparison = a.participantCount - b.participantCount
          break
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return sorted
  }, [filteredSessions, sortField, sortDirection])

  // Group sessions by class
  const groupedSessions = useMemo<GroupedSessions[]>(() => {
    if (!isGrouped) return []

    const groups = new Map<string, SessionData[]>()

    sortedSessions.forEach((session) => {
      if (!groups.has(session.className)) {
        groups.set(session.className, [])
      }
      groups.get(session.className)!.push(session)
    })

    return Array.from(groups.entries()).map(([className, sessions]) => ({
      className,
      sessions,
      isExpanded: groupExpanded[className] ?? true,
    }))
  }, [isGrouped, sortedSessions, groupExpanded])

  // Pagination
  const totalPages = Math.ceil(sortedSessions.length / pageSize)
  const paginatedSessions = useMemo(() => {
    if (isGrouped) return sortedSessions // No pagination when grouped
    
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return sortedSessions.slice(startIndex, endIndex)
  }, [sortedSessions, currentPage, pageSize, isGrouped])

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
    setCurrentPage(1)
  }, [sortField, sortDirection])

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return "↕"
    }
    return sortDirection === "asc" ? "↑" : "↓"
  }

  const handleToggleGroup = (className: string) => {
    setGroupExpanded((prev) => ({
      ...prev,
      [className]: !prev[className],
    }))
  }

  const handleClearFilters = () => {
    setSearchTerm("")
    setCurrentPage(1)
  }

  const activeFilterCount = searchTerm ? 1 : 0

  if (sessions.length === 0) {
    return (
      <ChartContainer
        title="Sessions Overview"
        className={className}
        aria-label="Sessions table - no data available"
      >
        <div className="flex items-center justify-center h-64 text-[var(--token-text-secondary)]">
        No sessions available
      </div>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer
      title="Sessions Overview"
      className={className}
      aria-label="Sessions table with sorting, filtering, and expandable rows"
    >
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Left side: Search */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="px-4 py-2 text-sm rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] placeholder:text-[var(--token-text-secondary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] w-full sm:w-64"
            />
          </div>

          {/* Right side: Filters and pagination controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {activeFilterCount > 0 && (
                <button
                  type="button"
                onClick={handleClearFilters}
                className="px-3 py-2 text-sm font-medium text-[var(--token-accent)] hover:text-[var(--token-accent-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] rounded"
              >
                Clear Filters ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-[var(--token-border-default)]">
          <table
            className="w-full min-w-[900px]"
            aria-label="Sessions table"
          >
            <thead className="bg-[var(--token-surface-alt)] border-b border-[var(--token-border-default)]">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                >
                  Session Name
              </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                >
                  Class
              </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                >
                  Start Time
              </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                >
                  Duration
              </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-sm font-medium text-[var(--token-text-secondary)]"
                >
                  Participants
              </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                >
                  Top 3 Finishers
              </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                >
                Actions
              </th>
            </tr>
          </thead>
            <tbody className="bg-[var(--token-surface)]">
              {isGrouped ? (
                groupedSessions.map((group) => (
                  <Fragment key={`group-${group.className}`}>
                    <tr
                      className="bg-[var(--token-surface-raised)] border-b border-[var(--token-border-default)] cursor-pointer hover:bg-[var(--token-surface-elevated)] transition-colors"
                      onClick={() => handleToggleGroup(group.className)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleToggleGroup(group.className)
                        }
                      }}
                      aria-expanded={group.isExpanded}
                      aria-label={`${group.className} - ${group.sessions.length} sessions - Click to ${group.isExpanded ? "collapse" : "expand"}`}
                    >
                      <td colSpan={7} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[var(--token-text-secondary)] transition-transform"
                            style={{
                              transform: group.isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                              display: "inline-block",
                            }}
                            aria-hidden="true"
                          >
                            ▶
                          </span>
                          <span className="text-[var(--token-text-primary)]">
                            {group.className}
                          </span>
                          <span className="text-sm text-[var(--token-text-secondary)]">
                            ({group.sessions.length} session{group.sessions.length !== 1 ? "s" : ""})
                          </span>
                        </div>
                      </td>
                    </tr>
                    {group.isExpanded &&
                      group.sessions.map((session) => (
                        <SessionsTableRow
                          key={session.id}
                          session={session}
                          selectedDriverIds={selectedDriverIds}
                          onNavigate={onNavigate}
                        />
                      ))}
                  </Fragment>
                ))
              ) : (
                paginatedSessions.map((session) => (
                  <SessionsTableRow
                    key={session.id}
                    session={session}
                    selectedDriverIds={selectedDriverIds}
                    onNavigate={onNavigate}
                  />
                ))
              )}
          </tbody>
        </table>

          {filteredSessions.length === 0 && (
            <div className="flex items-center justify-center py-12 text-[var(--token-text-secondary)]">
              No sessions match your filters
            </div>
          )}
      </div>

        {/* Pagination (only show when not grouped) */}
        {!isGrouped && (
          <ListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={pageSize}
            totalItems={sortedSessions.length}
            itemLabel="sessions"
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            onRowsPerPageChange={(newRowsPerPage) => {
              setPageSize(newRowsPerPage)
              setCurrentPage(1)
            }}
          />
        )}

        {/* Results summary */}
        <div className="text-sm text-[var(--token-text-secondary)] text-center">
          {isGrouped ? (
            <span>
              Showing {filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""} in {groupedSessions.length} class{groupedSessions.length !== 1 ? "es" : ""}
            </span>
          ) : (
            <span>
              Total: {sortedSessions.length} session{sortedSessions.length !== 1 ? "s" : ""}
            </span>
      )}
    </div>
      </div>
    </ChartContainer>
  )
}
