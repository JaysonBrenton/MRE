/**
 * @fileoverview Driver list component - responsive driver list/table
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Responsive driver list component (cards on mobile, table on desktop)
 * 
 * @purpose Displays drivers with stats, supports selection and sorting.
 *          Mobile-first design with card layout on small screens.
 * 
 * @relatedFiles
 * - src/components/event-analysis/DriverCard.tsx (mobile card)
 * - src/components/event-analysis/DriversTab.tsx (uses this)
 */

"use client"

import { useState, useMemo } from "react"
import DriverCard from "./DriverCard"

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
}

type SortField = "driverName" | "bestLapTime" | "avgLapTime" | "consistency" | "racesParticipated"
type SortDirection = "asc" | "desc"

export default function DriverList({
  drivers,
  selectedDriverIds,
  onSelectionChange,
}: DriverListProps) {
  const [sortField, setSortField] = useState<SortField>("bestLapTime")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const sortedDrivers = useMemo(() => {
    const sorted = [...drivers].sort((a, b) => {
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
  }, [drivers, sortField, sortDirection])

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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === "asc" ? "↑" : "↓"
  }

  return (
    <div className="space-y-4">
      {/* Mobile: Card layout */}
      <div className="block sm:hidden space-y-3">
        {sortedDrivers.map((driver) => (
          <DriverCard
            key={driver.driverId}
            {...driver}
            isSelected={selectedDriverIds.includes(driver.driverId)}
            onSelectionChange={handleDriverSelectionChange}
          />
        ))}
      </div>

      {/* Desktop: Table layout */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--token-border-default)]">
              <th className="text-left py-3 px-4">
                <input
                  type="checkbox"
                  checked={
                    selectedDriverIds.length === drivers.length &&
                    drivers.length > 0
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      onSelectionChange(drivers.map((d) => d.driverId))
                    } else {
                      onSelectionChange([])
                    }
                  }}
                  className="w-4 h-4 rounded border-[var(--token-border-default)] text-[var(--token-accent)] focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
                />
              </th>
              <th
                className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)] cursor-pointer hover:text-[var(--token-text-primary)] transition-colors"
                onClick={() => handleSort("driverName")}
              >
                Driver Name <SortIcon field="driverName" />
              </th>
              <th
                className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)] cursor-pointer hover:text-[var(--token-text-primary)] transition-colors"
                onClick={() => handleSort("racesParticipated")}
              >
                Races <SortIcon field="racesParticipated" />
              </th>
              <th
                className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)] cursor-pointer hover:text-[var(--token-text-primary)] transition-colors"
                onClick={() => handleSort("bestLapTime")}
              >
                Best Lap <SortIcon field="bestLapTime" />
              </th>
              <th
                className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)] cursor-pointer hover:text-[var(--token-text-primary)] transition-colors"
                onClick={() => handleSort("avgLapTime")}
              >
                Avg Lap <SortIcon field="avgLapTime" />
              </th>
              <th
                className="text-left py-3 px-4 text-sm font-medium text-[var(--token-text-secondary)] cursor-pointer hover:text-[var(--token-text-primary)] transition-colors"
                onClick={() => handleSort("consistency")}
              >
                Consistency <SortIcon field="consistency" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedDrivers.map((driver) => {
              const isSelected = selectedDriverIds.includes(driver.driverId)
              return (
                <tr
                  key={driver.driverId}
                  className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface)] transition-colors"
                >
                  <td className="py-3 px-4">
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
                  </td>
                  <td className="py-3 px-4 text-[var(--token-text-primary)] font-medium">
                    {driver.driverName}
                  </td>
                  <td className="py-3 px-4 text-[var(--token-text-secondary)]">
                    {driver.racesParticipated}
                  </td>
                  <td className="py-3 px-4 text-[var(--token-text-secondary)]">
                    {driver.bestLapTime
                      ? `${Math.floor(driver.bestLapTime / 60)}:${(
                          (driver.bestLapTime % 60).toFixed(3).padStart(6, "0")
                        )}`
                      : "N/A"}
                  </td>
                  <td className="py-3 px-4 text-[var(--token-text-secondary)]">
                    {driver.avgLapTime
                      ? `${Math.floor(driver.avgLapTime / 60)}:${(
                          (driver.avgLapTime % 60).toFixed(3).padStart(6, "0")
                        )}`
                      : "N/A"}
                  </td>
                  <td className="py-3 px-4 text-[var(--token-text-secondary)]">
                    {driver.consistency !== null
                      ? `${driver.consistency.toFixed(1)}%`
                      : "N/A"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

