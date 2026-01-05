/**
 * @fileoverview Chart controls component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Control panel for chart interactions
 *
 * @purpose Provides driver selection and metric switching controls for charts.
 *          Features virtualization, class grouping, compact toggle, and search.
 *          Optimized for desktop viewports.
 *
 * @relatedFiles
 * - src/components/event-analysis/OverviewTab.tsx (uses this)
 */

"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FixedSizeList } from "react-window"
import CollapsibleDriverPanel from "./CollapsibleDriverPanel"
import DriverSelectionHeader from "./DriverSelectionHeader"

export interface Driver {
  driverId: string
  driverName: string
}

export interface Race {
  className: string
  results: Array<{
    driverId: string
    driverName: string
  }>
}

export interface ChartControlsProps {
  drivers: Driver[]
  races: Race[]
  selectedDriverIds: string[]
  onDriverSelectionChange: (driverIds: string[]) => void
  onClassChange?: (className: string | null) => void
}

interface VirtualizedItem {
  type: "class-header" | "driver"
  data: {
    className?: string
    driverCount?: number
    driverId?: string
    driverName?: string
  }
}

interface ClassInfo {
  className: string
  drivers: Driver[]
  driverCount: number
}

// Group drivers by class from races data
// Only counts drivers that exist in the provided drivers array
function groupDriversByClass(drivers: Driver[], races: Race[]): Map<string, ClassInfo> {
  const classMap = new Map<string, Set<string>>()
  const driverMap = new Map<string, Driver>()

  // Create driver lookup map - only include drivers from the provided array
  drivers.forEach((driver) => {
    driverMap.set(driver.driverId, driver)
  })

  // Only process driver IDs that exist in the drivers array
  const validDriverIds = new Set(driverMap.keys())

  // Group drivers by class - only count drivers that exist in drivers array
  races.forEach((race) => {
    if (!classMap.has(race.className)) {
      classMap.set(race.className, new Set())
    }
    race.results.forEach((result) => {
      // Only add driver IDs that are in the valid drivers array
      if (validDriverIds.has(result.driverId)) {
        classMap.get(race.className)!.add(result.driverId)
      }
    })
  })

  // Convert to ClassInfo map
  const result = new Map<string, ClassInfo>()
  classMap.forEach((driverIds, className) => {
    const classDrivers = Array.from(driverIds)
      .map((id) => driverMap.get(id))
      .filter((d): d is Driver => d !== undefined)
    result.set(className, {
      className,
      drivers: classDrivers,
      driverCount: classDrivers.length,
    })
  })

  return result
}

// Create flat list for virtualization with class headers
function createVirtualizedList(
  driversByClass: Map<string, ClassInfo>,
  selectedClass: string | null,
  searchQuery: string
): VirtualizedItem[] {
  const items: VirtualizedItem[] = []
  const searchLower = searchQuery.toLowerCase().trim()

  // Filter classes
  const classesToShow = selectedClass
    ? ([driversByClass.get(selectedClass)].filter(Boolean) as ClassInfo[])
    : Array.from(driversByClass.values())

  // Sort classes by driver count (descending)
  classesToShow.sort((a, b) => b.driverCount - a.driverCount)

  classesToShow.forEach((classInfo) => {
    // Filter drivers by search query
    const filteredDrivers = searchLower
      ? classInfo.drivers.filter((d) => d.driverName.toLowerCase().includes(searchLower))
      : classInfo.drivers

    // Only add class header if there are drivers to show
    if (filteredDrivers.length > 0) {
      items.push({
        type: "class-header",
        data: {
          className: classInfo.className,
          // Always show the total driver count for the class, not the filtered count
          // This ensures consistency with the selected count calculation
          driverCount: classInfo.driverCount,
        },
      })

      // Add drivers for this class
      filteredDrivers.forEach((driver) => {
        items.push({
          type: "driver",
          data: {
            driverId: driver.driverId,
            driverName: driver.driverName,
          },
        })
      })
    }
  })

  return items
}

// Memoized driver item component
const DriverItem = React.memo<{
  index: number
  style: React.CSSProperties
  data: {
    items: VirtualizedItem[]
    isCompact: boolean
    selectedDriverIds: string[]
    onToggle: (driverId: string) => void
  }
}>(({ index, style, data }) => {
  const item = data.items[index]
  const { isCompact, selectedDriverIds, onToggle } = data

  if (item.type === "class-header") {
    return (
      <div
        style={style}
        className="flex items-center px-3 py-2 bg-[var(--token-surface)] border-b border-[var(--token-border-default)]"
      >
        <h3 className="text-sm font-semibold text-[var(--token-text-primary)]">
          {item.data.className} ({item.data.driverCount})
        </h3>
      </div>
    )
  }

  const isSelected = selectedDriverIds.includes(item.data.driverId!)
  const compactClasses = isCompact ? "px-2 py-1.5 gap-1.5 text-xs" : "px-3 py-2 gap-2 text-sm"
  const checkboxSize = isCompact ? "w-3.5 h-3.5" : "w-4 h-4"

  const marginStyle = { marginTop: "4px", marginBottom: "4px" }

  return (
    <div style={style}>
      <div style={{ paddingLeft: "8px", paddingRight: "8px", ...marginStyle }}>
        <label
          className={`flex items-center ${compactClasses} rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] hover:bg-[var(--token-surface)] cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[var(--token-interactive-focus-ring)]`}
          aria-label={`${item.data.driverName}, ${isSelected ? "selected" : "not selected"}`}
        >
          <span className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(item.data.driverId!)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onToggle(item.data.driverId!)
                }
              }}
              className={`${checkboxSize} rounded border-[var(--token-border-default)] text-[var(--token-accent)] focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]`}
              aria-label={`Toggle selection for ${item.data.driverName}`}
            />
          </span>
          <span className="text-[var(--token-text-primary)]">{item.data.driverName}</span>
        </label>
      </div>
    </div>
  )
})

DriverItem.displayName = "DriverItem"

export default function ChartControls({
  drivers,
  races,
  selectedDriverIds,
  onDriverSelectionChange,
  onClassChange,
}: ChartControlsProps) {
  const [isCompact, setIsCompact] = useState(false)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const containerHeight = 400
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Group drivers by class
  const driversByClass = useMemo(() => groupDriversByClass(drivers, races), [drivers, races])

  // Get classes sorted by driver count
  const classesSorted = useMemo(() => {
    return Array.from(driversByClass.values()).sort((a, b) => b.driverCount - a.driverCount)
  }, [driversByClass])

  // Create virtualized list
  const virtualizedItems = useMemo(
    () => createVirtualizedList(driversByClass, selectedClass, debouncedSearchQuery),
    [driversByClass, selectedClass, debouncedSearchQuery]
  )

  // Get visible drivers for select all
  const visibleDrivers = useMemo(() => {
    return virtualizedItems
      .filter((item) => item.type === "driver")
      .map((item) => item.data.driverId!)
      .filter(Boolean)
  }, [virtualizedItems])

  const handleDriverToggle = useCallback(
    (driverId: string) => {
      if (selectedDriverIds.includes(driverId)) {
        onDriverSelectionChange(selectedDriverIds.filter((id) => id !== driverId))
      } else {
        onDriverSelectionChange([...selectedDriverIds, driverId])
      }
    },
    [selectedDriverIds, onDriverSelectionChange]
  )

  const handleSelectAll = useCallback(() => {
    onDriverSelectionChange(visibleDrivers)
  }, [visibleDrivers, onDriverSelectionChange])

  const handleClearSelection = useCallback(() => {
    onDriverSelectionChange([])
  }, [onDriverSelectionChange])

  // Get total driver count - if a class is selected, show count for that class only
  const totalDriverCount = useMemo(() => {
    if (selectedClass) {
      const classInfo = driversByClass.get(selectedClass)
      return classInfo ? classInfo.driverCount : drivers.length
    }
    return drivers.length
  }, [drivers, selectedClass, driversByClass])

  // Get selected count - if a class is selected, only count selected drivers in that class
  const selectedCount = useMemo(() => {
    const driverIdsSet = new Set(drivers.map((d) => d.driverId))
    const validSelectedIds = selectedDriverIds.filter((id) => driverIdsSet.has(id))

    if (selectedClass) {
      const classInfo = driversByClass.get(selectedClass)
      if (classInfo) {
        const classDriverIds = new Set(classInfo.drivers.map((d) => d.driverId))
        const selectedInClass = validSelectedIds.filter((id) => classDriverIds.has(id))

        // Debug: Find missing drivers
        if (classInfo.driverCount !== selectedInClass.length) {
          const missingDrivers = classInfo.drivers.filter(
            (d) => !selectedDriverIds.includes(d.driverId)
          )
          console.log(
            `[ChartControls] Missing ${missingDrivers.length} drivers in class "${selectedClass}":`,
            missingDrivers.map((d) => ({ id: d.driverId, name: d.driverName }))
          )
          console.log(
            `[ChartControls] Class has ${classInfo.driverCount} drivers, but only ${selectedInClass.length} are selected`
          )
          console.log(`[ChartControls] Selected driver IDs:`, selectedDriverIds)
          console.log(`[ChartControls] Class driver IDs:`, Array.from(classDriverIds))
        }

        return selectedInClass.length
      }
    }

    return validSelectedIds.length
  }, [selectedDriverIds, drivers, selectedClass, driversByClass])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsClassDropdownOpen(false)
      }
    }

    if (isClassDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isClassDropdownOpen])

  // Item height based on compact mode (base height + margins: 4px top + 4px bottom = 8px)
  // Class headers need extra top margin (8px instead of 4px)
  const baseItemHeight = isCompact ? 36 : 44
  const itemHeight = baseItemHeight + 8 // 4px top + 4px bottom margin

  // Row renderer for virtualization
  const Row = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      return (
        <DriverItem
          index={index}
          style={style}
          data={{
            items: virtualizedItems,
            isCompact,
            selectedDriverIds,
            onToggle: handleDriverToggle,
          }}
        />
      )
    },
    [virtualizedItems, isCompact, selectedDriverIds, handleDriverToggle]
  )

  const selectedClassInfo = selectedClass ? driversByClass.get(selectedClass) : null
  const displayClass = selectedClassInfo
    ? `${selectedClassInfo.className} (${selectedClassInfo.driverCount})`
    : "All Classes"

  return (
    <div className="space-y-4 mb-6">
      {/* Driver selection - wrapped in collapsible panel */}
      <CollapsibleDriverPanel
        isOpen={isPanelOpen}
        onToggle={() => setIsPanelOpen(!isPanelOpen)}
        selectedCount={selectedCount}
        totalCount={totalDriverCount}
        header={
          <DriverSelectionHeader
            selectedCount={selectedCount}
            totalCount={totalDriverCount}
            onSelectAll={handleSelectAll}
            onClear={handleClearSelection}
          />
        }
      >
        <div className="space-y-2">
          {/* Controls Row */}
          <div className="flex gap-2">
            {/* Class Filter Dropdown */}
            <div className="relative flex-initial max-w-[200px]" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                className="flex items-center justify-between px-3 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                aria-label="Filter by class"
                aria-expanded={isClassDropdownOpen}
              >
                <span className="truncate">{displayClass}</span>
                <svg
                  className={`ml-2 w-4 h-4 transition-transform ${
                    isClassDropdownOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isClassDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-[var(--token-surface-elevated)] border border-[var(--token-border-default)] rounded-md shadow-lg max-h-60 overflow-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClass(null)
                      setIsClassDropdownOpen(false)
                      onClassChange?.(null)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] ${
                      selectedClass === null
                        ? "bg-[var(--token-accent)] text-[var(--token-text-primary)]"
                        : ""
                    }`}
                  >
                    All Classes
                  </button>
                  {classesSorted.map((classInfo) => (
                    <button
                      key={classInfo.className}
                      type="button"
                      onClick={() => {
                        setSelectedClass(classInfo.className)
                        setIsClassDropdownOpen(false)
                        onClassChange?.(classInfo.className)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] ${
                        selectedClass === classInfo.className
                          ? "bg-[var(--token-accent)] text-[var(--token-text-primary)]"
                          : ""
                      }`}
                    >
                      {classInfo.className} ({classInfo.driverCount})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="flex-initial max-w-[250px] relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search drivers..."
                className="w-full px-3 py-2 pr-8 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-sm text-[var(--token-text-primary)] placeholder-[var(--token-text-muted)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                aria-label="Search drivers"
                id="driver-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  aria-label="Clear search"
                >
                  <svg
                    className="w-4 h-4 text-[var(--token-text-secondary)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>

            {/* Compact Toggle */}
            <button
              type="button"
              onClick={() => setIsCompact(!isCompact)}
              className="flex items-center justify-center px-3 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              aria-label={isCompact ? "Switch to expanded view" : "Switch to compact view"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isCompact ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                )}
              </svg>
              <span className="ml-2">{isCompact ? "Expanded" : "Compact"}</span>
            </button>
          </div>

          {/* Virtualized Driver List */}
          <div
            ref={containerRef}
            className="border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface-elevated)]"
            style={{ height: `${containerHeight}px` }}
            role="listbox"
            aria-label="Driver selection list"
            aria-multiselectable="true"
          >
            {virtualizedItems.length > 0 ? (
              <FixedSizeList
                height={containerHeight}
                width="100%"
                itemCount={virtualizedItems.length}
                itemSize={itemHeight}
                overscanCount={5}
              >
                {Row}
              </FixedSizeList>
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
                No drivers found
              </div>
            )}
          </div>
        </div>
      </CollapsibleDriverPanel>
    </div>
  )
}
