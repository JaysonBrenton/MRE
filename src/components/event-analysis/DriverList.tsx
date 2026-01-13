/**
 * @fileoverview Driver list component with table layout and pagination
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-29
 * 
 * @description Driver list component with desktop-optimized table layout and pagination
 * 
 * @purpose Displays drivers with stats, supports selection, sorting, and pagination.
 *          Desktop-optimized table layout with paginated results.
 * 
 * @relatedFiles
 * - src/components/event-analysis/DriversTab.tsx (uses this)
 * - src/components/event-analysis/ListPagination.tsx (pagination component)
 */

"use client"

import { useState, useMemo, useEffect } from "react"
import ListPagination from "./ListPagination"
import ClassFilter from "./ClassFilter"

export interface Driver {
  driverId: string
  driverName: string
  racesParticipated: number
  bestLapTime: number | null
  avgLapTime: number | null
  consistency: number | null
}

export interface DriverListProps {
  drivers: Driver[]
  selectedDriverIds: string[]
  onSelectionChange: (driverIds: string[]) => void
  races?: Array<{
    className: string
    results: Array<{
      driverId: string
    }>
  }>
  raceClasses?: Map<string, { vehicleType: string | null; vehicleTypeNeedsReview: boolean }>
  eventId?: string
}

type SortField = "driverName" | "bestLapTime" | "avgLapTime" | "consistency" | "racesParticipated"
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

export default function DriverList({
  drivers,
  selectedDriverIds,
  onSelectionChange,
  races = [],
  raceClasses,
  eventId,
}: DriverListProps) {
  const [sortField, setSortField] = useState<SortField>("bestLapTime")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [itemsPerPage, setItemsPerPage] = useState(5)

  // Build a map of driverId -> classes they participated in
  const driverClassesMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    races.forEach((race) => {
        race.results.forEach((result) => {
          if (!map.has(result.driverId)) {
            map.set(result.driverId, new Set())
          }
          map.get(result.driverId)!.add(race.className)
        })
      })
    return map
  }, [races])

  // Extract unique classes from races
  const availableClasses = useMemo(() => {
    const classes = new Set<string>()
    races.forEach((race) => {
        classes.add(race.className)
      })
    return Array.from(classes).sort()
  }, [races])

  // Filter drivers by class
  const filteredDrivers = useMemo(() => {
    if (!selectedClass) {
      return drivers
    }
    return drivers.filter((driver) => {
      const driverClasses = driverClassesMap.get(driver.driverId)
      return driverClasses?.has(selectedClass) ?? false
    })
  }, [drivers, selectedClass, driverClassesMap])

  const sortedDrivers = useMemo(() => {
    const sorted = [...filteredDrivers].sort((a, b) => {
      let aValue: number | string | null
      let bValue: number | string | null

      switch (sortField) {
        case "driverName":
          aValue = a.driverName.toLowerCase()
          bValue = b.driverName.toLowerCase()
          break
        case "bestLapTime":
          aValue = a.bestLapTime ?? Infinity
          bValue = b.bestLapTime ?? Infinity
          break
        case "avgLapTime":
          aValue = a.avgLapTime ?? Infinity
          bValue = b.avgLapTime ?? Infinity
          break
        case "consistency":
          aValue = a.consistency ?? -Infinity
          bValue = b.consistency ?? -Infinity
          break
        case "racesParticipated":
          aValue = a.racesParticipated
          bValue = b.racesParticipated
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    return sorted
  }, [filteredDrivers, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const handleDriverSelectionChange = (driverId: string, selected: boolean) => {
    if (selected) {
      onSelectionChange([...selectedDriverIds, driverId])
    } else {
      onSelectionChange(selectedDriverIds.filter((id) => id !== driverId))
    }
  }

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setItemsPerPage(newRowsPerPage)
    setCurrentPage(1)
  }

  // Pagination calculations
  const totalPages = Math.ceil(sortedDrivers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedDrivers = sortedDrivers.slice(startIndex, endIndex)

  // Reset to page 1 when sort, filter, or itemsPerPage changes
  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    setTimeout(() => {
      setCurrentPage(1)
    }, 0)
  }, [sortField, sortDirection, selectedClass, itemsPerPage])

  return (
    <div className="space-y-4">
      {/* Class Filter */}
      <div className="flex justify-end">
        <ClassFilter
          classes={availableClasses}
          selectedClass={selectedClass}
          onClassChange={setSelectedClass}
          onClassInfoClick={eventId ? (className) => {
            // Could open modal here if needed
            console.log("Class info clicked:", className)
          } : undefined}
          raceClasses={raceClasses}
        />
      </div>

      {/* Table layout */}
      <div className="overflow-x-auto">
        <div className="w-full">
          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] border-b border-[var(--token-border-default)]">
            <div className="text-left py-3 px-4">
              <input
                type="checkbox"
                checked={
                  filteredDrivers.length > 0 &&
                  filteredDrivers.every((d) => selectedDriverIds.includes(d.driverId))
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    const allFilteredIds = filteredDrivers.map((d) => d.driverId)
                    const newSelection = [...new Set([...selectedDriverIds, ...allFilteredIds])]
                    onSelectionChange(newSelection)
                  } else {
                    const filteredIds = new Set(filteredDrivers.map((d) => d.driverId))
                    onSelectionChange(selectedDriverIds.filter((id) => !filteredIds.has(id)))
                  }
                }}
                className="w-4 h-4 rounded border-[var(--token-border-default)] text-[var(--token-accent)] focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
              />
            </div>
            <div
              className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]"
            >
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
            <div
              className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]"
            >
              <button
                type="button"
                onClick={() => handleSort("racesParticipated")}
                className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              >
                Races
                <SortIcon
                  field="racesParticipated"
                  activeField={sortField}
                  direction={sortDirection}
                />
              </button>
            </div>
            <div
              className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]"
            >
              <button
                type="button"
                onClick={() => handleSort("bestLapTime")}
                className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              >
                Best Lap
                <SortIcon
                  field="bestLapTime"
                  activeField={sortField}
                  direction={sortDirection}
                />
              </button>
            </div>
            <div
              className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]"
            >
              <button
                type="button"
                onClick={() => handleSort("avgLapTime")}
                className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              >
                Avg Lap
                <SortIcon
                  field="avgLapTime"
                  activeField={sortField}
                  direction={sortDirection}
                />
              </button>
            </div>
            <div
              className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)]"
            >
              <button
                type="button"
                onClick={() => handleSort("consistency")}
                className="rounded-md px-0 text-left text-[inherit] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              >
                Consistency
                <SortIcon
                  field="consistency"
                  activeField={sortField}
                  direction={sortDirection}
                />
              </button>
            </div>
          </div>
          {/* Table body */}
          <div>
            {paginatedDrivers.map((driver) => {
              const isSelected = selectedDriverIds.includes(driver.driverId)
              return (
                <div
                  key={driver.driverId}
                  className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)] transition-colors items-center"
                >
                  <div className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) =>
                        handleDriverSelectionChange(
                          driver.driverId,
                          e.target.checked
                        )
                      }
                      className="w-4 h-4 rounded border-[var(--token-border-default)] text-[var(--token-accent)] focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    />
                  </div>
                  <div className="py-3 px-4 text-[var(--token-text-primary)] font-medium">
                    {driver.driverName}
                  </div>
                  <div className="py-3 px-4 text-[var(--token-text-secondary)]">
                    {driver.racesParticipated}
                  </div>
                  <div className="py-3 px-4 text-[var(--token-text-secondary)]">
                    {driver.bestLapTime
                      ? `${Math.floor(driver.bestLapTime / 60)}:${(
                          (driver.bestLapTime % 60).toFixed(3).padStart(6, "0")
                        )}`
                      : "N/A"}
                  </div>
                  <div className="py-3 px-4 text-[var(--token-text-secondary)]">
                    {driver.avgLapTime
                      ? `${Math.floor(driver.avgLapTime / 60)}:${(
                          (driver.avgLapTime % 60).toFixed(3).padStart(6, "0")
                        )}`
                      : "N/A"}
                  </div>
                  <div className="py-3 px-4 text-[var(--token-text-secondary)]">
                    {driver.consistency !== null
                      ? `${driver.consistency.toFixed(1)}%`
                      : "N/A"}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Pagination */}
      <ListPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={sortedDrivers.length}
        itemLabel="drivers"
        rowsPerPageOptions={[5, 10, 25, 50, 100]}
        onRowsPerPageChange={handleRowsPerPageChange}
      />
    </div>
  )
}
