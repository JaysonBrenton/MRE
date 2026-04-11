/**
 * @fileoverview Per-bracket overall results (A Main, B Main, …) from leg races
 *
 * @description Computes overall 1st–3rd from lettered mains (A1-Main, …) via
 * `buildEventMainResultRows`, and falls back to the top 3 from each class main when labels
 * are not lettered. Rows open a modal with the full overall order or full session results.
 *
 * @relatedFiles
 * - src/core/events/main-bracket-overall.ts
 * - src/components/organisms/event-analysis/OverviewTab.tsx
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
import {
  buildEventMainResultRows,
  computeBracketFullStandings,
  getSortedRaceResults,
  isEventMainSession,
  resolveMainsForBracketOverallRow,
  type BracketOverallRow,
} from "@/core/events/main-bracket-overall"
import { formatLapTime, formatTimeUTC, formatTotalTime } from "@/lib/format-session-data"
import { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/lib/table-pagination"

type SortField =
  | "className"
  | "bracketLabel"
  | "sessionKind"
  | "startTime"
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

function sessionColumnLabel(row: BracketOverallRow): string {
  return row.sessionKind === "single-main" ? "Main final" : "Main (overall)"
}

/** Stable order when primary sort keys match (matches `buildEventMainResultRows`). */
function compareBracketRowsTieBreak(a: BracketOverallRow, b: BracketOverallRow): number {
  const c = a.className.localeCompare(b.className)
  if (c !== 0) return c
  return a.bracket.localeCompare(b.bracket)
}

/**
 * Default sort is by class, then bracket. When only one class is shown the Class column is
 * hidden but state may still be `className`; treat that as sorting by Main (`bracketLabel`)
 * so the active column and toggle behavior match what the user sees.
 */
function resolveSortFieldForDisplay(sortField: SortField, showClassColumn: boolean): SortField {
  if (!showClassColumn && sortField === "className") {
    return "bracketLabel"
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

export interface MainBracketResultsTableProps {
  races: EventAnalysisData["races"]
}

export default function MainBracketResultsTable({ races }: MainBracketResultsTableProps) {
  const [sortField, setSortField] = useState<SortField>("className")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)
  const [detailRow, setDetailRow] = useState<BracketOverallRow | null>(null)
  const [modalPage, setModalPage] = useState(1)
  const [modalItemsPerPage, setModalItemsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)

  const mainsOnly = useMemo(() => races.filter(isEventMainSession), [races])

  const resultRows = useMemo(() => buildEventMainResultRows(mainsOnly), [mainsOnly])

  const showClassColumn = useMemo(
    () => new Set(resultRows.map((r) => r.className)).size > 1,
    [resultRows]
  )

  const resolvedSortField = useMemo(
    () => resolveSortFieldForDisplay(sortField, showClassColumn),
    [sortField, showClassColumn]
  )

  const sortedRows = useMemo(() => {
    const rows = [...resultRows]
    rows.sort((a, b) => {
      let cmp = 0
      switch (resolvedSortField) {
        case "className":
          cmp = a.className.localeCompare(b.className)
          break
        case "bracketLabel":
          cmp = a.bracketLabel.localeCompare(b.bracketLabel)
          break
        case "sessionKind":
          cmp = sessionColumnLabel(a).localeCompare(sessionColumnLabel(b))
          break
        case "startTime": {
          const aT = a.startTime?.getTime() ?? Number.POSITIVE_INFINITY
          const bT = b.startTime?.getTime() ?? Number.POSITIVE_INFINITY
          cmp = aT - bT
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
      return compareBracketRowsTieBreak(a, b)
    })
    return rows
  }, [resultRows, resolvedSortField, sortDirection])

  const resultRowSignature = useMemo(
    () => resultRows.map((r) => `${r.className}\0${r.bracket}`).join("|"),
    [resultRows]
  )

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1))
  }, [resultRowSignature, sortField, sortDirection])

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

  const detailMains = useMemo(() => {
    if (!detailRow) return []
    return resolveMainsForBracketOverallRow(detailRow, mainsOnly)
  }, [detailRow, mainsOnly])

  const aggregateStandings = useMemo(() => {
    if (!detailRow || detailRow.sessionKind !== "aggregate") return []
    return computeBracketFullStandings(detailMains)
  }, [detailRow, detailMains])

  const singleSessionResults = useMemo(() => {
    if (!detailRow || detailRow.sessionKind !== "single-main") return []
    const r = detailMains[0]
    if (!r) return []
    return getSortedRaceResults(r)
  }, [detailRow, detailMains])

  const modalRowCount = useMemo(() => {
    if (!detailRow) return 0
    if (detailRow.sessionKind === "aggregate") return aggregateStandings.length
    return singleSessionResults.length
  }, [detailRow, aggregateStandings.length, singleSessionResults.length])

  const modalTotalPages = Math.max(1, Math.ceil(modalRowCount / modalItemsPerPage) || 1)
  const modalStartIndex = (modalPage - 1) * modalItemsPerPage

  const paginatedAggregateStandings = useMemo(
    () => aggregateStandings.slice(modalStartIndex, modalStartIndex + modalItemsPerPage),
    [aggregateStandings, modalStartIndex, modalItemsPerPage]
  )

  const paginatedSingleSessionResults = useMemo(
    () => singleSessionResults.slice(modalStartIndex, modalStartIndex + modalItemsPerPage),
    [singleSessionResults, modalStartIndex, modalItemsPerPage]
  )

  const detailModalKey = useMemo(
    () =>
      detailRow
        ? `${detailRow.className}\0${detailRow.bracket}\0${detailRow.sessionKind ?? ""}`
        : "",
    [detailRow]
  )

  useEffect(() => {
    if (!detailModalKey) return
    queueMicrotask(() => setModalPage(1))
  }, [detailModalKey])

  useEffect(() => {
    if (!detailRow) return
    if (modalPage > modalTotalPages) {
      queueMicrotask(() => setModalPage(modalTotalPages))
    }
  }, [detailRow, modalPage, modalTotalPages])

  const handleModalRowsPerPageChange = useCallback((next: number) => {
    setModalItemsPerPage(next)
    setModalPage(1)
  }, [])

  const headerClassLabel = useMemo(() => {
    const classes = Array.from(
      new Set(
        mainsOnly
          .map((race) => race.className)
          .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      )
    )
    if (classes.length === 0) return "All Classes"
    if (classes.length === 1) return classes[0]
    return "Multiple Classes"
  }, [mainsOnly])

  const closeDetail = useCallback(() => setDetailRow(null), [])

  if (resultRows.length === 0) {
    return (
      <div className={SURFACE_CLASS} style={SURFACE_STYLE}>
        <div className="px-4 py-3 border-b border-[var(--token-border-default)]">
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
            {`Event Results: ${headerClassLabel}`}
          </h2>
          <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
            No main sessions with results in this selection, so event podiums cannot be shown.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={SURFACE_CLASS} style={SURFACE_STYLE}>
      <div className="border-b border-[var(--token-border-default)] px-4 py-3">
        <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
          {`Event Results: ${headerClassLabel}`}
        </h2>
        <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
          Click a row for full results (overall bracket order or complete main finishing order).
        </p>
      </div>
      <div className="px-2 py-2 sm:px-4">
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
                  onClick={() => handleSort("bracketLabel")}
                  className={HEADER_BUTTON_CLASS}
                >
                  Main
                  <SortIcon
                    field="bracketLabel"
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
                  onClick={() => handleSort("sessionKind")}
                  className={HEADER_BUTTON_CLASS}
                >
                  Session
                  <SortIcon
                    field="sessionKind"
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
                key={`${row.className}-${row.bracket}`}
                tabIndex={0}
                aria-label={`View full results for ${row.className} ${row.bracketLabel}`}
                onClick={() => setDetailRow(row)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setDetailRow(row)
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
                      {row.bracketLabel}
                    </a>
                  ) : (
                    row.bracketLabel
                  )}
                </StandardTableCell>
                <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                  {sessionColumnLabel(row)}
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
            itemLabel="mains"
            onRowsPerPageChange={handleRowsPerPageChange}
            embedded
          />
        </div>
      </div>

      {detailRow && (
        <Modal
          isOpen
          onClose={closeDetail}
          title="Full results"
          subtitle={
            <span className="block truncate">
              {detailRow.className} · {detailRow.bracketLabel}
            </span>
          }
          maxWidth="3xl"
          footer={
            detailRow.raceUrl ? (
              <a
                href={detailRow.raceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[var(--token-accent)] underline-offset-2 hover:underline"
              >
                Open primary session on LiveRC
              </a>
            ) : undefined
          }
        >
          <div className="space-y-3">
            {detailRow.sessionKind === "aggregate" && (
              <>
                <p className="text-sm text-[var(--token-text-secondary)]">
                  Overall finishing order uses the same multi-leg rules as the event podium (best
                  legs, tie-breaks).
                </p>
                {aggregateStandings.length === 0 ? (
                  <p className="text-sm text-[var(--token-text-secondary)]">
                    No standings could be computed for this bracket.
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
                        </StandardTableRow>
                      </StandardTableHeader>
                      <tbody>
                        {paginatedAggregateStandings.map((s) => (
                          <StandardTableRow key={s.driverId}>
                            <StandardTableCell className="px-3 py-2 text-sm tabular-nums text-[var(--token-text-primary)]">
                              {s.rank}
                            </StandardTableCell>
                            <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-primary)]">
                              {s.driverName}
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
                        itemLabel="drivers"
                        onRowsPerPageChange={handleModalRowsPerPageChange}
                        embedded
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {detailRow.sessionKind === "single-main" && (
              <>
                {singleSessionResults.length === 0 ? (
                  <p className="text-sm text-[var(--token-text-secondary)]">
                    No finishing positions in this main session.
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
                        {paginatedSingleSessionResults.map((r) => (
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
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
