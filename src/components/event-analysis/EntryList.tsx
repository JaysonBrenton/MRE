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
import ClassFilter from "./ClassFilter"

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

export default function EntryList({ entries }: EntryListProps) {
  const [sortField, setSortField] = useState<SortField>("driverName")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Extract unique classes from entries
  const availableClasses = useMemo(() => {
    const classes = new Set<string>()
    entries.forEach((entry) => {
      if (entry.className) {
        classes.add(entry.className)
      }
    })
    return Array.from(classes).sort()
  }, [entries])

  // Filter entries by class
  const filteredEntries = useMemo(() => {
    if (!selectedClass) {
      return entries
    }
    return entries.filter((entry) => entry.className === selectedClass)
  }, [entries, selectedClass])

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

  // Reset to page 1 when sort, filter, or itemsPerPage changes
  useEffect(() => {
    setCurrentPage(1)
  }, [sortField, sortDirection, selectedClass, itemsPerPage])

  return (
    <div className="space-y-4">
      {/* Class Filter */}
      <div className="flex justify-end">
        <ClassFilter
          classes={availableClasses}
          selectedClass={selectedClass}
          onClassChange={setSelectedClass}
        />
      </div>

      {/* Table layout */}
      <div className="overflow-x-auto">
        <div className="w-full">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] border-b border-[var(--token-border-default)]">
            <div className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
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
            </div>
            <div className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
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
            </div>
            <div className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
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
            </div>
            <div className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]">
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
            </div>
          </div>
          {/* Table body */}
          <div>
            {paginatedEntries.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[1fr_auto_auto_auto] border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface)] transition-colors items-center"
              >
                <div className="py-3 px-4 text-[var(--token-text-primary)] font-medium">
                  {entry.driverName}
                </div>
                <div className="py-3 px-4 text-[var(--token-text-secondary)]">
                  {entry.className}
                </div>
                <div className="py-3 px-4 text-[var(--token-text-secondary)]">
                  {entry.transponderNumber || "N/A"}
                </div>
                <div className="py-3 px-4 text-[var(--token-text-secondary)]">
                  {entry.carNumber || "N/A"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pagination */}
      <ListPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={sortedEntries.length}
        itemLabel="entries"
        rowsPerPageOptions={[10, 25, 50, 100]}
        onRowsPerPageChange={handleRowsPerPageChange}
      />
    </div>
  )
}

