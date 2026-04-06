/**
 * @fileoverview Per-session race results (Session Analysis — one row per session)
 *
 * @description Lists 1st / 2nd / 3rd for every session in the selection (heats, qualifiers,
 * mains, seeding, practice rounds with results, etc.). Session + driver filters match
 * `EventFastestLapsTable`. Event Analysis → Event Results keeps overall / bracket winners in
 * `MainBracketResultsTable`; this table is per-session only.
 */

"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import ListPagination from "@/components/organisms/event-analysis/ListPagination"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  normalizeRaceSessionType,
  sortSessionTypeFilterKeys,
  sessionTypeFilterChipLabel,
} from "@/core/events/session-type-filter"
import { formatTimeUTC } from "@/lib/format-session-data"

const SURFACE_CLASS =
  "rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 shadow-sm"
const SURFACE_STYLE = {
  backgroundColor: "var(--glass-bg)",
  backdropFilter: "var(--glass-blur)",
  borderRadius: 16,
  border: "1px solid var(--glass-border)",
  boxShadow: "var(--glass-shadow)",
} as const

const DEFAULT_ROWS_PER_PAGE = 10

function formatSessionTypeLabel(sessionType: string | null, sectionHeader: string | null): string {
  if (sectionHeader && sectionHeader.trim().length > 0) {
    return sectionHeader
  }
  if (!sessionType) return "Race"
  const normalized = sessionType.toLowerCase()
  switch (normalized) {
    case "main":
      return "Main"
    case "qualifying":
      return "Qualifier"
    case "heat":
      return "Heat"
    case "seeding":
      return "Seeding"
    case "practiceday":
      return "Practice day"
    case "practice":
      return "Practice"
    default:
      return sessionType
  }
}

function sessionLabelForRace(race: EventAnalysisData["races"][number]): string {
  const sh = race.sectionHeader?.trim()
  if (sh) return sh
  return formatSessionTypeLabel(race.sessionType, null)
}

function podiumFromRaceResults(race: EventAnalysisData["races"][number]): {
  first: string | null
  second: string | null
  third: string | null
} {
  const ordered = [...race.results]
    .filter((r) => r.positionFinal > 0)
    .sort((a, b) => a.positionFinal - b.positionFinal)
  return {
    first: ordered[0]?.driverName ?? null,
    second: ordered[1]?.driverName ?? null,
    third: ordered[2]?.driverName ?? null,
  }
}

export interface SessionRaceResultsTableProps {
  races: EventAnalysisData["races"]
}

type Row = {
  raceId: string
  raceLabel: string
  className: string
  sessionLabel: string
  startTime: Date | null
  raceUrl: string
  firstName: string
  secondName: string | null
  thirdName: string | null
  raceOrder: number | null
}

function rowMatchesDriverSearch(row: Row, searchLower: string): boolean {
  if (!searchLower) return true
  const names = [row.firstName, row.secondName, row.thirdName].filter(
    (n): n is string => n != null && n !== "—"
  )
  return names.some((n) => n.toLowerCase().includes(searchLower))
}

export default function SessionRaceResultsTable({ races }: SessionRaceResultsTableProps) {
  const [sessionTypeFilter, setSessionTypeFilter] = useState("")
  const [driverSearch, setDriverSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ROWS_PER_PAGE)

  const headerClassLabel = useMemo(() => {
    const classes = Array.from(
      new Set(
        races
          .map((race) => race.className)
          .filter(
            (className): className is string =>
              typeof className === "string" && className.trim().length > 0
          )
      )
    )

    if (classes.length === 0) {
      return "All Classes"
    }
    if (classes.length === 1) {
      return classes[0]
    }
    return "Multiple Classes"
  }, [races])

  const sessionTypeOptions = useMemo(() => {
    const keys = new Set(races.map((r) => normalizeRaceSessionType(r.sessionType)))
    return sortSessionTypeFilterKeys([...keys])
  }, [races])

  const effectiveSessionTypeFilter = useMemo(() => {
    if (!sessionTypeFilter) return ""
    return sessionTypeOptions.includes(sessionTypeFilter) ? sessionTypeFilter : ""
  }, [sessionTypeFilter, sessionTypeOptions])

  const displayRaces = useMemo(() => {
    if (!effectiveSessionTypeFilter) return races
    return races.filter(
      (r) => normalizeRaceSessionType(r.sessionType) === effectiveSessionTypeFilter
    )
  }, [races, effectiveSessionTypeFilter])

  const rows: Row[] = useMemo(() => {
    const list: Row[] = []
    for (const race of displayRaces) {
      const podium = podiumFromRaceResults(race)
      list.push({
        raceId: race.id,
        raceLabel: race.raceLabel,
        className: race.className,
        sessionLabel: sessionLabelForRace(race),
        startTime: race.startTime,
        raceUrl: race.raceUrl,
        firstName: podium.first ?? "—",
        secondName: podium.second,
        thirdName: podium.third,
        raceOrder: race.raceOrder,
      })
    }
    list.sort((a, b) => {
      const cls = a.className.localeCompare(b.className)
      if (cls !== 0) return cls
      const oa = a.raceOrder ?? Number.POSITIVE_INFINITY
      const ob = b.raceOrder ?? Number.POSITIVE_INFINITY
      if (oa !== ob) return oa - ob
      const ta = a.startTime?.getTime() ?? 0
      const tb = b.startTime?.getTime() ?? 0
      return ta - tb
    })
    return list
  }, [displayRaces])

  const driverFilteredRows = useMemo(() => {
    const search = driverSearch.trim().toLowerCase()
    if (!search) return rows
    return rows.filter((row) => rowMatchesDriverSearch(row, search))
  }, [rows, driverSearch])

  const paginationResetKey = useMemo(
    () => `${effectiveSessionTypeFilter}\0${driverSearch}\0${rows.map((r) => r.raceId).join("\0")}`,
    [effectiveSessionTypeFilter, driverSearch, rows]
  )

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1))
  }, [paginationResetKey])

  const handleRowsPerPageChange = useCallback((next: number) => {
    setItemsPerPage(next)
    setCurrentPage(1)
  }, [])

  const totalPages = Math.max(1, Math.ceil(driverFilteredRows.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedRows = useMemo(
    () => driverFilteredRows.slice(startIndex, startIndex + itemsPerPage),
    [driverFilteredRows, startIndex, itemsPerPage]
  )

  useEffect(() => {
    if (currentPage > totalPages) {
      queueMicrotask(() => setCurrentPage(totalPages))
    }
  }, [currentPage, totalPages])

  const showClassColumn = useMemo(
    () => new Set(driverFilteredRows.map((r) => r.className)).size > 1,
    [driverFilteredRows]
  )

  if (races.length === 0) {
    return (
      <div className={SURFACE_CLASS} style={SURFACE_STYLE}>
        <div className="px-4 py-3">
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
            Session Results
          </h2>
          <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
            No races in this selection.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={SURFACE_CLASS} style={SURFACE_STYLE}>
      <div className="border-b border-[var(--token-border-default)] px-4 py-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
              {`Session Results: ${headerClassLabel}`}
            </h2>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-0">
            {sessionTypeOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="session-results-session-type"
                  className="text-xs font-medium text-[var(--token-text-secondary)]"
                >
                  Session
                </label>
                <select
                  id="session-results-session-type"
                  value={effectiveSessionTypeFilter}
                  onChange={(e) => setSessionTypeFilter(e.target.value)}
                  className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
                >
                  <option value="">All session types</option>
                  {sessionTypeOptions.map((key) => (
                    <option key={key} value={key}>
                      {sessionTypeFilterChipLabel(key)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label
                htmlFor="session-results-driver-filter"
                className="text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Driver
              </label>
              <input
                id="session-results-driver-filter"
                type="text"
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
                placeholder="Search driver name"
                className="w-40 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] placeholder:text-[var(--token-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
              />
            </div>
          </div>
        </div>
      </div>
      {displayRaces.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-[var(--token-text-secondary)]">
          No sessions match the selected session type.
        </p>
      ) : driverFilteredRows.length === 0 ? (
        <div className="flex h-32 items-center justify-center px-4 text-sm text-[var(--token-text-secondary)]">
          No races match the selected filters.
        </div>
      ) : (
        <div className="space-y-3 px-2 py-2 sm:px-4">
          <StandardTable>
            <StandardTableHeader>
              <StandardTableRow className="border-b border-[var(--token-border-default)]">
                {showClassColumn && (
                  <StandardTableCell
                    header
                    className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                  >
                    Class
                  </StandardTableCell>
                )}
                <StandardTableCell
                  header
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                >
                  Race
                </StandardTableCell>
                <StandardTableCell
                  header
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                >
                  Session
                </StandardTableCell>
                <StandardTableCell
                  header
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                >
                  Start time
                </StandardTableCell>
                <StandardTableCell
                  header
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                >
                  1st
                </StandardTableCell>
                <StandardTableCell
                  header
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                >
                  2nd
                </StandardTableCell>
                <StandardTableCell
                  header
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                >
                  3rd
                </StandardTableCell>
              </StandardTableRow>
            </StandardTableHeader>
            <tbody>
              {paginatedRows.map((row) => (
                <StandardTableRow key={row.raceId}>
                  {showClassColumn && (
                    <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-primary)]">
                      {row.className}
                    </StandardTableCell>
                  )}
                  <StandardTableCell className="px-3 py-2 text-sm font-medium text-[var(--token-text-primary)]">
                    {row.raceUrl ? (
                      <a
                        href={row.raceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--token-accent)] underline-offset-2 hover:underline"
                      >
                        {row.raceLabel}
                      </a>
                    ) : (
                      row.raceLabel
                    )}
                  </StandardTableCell>
                  <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                    {row.sessionLabel}
                  </StandardTableCell>
                  <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                    {formatTimeUTC(row.startTime)}
                  </StandardTableCell>
                  <StandardTableCell className="px-3 py-2 text-sm font-semibold text-[var(--token-text-primary)]">
                    {row.firstName}
                  </StandardTableCell>
                  <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                    {row.secondName ?? "—"}
                  </StandardTableCell>
                  <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                    {row.thirdName ?? "—"}
                  </StandardTableCell>
                </StandardTableRow>
              ))}
            </tbody>
          </StandardTable>
          <div className="min-w-0 w-full max-w-full">
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={driverFilteredRows.length}
              itemLabel="sessions"
              onRowsPerPageChange={handleRowsPerPageChange}
              embedded
            />
          </div>
        </div>
      )}
    </div>
  )
}
