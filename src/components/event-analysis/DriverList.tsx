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

import { useState, useMemo, useEffect } from "react"
import { FixedSizeList as List } from "react-window"
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

// Hook to detect if screen is mobile (sm breakpoint = 640px)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(true)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return isMobile
}

export default function DriverList({
  drivers,
  selectedDriverIds,
  onSelectionChange,
}: DriverListProps) {
  const [sortField, setSortField] = useState<SortField>("bestLapTime")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const isMobile = useIsMobile()

  // Stabilize drivers reference to prevent unnecessary re-sorts
  const driversKey = useMemo(() => drivers.map(d => d.driverId).join(","), [drivers.length, drivers.map(d => d.driverId).join(",")])

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
  }, [driversKey, sortField, sortDirection, drivers])

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

  // Mobile card row renderer for react-window
  const CardRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const driver = sortedDrivers[index]
    return (
      <div style={style}>
        <div className="px-0 pb-3">
          <DriverCard
            key={driver.driverId}
            {...driver}
            isSelected={selectedDriverIds.includes(driver.driverId)}
            onSelectionChange={handleDriverSelectionChange}
          />
        </div>
      </div>
    )
  }

  // Desktop table row renderer for react-window
  const TableRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const driver = sortedDrivers[index]
    const isSelected = selectedDriverIds.includes(driver.driverId)
    return (
      <div
        style={style}
        className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface)] transition-colors items-center"
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
  }

  return (
    <div className="space-y-4">
      {/* Mobile: Virtualized card layout */}
      {isMobile && (
        <div className="block sm:hidden">
          <List
            height={600}
            itemCount={sortedDrivers.length}
            itemSize={140}
            width="100%"
          >
            {CardRow}
          </List>
        </div>
      )}

      {/* Desktop: Virtualized table layout */}
      {!isMobile && (
        <div className="hidden sm:block overflow-x-auto">
          <div className="w-full">
            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] border-b border-[var(--token-border-default)]">
              <div className="text-left py-3 px-4">
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
            {/* Virtualized table body */}
            <List
              height={600}
              itemCount={sortedDrivers.length}
              itemSize={60}
              width="100%"
            >
              {TableRow}
            </List>
          </div>
        </div>
      )}
    </div>
  )
}
