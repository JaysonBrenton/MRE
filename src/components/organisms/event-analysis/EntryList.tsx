/**
 * @fileoverview Entry list component with table layout and pagination
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-29
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

export default function EntryList({ entries, raceClasses, eventId: _eventId }: EntryListProps) {
  const [sortField, setSortField] = useState<SortField>("driverName")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)

  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
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
  }, [entries, sortField, sortDirection])

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

  // Reset to page 1 when sort, filter, or itemsPerPage changes
  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [sortField, sortDirection, itemsPerPage])

  return (
    <ChartContainer
      title="Entry List"
      description="Complete list of drivers entered in this event"
      aria-label="Entry list with driver names, classes, transponders, and car numbers"
    >
      <div className="space-y-4">
        {/* Table layout */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* Table header */}
            <thead>
              <tr className="border-b border-[var(--token-border-default)]">
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
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
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                  <button
                    type="button"
                    onClick={() => handleSort("className")}
                    className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  >
                    Class
                    <SortIcon field="className" activeField={sortField} direction={sortDirection} />
                  </button>
                </th>
                {raceClasses && (
                  <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                    Vehicle Type
                  </th>
                )}
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
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
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
                  <button
                    type="button"
                    onClick={() => handleSort("carNumber")}
                    className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  >
                    Car Number
                    <SortIcon field="carNumber" activeField={sortField} direction={sortDirection} />
                  </button>
                </th>
              </tr>
            </thead>
            {/* Table body */}
            <tbody>
              {paginatedEntries.map((entry) => {
                const raceClassInfo = raceClasses?.get(entry.className)
                const vehicleType = raceClassInfo?.vehicleType

                return (
                  <tr
                    key={entry.id}
                    className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)] transition-colors"
                  >
                    <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-primary)]">
                      {entry.driverName}
                    </td>
                    <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                      {entry.className}
                    </td>
                    {raceClasses && (
                      <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                        {vehicleType || "Not determined"}
                      </td>
                    )}
                    <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                      {entry.transponderNumber || "N/A"}
                    </td>
                    <td className="py-3 px-4 text-sm font-normal text-[var(--token-text-secondary)]">
                      {entry.carNumber || "N/A"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <ListPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={sortedEntries.length}
          itemLabel="entries"
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      </div>
    </ChartContainer>
  )
}
