/**
 * @fileoverview Per-bracket overall results (A Main, B Main, …) from leg races
 *
 * @description Computes overall 1st–3rd from lettered mains (A1-Main, …) via
 * `buildEventMainResultRows`, and falls back to the top 3 from each class main when labels
 * are not lettered. Does not list individual legs.
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
import ListPagination from "@/components/organisms/event-analysis/ListPagination"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { buildEventMainResultRows, isEventMainSession } from "@/core/events/main-bracket-overall"
import { formatTimeUTC } from "@/lib/format-session-data"
import { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/lib/table-pagination"

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
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)

  const mainsOnly = useMemo(() => races.filter(isEventMainSession), [races])

  const resultRows = useMemo(() => buildEventMainResultRows(mainsOnly), [mainsOnly])

  const resultRowSignature = useMemo(
    () => resultRows.map((r) => `${r.className}\0${r.bracket}`).join("|"),
    [resultRows]
  )

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1))
  }, [resultRowSignature])

  const handleRowsPerPageChange = useCallback((next: number) => {
    setItemsPerPage(next)
    setCurrentPage(1)
  }, [])

  const totalPages = Math.max(1, Math.ceil(resultRows.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedRows = useMemo(
    () => resultRows.slice(startIndex, startIndex + itemsPerPage),
    [resultRows, startIndex, itemsPerPage]
  )

  useEffect(() => {
    if (currentPage > totalPages) {
      queueMicrotask(() => setCurrentPage(totalPages))
    }
  }, [currentPage, totalPages])

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

  const showClassColumn = useMemo(() => {
    return new Set(resultRows.map((r) => r.className)).size > 1
  }, [resultRows])

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
                  Class
                </StandardTableCell>
              )}
              <StandardTableCell
                header
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]"
              >
                Main
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
              <StandardTableRow key={`${row.className}-${row.bracket}`}>
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
                      {row.bracketLabel}
                    </a>
                  ) : (
                    row.bracketLabel
                  )}
                </StandardTableCell>
                <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                  {row.sessionKind === "single-main" ? "Main final" : "Main (overall)"}
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
            totalItems={resultRows.length}
            itemLabel="mains"
            onRowsPerPageChange={handleRowsPerPageChange}
            embedded
          />
        </div>
      </div>
    </div>
  )
}
