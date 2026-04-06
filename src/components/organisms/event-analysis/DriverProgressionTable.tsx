/**
 * @fileoverview Matrix table: drivers × mains-ladder sessions with finishing positions.
 */

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { DriverMainEventProgressionMatrix } from "@/core/events/driver-main-event-progression"
import ListPagination from "./ListPagination"

export interface DriverProgressionTableProps {
  matrix: DriverMainEventProgressionMatrix
  className?: string
}

const DEFAULT_ROWS_PER_PAGE = 10

/** Match BumpUpsDataTable / DriverBumpUpsTable header and body tokens */
const headerCell =
  "px-3 py-2 text-left text-xs font-semibold text-[var(--token-text-primary)] sm:text-sm"
const bodyCell = "px-3 py-1.5 text-sm text-[var(--token-text-primary)]"
const bodyCellNumeric =
  "px-2 py-1.5 text-center text-sm tabular-nums text-[var(--token-text-secondary)]"

function formatPositionCell(position: number | null): string | number {
  if (position === null) return "—"
  return position
}

export default function DriverProgressionTable({
  matrix,
  className = "",
}: DriverProgressionTableProps) {
  const { columns, rows } = matrix

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ROWS_PER_PAGE)

  const matrixSignature = useMemo(
    () => `${columns.map((c) => c.sessionId).join("\0")}|${rows.map((r) => r.driverId).join("\0")}`,
    [columns, rows]
  )

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1))
  }, [matrixSignature])

  const handleRowsPerPageChange = useCallback((next: number) => {
    setItemsPerPage(next)
    setCurrentPage(1)
  }, [])

  const totalPages = Math.max(1, Math.ceil(rows.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedRows = useMemo(
    () => rows.slice(startIndex, startIndex + itemsPerPage),
    [rows, startIndex, itemsPerPage]
  )

  useEffect(() => {
    if (currentPage > totalPages) {
      queueMicrotask(() => setCurrentPage(totalPages))
    }
  }, [currentPage, totalPages])

  if (columns.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--token-text-secondary)]">
          No mains-ladder sessions found for this class in ingested results.
        </p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--token-text-secondary)]">
          No driver results in mains-ladder sessions for this class.
        </p>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex w-full min-w-0 flex-col gap-2">
        <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)]/50 pt-2 pb-2">
          <table className="w-full min-w-max border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60">
                <th scope="col" className={`${headerCell} whitespace-nowrap`}>
                  Driver
                </th>
                {columns.map((col) => (
                  <th key={col.sessionId} scope="col" className={`max-w-[14rem] ${headerCell}`}>
                    <span className="line-clamp-2 leading-tight">
                      {col.roundKind} {col.raceLabel}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => (
                <tr
                  key={row.driverId}
                  className="border-b border-[var(--token-border-muted)]/80 odd:bg-[var(--token-surface)]/30"
                >
                  <td className={`${bodyCell} font-medium whitespace-nowrap`}>{row.driverName}</td>
                  {row.positions.map((pos, i) => (
                    <td key={columns[i]!.sessionId} className={bodyCellNumeric}>
                      {formatPositionCell(pos)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="min-w-0 w-full max-w-full">
          <ListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={rows.length}
            itemLabel="drivers"
            onRowsPerPageChange={handleRowsPerPageChange}
            embedded
          />
        </div>
      </div>
    </div>
  )
}
