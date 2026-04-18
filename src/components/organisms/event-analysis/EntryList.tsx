/**
 * @fileoverview Entry list component with table layout and pagination
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-04-06
 *
 * @description Entry list component showing the actual event entry list with pagination
 *
 * @purpose Displays event entries with driver name, class, transponder number, and car number.
 *          Desktop-optimized table layout with paginated results.
 *
 * @relatedFiles
 * - src/components/event-analysis/EntryListTab.tsx (uses this)
 * - src/components/event-analysis/ListPagination.tsx (pagination component)
 */

"use client"

import { useState, useMemo, useEffect } from "react"
import ListPagination from "./ListPagination"
import ChartContainer from "./ChartContainer"
import { getEntryListClassOptions } from "@/core/events/entry-list-class-options"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import { DataTableFrame } from "@/components/organisms/event-analysis/DataPanelSurface"

export interface Entry {
  id: string
  driverId: string
  driverName: string
  className: string
  transponderNumber: string | null
  carNumber: string | null
}

export interface EntryListProps {
  entries: Entry[]
  raceClasses?: Map<string, { vehicleType: string | null; vehicleTypeNeedsReview: boolean }>
  eventId?: string
  /**
   * Program-bucket options for the class filter dropdown. When omitted, options come from `entries`
   * only. Pass `getSessionAnalysisNavClassOptions(data)` to match Session Analysis pills.
   */
  classFilterOptions?: string[]
}

type SortField = "driverName" | "className" | "transponderNumber" | "carNumber"
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

export default function EntryList({
  entries,
  raceClasses,
  eventId: _eventId,
  classFilterOptions: classFilterOptionsProp,
}: EntryListProps) {
  const [sortField, setSortField] = useState<SortField>("driverName")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [classFilter, setClassFilter] = useState("")
  const [driverSearch, setDriverSearch] = useState("")

  const classOptions = useMemo(() => {
    if (classFilterOptionsProp != null && classFilterOptionsProp.length > 0) {
      return classFilterOptionsProp
    }
    return getEntryListClassOptions(entries)
  }, [entries, classFilterOptionsProp])

  useEffect(() => {
    if (classFilter && !classOptions.includes(classFilter)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync filter to new dataset
      setClassFilter("")
    }
  }, [classOptions, classFilter])

  const filteredEntries = useMemo(() => {
    let r = entries
    if (classFilter) {
      r = r.filter((e) => e.className.trim() === classFilter)
    }
    const search = driverSearch.trim().toLowerCase()
    if (search) {
      r = r.filter((e) => e.driverName.toLowerCase().includes(search))
    }
    return r
  }, [entries, classFilter, driverSearch])

  const sortedEntries = useMemo(() => {
    const sorted = [...filteredEntries].sort((a, b) => {
      let aValue: number | string | null
      let bValue: number | string | null

      switch (sortField) {
        case "driverName":
          aValue = a.driverName.toLowerCase()
          bValue = b.driverName.toLowerCase()
          break
        case "className":
          aValue = a.className.toLowerCase()
          bValue = b.className.toLowerCase()
          break
        case "transponderNumber":
          aValue = a.transponderNumber ?? ""
          bValue = b.transponderNumber ?? ""
          break
        case "carNumber":
          aValue = a.carNumber ?? ""
          bValue = b.carNumber ?? ""
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    return sorted
  }, [filteredEntries, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setItemsPerPage(newRowsPerPage)
    setCurrentPage(1)
  }

  // Pagination calculations
  const totalPages = Math.ceil(sortedEntries.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedEntries = sortedEntries.slice(startIndex, endIndex)

  useEffect(() => {
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [sortField, sortDirection, itemsPerPage, classFilter, driverSearch])

  const headerControls = useMemo(
    () => (
      <div className="mt-3 flex w-full flex-wrap items-center gap-3 sm:mt-0">
        <div className="flex items-center gap-2">
          <label
            htmlFor="entry-list-class-filter"
            className="text-xs font-medium text-[var(--token-text-secondary)]"
          >
            Sessions
          </label>
          <select
            id="entry-list-class-filter"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            <option value="">All Sessions</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="entry-list-driver-filter"
            className="text-xs font-medium text-[var(--token-text-secondary)]"
          >
            Driver
          </label>
          <input
            id="entry-list-driver-filter"
            type="text"
            value={driverSearch}
            onChange={(e) => setDriverSearch(e.target.value)}
            placeholder="Search driver name"
            className="w-40 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] placeholder:text-[var(--token-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
          />
        </div>
      </div>
    ),
    [classFilter, classOptions, driverSearch]
  )

  return (
    <ChartContainer
      headerControls={headerControls}
      aria-label="Entry list with driver names, classes, transponders, and car numbers"
    >
      <div className="space-y-4">
        {sortedEntries.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-[var(--token-text-secondary)]">
            No rows match the selected filters.
          </div>
        ) : (
          <DataTableFrame>
            <StandardTable>
              <StandardTableHeader>
                <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
                  <StandardTableCell header>
                    <button
                      type="button"
                      onClick={() => handleSort("driverName")}
                      className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    >
                      Driver Name
                      <SortIcon
                        field="driverName"
                        activeField={sortField}
                        direction={sortDirection}
                      />
                    </button>
                  </StandardTableCell>
                  <StandardTableCell header>
                    <button
                      type="button"
                      onClick={() => handleSort("className")}
                      className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    >
                      Class
                      <SortIcon
                        field="className"
                        activeField={sortField}
                        direction={sortDirection}
                      />
                    </button>
                  </StandardTableCell>
                  {raceClasses && <StandardTableCell header>Vehicle Type</StandardTableCell>}
                  <StandardTableCell header>
                    <button
                      type="button"
                      onClick={() => handleSort("transponderNumber")}
                      className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    >
                      Transponder
                      <SortIcon
                        field="transponderNumber"
                        activeField={sortField}
                        direction={sortDirection}
                      />
                    </button>
                  </StandardTableCell>
                  <StandardTableCell header>
                    <button
                      type="button"
                      onClick={() => handleSort("carNumber")}
                      className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    >
                      Car Number
                      <SortIcon
                        field="carNumber"
                        activeField={sortField}
                        direction={sortDirection}
                      />
                    </button>
                  </StandardTableCell>
                </tr>
              </StandardTableHeader>
              <tbody>
                {paginatedEntries.map((entry) => {
                  const raceClassInfo = raceClasses?.get(entry.className)
                  const vehicleType = raceClassInfo?.vehicleType

                  return (
                    <StandardTableRow key={entry.id}>
                      <StandardTableCell>{entry.driverName}</StandardTableCell>
                      <StandardTableCell className="text-[var(--token-text-secondary)]">
                        {entry.className}
                      </StandardTableCell>
                      {raceClasses && (
                        <StandardTableCell className="text-[var(--token-text-secondary)]">
                          {vehicleType || "Not determined"}
                        </StandardTableCell>
                      )}
                      <StandardTableCell className="text-[var(--token-text-secondary)]">
                        {entry.transponderNumber?.trim() || "—"}
                      </StandardTableCell>
                      <StandardTableCell className="text-[var(--token-text-secondary)]">
                        {entry.carNumber?.trim() || "—"}
                      </StandardTableCell>
                    </StandardTableRow>
                  )
                })}
              </tbody>
            </StandardTable>
          </DataTableFrame>
        )}

        {sortedEntries.length > 0 && (
          <ListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={sortedEntries.length}
            itemLabel="entries"
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        )}
      </div>
    </ChartContainer>
  )
}
