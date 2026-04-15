/**
 * @fileoverview Multi-main overall standings for Event Results (authoritative LiveRC data)
 *
 * @description Renders overall triple/double main standings from ingested `MultiMainResult`
 * rows — the same source as LiveRC “view_multi_main_result” pages (IFMAR/ROAR tie-break
 * already applied server-side). Class filtering uses case-insensitive equality via
 * `multiMainResultMatchesClassFilter`.
 *
 * @relatedFiles
 * - src/core/events/get-event-analysis-data.ts (loads multiMainResults)
 * - src/core/events/multi-main-class-match.ts
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
import { multiMainResultMatchesClassFilter } from "@/core/events/multi-main-class-match"
import { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/lib/table-pagination"
import {
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "@/components/organisms/event-analysis/overview-glass-surface"
import { DataTableFrame } from "@/components/organisms/event-analysis/DataPanelSurface"
import { typography } from "@/lib/typography"

export interface MultiMainOverallCardProps {
  multiMainResults: EventAnalysisData["multiMainResults"]
  /**
   * Class chip selection: only multi-main blocks whose `classLabel` matches are shown.
   * Null/undefined/empty = show every class that has multi-main data.
   */
  activeClassLabel?: string | null
}

type MultiMainBlock = EventAnalysisData["multiMainResults"][number]

function MultiMainClassBlock({ mm }: { mm: MultiMainBlock }) {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)

  const entriesSignature = useMemo(
    () => mm.entries.map((e) => `${e.driverId}:${e.position}:${e.points}`).join("|"),
    [mm.entries]
  )

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1))
  }, [entriesSignature])

  const handleRowsPerPageChange = useCallback((next: number) => {
    setItemsPerPage(next)
    setCurrentPage(1)
  }, [])

  const totalPages = Math.max(1, Math.ceil(mm.entries.length / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedEntries = useMemo(
    () => mm.entries.slice(startIndex, startIndex + itemsPerPage),
    [mm.entries, startIndex, itemsPerPage]
  )

  useEffect(() => {
    if (currentPage > totalPages) {
      queueMicrotask(() => setCurrentPage(totalPages))
    }
  }, [currentPage, totalPages])

  return (
    <div className={OVERVIEW_GLASS_SURFACE_CLASS} style={OVERVIEW_GLASS_SURFACE_STYLE}>
      <div className="border-b border-[var(--token-border-default)] px-4 py-3">
        <h4 className={typography.h5}>{mm.classLabel}</h4>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--token-text-secondary)]">
          <span>
            Mains: {mm.completedMains} of {mm.totalMains} completed
          </span>
          {mm.tieBreaker && <span>Tie breaker: {mm.tieBreaker}</span>}
        </div>
      </div>
      <div className="px-2 py-2 sm:px-4">
        <DataTableFrame>
          <StandardTable>
            <StandardTableHeader>
              <StandardTableRow className="border-b border-[var(--token-border-default)]">
                <StandardTableCell
                  header
                  className={`px-3 py-2 text-left ${typography.tableHeader}`}
                >
                  Overall
                </StandardTableCell>
                <StandardTableCell
                  header
                  className={`px-3 py-2 text-left ${typography.tableHeader}`}
                >
                  Driver
                </StandardTableCell>
                <StandardTableCell
                  header
                  className={`px-3 py-2 text-right ${typography.tableHeader}`}
                >
                  Pts
                </StandardTableCell>
              </StandardTableRow>
            </StandardTableHeader>
            <tbody>
              {paginatedEntries.map((entry) => {
                const isPodium = entry.position >= 1 && entry.position <= 3
                return (
                  <StandardTableRow
                    key={`${mm.id}-${entry.driverId}`}
                    className={isPodium ? "bg-[var(--token-accent-soft-bg)]/30" : ""}
                  >
                    <StandardTableCell className="px-3 py-2 text-sm text-[var(--token-text-primary)]">
                      {entry.position}
                    </StandardTableCell>
                    <StandardTableCell
                      className={`px-3 py-2 text-sm ${isPodium ? "font-semibold text-[var(--token-text-primary)]" : "text-[var(--token-text-primary)]"}`}
                    >
                      {entry.driverName}
                    </StandardTableCell>
                    <StandardTableCell className="px-3 py-2 text-right text-sm text-[var(--token-text-secondary)]">
                      {entry.points}
                    </StandardTableCell>
                  </StandardTableRow>
                )
              })}
            </tbody>
          </StandardTable>
        </DataTableFrame>
        {mm.entries.length > 0 && (
          <div className="min-w-0 w-full max-w-full">
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={mm.entries.length}
              itemLabel="drivers"
              onRowsPerPageChange={handleRowsPerPageChange}
              embedded
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default function MultiMainOverallCard({
  multiMainResults,
  activeClassLabel,
}: MultiMainOverallCardProps) {
  if (!multiMainResults || multiMainResults.length === 0) {
    return null
  }

  const filteredResults = multiMainResults.filter((mm) =>
    multiMainResultMatchesClassFilter(mm.classLabel, activeClassLabel)
  )

  if (filteredResults.length === 0) {
    return null
  }

  return (
    <div className="w-full space-y-4" id="multi-main-overall-content">
      <div className="space-y-1">
        <h3 className={typography.h4}>Overall multi-main standings</h3>
        <p className={typography.bodySecondary}>
          Official overall results from LiveRC multi-main pages (best legs / tie-breaks as
          published).
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {filteredResults.map((mm) => (
          <MultiMainClassBlock key={mm.id} mm={mm} />
        ))}
      </div>
    </div>
  )
}
