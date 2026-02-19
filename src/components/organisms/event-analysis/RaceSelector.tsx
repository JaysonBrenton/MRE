/**
 * @fileoverview Race selector component - table with pagination for race selection
 *
 * @created 2025-01-28
 * @creator Auto-generated
 * @lastModified 2026-01-31
 *
 * @description Table of available races with sortable columns and pagination; click a row to select.
 *
 * @purpose Provides a scannable, sortable, paginated interface for race selection.
 *          Supports filtering by class and highlights selected race.
 *
 * @relatedFiles
 * - src/components/event-analysis/ComparisonTest.tsx (parent)
 * - src/components/molecules/StandardTable.tsx
 * - src/components/organisms/event-analysis/ListPagination.tsx
 */

"use client"

import { useState, useMemo, useEffect } from "react"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import ListPagination from "@/components/organisms/event-analysis/ListPagination"
import { formatDateUTC, formatTimeUTC } from "@/lib/format-session-data"

const DEFAULT_PAGE_SIZE = 5
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50]

type SortKey = "race" | "class" | "date" | "startTime"
type SortDir = "asc" | "desc"

function sortRaces(races: Race[], sortKey: SortKey, sortDir: SortDir): Race[] {
  const mult = sortDir === "asc" ? 1 : -1
  return [...races].sort((a, b) => {
    switch (sortKey) {
      case "race":
        return mult * a.raceLabel.localeCompare(b.raceLabel, undefined, { sensitivity: "base" })
      case "class":
        return (
          mult *
          (a.className ?? "").localeCompare(b.className ?? "", undefined, { sensitivity: "base" })
        )
      case "date":
      case "startTime": {
        const ta = a.startTime?.getTime() ?? Number.MAX_SAFE_INTEGER
        const tb = b.startTime?.getTime() ?? Number.MAX_SAFE_INTEGER
        return mult * (ta - tb)
      }
      default:
        return 0
    }
  })
}

export interface Race {
  id: string
  raceLabel: string
  className: string
  startTime: Date | null
}

export interface RaceSelectorProps {
  races: Race[]
  selectedRaceId: string | null
  onRaceSelect: (raceId: string) => void
  selectedClass?: string | null
  /** When true, do not render the "Select a race" heading (parent supplies its own). */
  hideHeading?: boolean
}

export default function RaceSelector({
  races,
  selectedRaceId,
  onRaceSelect,
  selectedClass,
  hideHeading = false,
}: RaceSelectorProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE)
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const filteredRaces = useMemo(() => {
    return selectedClass ? races.filter((r) => r.className === selectedClass) : races
  }, [races, selectedClass])

  const sortedRaces = useMemo(
    () => sortRaces(filteredRaces, sortKey, sortDir),
    [filteredRaces, sortKey, sortDir]
  )

  const totalPages = Math.max(1, Math.ceil(sortedRaces.length / rowsPerPage))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * rowsPerPage
  const paginatedRaces = useMemo(
    () => sortedRaces.slice(startIndex, startIndex + rowsPerPage),
    [sortedRaces, startIndex, rowsPerPage]
  )

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
    setCurrentPage(1)
  }

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1))
  }, [selectedClass])
  useEffect(() => {
    queueMicrotask(() => setCurrentPage((prev) => Math.min(prev, totalPages)))
  }, [totalPages])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setRowsPerPage(newRowsPerPage)
    setCurrentPage(1)
  }

  if (filteredRaces.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-[var(--token-text-secondary)]">
          {selectedClass ? `No races available for class "${selectedClass}"` : "No races available"}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!hideHeading && (
        <h3 className="text-sm font-medium text-[var(--token-text-primary)]">Select a race</h3>
      )}
      <div className="rounded-lg border border-[var(--token-border-default)] overflow-hidden bg-[var(--token-surface-elevated)]">
        <StandardTable>
          <StandardTableHeader>
            <tr className="border-b border-[var(--token-border-default)]">
              {(
                [
                  { key: "race" as const, label: "Race" },
                  { key: "class" as const, label: "Class" },
                  { key: "date" as const, label: "Date" },
                  { key: "startTime" as const, label: "Start time" },
                ] as const
              ).map(({ key, label }) => {
                const isActive = sortKey === key
                const ariaSort = !isActive
                  ? undefined
                  : sortDir === "asc"
                    ? "ascending"
                    : "descending"
                return (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={ariaSort}
                    className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(key)}
                      className="flex items-center gap-1.5 w-full text-left hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] rounded"
                      aria-label={
                        isActive
                          ? `Sort by ${label} ${sortDir === "asc" ? "ascending" : "descending"}. Click to reverse.`
                          : `Sort by ${label}`
                      }
                    >
                      {label}
                      {isActive && (
                        <span className="text-[var(--token-accent)]" aria-hidden>
                          {sortDir === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </button>
                  </th>
                )
              })}
            </tr>
          </StandardTableHeader>
          <tbody>
            {paginatedRaces.map((race) => {
              const isSelected = selectedRaceId === race.id
              return (
                <StandardTableRow
                  key={race.id}
                  onClick={() => onRaceSelect(race.id)}
                  className={
                    isSelected
                      ? "bg-[var(--token-accent)]/10 border-l-4 border-l-[var(--token-accent)]"
                      : ""
                  }
                >
                  <StandardTableCell>
                    <span className="font-medium text-[var(--token-text-primary)]">
                      {race.raceLabel}
                    </span>
                    {isSelected && (
                      <span className="ml-2 text-[var(--token-accent)]" aria-hidden>
                        ✓
                      </span>
                    )}
                  </StandardTableCell>
                  <StandardTableCell>{race.className || "—"}</StandardTableCell>
                  <StandardTableCell>
                    {race.startTime ? formatDateUTC(race.startTime) : "—"}
                  </StandardTableCell>
                  <StandardTableCell>
                    {race.startTime ? formatTimeUTC(race.startTime) : "—"}
                  </StandardTableCell>
                </StandardTableRow>
              )
            })}
          </tbody>
        </StandardTable>
      </div>
      <ListPagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        itemsPerPage={rowsPerPage}
        totalItems={sortedRaces.length}
        itemLabel="races"
        rowsPerPageOptions={PAGE_SIZE_OPTIONS}
        onRowsPerPageChange={handleRowsPerPageChange}
      />
    </div>
  )
}
