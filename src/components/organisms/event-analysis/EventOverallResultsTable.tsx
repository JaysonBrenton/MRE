/**
 * @fileoverview Event Overview — overall / class podium as a table (aligned with SessionRaceResultsTable)
 */

"use client"

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import { DataTableFrame } from "@/components/organisms/event-analysis/DataPanelSurface"
import ListPagination from "@/components/organisms/event-analysis/ListPagination"
import {
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "@/components/organisms/event-analysis/overview-glass-surface"
import {
  driverNamesMatchForClassWinner,
  type ClassWinnerHighlight,
} from "@/core/events/build-event-highlights"
import type { TopQualifierCardModel } from "@/core/events/top-qualifier-overview-cards"
import { typography } from "@/lib/typography"
import { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/lib/table-pagination"
import { PodiumSlotName, HighlightPodiumName } from "./OverviewPodiumNames"

type SortField = "classDisplay" | "winnerName" | "secondPlaceName" | "thirdPlaceName"

type SortDirection = "asc" | "desc"

interface SortIconProps {
  field: SortField
  activeField: SortField
  direction: SortDirection
}

function SortIcon({ field, activeField, direction }: SortIconProps) {
  if (activeField !== field) return null
  return <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span>
}

function compareRowsTieBreak(a: ClassWinnerHighlight, b: ClassWinnerHighlight): number {
  return a.className.localeCompare(b.className)
}

const HEADER_BUTTON_CLASS =
  "inline-flex w-full items-center gap-1 rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"

/** Matches {@link PodiumPlaceCell}: `w-10` TQ slot + `gap-2` before the place badge — aligns header labels with chips. */
const PODIUM_HEADER_LEAD_SPACER = <span className="inline-flex h-6 w-10 shrink-0" aria-hidden />

const PODIUM_HEADER_SORT_BUTTON_CLASS = [
  "inline-flex min-w-0 flex-1 items-center gap-1 rounded-md px-0 text-left text-[inherit]",
  "hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]",
].join(" ")

const SURFACE_CLASS = OVERVIEW_GLASS_SURFACE_CLASS
const SURFACE_STYLE = OVERVIEW_GLASS_SURFACE_STYLE

function placeBadgeClass(place: "1st" | "2nd" | "3rd"): string {
  if (place === "1st") {
    return "bg-[var(--token-status-warning-bg)] text-[var(--token-status-warning-text)] ring-[var(--token-status-warning-text)]/20"
  }
  if (place === "2nd") {
    return "bg-[var(--token-surface-raised)]/80 text-[var(--token-text-secondary)] ring-[var(--token-border-default)]/80"
  }
  return "bg-[var(--token-surface-raised)]/60 text-[var(--token-text-secondary)] ring-[var(--token-border-default)]/80"
}

function PodiumPlaceCell({
  place,
  children,
  isTopQualifier = false,
}: {
  place: "1st" | "2nd" | "3rd"
  children: ReactNode
  /** When true, show a TQ chip (same size as the place badge) before the place badge. */
  isTopQualifier?: boolean
}) {
  const badgeClass = placeBadgeClass(place)
  const tqBadgeClass =
    "inline-flex h-6 w-10 shrink-0 items-center justify-center rounded-md text-[0.65rem] font-bold leading-none tabular-nums tracking-wide ring-1 ring-inset bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)] ring-[var(--token-accent)]/35 no-underline"
  return (
    <span className="flex min-w-0 max-w-full items-center gap-2">
      {isTopQualifier ? (
        <abbr title="Top qualifier" className={tqBadgeClass} aria-label="Top qualifier">
          TQ
        </abbr>
      ) : (
        <span className="inline-flex h-6 w-10 shrink-0" aria-hidden />
      )}
      <span
        className={`inline-flex h-6 w-10 shrink-0 items-center justify-center rounded-md text-[0.65rem] font-bold leading-none tabular-nums tracking-tight ring-1 ring-inset ${badgeClass}`}
        aria-hidden
      >
        {place}
      </span>
      <span className="min-w-0 flex-1 self-center">{children}</span>
    </span>
  )
}

function rowMatchesDriverSearch(row: ClassWinnerHighlight, searchLower: string): boolean {
  if (!searchLower) return true
  const names = [row.winnerName, row.secondPlaceName, row.thirdPlaceName].filter(
    (n): n is string => typeof n === "string" && n.trim().length > 0
  )
  return names.some((n) => n.toLowerCase().includes(searchLower))
}

export interface EventOverallResultsTableProps {
  rows: ClassWinnerHighlight[]
  topQualifierByClass: ReadonlyMap<string, TopQualifierCardModel>
  onRowActivate: (row: ClassWinnerHighlight) => void
  /** When set, row matching this class + winner shows `aria-expanded` for the standings modal. */
  activeDetail: ClassWinnerHighlight | null
  classFilter?: string | null
  onClassFilterChange?: (className: string | null) => void
  classFilterOptions?: string[]
  /** Event vs session results toggle; rendered with Class / Driver filters (table toolbar). */
  resultsTabStrip?: ReactNode
}

export default function EventOverallResultsTable({
  rows,
  topQualifierByClass,
  onRowActivate,
  activeDetail,
  classFilter,
  onClassFilterChange,
  classFilterOptions,
  resultsTabStrip,
}: EventOverallResultsTableProps) {
  const classFilterId = useId()
  const driverFilterId = useId()

  const availableClassOptions = useMemo(() => {
    const source =
      classFilterOptions && classFilterOptions.length > 0
        ? classFilterOptions
        : Array.from(
            new Set(
              rows
                .map((r) => r.className)
                .filter(
                  (className): className is string =>
                    typeof className === "string" && className.trim().length > 0
                )
            )
          )
    return Array.from(
      new Set(
        source
          .map((className) => className.trim())
          .filter(
            (className): className is string =>
              typeof className === "string" && className.trim().length > 0
          )
      )
    ).sort((a, b) => a.localeCompare(b))
  }, [rows, classFilterOptions])

  const effectiveClassFilter = useMemo(() => {
    const next = classFilter?.trim() ?? ""
    if (!next) return ""
    return availableClassOptions.includes(next) ? next : ""
  }, [classFilter, availableClassOptions])

  const classFilteredRows = useMemo(() => {
    if (!effectiveClassFilter) return rows
    return rows.filter((r) => r.className === effectiveClassFilter)
  }, [rows, effectiveClassFilter])

  const headerClassLabel = useMemo(() => {
    const classes = Array.from(
      new Set(
        classFilteredRows
          .map((r) => r.className)
          .filter(
            (className): className is string =>
              typeof className === "string" && className.trim().length > 0
          )
      )
    )
    if (classes.length === 0) return "All Classes"
    if (classes.length === 1) return classes[0]
    return "Multiple Classes"
  }, [classFilteredRows])

  const [driverSearch, setDriverSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("classDisplay")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)

  const driverFilteredRows = useMemo(() => {
    const search = driverSearch.trim().toLowerCase()
    if (!search) return classFilteredRows
    return classFilteredRows.filter((row) => rowMatchesDriverSearch(row, search))
  }, [classFilteredRows, driverSearch])

  const sortedRows = useMemo(() => {
    const list = [...driverFilteredRows]
    list.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case "classDisplay":
          cmp = a.classDisplay.localeCompare(b.classDisplay)
          break
        case "winnerName":
          cmp = a.winnerName.localeCompare(b.winnerName, undefined, { sensitivity: "base" })
          break
        case "secondPlaceName":
          cmp = (a.secondPlaceName ?? "").localeCompare(b.secondPlaceName ?? "", undefined, {
            sensitivity: "base",
          })
          break
        case "thirdPlaceName":
          cmp = (a.thirdPlaceName ?? "").localeCompare(b.thirdPlaceName ?? "", undefined, {
            sensitivity: "base",
          })
          break
        default:
          cmp = 0
      }
      if (cmp !== 0) {
        return sortDirection === "asc" ? cmp : -cmp
      }
      return compareRowsTieBreak(a, b)
    })
    return list
  }, [driverFilteredRows, sortField, sortDirection])

  const paginationResetKey = useMemo(
    () =>
      `${effectiveClassFilter}\0${driverSearch}\0${classFilteredRows.map((r) => r.className).join("\0")}`,
    [effectiveClassFilter, driverSearch, classFilteredRows]
  )

  useEffect(() => {
    queueMicrotask(() => setCurrentPage(1))
  }, [paginationResetKey, sortField, sortDirection])

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      } else {
        setSortField(field)
        setSortDirection("asc")
      }
    },
    [sortField]
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

  const podiumSlotIsTopQualifier = useCallback(
    (className: string, name: string | null | undefined) => {
      const tq = topQualifierByClass.get(className.trim()) ?? null
      return Boolean(name && tq && driverNamesMatchForClassWinner(name, tq.driverDisplayName))
    },
    [topQualifierByClass]
  )

  if (rows.length === 0) {
    return (
      <div className={SURFACE_CLASS} style={SURFACE_STYLE}>
        <div className="border-b border-[var(--token-border-default)] px-4 py-3">
          <div className="flex min-w-0 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="min-w-0 sm:min-w-[12rem] sm:flex-1 sm:pr-2">
              <h2 className={typography.overviewEventResultsToolbarTitle}>Event Results</h2>
              <p className="mt-1 text-left text-sm text-[var(--token-text-secondary)]">
                No overall class results in this selection.
              </p>
            </div>
            {resultsTabStrip ? (
              <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-3">
                {resultsTabStrip}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={SURFACE_CLASS} style={SURFACE_STYLE}>
      <div className="border-b border-[var(--token-border-default)] px-4 py-3">
        <div className="flex min-w-0 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2
            className={`${typography.overviewEventResultsToolbarTitle} min-w-0 max-w-full flex-1 truncate sm:pr-2`}
          >
            {`Event Results: ${headerClassLabel}`}
          </h2>
          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-3">
            {resultsTabStrip}
            {onClassFilterChange && availableClassOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor={classFilterId}
                  className="text-xs font-medium text-[var(--token-text-secondary)]"
                >
                  Class
                </label>
                <select
                  id={classFilterId}
                  value={effectiveClassFilter}
                  onChange={(e) => onClassFilterChange(e.target.value || null)}
                  className="max-w-[min(100%,22rem)] rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
                >
                  <option value="">All classes</option>
                  {availableClassOptions.map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label
                htmlFor={driverFilterId}
                className="text-xs font-medium text-[var(--token-text-secondary)]"
              >
                Driver
              </label>
              <input
                id={driverFilterId}
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
      {classFilteredRows.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-[var(--token-text-secondary)]">
          No classes match the selected class filter.
        </p>
      ) : driverFilteredRows.length === 0 ? (
        <div className="flex h-32 items-center justify-center px-4 text-sm text-[var(--token-text-secondary)]">
          No rows match the driver search.
        </div>
      ) : (
        <div className="space-y-3 px-2 py-2 sm:px-4">
          <DataTableFrame>
            <StandardTable>
              <StandardTableHeader>
                <StandardTableRow className="border-b border-[var(--token-border-default)]">
                  <StandardTableCell
                    header
                    className={`align-middle px-3 py-2 text-left ${typography.tableHeader}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort("classDisplay")}
                      className={HEADER_BUTTON_CLASS}
                    >
                      Class
                      <SortIcon
                        field="classDisplay"
                        activeField={sortField}
                        direction={sortDirection}
                      />
                    </button>
                  </StandardTableCell>
                  <StandardTableCell
                    header
                    className={`align-middle px-3 py-2 text-left ${typography.tableHeader}`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {PODIUM_HEADER_LEAD_SPACER}
                      <button
                        type="button"
                        onClick={() => handleSort("winnerName")}
                        className={PODIUM_HEADER_SORT_BUTTON_CLASS}
                      >
                        1st
                        <SortIcon
                          field="winnerName"
                          activeField={sortField}
                          direction={sortDirection}
                        />
                      </button>
                    </div>
                  </StandardTableCell>
                  <StandardTableCell
                    header
                    className={`align-middle px-3 py-2 text-left ${typography.tableHeader}`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {PODIUM_HEADER_LEAD_SPACER}
                      <button
                        type="button"
                        onClick={() => handleSort("secondPlaceName")}
                        className={PODIUM_HEADER_SORT_BUTTON_CLASS}
                      >
                        2nd
                        <SortIcon
                          field="secondPlaceName"
                          activeField={sortField}
                          direction={sortDirection}
                        />
                      </button>
                    </div>
                  </StandardTableCell>
                  <StandardTableCell
                    header
                    className={`align-middle px-3 py-2 text-left ${typography.tableHeader}`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {PODIUM_HEADER_LEAD_SPACER}
                      <button
                        type="button"
                        onClick={() => handleSort("thirdPlaceName")}
                        className={PODIUM_HEADER_SORT_BUTTON_CLASS}
                      >
                        3rd
                        <SortIcon
                          field="thirdPlaceName"
                          activeField={sortField}
                          direction={sortDirection}
                        />
                      </button>
                    </div>
                  </StandardTableCell>
                </StandardTableRow>
              </StandardTableHeader>
              <tbody>
                {paginatedRows.map((cw) => {
                  const isOpen =
                    activeDetail?.className === cw.className &&
                    activeDetail?.winnerName === cw.winnerName
                  const ariaLabel = `Open class results: 1st ${cw.winnerName}${
                    podiumSlotIsTopQualifier(cw.className, cw.winnerName) ? " (top qualifier)" : ""
                  }${cw.secondPlaceName ? `, 2nd ${cw.secondPlaceName}` : ""}${
                    podiumSlotIsTopQualifier(cw.className, cw.secondPlaceName)
                      ? " (top qualifier)"
                      : ""
                  }${cw.thirdPlaceName ? `, 3rd ${cw.thirdPlaceName}` : ""}${
                    podiumSlotIsTopQualifier(cw.className, cw.thirdPlaceName)
                      ? " (top qualifier)"
                      : ""
                  } · ${cw.classDisplay}`
                  return (
                    <StandardTableRow
                      key={cw.className}
                      tabIndex={0}
                      aria-label={ariaLabel}
                      aria-haspopup="dialog"
                      aria-expanded={isOpen}
                      onClick={() => onRowActivate(cw)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          onRowActivate(cw)
                        }
                      }}
                    >
                      <StandardTableCell className="align-middle px-3 py-2 text-sm font-medium text-[var(--token-text-primary)]">
                        {cw.classDisplay}
                      </StandardTableCell>
                      <StandardTableCell className="align-middle px-3 py-2 text-sm text-[var(--token-text-primary)]">
                        <PodiumPlaceCell
                          place="1st"
                          isTopQualifier={podiumSlotIsTopQualifier(cw.className, cw.winnerName)}
                        >
                          <HighlightPodiumName
                            name={cw.winnerName}
                            className="min-w-0 truncate font-semibold text-[var(--token-text-primary)]"
                          />
                        </PodiumPlaceCell>
                      </StandardTableCell>
                      <StandardTableCell className="align-middle px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                        <PodiumPlaceCell
                          place="2nd"
                          isTopQualifier={podiumSlotIsTopQualifier(
                            cw.className,
                            cw.secondPlaceName
                          )}
                        >
                          <PodiumSlotName
                            name={cw.secondPlaceName}
                            filledClassName="min-w-0 truncate text-[var(--token-text-secondary)]"
                            emptyHint="No 2nd place in imported results for this class"
                            suppressEmbeddedTqBadge
                          />
                        </PodiumPlaceCell>
                      </StandardTableCell>
                      <StandardTableCell className="align-middle px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                        <PodiumPlaceCell
                          place="3rd"
                          isTopQualifier={podiumSlotIsTopQualifier(cw.className, cw.thirdPlaceName)}
                        >
                          <PodiumSlotName
                            name={cw.thirdPlaceName}
                            filledClassName="min-w-0 truncate text-[var(--token-text-secondary)]"
                            emptyHint="No 3rd place in imported results for this class"
                            suppressEmbeddedTqBadge
                          />
                        </PodiumPlaceCell>
                      </StandardTableCell>
                    </StandardTableRow>
                  )
                })}
              </tbody>
            </StandardTable>
          </DataTableFrame>
          <div className="min-w-0 w-full max-w-full">
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={sortedRows.length}
              itemLabel="classes"
              onRowsPerPageChange={handleRowsPerPageChange}
              embedded
            />
          </div>
        </div>
      )}
    </div>
  )
}
