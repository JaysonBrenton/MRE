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
import { useRouter } from "next/navigation"
import { FixedSizeList } from "react-window"
import Modal from "@/components/ui/Modal"
import Tooltip from "@/components/ui/Tooltip"
import ClassDetailsModal from "./ClassDetailsModal"
import EventSearchModal from "@/components/dashboard/shell/EventSearchModal"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { selectEvent, clearEvent } from "@/store/slices/dashboardSlice"

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
  selectedClass?: string | null
  raceClasses?: Map<string, { vehicleType: string | null; vehicleTypeNeedsReview: boolean }>
  eventId?: string
  onClassInfoClick?: (className: string) => void
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
}: ChartControlsProps) {
  const [isCompact, setIsCompact] = useState(false)
  const selectedClass = selectedClassProp
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false)
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false)
  const [isClassDetailsModalOpen, setIsClassDetailsModalOpen] = useState(false)
  const [isClassSelectionModalOpen, setIsClassSelectionModalOpen] = useState(false)
  const [isEventSearchModalOpen, setIsEventSearchModalOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [successStats, setSuccessStats] = useState<{
    racesIngested: number
    resultsIngested: number
    lapsIngested: number
    status: string
    lastIngestedAt?: string
  } | null>(null)
  
  const router = useRouter()
  const dispatch = useAppDispatch()
  const selectedEventId = useAppSelector((state) => state.dashboard.selectedEventId)
  const eventData = useAppSelector((state) => state.dashboard.eventData)
  const selectedEventName = eventData?.event?.eventName ?? null

  const handleSelectEvent = (eventId: string | null) => {
    if (eventId) {
      dispatch(selectEvent(eventId))
    } else {
      dispatch(clearEvent())
    }
  }

  // Helper function to format stats message with proper pluralization
  const formatStatsMessage = useCallback((stats: {
    racesIngested: number
    resultsIngested: number
    lapsIngested: number
    status: string
  }): { title: string; message: string } => {
    const { racesIngested, resultsIngested, lapsIngested, status } = stats
    
    // Helper to pluralize
    const pluralize = (count: number, singular: string, plural: string) => {
      return count === 1 ? singular : plural
    }

    // Handle "in_progress" status
    if (status === "in_progress") {
      return {
        title: "Refresh In Progress",
        message: "Event data ingestion is still running in the background. The page will update automatically when complete.",
      }
    }

    // If all counts are 0 or status is "already_complete"
    if ((racesIngested === 0 && resultsIngested === 0 && lapsIngested === 0) || status === "already_complete") {
      return {
        title: "Event Up to Date",
        message: "Event is up to date. No new data found since last refresh.",
      }
    }

    // Build stats breakdown
    const statsParts: string[] = []
    if (racesIngested > 0) {
      statsParts.push(`${racesIngested} ${pluralize(racesIngested, "race", "races")}`)
    }
    if (resultsIngested > 0) {
      statsParts.push(`${resultsIngested} ${pluralize(resultsIngested, "result", "results")}`)
    }
    if (lapsIngested > 0) {
      statsParts.push(`${lapsIngested} ${pluralize(lapsIngested, "lap", "laps")}`)
    }

    const statsText = statsParts.length > 0 
      ? `Ingested ${statsParts.join(", ")}.`
      : "Refresh complete."

    return {
      title: "Refresh Complete",
      message: `Refresh complete! ${statsText}`,
    }
  }, [])

  const handleRefreshEventData = useCallback(async () => {
    if (!eventId || isRefreshing) {
      return
    }

    setIsRefreshing(true)
    setErrorMessage(null)
    setSuccessStats(null)
    setIsSuccessModalOpen(false)

    try {
      const response = await fetch(`/api/v1/events/${eventId}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depth: "laps_full" }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        const errorMsg = data.error?.message || `Error: ${response.status} ${response.statusText}`
        setErrorMessage(errorMsg)
        setIsErrorModalOpen(true)
        return
      }

      // Check the ingestion response to understand what happened
      const ingestionData = data.data
      const status = ingestionData?.status
      const racesIngested = ingestionData?.races_ingested ?? 0
      const resultsIngested = ingestionData?.results_ingested ?? 0
      const lapsIngested = ingestionData?.laps_ingested ?? 0
      const lastIngestedAt = ingestionData?.last_ingested_at

      // Capture stats for success modal
      setSuccessStats({
        racesIngested,
        resultsIngested,
        lapsIngested,
        status: status || "unknown",
        lastIngestedAt,
      })

      // Log what happened for debugging
      console.log("[RefreshEventData] Ingestion response:", {
        status,
        racesIngested,
        resultsIngested,
        lapsIngested,
        httpStatus: response.status,
      })

      // If ingestion is still in progress (202 status), wait before refreshing
      if (response.status === 202 || status === "in_progress") {
        // Wait 3 seconds for ingestion to make progress, then refresh
        await new Promise((resolve) => setTimeout(resolve, 3000))
        router.refresh()
        // Show success modal after refresh (even if in progress, show what we know)
        setIsSuccessModalOpen(true)
        return
      }

      // Add a small delay to ensure any async database writes complete
      // This is especially important for live events where data is being written
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Always refresh to get the latest data from the database
      // Even if status is "already_complete", we want to show the latest from DB
      router.refresh()
      
      // Show success modal after refresh completes
      setIsSuccessModalOpen(true)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error occurred"
      setErrorMessage(`Failed to refresh event data: ${errorMsg}`)
      setIsErrorModalOpen(true)
    } finally {
      setIsRefreshing(false)
    }
  }, [eventId, isRefreshing, router])
  
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
      {/* Chart control buttons */}
      <div className="relative inline-flex items-center gap-2 flex-wrap">
        {/* Find Events button */}
        <Tooltip text="Find Events">
          <button
            type="button"
            onClick={() => setIsEventSearchModalOpen(true)}
            className="flex items-center gap-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            aria-label={selectedEventName ? `Selected: ${selectedEventName}. Find Events` : "Find Events"}
          >
            <svg
              className="h-4 w-4 text-[var(--token-text-muted)]"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Find Events</span>
          </button>
        </Tooltip>

        {/* Refresh Event Data button */}
        {eventId && (
          <Tooltip text="Refresh Event Data">
            <button
              type="button"
              onClick={handleRefreshEventData}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Refresh event data from LiveRC"
            >
              {isRefreshing ? (
                <svg
                  className="h-4 w-4 text-[var(--token-text-muted)] animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.5"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4 text-[var(--token-text-muted)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M3 21v-5h5"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              <span>Refresh</span>
            </button>
          </Tooltip>
        )}

        {/* Select Drivers button */}
        <div className="relative">
          <Tooltip text="Select Drivers or a Class">
            <button
              type="button"
              onClick={() => setIsDriverModalOpen(true)}
              className="flex items-center gap-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              aria-label={`Open driver selection - ${selectionText}`}
              aria-haspopup="dialog"
              aria-expanded={isDriverModalOpen}
            >
              <svg
                className="h-4 w-4 text-[var(--token-text-muted)]"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Select Drivers</span>
              {selectedCount > 0 && (
                <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--token-accent)] px-1.5 text-xs font-medium text-[var(--token-text-primary)]">
                  {selectedCount}
                </span>
              )}
            </button>
          </Tooltip>
        </div>

        {/* Select Class button */}
        <div className="relative">
          <Tooltip text="Select Class">
            <button
              type="button"
              onClick={() => setIsClassSelectionModalOpen(true)}
              className="flex items-center gap-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              aria-label={`Select class${selectedClass ? ` - ${selectedClass}` : ""}`}
              aria-haspopup="dialog"
              aria-expanded={isClassSelectionModalOpen}
            >
              <svg
                className="h-4 w-4 text-[var(--token-text-muted)]"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 3h8v8H3V3zM13 3h8v8h-8V3zM3 13h8v8H3v-8zM13 13h8v8h-8v-8z"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Select Class</span>
              {selectedClass && selectedClassInfo && (
                <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--token-accent)] px-1.5 text-xs font-medium text-[var(--token-text-primary)]">
                  {selectedClassInfo.driverCount}
                </span>
              )}
            </button>
          </Tooltip>
        </div>

        {/* Clear selected event button */}
        {selectedEventId && (
          <Tooltip text="Clear selected event">
            <button
              type="button"
              onClick={() => dispatch(clearEvent())}
              className="flex items-center gap-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              aria-label="Clear selected event"
            >
              <svg
                className="h-4 w-4 text-[var(--token-text-muted)]"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Clear Event</span>
            </button>
          </Tooltip>
        )}

        {/* Clear driver selection button */}
        <Tooltip text="Clear driver selection">
          <button
            type="button"
            onClick={handleClearSelection}
            disabled={selectedCount === 0}
            className="flex items-center gap-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Clear driver selection"
          >
            <svg
              className="h-4 w-4 text-[var(--token-text-muted)]"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Clear Selection</span>
          </button>
        </Tooltip>
      </div>

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
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
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
                  <span className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded" title="Vehicle type needs review">
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
      
      {/* Class Selection Modal */}
      <Modal
        isOpen={isClassSelectionModalOpen}
        onClose={() => setIsClassSelectionModalOpen(false)}
        title="Select Class"
        maxWidth="md"
        ariaLabel="Class selection modal"
      >
        <div className="p-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                onClassChange?.(null)
                setIsClassSelectionModalOpen(false)
              }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] ${
                selectedClass === null
                  ? "bg-[var(--token-accent)]/20 text-[var(--token-accent)] font-medium"
                  : "text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)]"
              }`}
            >
              All Classes
            </button>
            {classesSorted.map((classInfo) => (
              <button
                key={classInfo.className}
                type="button"
                onClick={() => {
                  const className = classInfo.className
                  console.log("[ChartControls] Class selected:", className, "Type:", typeof className, "Length:", className?.length)
                  console.log("[ChartControls] onClassChange exists:", !!onClassChange)
                  if (onClassChange && className) {
                    console.log("[ChartControls] Calling onClassChange with:", className)
                    onClassChange(className)
                    console.log("[ChartControls] onClassChange called successfully")
                  } else {
                    console.error("[ChartControls] ERROR: onClassChange is undefined or className is falsy!", { onClassChange: !!onClassChange, className })
                  }
                  setIsClassSelectionModalOpen(false)
                }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] ${
                  selectedClass === classInfo.className
                    ? "bg-[var(--token-accent)]/20 text-[var(--token-accent)] font-medium"
                    : "text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)]"
                }`}
              >
                {classInfo.className} ({classInfo.driverCount})
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Event Search Modal */}
      <EventSearchModal
        isOpen={isEventSearchModalOpen}
        onClose={() => setIsEventSearchModalOpen(false)}
        onSelectEvent={handleSelectEvent}
        selectedEventId={selectedEventId}
      />

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
            const response = await fetch(
              `/api/v1/events/${eventId}/race-classes/${encodeURIComponent(selectedClass)}/vehicle-type`,
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vehicleType, acceptInference }),
              }
            )
            if (!response.ok) {
              throw new Error("Failed to save vehicle type")
            }
            // Refresh the page to show updated data
            window.location.reload()
          }}
        />
      )}

      {/* Error Modal */}
      <Modal
        isOpen={isErrorModalOpen}
        onClose={() => {
          setIsErrorModalOpen(false)
          setErrorMessage(null)
        }}
        title="Refresh Event Data Error"
        maxWidth="md"
        ariaLabel="Error modal for event data refresh"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setIsErrorModalOpen(false)
                setErrorMessage(null)
              }}
              className="px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface-elevated)] hover:bg-[var(--token-surface-raised)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="p-4">
          <p className="text-[var(--token-text-primary)]">
            {errorMessage || "An unknown error occurred while refreshing event data."}
          </p>
        </div>
      </Modal>

      {/* Success Modal */}
      {successStats && (
        <Modal
          isOpen={isSuccessModalOpen}
          onClose={() => {
            setIsSuccessModalOpen(false)
            setSuccessStats(null)
          }}
          title={formatStatsMessage(successStats).title}
          maxWidth="md"
          ariaLabel="Success modal for event data refresh"
          footer={
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false)
                  setSuccessStats(null)
                }}
                className="px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface-elevated)] hover:bg-[var(--token-surface-raised)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="p-4 space-y-4">
            <p className="text-[var(--token-text-primary)]">
              {formatStatsMessage(successStats).message}
            </p>
            
            {/* Statistics breakdown */}
            {(successStats.racesIngested > 0 || successStats.resultsIngested > 0 || successStats.lapsIngested > 0) && (
              <div className="border-t border-[var(--token-border-default)] pt-4">
                <h3 className="text-sm font-semibold text-[var(--token-text-primary)] mb-2">
                  Statistics
                </h3>
                <dl className="grid grid-cols-3 gap-4">
                  <div>
                    <dt className="text-xs text-[var(--token-text-secondary)]">Races</dt>
                    <dd className="text-lg font-medium text-[var(--token-text-primary)]">
                      {successStats.racesIngested.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--token-text-secondary)]">Results</dt>
                    <dd className="text-lg font-medium text-[var(--token-text-primary)]">
                      {successStats.resultsIngested.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--token-text-secondary)]">Laps</dt>
                    <dd className="text-lg font-medium text-[var(--token-text-primary)]">
                      {successStats.lapsIngested.toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Last ingested timestamp */}
            {successStats.lastIngestedAt && (
              <div className="border-t border-[var(--token-border-default)] pt-4">
                <p className="text-xs text-[var(--token-text-secondary)]">
                  Last ingested: {new Date(successStats.lastIngestedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
