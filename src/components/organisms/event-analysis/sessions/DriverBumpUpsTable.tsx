/**
 * @fileoverview Table of inferred driver bump-ups for a class (nitro sessions tab).
 *
 * @see docs/plans/bump-ups-ux-surfacing.md
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { BumpUpRow } from "@/core/events/infer-bump-ups"
import ListPagination from "../ListPagination"

/** Row with class for the “all classes” aggregate view */
export type BumpUpRowWithClass = BumpUpRow & { className: string }

const DEFAULT_ROWS_PER_PAGE = 10

const headerCell =
  "px-3 py-2 text-left text-xs font-semibold text-[var(--token-text-primary)] sm:text-sm"
const headerCellNumeric = `${headerCell} tabular-nums`
const bodyCell = "px-3 py-1.5 text-sm text-[var(--token-text-primary)]"
const bodyCellMuted = "px-3 py-1.5 text-sm text-[var(--token-text-secondary)]"
const bodyCellMutedNarrow = "max-w-[14rem] px-3 py-1.5 text-sm text-[var(--token-text-secondary)]"
const bodyCellClass = "max-w-[12rem] px-3 py-1.5 text-sm text-[var(--token-text-secondary)]"
const bodyCellNumeric =
  "px-2 py-1.5 text-center text-sm tabular-nums text-[var(--token-text-secondary)]"

export interface DriverBumpUpsTableProps {
  rows: BumpUpRow[]
  /**
   * When true, a single class is selected — `rows` are for that class only.
   * When false, “All Classes” mode: pass `aggregatedRows` (may be empty).
   */
  hasSelectedClass: boolean
  /** All-classes view: one row per bump with `className` for the racing class */
  aggregatedRows?: BumpUpRowWithClass[]
}

export default function DriverBumpUpsTable({
  rows,
  hasSelectedClass,
  aggregatedRows = [],
}: DriverBumpUpsTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ROWS_PER_PAGE)

  const tableRows: BumpUpRowWithClass[] | BumpUpRow[] = hasSelectedClass ? rows : aggregatedRows

  const matrixSignature = useMemo(
    () =>
      tableRows
        .map((r) =>
          "className" in r
            ? `${r.className}\0${r.driverId}\0${r.fromRaceLabel}\0${r.toRaceLabel}`
            : `${r.driverId}\0${r.fromRaceLabel}\0${r.toRaceLabel}`
        )
        .join("|"),
    [tableRows]
  )

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1))
  }, [matrixSignature, hasSelectedClass])

  const handleRowsPerPageChange = useCallback((next: number) => {
    setItemsPerPage(next)
    setCurrentPage(1)
  }, [])

  const totalPages = Math.max(1, Math.ceil(tableRows.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedRows = useMemo(
    () => tableRows.slice(startIndex, startIndex + itemsPerPage),
    [tableRows, startIndex, itemsPerPage]
  )

  useEffect(() => {
    if (currentPage > totalPages) {
      queueMicrotask(() => setCurrentPage(totalPages))
    }
  }, [currentPage, totalPages])

  if (!hasSelectedClass) {
    return (
      <div className="space-y-3">
        {aggregatedRows.length === 0 ? (
          <p className="text-sm text-[var(--token-text-secondary)]">
            No advancements inferred across classes. Try a single class filter, or check that
            mains/LCQ session names match the ladder heuristics for this event.
          </p>
        ) : (
          <BumpUpsDataTable
            hasClassColumn
            rows={paginatedRows as BumpUpRowWithClass[]}
            totalItems={aggregatedRows.length}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--token-text-secondary)]">
          No advancements inferred for this class. This can happen if only a single main exists or
          session names could not be matched to a ladder.
        </p>
      ) : (
        <BumpUpsDataTable
          hasClassColumn={false}
          rows={paginatedRows as BumpUpRow[]}
          totalItems={rows.length}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      )}
    </div>
  )
}

interface BumpUpsDataTableProps {
  hasClassColumn: boolean
  rows: BumpUpRowWithClass[] | BumpUpRow[]
  totalItems: number
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  itemsPerPage: number
  onRowsPerPageChange: (n: number) => void
}

function BumpUpsDataTable({
  hasClassColumn,
  rows,
  totalItems,
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  onRowsPerPageChange,
}: BumpUpsDataTableProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/50 pt-2 pb-2">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60">
              {hasClassColumn && (
                <th scope="col" className={headerCell}>
                  Class
                </th>
              )}
              <th scope="col" className={headerCell}>
                Driver
              </th>
              <th scope="col" className={headerCell}>
                From
              </th>
              <th scope="col" className={headerCell}>
                To
              </th>
              <th scope="col" className={headerCellNumeric}>
                From pos.
              </th>
              <th scope="col" className={headerCellNumeric}>
                To pos.
              </th>
            </tr>
          </thead>
          <tbody>
            {hasClassColumn
              ? (rows as BumpUpRowWithClass[]).map((row, i) => (
                  <tr
                    key={`${row.className}-${row.driverId}-${row.fromRaceLabel}-${row.toRaceLabel}-${i}`}
                    className="border-b border-[var(--token-border-muted)]/80 odd:bg-[var(--token-surface)]/30"
                  >
                    <td className={bodyCellClass}>{row.className}</td>
                    <td className={`${bodyCell} font-medium`}>{row.driverName}</td>
                    <td className={bodyCellMutedNarrow}>{row.fromRaceLabel}</td>
                    <td className={bodyCellMutedNarrow}>{row.toRaceLabel}</td>
                    <td className={bodyCellNumeric}>{row.fromPosition ?? "—"}</td>
                    <td className={bodyCellNumeric}>{row.toPosition ?? "—"}</td>
                  </tr>
                ))
              : (rows as BumpUpRow[]).map((row, i) => (
                  <tr
                    key={`${row.driverId}-${row.fromRaceLabel}-${row.toRaceLabel}-${i}`}
                    className="border-b border-[var(--token-border-muted)]/80 odd:bg-[var(--token-surface)]/30"
                  >
                    <td className={`${bodyCell} font-medium`}>{row.driverName}</td>
                    <td className={bodyCellMutedNarrow}>{row.fromRaceLabel}</td>
                    <td className={bodyCellMutedNarrow}>{row.toRaceLabel}</td>
                    <td className={bodyCellNumeric}>{row.fromPosition ?? "—"}</td>
                    <td className={bodyCellNumeric}>{row.toPosition ?? "—"}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <div className="min-w-0 w-full max-w-full">
        <ListPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          itemsPerPage={itemsPerPage}
          totalItems={totalItems}
          itemLabel="advancements"
          onRowsPerPageChange={onRowsPerPageChange}
          embedded
        />
      </div>
    </div>
  )
}
