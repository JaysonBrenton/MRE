/**
 * @fileoverview Event Analysis Sidebar component
 *
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 *
 * @description Collapsible sidebar containing event action buttons
 *
 * @purpose Provides action buttons (Find Events, Refresh, Select Drivers, Clear Event)
 *          that are accessible across all event analysis tabs. The sidebar is always visible
 *          and can be collapsed to icon-only mode.
 *
 * @relatedFiles
 * - src/components/event-analysis/ChartControls.tsx (button logic extracted from here)
 * - src/components/dashboard/EventAnalysisSection.tsx (uses this)
 */

"use client"

import React, { useCallback, useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { FixedSizeList } from "react-window"
import Modal from "@/components/ui/Modal"
import ClassDetailsModal from "./ClassDetailsModal"
import SidebarAction from "./SidebarAction"
import { useDashboardEventSearch } from "@/components/dashboard/DashboardEventSearchProvider"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { clearEvent } from "@/store/slices/dashboardSlice"
import type { Driver, Race } from "./ChartControls"

const STORAGE_KEY_SIDEBAR_COLLAPSED = "mre-event-analysis-sidebar-collapsed"

interface EventAnalysisSidebarProps {
  eventId?: string
  selectedDriverIds: string[]
  onDriverSelectionChange: (driverIds: string[]) => void
  selectedClass?: string | null
  onClassChange?: (className: string | null) => void
  drivers?: Driver[]
  races?: Race[]
  raceClasses?: Map<string, { vehicleType: string | null; vehicleTypeNeedsReview: boolean }>
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
function groupDriversByClass(drivers: Driver[], races: Race[]): Map<string, ClassInfo> {
  const classMap = new Map<string, Set<string>>()
  const driverMap = new Map<string, Driver>()

  drivers.forEach((driver) => {
    driverMap.set(driver.driverId, driver)
  })

  const validDriverIds = new Set(driverMap.keys())

  races.forEach((race) => {
    if (!classMap.has(race.className)) {
      classMap.set(race.className, new Set())
    }
    race.results.forEach((result) => {
      if (validDriverIds.has(result.driverId)) {
        classMap.get(race.className)!.add(result.driverId)
      }
    })
  })

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

// Determine the appropriate class selection based on selected drivers
// Returns the class name if all drivers are from the same class, null otherwise
function determineClassFromDrivers(
  selectedDriverIds: string[],
  races: Race[]
): string | null {
  if (selectedDriverIds.length === 0) {
    return null
  }

  // Find all classes that contain any of the selected drivers
  const classesWithSelectedDrivers = new Set<string>()
  const selectedDriverIdsSet = new Set(selectedDriverIds)

  races.forEach((race) => {
    race.results.forEach((result) => {
      if (selectedDriverIdsSet.has(result.driverId)) {
        classesWithSelectedDrivers.add(race.className)
      }
    })
  })

  // If no classes found (shouldn't happen, but handle gracefully)
  if (classesWithSelectedDrivers.size === 0) {
    return null
  }

  // If all selected drivers are from a single class, return that class
  if (classesWithSelectedDrivers.size === 1) {
    return Array.from(classesWithSelectedDrivers)[0]
  }

  // If drivers are from multiple classes, return null (show all classes)
  return null
}

// Create flat list for virtualization with class headers
function createVirtualizedList(
  driversByClass: Map<string, ClassInfo>,
  selectedClass: string | null,
  searchQuery: string
): VirtualizedItem[] {
  const items: VirtualizedItem[] = []
  const searchLower = searchQuery.toLowerCase().trim()

  const classesToShow = selectedClass
    ? ([driversByClass.get(selectedClass)].filter(Boolean) as ClassInfo[])
    : Array.from(driversByClass.values())

  classesToShow.sort((a, b) => b.driverCount - a.driverCount)

  classesToShow.forEach((classInfo) => {
    const filteredDrivers = searchLower
      ? classInfo.drivers.filter((d) => d.driverName.toLowerCase().includes(searchLower))
      : classInfo.drivers

    if (filteredDrivers.length > 0) {
      items.push({
        type: "class-header",
        data: {
          className: classInfo.className,
          driverCount: classInfo.driverCount,
        },
      })

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

export default function EventAnalysisSidebar({
  eventId,
  selectedDriverIds,
  onDriverSelectionChange,
  selectedClass,
  onClassChange,
  drivers = [],
  races = [],
  raceClasses,
}: EventAnalysisSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false
    }
    const stored = window.localStorage.getItem(STORAGE_KEY_SIDEBAR_COLLAPSED)
    return stored === "true"
  })
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false)
  const [isClassDetailsModalOpen, setIsClassDetailsModalOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { openEventSearch, registerAction, unregisterAction } = useDashboardEventSearch()
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
  const [isCompact, setIsCompact] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false)
  const [driversManuallySelected, setDriversManuallySelected] = useState(false)

  const router = useRouter()
  const dispatch = useAppDispatch()
  const selectedEventId = useAppSelector((state) => state.dashboard.selectedEventId)
  const eventData = useAppSelector((state) => state.dashboard.eventData)
  const selectedEventName = eventData?.event?.eventName ?? null
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleToggleCollapsed = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY_SIDEBAR_COLLAPSED, String(newState))
    }
  }

  // Helper function to format stats message
  const formatStatsMessage = useCallback(
    (stats: {
      racesIngested: number
      resultsIngested: number
      lapsIngested: number
      status: string
    }): { title: string; message: string } => {
      const { racesIngested, resultsIngested, lapsIngested, status } = stats

      const pluralize = (count: number, singular: string, plural: string) => {
        return count === 1 ? singular : plural
      }

      if (status === "in_progress") {
        return {
          title: "Refresh In Progress",
          message:
            "Event data ingestion is still running in the background. The page will update automatically when complete.",
        }
      }

      if (
        (racesIngested === 0 && resultsIngested === 0 && lapsIngested === 0) ||
        status === "already_complete"
      ) {
        return {
          title: "Event Up to Date",
          message: "Event is up to date. No new data found since last refresh.",
        }
      }

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

      const statsText =
        statsParts.length > 0 ? `Ingested ${statsParts.join(", ")}.` : "Refresh complete."

      return {
        title: "Refresh Complete",
        message: `Refresh complete! ${statsText}`,
      }
    },
    []
  )

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

      const ingestionData = data.data
      const status = ingestionData?.status
      const racesIngested = ingestionData?.races_ingested ?? 0
      const resultsIngested = ingestionData?.results_ingested ?? 0
      const lapsIngested = ingestionData?.laps_ingested ?? 0
      const lastIngestedAt = ingestionData?.last_ingested_at

      setSuccessStats({
        racesIngested,
        resultsIngested,
        lapsIngested,
        status: status || "unknown",
        lastIngestedAt,
      })

      if (response.status === 202 || status === "in_progress") {
        await new Promise((resolve) => setTimeout(resolve, 3000))
        router.refresh()
        setIsSuccessModalOpen(true)
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
      router.refresh()
      setIsSuccessModalOpen(true)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error occurred"
      setErrorMessage(`Failed to refresh event data: ${errorMsg}`)
      setIsErrorModalOpen(true)
    } finally {
      setIsRefreshing(false)
    }
  }, [eventId, isRefreshing, router])

  useEffect(() => {
    registerAction("refresh", handleRefreshEventData)
    registerAction("select-drivers", () => setIsDriverModalOpen(true))
    registerAction("clear-event", () => dispatch(clearEvent()))
    return () => {
      unregisterAction("refresh")
      unregisterAction("select-drivers")
      unregisterAction("clear-event")
    }
  }, [registerAction, unregisterAction, handleRefreshEventData, dispatch])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Group drivers by class
  const driversByClass = useMemo(() => {
    if (!drivers.length || !races.length) {
      return new Map<string, ClassInfo>()
    }
    return groupDriversByClass(drivers, races)
  }, [drivers, races])

  // Get classes sorted by driver count
  const classesSorted = useMemo(() => {
    return Array.from(driversByClass.values()).sort((a, b) => b.driverCount - a.driverCount)
  }, [driversByClass])

  // Create virtualized list
  const virtualizedItems = useMemo(
    () => createVirtualizedList(driversByClass, selectedClass || null, debouncedSearchQuery),
    [driversByClass, selectedClass, debouncedSearchQuery]
  )

  // Get visible drivers for select all
  const visibleDrivers = useMemo(() => {
    return virtualizedItems
      .filter((item) => item.type === "driver")
      .map((item) => item.data.driverId!)
      .filter(Boolean)
  }, [virtualizedItems])

  // Get all drivers (for auto-selection when "All Classes" is selected)
  const allDrivers = useMemo(() => {
    const driverSet = new Set<string>()
    races.forEach((race) => {
      race.results.forEach((result) => {
        // Only include drivers who have completed at least one lap
        if ((result.lapsCompleted ?? 0) > 0) {
          driverSet.add(result.driverId)
        }
      })
    })
    return Array.from(driverSet)
  }, [races])

  // Handle class change from dropdown - auto-select drivers in the class
  const handleClassChangeFromDropdown = useCallback(
    (className: string | null) => {
      setDriversManuallySelected(true)
      
      // Update class selection first
      onClassChange?.(className)
      
      // Then auto-select all drivers in the selected class
      // React will batch these updates, but we call them in order for clarity
      if (className !== null) {
        // Get all drivers who raced in this class and have completed at least one lap
        const driversInClass = new Set<string>()
        races
          .filter((race) => race.className === className)
          .forEach((race) => {
            race.results.forEach((result) => {
              // Only include drivers who have completed at least one lap
              if ((result.lapsCompleted ?? 0) > 0) {
                driversInClass.add(result.driverId)
              }
            })
          })
        
        // Select all drivers in this class
        const driverIdsArray = Array.from(driversInClass)
        onDriverSelectionChange(driverIdsArray)
      } else {
        // When "All Classes" is selected, select all available drivers
        onDriverSelectionChange(allDrivers)
      }
    },
    [races, onClassChange, onDriverSelectionChange, allDrivers]
  )

  const handleDriverToggle = useCallback(
    (driverId: string) => {
      setDriversManuallySelected(true)
      const newDriverIds = selectedDriverIds.includes(driverId)
        ? selectedDriverIds.filter((id) => id !== driverId)
        : [...selectedDriverIds, driverId]
      
      onDriverSelectionChange(newDriverIds)
      
      // Update class selection based on selected drivers
      const determinedClass = determineClassFromDrivers(newDriverIds, races)
      if (onClassChange && determinedClass !== selectedClass) {
        onClassChange(determinedClass)
      }
    },
    [selectedDriverIds, onDriverSelectionChange, races, selectedClass, onClassChange]
  )

  const handleSelectAll = useCallback(() => {
    setDriversManuallySelected(true)
    onDriverSelectionChange(visibleDrivers)
    
    // Update class selection based on selected drivers
    const determinedClass = determineClassFromDrivers(visibleDrivers, races)
    if (onClassChange && determinedClass !== selectedClass) {
      onClassChange(determinedClass)
    }
  }, [visibleDrivers, onDriverSelectionChange, races, selectedClass, onClassChange])

  const handleClearSelection = useCallback(() => {
    setDriversManuallySelected(true)
    onDriverSelectionChange([])
    onClassChange?.(null)
  }, [onDriverSelectionChange, onClassChange])

  // Get total driver count
  const totalDriverCount = useMemo(() => {
    if (selectedClass) {
      const classInfo = driversByClass.get(selectedClass)
      return classInfo ? classInfo.driverCount : drivers.length
    }
    return drivers.length
  }, [drivers, selectedClass, driversByClass])

  // Get selected count
  const selectedCount = useMemo(() => {
    const driverIdsSet = new Set(drivers.map((d) => d.driverId))
    const validSelectedIds = selectedDriverIds.filter((id) => driverIdsSet.has(id))

    if (selectedClass) {
      const classInfo = driversByClass.get(selectedClass)
      if (classInfo) {
        const classDriverIds = new Set(classInfo.drivers.map((d) => d.driverId))
        return validSelectedIds.filter((id) => classDriverIds.has(id)).length
      }
    }

    return validSelectedIds.length
  }, [selectedDriverIds, drivers, selectedClass, driversByClass])

  const selectionText =
    selectedCount === 0
      ? "No drivers selected"
      : selectedCount === totalDriverCount
        ? `All ${totalDriverCount} drivers selected`
        : `${selectedCount} of ${totalDriverCount} drivers selected`

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

  // Item height based on compact mode
  const baseItemHeight = isCompact ? 36 : 44
  const itemHeight = baseItemHeight + 8

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

  const containerHeight = 400

  const sidebarWidth = isCollapsed ? "w-16" : "w-64"

  return (
    <>
      <aside
        className={`${sidebarWidth} flex-shrink-0 self-start flex flex-col border-r border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]`}
        style={{ position: 'sticky', top: '1.5rem', alignSelf: 'flex-start' }}
      >
        {/* Header: toggle + optional Actions label */}
        <div
          className={`flex items-center border-b border-[var(--token-border-default)]/60 flex-shrink-0 ${
            isCollapsed ? "flex-col justify-center gap-2 py-2" : "justify-between p-2"
          }`}
        >
          {!isCollapsed && (
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--token-text-muted)]">
              Actions
            </span>
          )}
          <button
            type="button"
            onClick={handleToggleCollapsed}
            className="rounded-lg p-1.5 text-[var(--token-text-secondary)] hover:bg-[var(--token-surface-raised)] hover:text-[var(--token-text-primary)] transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d={isCollapsed ? "m9 6 6 6-6 6" : "m15 18-6-6 6-6"}
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {isCollapsed && (
            <span
              className="text-[10px] font-medium uppercase tracking-wider text-[var(--token-text-muted)] -rotate-90 origin-center whitespace-nowrap"
              aria-hidden="true"
            >
              Actions
            </span>
          )}
        </div>

        {/* Buttons */}
        <div className="p-2 space-y-2">
          {/* Event group */}
          <div className="space-y-2">
            <SidebarAction
              icon={
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              label="Find Events"
              tooltip={selectedEventName ? `Selected: ${selectedEventName}. Find Events` : "Find Events"}
              shortcut="⌘E"
              onClick={openEventSearch}
              isCollapsed={isCollapsed}
              ariaLabel={selectedEventName ? `Selected: ${selectedEventName}. Find Events` : "Find Events"}
            />

            {eventId && (
              <SidebarAction
                icon={
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M3 21v-5h5"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
                loadingIcon={
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.5"
                    />
                  </svg>
                }
                label="Refresh"
                tooltip="Refresh event data from LiveRC"
                shortcut="⌘⌥R"
                onClick={handleRefreshEventData}
                disabled={isRefreshing}
                isCollapsed={isCollapsed}
                ariaLabel="Refresh event data from LiveRC"
                isLoading={isRefreshing}
              />
            )}

            {selectedEventId && (
              <SidebarAction
                icon={
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
                label="Clear Event"
                tooltip="Clear selected event"
                shortcut="⌘⇧E"
                onClick={() => dispatch(clearEvent())}
                isCollapsed={isCollapsed}
                ariaLabel="Clear selected event"
              />
            )}
          </div>

          <div className="border-t border-[var(--token-border-default)] pt-2" aria-hidden="true" />

          {/* Drivers group */}
          <div className="space-y-2">
            <SidebarAction
              icon={
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              label="Select Drivers"
              tooltip={`Select Drivers or a Class - ${selectionText}`}
              shortcut="⌘D"
              onClick={() => setIsDriverModalOpen(true)}
              disabled={!eventId}
              isCollapsed={isCollapsed}
              ariaLabel={`Open driver selection - ${selectionText}`}
              ariaHaspopup="dialog"
              ariaExpanded={isDriverModalOpen}
              badge={selectedCount > 0 && driversManuallySelected ? selectedCount : null}
            />
          </div>
        </div>
      </aside>

      {/* Driver Selection Modal */}
      {drivers.length > 0 && races.length > 0 && (
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
                  {selectedClass && onClassChange && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsClassDetailsModalOpen(true)
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
                        handleClassChangeFromDropdown(null)
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
                          handleClassChangeFromDropdown(classInfo.className)
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
      )}

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
            console.log("[EventAnalysisSidebar] Saving vehicle type:", {
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
                console.error("[EventAnalysisSidebar] Save failed:", errorData)
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
            console.log("[EventAnalysisSidebar] Save response:", result)
            if (!result.success) {
              const errorMessage = result.error?.message || "Save operation failed"
              console.error("[EventAnalysisSidebar] Save returned success:false:", result)
              throw new Error(errorMessage)
            }

            console.log("[EventAnalysisSidebar] Save successful, reloading page...")
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

            {(successStats.racesIngested > 0 ||
              successStats.resultsIngested > 0 ||
              successStats.lapsIngested > 0) && (
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
    </>
  )
}
