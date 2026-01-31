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

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { FixedSizeList } from "react-window"
import Modal from "@/components/molecules/Modal"
import ClassDetailsModal from "./ClassDetailsModal"

export interface Driver {
  driverId: string
  driverName: string
}

export interface Race {
  className: string
  results: Array<{
    driverId: string
    driverName: string
    lapsCompleted?: number
  }>
}

export interface ChartControlsProps {
  drivers: Driver[]
  races: Race[]
  selectedDriverIds: string[]
  onDriverSelectionChange: (driverIds: string[]) => void
  onClassChange?: (className: string | null) => void
  selectedClass?: string | null
  raceClasses?: Map<string, { vehicleType: string | null; vehicleTypeNeedsReview: boolean }>
  eventId?: string
  onClassInfoClick?: (className: string) => void
  onSelectAllClick?: () => void
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
          className={`flex items-center ${compactClasses} rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] hover:bg-[var(--token-surface-raised)] cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[var(--token-interactive-focus-ring)]`}
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
  selectedClass: selectedClassProp = null,
  raceClasses,
  eventId,
  onClassInfoClick,
  onSelectAllClick,
}: ChartControlsProps) {
  const [isCompact, setIsCompact] = useState(false)
  const selectedClass = selectedClassProp
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false)
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false)
  const [isClassDetailsModalOpen, setIsClassDetailsModalOpen] = useState(false)
  // Track whether drivers were manually selected via the driver modal
  // vs auto-selected via class selection
  const [driversManuallySelected, setDriversManuallySelected] = useState(false)

  // Debug: Log selectedClass value to verify it's updating
  useEffect(() => {
    if (isClassDropdownOpen) {
      console.log("[ChartControls] selectedClass prop value:", selectedClass)
    }
  }, [selectedClass, isClassDropdownOpen])
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
      setDriversManuallySelected(true)
      if (selectedDriverIds.includes(driverId)) {
        onDriverSelectionChange(selectedDriverIds.filter((id) => id !== driverId))
      } else {
        onDriverSelectionChange([...selectedDriverIds, driverId])
      }
    },
    [selectedDriverIds, onDriverSelectionChange]
  )

  const handleSelectAll = useCallback(() => {
    setDriversManuallySelected(true)
    onDriverSelectionChange(visibleDrivers)
    onSelectAllClick?.()
  }, [visibleDrivers, onDriverSelectionChange, onSelectAllClick])

  const handleClearSelection = useCallback(() => {
    setDriversManuallySelected(true)
    onDriverSelectionChange([])
    onClassChange?.(null)
  }, [onDriverSelectionChange, onClassChange])

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

  // Track previous selectedClass to detect changes
  const prevSelectedClassRef = useRef<string | null>(null)

  // Clear manual selection flag when class is selected/changed
  // (selecting a class auto-selects drivers, so this isn't manual selection)
  useLayoutEffect(() => {
    const classChanged = selectedClass !== prevSelectedClassRef.current
    if (classChanged && selectedClass !== null) {
      // When a class is selected, clear the manual selection flag
      // because drivers will be auto-selected
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDriversManuallySelected(false)
    }
    prevSelectedClassRef.current = selectedClass
  }, [selectedClass])

  // Also clear manual selection flag when selectedDriverIds changes and matches
  // what would be auto-selected for the current class
  // This handles the case where class selection triggers driver auto-selection
  useEffect(() => {
    if (selectedClass !== null && selectedDriverIds.length > 0) {
      const classInfo = driversByClass.get(selectedClass)
      if (classInfo) {
        const classDriverIds = new Set(classInfo.drivers.map((d) => d.driverId))
        const selectedInClass = selectedDriverIds.filter((id) => classDriverIds.has(id))
        // If all drivers in the class are selected and no drivers outside the class are selected,
        // this was likely auto-selection due to class selection
        if (
          selectedInClass.length === classInfo.driverCount &&
          selectedDriverIds.length === selectedInClass.length
        ) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setDriversManuallySelected(false)
        }
      }
    }
  }, [selectedClass, selectedDriverIds, driversByClass])

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
  const raceClassInfo = selectedClass ? raceClasses?.get(selectedClass) : null
  const vehicleType = raceClassInfo?.vehicleType
  const needsReview = raceClassInfo?.vehicleTypeNeedsReview ?? false
  const displayClass = selectedClassInfo
    ? `${selectedClassInfo.className} (${selectedClassInfo.driverCount})`
    : "All Classes"

  const selectionText =
    selectedCount === 0
      ? "No drivers selected"
      : selectedCount === totalDriverCount
        ? `All ${totalDriverCount} drivers selected`
        : `${selectedCount} of ${totalDriverCount} drivers selected`

  return (
    <div className="space-y-4 mb-6">
      {/* Driver Selection Modal */}
      <Modal
        isOpen={isDriverModalOpen}
        onClose={() => setIsDriverModalOpen(false)}
        title="Select Drivers"
        maxWidth="4xl"
        ariaLabel="Driver selection modal"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-[var(--token-text-secondary)]">
              {selectedCount} / {totalDriverCount} selected
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClearSelection}
                disabled={selectedCount === 0}
                className="px-4 py-2 text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] disabled:opacity-50 disabled:cursor-not-allowed border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface-elevated)] hover:bg-[var(--token-surface-raised)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={selectedCount === totalDriverCount}
                className="px-4 py-2 text-sm font-medium text-[var(--token-accent)] hover:text-[var(--token-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface-elevated)] hover:bg-[var(--token-surface-raised)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setIsDriverModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface-elevated)] hover:bg-[var(--token-surface-raised)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              >
                Done
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 p-4">
          {/* Controls Row */}
          <div className="flex gap-2">
            {/* Class Filter Dropdown */}
            <div className="relative flex-initial max-w-[200px]" ref={dropdownRef}>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                  className="flex items-center justify-between px-3 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
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
                {selectedClass && onClassInfoClick && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsClassDetailsModalOpen(true)
                      onClassInfoClick(selectedClass)
                    }}
                    className="p-1.5 text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded"
                    aria-label={`View details for ${selectedClass}`}
                    title="View class details"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                )}
                {needsReview && (
                  <span
                    className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded"
                    title="Vehicle type needs review"
                  >
                    ⚠
                  </span>
                )}
              </div>
              {isClassDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-[var(--token-surface-elevated)] border border-[var(--token-border-default)] rounded-md shadow-lg max-h-60 overflow-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setIsClassDropdownOpen(false)
                      onClassChange?.(null)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] transition-colors hover:bg-[var(--token-surface-raised)]"
                  >
                    All Classes
                  </button>
                  {classesSorted.map((classInfo) => (
                    <button
                      key={classInfo.className}
                      type="button"
                      onClick={() => {
                        setIsClassDropdownOpen(false)
                        onClassChange?.(classInfo.className)
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] transition-colors hover:bg-[var(--token-surface-raised)]"
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
              className="flex items-center justify-center px-3 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
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
      </Modal>

      {/* Class Details Modal */}
      {eventId && selectedClass && raceClasses && (
        <ClassDetailsModal
          isOpen={isClassDetailsModalOpen}
          onClose={() => setIsClassDetailsModalOpen(false)}
          eventId={eventId}
          className={selectedClass}
          vehicleType={raceClasses.get(selectedClass)?.vehicleType ?? null}
          vehicleTypeNeedsReview={raceClasses.get(selectedClass)?.vehicleTypeNeedsReview ?? true}
          onSave={async (vehicleType, acceptInference) => {
            const url = `/api/v1/events/${eventId}/race-classes/${encodeURIComponent(selectedClass)}/vehicle-type`
            console.log("[ChartControls] Saving vehicle type:", {
              eventId,
              className: selectedClass,
              vehicleType,
              acceptInference,
              url,
            })

            const response = await fetch(url, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ vehicleType, acceptInference }),
              credentials: "include",
              cache: "no-store",
            })

            if (!response.ok) {
              // Parse error response to get actual error message
              let errorMessage = "Failed to save vehicle type"
              try {
                const errorData = await response.json()
                console.error("[ChartControls] Save failed:", errorData)
                if (errorData.error?.message) {
                  errorMessage = errorData.error.message
                } else if (errorData.error?.code) {
                  errorMessage = `${errorData.error.code}: ${errorMessage}`
                }
              } catch {
                // If response is not JSON, use status text
                errorMessage = response.statusText || errorMessage
              }
              throw new Error(errorMessage)
            }

            // Verify response body indicates success
            const result = await response.json()
            console.log("[ChartControls] Save response:", result)
            if (!result.success) {
              const errorMessage = result.error?.message || "Save operation failed"
              console.error("[ChartControls] Save returned success:false:", result)
              throw new Error(errorMessage)
            }

            // Refresh the page to show updated data
            console.log("[ChartControls] Save successful, reloading page...")
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}
