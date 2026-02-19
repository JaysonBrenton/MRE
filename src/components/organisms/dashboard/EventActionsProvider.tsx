/**
 * @fileoverview Event Actions Provider - Global event action handlers and modals
 *
 * @created 2025-01-29
 * @creator System
 * @lastModified 2025-01-29
 *
 * @description Provides global event action handlers and renders all event-related modals.
 *              This provider wraps the app to make event actions available from the navigation rail.
 *
 * @purpose Centralizes event action functionality so it's accessible from AdaptiveNavigationRail
 *          on all pages, not just event analysis pages.
 *
 * @relatedFiles
 * - src/components/dashboard/EventActionsContext.tsx (context definition)
 * - src/components/dashboard/shell/AdaptiveNavigationRail.tsx (uses this context)
 * - src/components/event-analysis/EventAnalysisSidebar.tsx (old implementation - to be removed)
 */

"use client"

import React, { useCallback, useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { FixedSizeList } from "react-window"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { clearEvent } from "@/store/slices/dashboardSlice"
import { useDashboardEventSearch } from "@/components/organisms/dashboard/DashboardEventSearchProvider"
import Modal from "@/components/molecules/Modal"
import PracticeDriverSelector from "@/components/organisms/event-analysis/PracticeDriverSelector"
import { EventActionsContext, type EventActionsContextValue } from "./EventActionsContext"

// Types for driver selection modal
interface Driver {
  driverId: string
  driverName: string
}

interface Race {
  className: string
  results: Array<{
    driverId: string
    driverName: string
    lapsCompleted: number | null
  }>
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
function determineClassFromDrivers(selectedDriverIds: string[], races: Race[]): string | null {
  if (selectedDriverIds.length === 0) {
    return null
  }

  const classesWithSelectedDrivers = new Set<string>()
  const selectedDriverIdsSet = new Set(selectedDriverIds)

  races.forEach((race) => {
    race.results.forEach((result) => {
      if (selectedDriverIdsSet.has(result.driverId)) {
        classesWithSelectedDrivers.add(race.className)
      }
    })
  })

  if (classesWithSelectedDrivers.size === 0) {
    return null
  }

  if (classesWithSelectedDrivers.size === 1) {
    return Array.from(classesWithSelectedDrivers)[0]
  }

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

interface EventActionsProviderProps {
  children: React.ReactNode
}

export default function EventActionsProvider({ children }: EventActionsProviderProps) {
  const router = useRouter()
  const dispatch = useAppDispatch()
  const { openEventSearch, registerAction, unregisterAction } = useDashboardEventSearch()
  const selectedEventId = useAppSelector((state) => state.dashboard.selectedEventId)
  const eventData = useAppSelector((state) => state.dashboard.eventData)
  const analysisData = useAppSelector((state) => state.dashboard.analysisData)
  const selectedPracticeDriverId = useAppSelector(
    (state) => state.dashboard.selectedPracticeDriverId
  )

  const isPracticeDay = analysisData?.isPracticeDay ?? eventData?.isPracticeDay ?? false

  // Modal states
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false)
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

  // Driver selection state
  // Default to "All Classes" (null) when event is first loaded
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const isCompact = false // Always expanded view
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Reset selections when event changes
  // Ensures "All Classes" (null) is the default when an event is first loaded
  useEffect(() => {
    setSelectedDriverIds([])
    setSelectedClass(null) // Default to "All Classes" when event changes
  }, [selectedEventId])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Transform analysis data to get drivers and races
  const { drivers, races } = useMemo(() => {
    if (!analysisData) {
      return {
        drivers: [],
        races: [],
        raceClasses: new Map<
          string,
          { vehicleType: string | null; vehicleTypeNeedsReview: boolean }
        >(),
      }
    }

    // Extract drivers from races
    const driverMap = new Map<string, Driver>()
    const raceList: Race[] = analysisData.races.map((race) => ({
      className: race.className,
      results: race.results.map((result) => ({
        driverId: result.driverId,
        driverName: result.driverName,
        lapsCompleted: result.lapsCompleted,
      })),
    }))

    raceList.forEach((race) => {
      race.results.forEach((result) => {
        if ((result.lapsCompleted ?? 0) > 0 && !driverMap.has(result.driverId)) {
          driverMap.set(result.driverId, {
            driverId: result.driverId,
            driverName: result.driverName,
          })
        }
      })
    })

    const driverList = Array.from(driverMap.values())

    return { drivers: driverList, races: raceList }
  }, [analysisData])

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
        if ((result.lapsCompleted ?? 0) > 0) {
          driverSet.add(result.driverId)
        }
      })
    })
    return Array.from(driverSet)
  }, [races])

  // Handle class change from dropdown
  const handleClassChangeFromDropdown = useCallback(
    (className: string | null) => {
      setSelectedClass(className)

      if (className !== null) {
        const driversInClass = new Set<string>()
        races
          .filter((race) => race.className === className)
          .forEach((race) => {
            race.results.forEach((result) => {
              if ((result.lapsCompleted ?? 0) > 0) {
                driversInClass.add(result.driverId)
              }
            })
          })
        setSelectedDriverIds(Array.from(driversInClass))
      } else {
        setSelectedDriverIds(allDrivers)
      }
    },
    [races, allDrivers]
  )

  const handleDriverToggle = useCallback(
    (driverId: string) => {
      const newDriverIds = selectedDriverIds.includes(driverId)
        ? selectedDriverIds.filter((id) => id !== driverId)
        : [...selectedDriverIds, driverId]

      setSelectedDriverIds(newDriverIds)

      const determinedClass = determineClassFromDrivers(newDriverIds, races)
      if (determinedClass !== selectedClass) {
        setSelectedClass(determinedClass)
      }
    },
    [selectedDriverIds, races, selectedClass]
  )

  const handleSelectAll = useCallback(() => {
    setSelectedDriverIds(visibleDrivers)

    const determinedClass = determineClassFromDrivers(visibleDrivers, races)
    if (determinedClass !== selectedClass) {
      setSelectedClass(determinedClass)
    }
  }, [visibleDrivers, races, selectedClass])

  const handleClearSelection = useCallback(() => {
    setSelectedDriverIds([])
    setSelectedClass(null)
  }, [])

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
  const displayClass = selectedClassInfo
    ? `${selectedClassInfo.className} (${selectedClassInfo.driverCount})`
    : "All Classes"

  const containerHeight = 400

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
    if (!selectedEventId || isRefreshing) {
      return
    }

    setIsRefreshing(true)
    setErrorMessage(null)
    setSuccessStats(null)
    setIsSuccessModalOpen(false)

    const JOB_POLL_INTERVAL_MS = 2000
    const JOB_POLL_MAX_ATTEMPTS = 450 // ~15 min at 2s

    try {
      const response = await fetch(`/api/v1/events/${selectedEventId}/ingest`, {
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

      const ingestionData = data.data as {
        job_id?: string
        status?: string
        races_ingested?: number
        results_ingested?: number
        laps_ingested?: number
        last_ingested_at?: string
      }

      // Queued (202): poll job status until completed or failed
      if (response.status === 202 && ingestionData?.job_id) {
        const jobId = ingestionData.job_id
        for (let attempt = 0; attempt < JOB_POLL_MAX_ATTEMPTS; attempt++) {
          const jobRes = await fetch(`/api/v1/ingestion/jobs/${jobId}`)
          const jobJson = await jobRes.json()
          const jobData = jobJson?.data as
            | {
                status?: string
                result?: {
                  races_ingested?: number
                  results_ingested?: number
                  laps_ingested?: number
                  last_ingested_at?: string
                }
                error_message?: string
              }
            | undefined

          if (!jobJson?.success || !jobData) {
            setErrorMessage("Could not read ingestion job status.")
            setIsErrorModalOpen(true)
            return
          }

          if (jobData.status === "completed" && jobData.result) {
            const r = jobData.result
            setSuccessStats({
              racesIngested: r.races_ingested ?? 0,
              resultsIngested: r.results_ingested ?? 0,
              lapsIngested: r.laps_ingested ?? 0,
              status: "updated",
              lastIngestedAt: r.last_ingested_at ?? undefined,
            })
            await new Promise((resolve) => setTimeout(resolve, 500))
            router.refresh()
            setIsSuccessModalOpen(true)
            return
          }

          if (jobData.status === "failed") {
            setErrorMessage(jobData.error_message ?? "Import failed.")
            setIsErrorModalOpen(true)
            return
          }

          await new Promise((resolve) => setTimeout(resolve, JOB_POLL_INTERVAL_MS))
        }
        setErrorMessage(
          "Import is taking longer than expected. The page will update when it completes."
        )
        setIsErrorModalOpen(true)
        return
      }

      // Synchronous 200 response
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
  }, [selectedEventId, isRefreshing, router])

  const handleClearEvent = useCallback(() => {
    dispatch(clearEvent())
  }, [dispatch])

  const handleOpenDriverSelection = useCallback(() => {
    setIsDriverModalOpen(true)
  }, [])

  const handleCloseDriverSelection = useCallback(() => {
    setIsDriverModalOpen(false)
  }, [])

  // Register actions with DashboardEventSearchProvider for keyboard shortcuts
  useEffect(() => {
    registerAction("refresh", handleRefreshEventData)
    registerAction("select-drivers", handleOpenDriverSelection)
    registerAction("clear-event", handleClearEvent)
    return () => {
      unregisterAction("refresh")
      unregisterAction("select-drivers")
      unregisterAction("clear-event")
    }
  }, [
    registerAction,
    unregisterAction,
    handleRefreshEventData,
    handleOpenDriverSelection,
    handleClearEvent,
  ])

  const contextValue: EventActionsContextValue = {
    openEventSearch,
    handleRefreshEventData,
    isRefreshing,
    openDriverSelection: handleOpenDriverSelection,
    closeDriverSelection: handleCloseDriverSelection,
    isDriverModalOpen,
    clearEvent: handleClearEvent,
    selectedDriverIds,
    onDriverSelectionChange: setSelectedDriverIds,
    selectedClass,
    onClassChange: handleClassChangeFromDropdown,
    selectedEventId,
    hasEventSelected: !!selectedEventId,
    classesForFilter: classesSorted.map((c) => ({ className: c.className, count: c.driverCount })),
  }

  return (
    <EventActionsContext.Provider value={contextValue}>
      {children}

      {/* Driver Selection Modal */}
      {drivers.length > 0 && races.length > 0 && (
        <Modal
          isOpen={isDriverModalOpen}
          onClose={handleCloseDriverSelection}
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
                  onClick={handleCloseDriverSelection}
                  className="px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface-elevated)] hover:bg-[var(--token-surface-raised)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                >
                  Done
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 p-4">
            {/* View as driver - practice day only; integrated so it lives with driver selection */}
            {isPracticeDay && drivers.length > 0 && (
              <div
                role="group"
                aria-label="View as driver (practice day)"
                className="flex flex-col gap-2 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface)] p-3"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--token-text-primary)]">
                  <svg
                    className="h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
                  </svg>
                  <span>View as driver</span>
                </div>
                <PracticeDriverSelector
                  drivers={drivers.map((d) => ({ driverId: d.driverId, driverName: d.driverName }))}
                  selectedDriverId={selectedPracticeDriverId}
                  hideLabel
                  className="w-full"
                />
              </div>
            )}

            {/* Controls Row */}
            <div className="flex gap-2">
              {/* Class Filter Dropdown */}
              <div className="relative flex-initial w-[220px] min-w-[220px]" ref={dropdownRef}>
                <label className="block text-xs font-medium text-[var(--token-text-secondary)] mb-1">
                  Class
                </label>
                <div className="flex items-center gap-1 w-full">
                  <button
                    type="button"
                    onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                    className="w-full min-w-0 flex items-center justify-between px-3 py-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
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
              <div className="flex-initial w-[220px] min-w-[220px] relative">
                <label
                  htmlFor="driver-search-input"
                  className="block text-xs font-medium text-[var(--token-text-secondary)] mb-1"
                >
                  Search drivers
                </label>
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

      {/* Error Modal */}
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
    </EventActionsContext.Provider>
  )
}
