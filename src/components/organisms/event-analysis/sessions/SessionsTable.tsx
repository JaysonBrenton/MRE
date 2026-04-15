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
import SessionLapDataModal from "./SessionLapDataModal"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import { DataTableFrame } from "@/components/organisms/event-analysis/DataPanelSurface"
import StandardButton from "@/components/atoms/StandardButton"
import type { SessionData } from "@/core/events/get-sessions-data"
import { formatClassName } from "@/lib/format-class-name"

export interface SessionsTableProps {
  sessions: SessionData[]
  selectedDriverIds?: string[]
  className?: string
  onNavigate?: (sessionId: string) => void
  /** Enable hybrid columns (Best Lap, Avg Lap, Total Laps, Fastest Driver) and View Details drill-down. TEST tab only. */
  showHybridColumns?: boolean
  eventId?: string
  selectedClass?: string | null
}

type SortField = "raceLabel" | "className" | "startTime" | "durationSeconds" | "participantCount"
type SortDirection = "asc" | "desc"

interface GroupedSessions {
  className: string
  sessions: SessionData[]
  isExpanded: boolean
}

const BASE_COLUMNS = 7
const HYBRID_COLUMNS = 4 // Best Lap, Avg Lap, Total Laps, Fastest Driver

export default function SessionsTable({
  sessions,
  selectedDriverIds = [],
  className = "",
  onNavigate,
  showHybridColumns = false,
  eventId,
  selectedClass = null,
}: SessionsTableProps) {
  const colCount = showHybridColumns ? BASE_COLUMNS + HYBRID_COLUMNS : BASE_COLUMNS
  const [sortField] = useState<SortField>("startTime")
  const [sortDirection] = useState<SortDirection>("asc")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRoundHeading, setSelectedRoundHeading] = useState<string | null>(null)
  const [selectedClassFilter, setSelectedClassFilter] = useState<string | null>(null)
  const [isGrouped] = useState(false)
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [lapModalSession, setLapModalSession] = useState<SessionData | null>(null)

  // Round headings from LiveRC (e.g. "Qualifier Round 1", "Seeding Round 2", "Main Events") - for filter dropdown
  const availableRoundHeadings = useMemo(() => {
    const headings = new Set<string>()
    sessions.forEach((s) => {
      const h = s.sectionHeader?.trim()
      if (h) headings.add(h)
    })
    return Array.from(headings).sort()
  }, [sessions])

  // Classes present in the data (for filter dropdown)
  const availableClasses = useMemo(() => {
    const classes = new Set<string>()
    sessions.forEach((s) => {
      if (s.className?.trim()) classes.add(s.className.trim())
    })
    return Array.from(classes).sort()
  }, [sessions])

  // Filter sessions by round heading, class, and driver names
  const filteredSessions = useMemo(() => {
    let filtered = [...sessions]

    if (selectedRoundHeading) {
      filtered = filtered.filter((s) => s.sectionHeader?.trim() === selectedRoundHeading.trim())
    }

    if (selectedClassFilter) {
      filtered = filtered.filter((s) => s.className?.trim() === selectedClassFilter.trim())
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter((session) => {
        const driverNames = new Set<string>()
        session.topFinishers.forEach((f) => {
          if (f.driverName?.trim()) driverNames.add(f.driverName.trim().toLowerCase())
        })
        session.results.forEach((r) => {
          if (r.driverName?.trim()) driverNames.add(r.driverName.trim().toLowerCase())
        })
        return [...driverNames].some((name) => name.includes(searchLower))
      })
    }

    return filtered
  }, [sessions, selectedRoundHeading, selectedClassFilter, searchTerm])

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

  const handleToggleGroup = (className: string) => {
    setGroupExpanded((prev) => ({
      ...prev,
      [className]: !prev[className],
    }))
  }

  const handleClearFilters = () => {
    setSearchTerm("")
    setSelectedRoundHeading(null)
    setSelectedClassFilter(null)
    setCurrentPage(1)
  }

  const handleViewLapDetails = useCallback((session: SessionData) => {
    setLapModalSession(session)
  }, [])

  const handleCloseLapModal = useCallback(() => {
    setLapModalSession(null)
  }, [])

  const activeFilterCount =
    (searchTerm ? 1 : 0) + (selectedRoundHeading ? 1 : 0) + (selectedClassFilter ? 1 : 0)

  if (sessions.length === 0) {
    return (
      <ChartContainer
        title="Sessions Overview"
        titleClassName="text-sm font-medium text-[var(--token-text-secondary)] mb-2"
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
      className={className}
      aria-label="Sessions table with sorting, filtering, and expandable rows"
    >
      <div className="space-y-4">
        {/* Single header row: title + search + clear */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--token-border-default)] pb-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
            <div className="flex flex-col gap-1 shrink-0">
              <label
                htmlFor="sessions-round-select"
                className="text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Filter by Round
              </label>
              <select
                id="sessions-round-select"
                aria-label="Filter by round heading"
                value={selectedRoundHeading ?? ""}
                onChange={(e) => {
                  setSelectedRoundHeading(e.target.value || null)
                  setCurrentPage(1)
                }}
                className="px-4 py-2 text-sm rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] shrink-0"
              >
                <option value="">All Sessions</option>
                {availableRoundHeadings.map((heading) => (
                  <option key={heading} value={heading}>
                    {heading}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <label
                htmlFor="sessions-class-filter"
                className="text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Filter by Class Type
              </label>
              <select
                id="sessions-class-filter"
                aria-label="Filter by class"
                value={selectedClassFilter ?? ""}
                onChange={(e) => {
                  setSelectedClassFilter(e.target.value || null)
                  setCurrentPage(1)
                }}
                className="px-4 py-2 text-sm rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] shrink-0"
              >
                <option value="">All Classes</option>
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 shrink-0 w-40">
              <label
                htmlFor="sessions-search-input"
                className="text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Filter by Driver Name
              </label>
              <input
                id="sessions-search-input"
                type="text"
                placeholder="Search by driver name..."
                aria-label="Filter sessions by driver name"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="px-4 py-2 text-sm rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] placeholder:text-[var(--token-text-secondary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] w-full"
              />
            </div>
          </div>

          {/* Right: Clear Filters */}
          <div className="flex items-center shrink-0">
            {activeFilterCount > 0 && (
              <StandardButton
                type="button"
                onClick={handleClearFilters}
                className="!px-3 !py-2 !bg-transparent !border-0 text-[var(--token-accent)] hover:!bg-[var(--token-accent)]/10"
              >
                Clear Filters ({activeFilterCount})
              </StandardButton>
            )}
          </div>
        </div>

        {/* Table */}
        <DataTableFrame>
          <StandardTable className={showHybridColumns ? "min-w-[1200px]" : "min-w-[900px]"}>
            <StandardTableHeader>
              <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
                <StandardTableCell header>Session Name</StandardTableCell>
                <StandardTableCell header>Class</StandardTableCell>
                <StandardTableCell header>Start Time</StandardTableCell>
                <StandardTableCell header>Duration</StandardTableCell>
                <StandardTableCell header className="text-center">
                  Participants
                </StandardTableCell>
                <StandardTableCell header>Top 3 Finishers</StandardTableCell>
                <StandardTableCell header>Actions</StandardTableCell>
                {showHybridColumns && (
                  <>
                    <StandardTableCell header>Best Lap</StandardTableCell>
                    <StandardTableCell header>Avg Lap</StandardTableCell>
                    <StandardTableCell header className="text-center">
                      Total Laps
                    </StandardTableCell>
                    <StandardTableCell header>Fastest Driver</StandardTableCell>
                  </>
                )}
              </tr>
            </StandardTableHeader>
            <tbody className="bg-[var(--token-surface)]">
              {isGrouped
                ? groupedSessions.map((group) => (
                    <Fragment key={`group-${group.className}`}>
                      <StandardTableRow
                        onClick={() => handleToggleGroup(group.className)}
                        className="bg-[var(--token-surface-raised)] cursor-pointer hover:!bg-[var(--token-surface-elevated)]"
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
                        <td colSpan={colCount} className="px-4 py-3">
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
                              {formatClassName(group.className)}
                            </span>
                            <span className="text-sm text-[var(--token-text-secondary)]">
                              ({group.sessions.length} session
                              {group.sessions.length !== 1 ? "s" : ""})
                            </span>
                          </div>
                        </td>
                      </StandardTableRow>
                      {group.isExpanded &&
                        group.sessions.map((session) => (
                          <SessionsTableRow
                            key={session.id}
                            session={session}
                            selectedDriverIds={selectedDriverIds}
                            onNavigate={onNavigate}
                            showHybridColumns={showHybridColumns}
                            eventId={eventId}
                            selectedClass={selectedClass}
                            colCount={colCount}
                            onViewLapDetails={
                              showHybridColumns && eventId ? handleViewLapDetails : undefined
                            }
                          />
                        ))}
                    </Fragment>
                  ))
                : paginatedSessions.map((session) => (
                    <SessionsTableRow
                      key={session.id}
                      session={session}
                      selectedDriverIds={selectedDriverIds}
                      onNavigate={onNavigate}
                      showHybridColumns={showHybridColumns}
                      eventId={eventId}
                      selectedClass={selectedClass}
                      colCount={colCount}
                      onViewLapDetails={
                        showHybridColumns && eventId ? handleViewLapDetails : undefined
                      }
                    />
                  ))}
            </tbody>
          </StandardTable>

          {filteredSessions.length === 0 && (
            <div className="flex items-center justify-center py-12 text-[var(--token-text-secondary)]">
              No sessions match your filters
            </div>
          )}
        </DataTableFrame>

        {/* Pagination (only show when not grouped) */}
        {!isGrouped && (
          <ListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={pageSize}
            totalItems={sortedSessions.length}
            itemLabel="sessions"
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
              Showing {filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""} in{" "}
              {groupedSessions.length} class{groupedSessions.length !== 1 ? "es" : ""}
            </span>
          ) : (
            <span>
              Total: {sortedSessions.length} session{sortedSessions.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Lap Data Modal - rendered outside table to avoid hydration errors */}
      {showHybridColumns && eventId && lapModalSession && (
        <SessionLapDataModal
          isOpen={true}
          onClose={handleCloseLapModal}
          eventId={eventId}
          selectedClass={selectedClass}
          raceId={lapModalSession.raceId}
          raceLabel={lapModalSession.raceLabel}
        />
      )}
    </ChartContainer>
  )
}
