/**
 * @fileoverview Per-session race results (Session Analysis — one row per session)
 *
 * @description Lists 1st / 2nd / 3rd for every session in the selection (heats, qualifiers,
 * mains, seeding, practice rounds with results, etc.). Session + driver filters match
 * `EventFastestLapsTable`. Event Analysis → Event Results keeps overall / bracket winners in
 * `MainBracketResultsTable`; this table is per-session only. Rows open a modal with the full
 * finishing order for that session (same underlying `races` data as this table).
 */

"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import Modal from "@/components/molecules/Modal"
import ListPagination from "@/components/organisms/event-analysis/ListPagination"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { getSortedRaceResults } from "@/core/events/main-bracket-overall"
import {
  normalizeRaceSessionType,
  sortSessionTypeFilterKeys,
  sessionTypeFilterChipLabel,
} from "@/core/events/session-type-filter"
import { formatLapTime, formatTimeUTC, formatTotalTime } from "@/lib/format-session-data"
import { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/lib/table-pagination"

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

type SortField =
  | "className"
  | "raceLabel"
  | "sessionLabel"
  | "startTime"
  | "raceOrder"
  | "firstName"
  | "secondName"
  | "thirdName"

type SortDirection = "asc" | "desc"

interface SortIconProps {
  field: SortField
  activeField: SortField
  direction: SortDirection
}

function SortIcon({ field, activeField, direction }: SortIconProps) {
  if (activeField !== field) {
    return null
  }
  return <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span>
}

/** Default row order when primary keys match (matches previous class → order → time sort). */
function compareSessionRowsTieBreak(a: Row, b: Row): number {
  const cls = a.className.localeCompare(b.className)
  if (cls !== 0) return cls
  const oa = a.raceOrder ?? Number.POSITIVE_INFINITY
  const ob = b.raceOrder ?? Number.POSITIVE_INFINITY
  if (oa !== ob) return oa - ob
  const ta = a.startTime?.getTime() ?? 0
  const tb = b.startTime?.getTime() ?? 0
  return ta - tb
}

/**
 * Default sort is by class, then race order. When only one class is shown the Class column is
 * hidden but state may still be `className`; treat that as sorting by schedule order (`raceOrder`).
 */
function resolveSortFieldForDisplay(sortField: SortField, showClassColumn: boolean): SortField {
  if (!showClassColumn && sortField === "className") {
    return "raceOrder"
  }
  return sortField
}

const HEADER_BUTTON_CLASS =
  "inline-flex w-full items-center gap-1 rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"

const SURFACE_CLASS =
  "rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 shadow-sm"
const SURFACE_STYLE = {
  backgroundColor: "var(--glass-bg)",
  backdropFilter: "var(--glass-blur)",
  borderRadius: 16,
  border: "1px solid var(--glass-border)",
  boxShadow: "var(--glass-shadow)",
} as const

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
  const [sortField, setSortField] = useState<SortField>("className")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)
  const [detailRaceId, setDetailRaceId] = useState<string | null>(null)
  const [modalPage, setModalPage] = useState(1)
  const [modalItemsPerPage, setModalItemsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)

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
    return list
  }, [displayRaces])

  const driverFilteredRows = useMemo(() => {
    const search = driverSearch.trim().toLowerCase()
    if (!search) return rows
    return rows.filter((row) => rowMatchesDriverSearch(row, search))
  }, [rows, driverSearch])

  const showClassColumn = useMemo(
    () => new Set(driverFilteredRows.map((r) => r.className)).size > 1,
    [driverFilteredRows]
  )

  const resolvedSortField = useMemo(
    () => resolveSortFieldForDisplay(sortField, showClassColumn),
    [sortField, showClassColumn]
  )

  const sortedRows = useMemo(() => {
    const list = [...driverFilteredRows]
    list.sort((a, b) => {
      let cmp = 0
      switch (resolvedSortField) {
        case "className":
          cmp = a.className.localeCompare(b.className)
          break
        case "raceLabel":
          cmp = a.raceLabel.localeCompare(b.raceLabel)
          break
        case "sessionLabel":
          cmp = a.sessionLabel.localeCompare(b.sessionLabel)
          break
        case "startTime": {
          const aT = a.startTime?.getTime() ?? Number.POSITIVE_INFINITY
          const bT = b.startTime?.getTime() ?? Number.POSITIVE_INFINITY
          cmp = aT - bT
          break
        }
        case "raceOrder": {
          const oa = a.raceOrder ?? Number.POSITIVE_INFINITY
          const ob = b.raceOrder ?? Number.POSITIVE_INFINITY
          cmp = oa - ob
          break
        }
        case "firstName":
          cmp = a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" })
          break
        case "secondName":
          cmp = (a.secondName ?? "").localeCompare(b.secondName ?? "", undefined, {
            sensitivity: "base",
          })
          break
        case "thirdName":
          cmp = (a.thirdName ?? "").localeCompare(b.thirdName ?? "", undefined, {
            sensitivity: "base",
          })
          break
        default:
          cmp = 0
      }
      if (cmp !== 0) {
        return sortDirection === "asc" ? cmp : -cmp
      }
      return compareSessionRowsTieBreak(a, b)
    })
    return list
  }, [driverFilteredRows, resolvedSortField, sortDirection])

  const paginationResetKey = useMemo(
    () => `${effectiveSessionTypeFilter}\0${driverSearch}\0${rows.map((r) => r.raceId).join("\0")}`,
    [effectiveSessionTypeFilter, driverSearch, rows]
  )

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1))
  }, [paginationResetKey, sortField, sortDirection])

  const handleSort = useCallback(
    (field: SortField) => {
      const active = resolveSortFieldForDisplay(sortField, showClassColumn)
      if (active === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      } else {
        setSortField(field)
        setSortDirection("asc")
      }
    },
    [sortField, showClassColumn]
  )

  const handleRowsPerPageChange = useCallback((next: number) => {
    setItemsPerPage(next)
    setCurrentPage(1)
  }, [])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedRows = useMemo(
    () => sortedRows.slice(startIndex, startIndex + itemsPerPage),
    [sortedRows, startIndex, itemsPerPage]
  )

  useEffect(() => {
    if (currentPage > totalPages) {
      queueMicrotask(() => setCurrentPage(totalPages))
    }
  }, [currentPage, totalPages])

  const detailRace = useMemo(() => {
    if (!detailRaceId) return null
    return races.find((r) => r.id === detailRaceId) ?? null
  }, [races, detailRaceId])

  useEffect(() => {
    if (detailRaceId && !detailRace) {
      queueMicrotask(() => setDetailRaceId(null))
    }
  }, [detailRaceId, detailRace])

  const sessionResultsSorted = useMemo(() => {
    if (!detailRace) return []
    return getSortedRaceResults(detailRace)
  }, [detailRace])

  const modalRowCount = sessionResultsSorted.length
  const modalTotalPages = Math.max(1, Math.ceil(modalRowCount / modalItemsPerPage) || 1)
  const modalStartIndex = (modalPage - 1) * modalItemsPerPage
  const paginatedSessionResults = useMemo(
    () => sessionResultsSorted.slice(modalStartIndex, modalStartIndex + modalItemsPerPage),
    [sessionResultsSorted, modalStartIndex, modalItemsPerPage]
  )

  const detailModalKey = detailRaceId ?? ""

  useEffect(() => {
    if (!detailModalKey) return
    queueMicrotask(() => setModalPage(1))
  }, [detailModalKey])

  useEffect(() => {
    if (!detailRaceId) return
    if (modalPage > modalTotalPages) {
      queueMicrotask(() => setModalPage(modalTotalPages))
    }
  }, [detailRaceId, modalPage, modalTotalPages])

  const handleModalRowsPerPageChange = useCallback((next: number) => {
    setModalItemsPerPage(next)
    setModalPage(1)
  }, [])

  const closeDetail = useCallback(() => setDetailRaceId(null), [])

  const detailSubtitle = useMemo(() => {
    if (!detailRace) return null
    const sessionLabel = sessionLabelForRace(detailRace)
    const timeLabel = formatTimeUTC(detailRace.startTime)
    return (
      <span className="block space-y-0.5">
        <span className="block truncate">
          {detailRace.className} · {detailRace.raceLabel}
        </span>
        <span className="block truncate text-sm font-normal text-[var(--token-text-secondary)]">
          {sessionLabel}
          {timeLabel ? ` · ${timeLabel}` : ""}
        </span>
      </span>
    )
  }, [detailRace])

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
            {displayRaces.length > 0 && driverFilteredRows.length > 0 && (
              <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
                Click a row for the full finishing order for that session.
              </p>
            )}
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
                    <button
                      type="button"
                      onClick={() => handleSort("className")}
                      className={HEADER_BUTTON_CLASS}
                    >
                      Class
                      <SortIcon
                        field="className"
                        activeField={resolvedSortField}
                        direction={sortDirection}
                      />
                    </button>
                  </StandardTableCell>
                )}
                <StandardTableCell
                  header
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                >
                  <button
                    type="button"
                    onClick={() => handleSort("raceLabel")}
                    className={HEADER_BUTTON_CLASS}
                  >
                    Race
                    <SortIcon
                      field="raceLabel"
                      activeField={
                        resolvedSortField === "raceOrder" ? "raceLabel" : resolvedSortField
                      }
                      direction={sortDirection}
                    />
                  </button>
                </StandardTableCell>
                <StandardTableCell
                  header
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                >
                  <button
                    type="button"
                    onClick={() => handleSort("sessionLabel")}
                    className={HEADER_BUTTON_CLASS}
                  >
                    Session
                    <SortIcon
                      field="sessionLabel"
                      activeField={resolvedSortField}
                      direction={sortDirection}
                    />
                  </button>
                </StandardTableCell>
                <StandardTableCell
                  header
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                >
                  <button
                    type="button"
                    onClick={() => handleSort("startTime")}
                    className={HEADER_BUTTON_CLASS}
                  >
                    Start time
                    <SortIcon
                      field="startTime"
                      activeField={resolvedSortField}
                      direction={sortDirection}
                    />
                  </button>
                </StandardTableCell>
                <StandardTableCell
                  header
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                >
                  <button
                    type="button"
                    onClick={() => handleSort("firstName")}
                    className={HEADER_BUTTON_CLASS}
                  >
                    1st
                    <SortIcon
                      field="firstName"
                      activeField={resolvedSortField}
                      direction={sortDirection}
                    />
                  </button>
                </StandardTableCell>
                <StandardTableCell
                  header
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                >
                  <button
                    type="button"
                    onClick={() => handleSort("secondName")}
                    className={HEADER_BUTTON_CLASS}
                  >
                    2nd
                    <SortIcon
                      field="secondName"
                      activeField={resolvedSortField}
                      direction={sortDirection}
                    />
                  </button>
                </StandardTableCell>
                <StandardTableCell
                  header
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                >
                  <button
                    type="button"
                    onClick={() => handleSort("thirdName")}
                    className={HEADER_BUTTON_CLASS}
                  >
                    3rd
                    <SortIcon
                      field="thirdName"
                      activeField={resolvedSortField}
                      direction={sortDirection}
                    />
                  </button>
                </StandardTableCell>
              </StandardTableRow>
            </StandardTableHeader>
            <tbody>
              {paginatedRows.map((row) => (
                <StandardTableRow
                  key={row.raceId}
                  tabIndex={0}
                  aria-label={`View full session results for ${row.className} ${row.raceLabel}`}
                  onClick={() => setDetailRaceId(row.raceId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setDetailRaceId(row.raceId)
                    }
                  }}
                >
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
                        onClick={(e) => e.stopPropagation()}
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
              totalItems={sortedRows.length}
              itemLabel="sessions"
              onRowsPerPageChange={handleRowsPerPageChange}
              embedded
            />
          </div>
        </div>
      )}

      {detailRace && (
        <Modal
          isOpen
          onClose={closeDetail}
          title="Full session results"
          subtitle={detailSubtitle}
          maxWidth="3xl"
          footer={
            detailRace.raceUrl ? (
              <a
                href={detailRace.raceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--token-accent)] underline-offset-2 hover:underline"
              >
                Open session on LiveRC
              </a>
            ) : undefined
          }
        >
          <div className="space-y-3">
            {sessionResultsSorted.length === 0 ? (
              <p className="text-sm text-[var(--token-text-secondary)]">
                No finishing positions in this session.
              </p>
            ) : (
              <>
                <StandardTable>
                  <StandardTableHeader>
                    <StandardTableRow className="border-b border-[var(--token-border-default)]">
                      <StandardTableCell
                        header
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                      >
                        Pos
                      </StandardTableCell>
                      <StandardTableCell
                        header
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                      >
                        Driver
                      </StandardTableCell>
                      <StandardTableCell
                        header
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                      >
                        Laps
                      </StandardTableCell>
                      <StandardTableCell
                        header
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                      >
                        Total
                      </StandardTableCell>
                      <StandardTableCell
                        header
                        className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
                      >
                        Fast
                      </StandardTableCell>
                    </StandardTableRow>
                  </StandardTableHeader>
                  <tbody>
                    {paginatedSessionResults.map((r) => (
                      <StandardTableRow key={r.raceResultId}>
                        <StandardTableCell className="px-3 py-2 text-sm tabular-nums text-[var(--token-text-primary)]">
                          {r.positionFinal}
                        </StandardTableCell>
                        <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-primary)]">
                          {r.driverName}
                        </StandardTableCell>
                        <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                          {r.lapsCompleted}
                        </StandardTableCell>
                        <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                          {formatTotalTime(r.totalTimeSeconds)}
                        </StandardTableCell>
                        <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                          {formatLapTime(r.fastLapTime)}
                        </StandardTableCell>
                      </StandardTableRow>
                    ))}
                  </tbody>
                </StandardTable>
                <div className="min-w-0 w-full max-w-full pt-2">
                  <ListPagination
                    currentPage={modalPage}
                    totalPages={modalTotalPages}
                    onPageChange={setModalPage}
                    itemsPerPage={modalItemsPerPage}
                    totalItems={modalRowCount}
                    itemLabel="results"
                    onRowsPerPageChange={handleModalRowsPerPageChange}
                    embedded
                  />
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
