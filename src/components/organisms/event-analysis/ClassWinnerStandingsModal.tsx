"use client"

import { useEffect, useMemo, useState } from "react"
import {
  resolveClassWinnerModalDetail,
  type ClassWinnerHighlight,
} from "@/core/events/build-event-highlights"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import Modal from "@/components/molecules/Modal"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import { DataTableFrame } from "@/components/organisms/event-analysis/DataPanelSurface"
import ListPagination from "./ListPagination"
import { typography } from "@/lib/typography"
import { DEFAULT_TABLE_ROWS_PER_PAGE, normalizeTableRowsPerPage } from "@/lib/table-pagination"
import {
  CLASS_WINNER_STANDINGS_MODAL_DEFAULT_HEIGHT_REM,
  CLASS_WINNER_STANDINGS_MODAL_DEFAULT_WIDTH_REM,
} from "@/lib/modal-styles"

const CLASS_WINNER_MODAL_RESIZABLE_DEFAULT = {
  width: CLASS_WINNER_STANDINGS_MODAL_DEFAULT_WIDTH_REM,
  height: CLASS_WINNER_STANDINGS_MODAL_DEFAULT_HEIGHT_REM,
} as const

export type ClassWinnerStandingsModalProps = {
  detail: ClassWinnerHighlight | null
  onClose: () => void
  races: EventAnalysisData["races"]
  multiMainResults: EventAnalysisData["multiMainResults"]
}

export function ClassWinnerStandingsModal({
  detail,
  onClose,
  races,
  multiMainResults,
}: ClassWinnerStandingsModalProps) {
  const [standingsPage, setStandingsPage] = useState(1)
  const [standingsRowsPerPage, setStandingsRowsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)

  const classWinnerModalResolved = useMemo(() => {
    if (!detail) return null
    return resolveClassWinnerModalDetail(detail, { races, multiMainResults })
  }, [detail, races, multiMainResults])

  const classWinnerStandingsCount = useMemo(() => {
    if (classWinnerModalResolved?.kind === "multiMain")
      return classWinnerModalResolved.standingsRows.length
    if (classWinnerModalResolved?.kind === "featuredMain")
      return classWinnerModalResolved.standingsRows.length
    return 0
  }, [classWinnerModalResolved])

  const classWinnerStandingsTotalPages = Math.max(
    1,
    Math.ceil(classWinnerStandingsCount / standingsRowsPerPage)
  )
  const classWinnerStandingsEffectivePage = Math.min(
    Math.max(1, standingsPage),
    classWinnerStandingsTotalPages
  )
  const classWinnerMultiMainPageRows = useMemo(() => {
    if (classWinnerModalResolved?.kind !== "multiMain") return []
    const start = (classWinnerStandingsEffectivePage - 1) * standingsRowsPerPage
    return classWinnerModalResolved.standingsRows.slice(start, start + standingsRowsPerPage)
  }, [classWinnerModalResolved, classWinnerStandingsEffectivePage, standingsRowsPerPage])
  const classWinnerFeaturedPageRows = useMemo(() => {
    if (classWinnerModalResolved?.kind !== "featuredMain") return []
    const start = (classWinnerStandingsEffectivePage - 1) * standingsRowsPerPage
    return classWinnerModalResolved.standingsRows.slice(start, start + standingsRowsPerPage)
  }, [classWinnerModalResolved, classWinnerStandingsEffectivePage, standingsRowsPerPage])

  useEffect(() => {
    queueMicrotask(() => setStandingsPage(1))
  }, [detail])

  return (
    <Modal
      isOpen={detail !== null}
      onClose={onClose}
      title={detail?.winnerName ?? "Class winner"}
      subtitle={detail ? `${detail.classDisplay} · ${detail.raceLabel}` : undefined}
      maxWidth="lg"
      resizable
      resizableDefaultSize={CLASS_WINNER_MODAL_RESIZABLE_DEFAULT}
    >
      {detail ? (
        <div
          className={`space-y-4 text-sm text-[var(--token-text-secondary)] ${typography.body}`}
          style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
        >
          {!classWinnerModalResolved ? (
            <p className="text-[var(--token-text-secondary)]">
              Detailed result breakdown is not available for this import.
            </p>
          ) : classWinnerModalResolved.kind === "multiMain" ? (
            <div className="flex min-w-0 flex-col gap-3">
              {classWinnerModalResolved.standingsRows.length === 0 ? (
                <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
                  No standings rows in the imported multi-main table for this class.
                </p>
              ) : (
                <>
                  <DataTableFrame className="max-w-full overflow-x-auto">
                    <StandardTable>
                      <StandardTableHeader>
                        <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
                          <StandardTableCell header className="whitespace-nowrap">
                            Position
                          </StandardTableCell>
                          <StandardTableCell header>Driver</StandardTableCell>
                          <StandardTableCell
                            header
                            className="w-12 whitespace-nowrap text-right tabular-nums"
                          >
                            Pts
                          </StandardTableCell>
                          <StandardTableCell
                            header
                            className="w-12 whitespace-nowrap text-right tabular-nums"
                          >
                            Sd
                          </StandardTableCell>
                          {classWinnerModalResolved.mainColumnLabels.map((label) => (
                            <StandardTableCell
                              key={label}
                              header
                              className="min-w-[6.5rem] max-w-[10rem] whitespace-nowrap"
                            >
                              {label}
                            </StandardTableCell>
                          ))}
                        </tr>
                      </StandardTableHeader>
                      <tbody>
                        {classWinnerMultiMainPageRows.map((row) => (
                          <StandardTableRow
                            key={`${row.position}-${row.driverName}`}
                            className={
                              row.highlight ? "bg-[var(--token-accent-soft-bg)]/50" : undefined
                            }
                          >
                            <StandardTableCell className="tabular-nums text-[var(--token-text-secondary)]">
                              {row.position}
                            </StandardTableCell>
                            <StandardTableCell className="min-w-0 break-words font-medium text-[var(--token-text-primary)]">
                              {row.driverName}
                            </StandardTableCell>
                            <StandardTableCell className="text-right tabular-nums text-[var(--token-text-primary)]">
                              {row.points}
                            </StandardTableCell>
                            <StandardTableCell className="text-right tabular-nums text-[var(--token-text-secondary)]">
                              {row.seededPosition != null ? row.seededPosition : "—"}
                            </StandardTableCell>
                            {row.mainCells.map((cell, i) => (
                              <StandardTableCell
                                key={classWinnerModalResolved.mainColumnLabels[i]!}
                                className="min-w-0 max-w-[10rem] break-all font-mono text-xs text-[var(--token-text-primary)]"
                              >
                                {cell}
                              </StandardTableCell>
                            ))}
                          </StandardTableRow>
                        ))}
                      </tbody>
                    </StandardTable>
                  </DataTableFrame>
                  <ListPagination
                    embedded
                    currentPage={classWinnerStandingsEffectivePage}
                    totalPages={classWinnerStandingsTotalPages}
                    onPageChange={setStandingsPage}
                    itemsPerPage={standingsRowsPerPage}
                    totalItems={classWinnerStandingsCount}
                    itemLabel="drivers"
                    onRowsPerPageChange={(n) => {
                      setStandingsRowsPerPage(normalizeTableRowsPerPage(n))
                    }}
                  />
                </>
              )}
            </div>
          ) : classWinnerModalResolved.kind === "featuredMain" ? (
            <div className="flex min-w-0 flex-col gap-3">
              {classWinnerModalResolved.standingsRows.length === 0 ? (
                <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
                  No result rows in this main for the class.
                </p>
              ) : (
                <>
                  <DataTableFrame className="max-w-full overflow-x-auto">
                    <StandardTable>
                      <StandardTableHeader>
                        <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
                          <StandardTableCell header className="whitespace-nowrap">
                            Position
                          </StandardTableCell>
                          <StandardTableCell header>Driver</StandardTableCell>
                          <StandardTableCell header className="min-w-[5rem]">
                            Laps / time
                          </StandardTableCell>
                          <StandardTableCell header className="min-w-[4rem] whitespace-nowrap">
                            Fast lap
                          </StandardTableCell>
                        </tr>
                      </StandardTableHeader>
                      <tbody>
                        {classWinnerFeaturedPageRows.map((row) => (
                          <StandardTableRow
                            key={`${row.position}-${row.driverName}`}
                            className={
                              row.highlight ? "bg-[var(--token-accent-soft-bg)]/50" : undefined
                            }
                          >
                            <StandardTableCell className="tabular-nums text-[var(--token-text-secondary)]">
                              {row.position}
                            </StandardTableCell>
                            <StandardTableCell className="min-w-0 break-words font-medium text-[var(--token-text-primary)]">
                              {row.driverName}
                            </StandardTableCell>
                            <StandardTableCell className="min-w-0 break-words font-mono text-xs text-[var(--token-text-primary)]">
                              {row.lapsTimeLine ?? "—"}
                            </StandardTableCell>
                            <StandardTableCell className="tabular-nums text-xs text-[var(--token-text-primary)]">
                              {row.fastLapFormatted ?? "—"}
                            </StandardTableCell>
                          </StandardTableRow>
                        ))}
                      </tbody>
                    </StandardTable>
                  </DataTableFrame>
                  <ListPagination
                    embedded
                    currentPage={classWinnerStandingsEffectivePage}
                    totalPages={classWinnerStandingsTotalPages}
                    onPageChange={setStandingsPage}
                    itemsPerPage={standingsRowsPerPage}
                    totalItems={classWinnerStandingsCount}
                    itemLabel="drivers"
                    onRowsPerPageChange={(n) => {
                      setStandingsRowsPerPage(normalizeTableRowsPerPage(n))
                    }}
                  />
                </>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}
