/**
 * @fileoverview Overview tab component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Overview tab content for event analysis
 *
 * @purpose Displays event summary statistics and primary highlights chart.
 *          Supports chart type switching and driver selection.
 *
 * @relatedFiles
 * - src/components/event-analysis/EventStats.tsx (statistics)
 * - src/components/event-analysis/ChartControls.tsx (controls)
 * - src/components/event-analysis/BestLapBarChart.tsx (charts)
 */

"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import EventStats from "./EventStats"
import ChartControls from "./ChartControls"
import UnifiedPerformanceChart, { type ChartViewType } from "./UnifiedPerformanceChart"
import ChartSection from "./ChartSection"
import type { DriverPerformanceData } from "./UnifiedPerformanceChart"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { normalizeDriverName } from "@/core/users/name-normalizer"
import ChartDataNotice from "./ChartDataNotice"
import {
  getDriversMissingAvgVsFastest,
  getDriversMissingBestLap,
  getUnselectedDriversInClass,
} from "@/core/events/event-analysis-notices"
import { clientLogger } from "@/lib/client-logger"
import { getValidClasses } from "@/core/events/class-validator"

export interface OverviewTabProps {
  data: EventAnalysisData
  selectedDriverIds: string[]
  onDriverSelectionChange: (driverIds: string[]) => void
  selectedClass: string | null
  onClassChange: (className: string | null) => void
}

// Debug: Verify onClassChange prop
let onClassChangeCallCount = 0

type ClassChangeCallback = ((className: string | null) => void) & {
  __CALLBACK_ID?: string
  __IS_OUR_FUNCTION?: boolean
}

export default function OverviewTab({
  data,
  selectedDriverIds,
  onDriverSelectionChange,
  selectedClass,
  onClassChange,
}: OverviewTabProps) {
  // Log the prop immediately when component receives it
  console.log("[OverviewTab] ====== COMPONENT RENDERED ======")
  console.log("[OverviewTab] onClassChange prop received:", onClassChange)
  console.log("[OverviewTab] onClassChange type:", typeof onClassChange)
  console.log(
    "[OverviewTab] onClassChange.__CALLBACK_ID:",
    (onClassChange as ClassChangeCallback)?.__CALLBACK_ID
  )
  console.log("[OverviewTab] onClassChange.name:", onClassChange?.name)
  console.log(
    "[OverviewTab] onClassChange.toString():",
    onClassChange?.toString?.()?.substring(0, 100)
  )

  const lastLoggedMissingState = useRef<string | null>(null)

  const [paginationState, setPaginationState] = useState({
    page: 1,
    selectionKey: "",
  })
  const [selectAllClickedForCurrentClass, setSelectAllClickedForCurrentClass] = useState(false)
  const [chartViewState, setChartViewState] = useState<ChartViewType>("column")
  const selectionKey = selectedDriverIds.join("|")
  const currentPage = paginationState.selectionKey === selectionKey ? paginationState.page : 1
  const driversPerPage = 25

  // Get race classes from entry list
  const validClasses = useMemo(() => getValidClasses(data), [data])

  // Filter races by selected class
  const filteredRaces = useMemo(() => {
    if (selectedClass === null) {
      return data.races
    }
    return data.races.filter((race) => race.className === selectedClass)
  }, [data.races, selectedClass])

  // Calculate driver stats from ALL races (not filtered by class)
  // This ensures ChartControls always has the complete driver list for correct class counts
  // Exclude non-starting drivers (lapsCompleted === 0) as they have no performance data
  const allDriverStats = useMemo(() => {
    const driverMap = new Map<
      string,
      {
        driverId: string
        driverName: string
        bestLapTime: number | null
        avgLapTimes: number[]
      }
    >()

    // Process ALL races (not filtered by class)
    data.races.forEach((race) => {
      race.results.forEach((result) => {
        // Skip non-starting drivers (0 laps completed) - they have no performance data
        if (result.lapsCompleted === 0) {
          return
        }

        const driverId = result.driverId
        const driverName = result.driverName

        if (!driverMap.has(driverId)) {
          driverMap.set(driverId, {
            driverId,
            driverName,
            bestLapTime: null,
            avgLapTimes: [],
          })
        }

        const driverData = driverMap.get(driverId)!

        // Update best lap time
        if (result.fastLapTime !== null) {
          if (driverData.bestLapTime === null || result.fastLapTime < driverData.bestLapTime) {
            driverData.bestLapTime = result.fastLapTime
          }
        }

        // Collect average lap times
        if (result.avgLapTime !== null) {
          driverData.avgLapTimes.push(result.avgLapTime)
        }
      })
    })

    // Calculate final averages
    return Array.from(driverMap.values()).map((driver) => {
      const avgLapTime =
        driver.avgLapTimes.length > 0
          ? driver.avgLapTimes.reduce((a, b) => a + b, 0) / driver.avgLapTimes.length
          : null

      return {
        driverId: driver.driverId,
        driverName: driver.driverName,
        bestLapTime: driver.bestLapTime,
        avgLapTime,
      }
    })
  }, [data.races])

  // Calculate driver stats from filtered races only (for chart display)
  // Exclude non-starting drivers (lapsCompleted === 0) as they have no performance data
  const driverStatsByClass = useMemo(() => {
    const driverMap = new Map<
      string,
      {
        driverId: string
        driverName: string
        bestLapTime: number | null
        bestLapRaceLabel: string | null
        avgLapTimes: number[]
        positions: number[]
        consistencies: number[]
      }
    >()

    // Process each race in filtered races
    filteredRaces.forEach((race) => {
      race.results.forEach((result) => {
        // Skip non-starting drivers (0 laps completed) - they have no performance data
        if (result.lapsCompleted === 0) {
          return
        }

        const driverId = result.driverId
        const driverName = result.driverName

        if (!driverMap.has(driverId)) {
          driverMap.set(driverId, {
            driverId,
            driverName,
            bestLapTime: null,
            bestLapRaceLabel: null,
            avgLapTimes: [],
            positions: [],
            consistencies: [],
          })
        }

        const driverData = driverMap.get(driverId)!

        // Update best lap time and track the race label
        if (result.fastLapTime !== null) {
          if (driverData.bestLapTime === null || result.fastLapTime < driverData.bestLapTime) {
            driverData.bestLapTime = result.fastLapTime
            driverData.bestLapRaceLabel = race.raceLabel
          }
        }

        // Collect average lap times
        if (result.avgLapTime !== null) {
          driverData.avgLapTimes.push(result.avgLapTime)
        }

        // Collect consistency (per-race score 0–100; higher = more consistent)
        if (result.consistency !== null) {
          driverData.consistencies.push(result.consistency)
        }

        // Collect positions
        driverData.positions.push(result.positionFinal)
      })
    })

    // Find the fastest lap time in the class (for gap calculation)
    let fastestLapInClass: number | null = null
    for (const driver of driverMap.values()) {
      if (driver.bestLapTime !== null) {
        if (fastestLapInClass === null || driver.bestLapTime < fastestLapInClass) {
          fastestLapInClass = driver.bestLapTime
        }
      }
    }

    // Calculate final averages and additional metrics
    return Array.from(driverMap.values()).map((driver) => {
      const avgLapTime =
        driver.avgLapTimes.length > 0
          ? driver.avgLapTimes.reduce((a, b) => a + b, 0) / driver.avgLapTimes.length
          : null

      const averagePosition =
        driver.positions.length > 0
          ? driver.positions.reduce((a, b) => a + b, 0) / driver.positions.length
          : null

      // Calculate gap to fastest
      const gapToFastest =
        driver.bestLapTime !== null && fastestLapInClass !== null
          ? driver.bestLapTime - fastestLapInClass
          : null

      // Count podium finishes (positions 1, 2, or 3)
      const podiumFinishes = driver.positions.filter((pos) => pos >= 1 && pos <= 3).length

      // Average consistency for this class (mean of per-race consistency scores)
      const averageConsistency =
        driver.consistencies.length > 0
          ? driver.consistencies.reduce((a, b) => a + b, 0) / driver.consistencies.length
          : null

      return {
        driverId: driver.driverId,
        driverName: driver.driverName,
        bestLapTime: driver.bestLapTime,
        bestLapRaceLabel: driver.bestLapRaceLabel,
        avgLapTime,
        averagePosition,
        gapToFastest,
        podiumFinishes,
        averageConsistency,
      }
    })
  }, [filteredRaces])

  // Prepare unified chart data
  const unifiedChartData = useMemo<DriverPerformanceData[]>(() => {
    return driverStatsByClass.map((d) => ({
      driverId: d.driverId,
      driverName: d.driverName,
      bestLapTime: d.bestLapTime,
      bestLapRaceLabel: d.bestLapRaceLabel,
      averageLapTime: d.avgLapTime,
      consistency: d.averageConsistency ?? null,
      averagePosition: d.averagePosition,
      gapToFastest: d.gapToFastest,
      podiumFinishes: d.podiumFinishes,
    }))
  }, [driverStatsByClass])

  // Build driver options from allDriverStats (not filtered by class)
  // This ensures ChartControls always has the complete driver list for correct class counts
  // Excludes non-starting drivers (those with 0 laps completed who have no performance data to visualize)
  const driverOptions = useMemo(() => {
    return allDriverStats.map((d) => ({
      driverId: d.driverId,
      driverName: d.driverName,
    }))
  }, [allDriverStats])

  const driverOptionsLookup = useMemo(() => {
    return new Map(driverOptions.map((driver) => [driver.driverId, driver.driverName]))
  }, [driverOptions])

  const driverNameLookup = useMemo(() => {
    const map = new Map<string, string>()
    // First, add all drivers from data.drivers (these are aggregated across all races)
    data.drivers.forEach((driver) => {
      if (driver.driverName) {
        map.set(driver.driverId, driver.driverName)
      }
    })
    // Then, add all drivers from race results (including those with 0 laps)
    // This ensures we have names for all drivers who appear in any race
    data.races.forEach((race) => {
      race.results.forEach((result) => {
        // Only add if we don't already have this driverId, or if the existing entry is empty
        if (result.driverId && result.driverName) {
          const existing = map.get(result.driverId)
          if (!existing || existing.trim() === "") {
            map.set(result.driverId, result.driverName)
          }
        }
      })
    })
    return map
  }, [data.drivers, data.races])

  // Expand selectedDriverIds to include all driverIds that match by normalized name
  // This handles cases where there are multiple Driver records with the same/similar name
  // We check data.drivers, driverStatsByClass, AND race results directly to catch all matches
  const expandedSelectedDriverIds = useMemo(() => {
    if (selectedDriverIds.length === 0) {
      return []
    }

    // Get normalized names of selected drivers from data.drivers
    const selectedNormalizedNames = new Set<string>()
    data.drivers.forEach((driver) => {
      if (selectedDriverIds.includes(driver.driverId)) {
        selectedNormalizedNames.add(normalizeDriverName(driver.driverName))
      }
    })

    // Find all driverIds that match any of the selected normalized names
    const expandedIds = new Set<string>(selectedDriverIds)

    // Check data.drivers
    data.drivers.forEach((driver) => {
      const normalizedName = normalizeDriverName(driver.driverName)
      if (selectedNormalizedNames.has(normalizedName)) {
        expandedIds.add(driver.driverId)
      }
    })

    // Check driverStatsByClass (aggregated from race results)
    driverStatsByClass.forEach((driver) => {
      const normalizedName = normalizeDriverName(driver.driverName)
      if (selectedNormalizedNames.has(normalizedName)) {
        expandedIds.add(driver.driverId)
      }
    })

    // Also check race results directly - check both filtered and all races
    // This catches any driverIds that might not be in aggregates or filtered races
    // Only include drivers with laps > 0 (exclude non-starting drivers)
    filteredRaces.forEach((race) => {
      race.results.forEach((result) => {
        if (result.lapsCompleted > 0) {
          const normalizedName = normalizeDriverName(result.driverName)
          if (selectedNormalizedNames.has(normalizedName)) {
            expandedIds.add(result.driverId)
          }
        }
      })
    })

    // Also check all races (not just filtered) to catch drivers in other classes
    // Include ALL drivers from race results (even with 0 laps) to ensure we catch all matches
    data.races.forEach((race) => {
      race.results.forEach((result) => {
        // Include all drivers, not just those with laps > 0, to ensure name matching works
        // for drivers who may have 0 laps in some races but > 0 in others
        const normalizedName = normalizeDriverName(result.driverName)
        if (selectedNormalizedNames.has(normalizedName)) {
          expandedIds.add(result.driverId)
        }
      })
    })

    // Filter to only include driverIds that we have names for in driverNameLookup
    // This prevents "Unknown Driver" from appearing
    const driverNameLookupSnapshot = new Map(driverNameLookup)
    return Array.from(expandedIds).filter((driverId) => driverNameLookupSnapshot.has(driverId))
  }, [
    selectedDriverIds,
    data.drivers,
    driverStatsByClass,
    filteredRaces,
    data.races,
    driverNameLookup,
  ])

  const shouldShowSelectionNotices = expandedSelectedDriverIds.length > 0

  // Only consider selected drivers who are in the current class for "missing best lap" / "missing avg vs fastest"
  // so we don't incorrectly flag drivers from other classes when a class is selected
  const selectedDriverIdsInCurrentClass = useMemo(() => {
    const statsDriverIds = new Set(driverStatsByClass.map((d) => d.driverId))
    return expandedSelectedDriverIds.filter((id) => statsDriverIds.has(id))
  }, [expandedSelectedDriverIds, driverStatsByClass])

  const missingBestLapDriverIds = useMemo(() => {
    if (!shouldShowSelectionNotices) {
      return []
    }
    return getDriversMissingBestLap(selectedDriverIdsInCurrentClass, driverStatsByClass)
  }, [shouldShowSelectionNotices, selectedDriverIdsInCurrentClass, driverStatsByClass])

  const missingAvgVsFastestDriverIds = useMemo(() => {
    if (!shouldShowSelectionNotices) {
      return []
    }
    return getDriversMissingAvgVsFastest(selectedDriverIdsInCurrentClass, driverStatsByClass)
  }, [shouldShowSelectionNotices, selectedDriverIdsInCurrentClass, driverStatsByClass])

  const mapDriverIdsToNames = useCallback(
    (driverIds: string[]) => {
      return driverIds.map((driverId) => {
        const name = driverNameLookup.get(driverId) ?? driverOptionsLookup.get(driverId)
        return name ?? "Unknown Driver"
      })
    },
    [driverNameLookup, driverOptionsLookup]
  )

  const missingBestLapDriverNames = useMemo(
    () => mapDriverIdsToNames(missingBestLapDriverIds),
    [mapDriverIdsToNames, missingBestLapDriverIds]
  )

  const missingAvgVsFastestDriverNames = useMemo(
    () => mapDriverIdsToNames(missingAvgVsFastestDriverIds),
    [mapDriverIdsToNames, missingAvgVsFastestDriverIds]
  )

  // Calculate unselected drivers in the selected class
  const unselectedDriversInClassIds = useMemo(() => {
    if (!selectedClass) {
      return []
    }

    // Get all drivers in the selected class from races data
    // Only include drivers that are in driverOptions (excludes non-starting drivers)
    const driverOptionsSet = new Set(driverOptions.map((d) => d.driverId))
    const classDrivers: Array<{ driverId: string }> = []

    data.races.forEach((race) => {
      if (race.className === selectedClass) {
        race.results.forEach((result) => {
          // Only include drivers that are in driverOptions (have performance data)
          if (driverOptionsSet.has(result.driverId)) {
            // Avoid duplicates
            if (!classDrivers.some((d) => d.driverId === result.driverId)) {
              classDrivers.push({ driverId: result.driverId })
            }
          }
        })
      }
    })

    if (classDrivers.length === 0) {
      return []
    }

    return getUnselectedDriversInClass(selectedDriverIds, classDrivers)
  }, [selectedClass, data.races, driverOptions, selectedDriverIds])

  const unselectedDriversInClassNames = useMemo(
    () => mapDriverIdsToNames(unselectedDriversInClassIds),
    [mapDriverIdsToNames, unselectedDriversInClassIds]
  )

  const allDriversInClassSelected = useMemo(() => {
    if (!selectedClass || driverStatsByClass.length === 0) {
      return false
    }
    return driverStatsByClass.every((d) => selectedDriverIds.includes(d.driverId))
  }, [selectedClass, driverStatsByClass, selectedDriverIds])

  // Clear "Select All clicked" when user deselects a driver
  // Only clear if we previously had all selected and now we don't (user explicitly deselected)
  const prevAllDriversInClassSelected = useRef(false)
  useEffect(() => {
    if (prevAllDriversInClassSelected.current && !allDriversInClassSelected) {
      // User had all drivers selected, but now they don't - clear the flag
      setSelectAllClickedForCurrentClass(false)
    }
    prevAllDriversInClassSelected.current = allDriversInClassSelected
  }, [allDriversInClassSelected])

  const handleSelectAllClick = useCallback(() => {
    setSelectAllClickedForCurrentClass(true)
  }, [])

  // Handle driver toggle from chart click
  const handleSelectionChange = useCallback(
    (driverIds: string[]) => {
      setPaginationState({
        page: 1,
        selectionKey: driverIds.join("|"),
      })
      onDriverSelectionChange(driverIds)
    },
    [onDriverSelectionChange]
  )

  const handleDriverToggle = useCallback(
    (driverId: string) => {
      if (selectedDriverIds.includes(driverId)) {
        handleSelectionChange(selectedDriverIds.filter((id) => id !== driverId))
      } else {
        handleSelectionChange([...selectedDriverIds, driverId])
      }
    },
    [selectedDriverIds, handleSelectionChange]
  )

  const handlePageChange = useCallback(
    (page: number) => {
      setPaginationState({ page, selectionKey })
    },
    [selectionKey]
  )

  // Auto-select all drivers when "All Classes" is the default on initial load
  // This ensures charts show all classes data when event is first loaded
  const hasAutoSelectedOnLoad = useRef<string | null>(null)
  useEffect(() => {
    const eventId = data.event.id
    if (
      driverOptions.length > 0 &&
      selectedClass === null &&
      hasAutoSelectedOnLoad.current !== eventId &&
      (selectedDriverIds.length === 0 || selectedDriverIds.length !== driverOptions.length)
    ) {
      const allDriverIds = driverOptions.map((driver) => driver.driverId)
      const allSelected = allDriverIds.every((id) => selectedDriverIds.includes(id))
      if (!allSelected) {
        hasAutoSelectedOnLoad.current = eventId
        handleSelectionChange(allDriverIds)
      }
    }
  }, [driverOptions, selectedClass, selectedDriverIds, handleSelectionChange, data.event.id])

  // Reset auto-select flag when event changes or when switching to "All Classes"
  const prevSelectedClass = useRef<string | null>(null)
  const prevEventId = useRef<string | null>(null)
  useEffect(() => {
    const eventId = data.event.id
    if (prevEventId.current !== eventId) {
      hasAutoSelectedOnLoad.current = null
      prevEventId.current = eventId
    }
    if (prevSelectedClass.current !== selectedClass && selectedClass === null) {
      hasAutoSelectedOnLoad.current = null
    }
    prevSelectedClass.current = selectedClass
  }, [selectedClass, data.event.id])

  const handleClassChange = useCallback(
    (className: string | null) => {
      console.log("[OverviewTab] handleClassChange called with:", className)

      setSelectAllClickedForCurrentClass(false)
      setPaginationState({
        page: 1,
        selectionKey: "",
      })

      // Auto-select all drivers in the selected class (excluding non-starting drivers)
      if (className !== null) {
        // Get all drivers who raced in this class and have completed at least one lap
        const driversInClass = new Set<string>()
        data.races
          .filter((race) => race.className === className)
          .forEach((race) => {
            race.results.forEach((result) => {
              // Only include drivers who have completed at least one lap
              if (result.lapsCompleted > 0) {
                driversInClass.add(result.driverId)
              }
            })
          })

        // Select all drivers in this class
        const driverIdsArray = Array.from(driversInClass)
        handleSelectionChange(driverIdsArray)
      } else {
        // When "All Classes" is selected, select all available drivers
        const allDriverIds = driverOptions.map((driver) => driver.driverId)
        handleSelectionChange(allDriverIds)
      }

      // Call the parent's onClassChange callback
      onClassChangeCallCount++
      console.log("[OverviewTab] ====== CALLING onClassChange ======")
      console.log("[OverviewTab] Call #", onClassChangeCallCount)
      console.log("[OverviewTab] className to pass:", className, "Type:", typeof className)
      console.log("[OverviewTab] onClassChange function:", onClassChange)
      console.log("[OverviewTab] onClassChange type:", typeof onClassChange)
      console.log("[OverviewTab] onClassChange is defined:", !!onClassChange)
      type ClassChangeCallback = ((className: string | null) => void) & {
        __CALLBACK_ID?: string
        __IS_OUR_FUNCTION?: boolean
      }
      console.log(
        "[OverviewTab] onClassChange.__CALLBACK_ID:",
        (onClassChange as ClassChangeCallback)?.__CALLBACK_ID
      )
      console.log("[OverviewTab] onClassChange.name:", onClassChange?.name)

      if (!onClassChange) {
        console.error("[OverviewTab] CRITICAL ERROR: onClassChange is undefined or null!")
        return
      }

      // Normalize the value before passing
      const normalized =
        className && typeof className === "string" && className.trim() !== ""
          ? className.trim()
          : null

      try {
        console.log("[OverviewTab] About to call onClassChange with normalized value:", normalized)

        // Call onClassChange with normalized value
        // Even if it's setSelectedClass directly, this should update the state
        onClassChange(normalized)

        console.log("[OverviewTab] onClassChange called successfully")
      } catch (error) {
        console.error("[OverviewTab] ERROR calling onClassChange:", error)
        throw error
      }
    },
    [data.races, driverOptions, handleSelectionChange, onClassChange]
  )

  useEffect(() => {
    if (!shouldShowSelectionNotices) {
      lastLoggedMissingState.current = null
      return
    }

    if (missingBestLapDriverIds.length === 0 && missingAvgVsFastestDriverIds.length === 0) {
      lastLoggedMissingState.current = null
      return
    }

    const payload = JSON.stringify({
      missingBestLapDriverIds,
      missingAvgVsFastestDriverIds,
    })

    if (lastLoggedMissingState.current === payload) {
      return
    }

    lastLoggedMissingState.current = payload

    clientLogger.warn("event_analysis_missing_driver_metrics", {
      eventId: data.event.id,
      classFilter: selectedClass ?? "all",
      selectedDriverCount: expandedSelectedDriverIds.length,
      missingBestLapDriverIds,
      missingAvgVsFastestDriverIds,
    })
  }, [
    shouldShowSelectionNotices,
    missingBestLapDriverIds,
    missingAvgVsFastestDriverIds,
    data.event.id,
    selectedClass,
    expandedSelectedDriverIds.length,
  ])

  // Debug: Log when selections change to help diagnose chart update issues
  useEffect(() => {
    console.log("[OverviewTab] Selection state changed:", {
      selectedDriverIds: selectedDriverIds.length,
      expandedSelectedDriverIds: expandedSelectedDriverIds.length,
      selectedClass,
      unifiedChartDataLength: unifiedChartData.length,
      driverStatsByClassLength: driverStatsByClass.length,
      filteredRacesLength: filteredRaces.length,
    })
  }, [
    selectedDriverIds,
    expandedSelectedDriverIds,
    selectedClass,
    unifiedChartData.length,
    driverStatsByClass.length,
    filteredRaces.length,
  ])

  return (
    <div
      className="space-y-6"
      role="tabpanel"
      id="tabpanel-overview"
      aria-labelledby="tab-overview"
    >
      {/* Event Statistics */}
      <section className="space-y-4">
        <div className="border-b border-[var(--token-border-default)] pb-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--token-text-primary)] mb-1">
              Event Statistics
            </h2>
          </div>
        </div>

        <EventStats
          totalRaces={data.summary.totalRaces}
          totalDrivers={data.summary.totalDrivers}
          totalLaps={data.summary.totalLaps}
          dateRange={data.summary.dateRange}
        />
      </section>

      {/* Chart Configuration Section */}
      <section className="space-y-4">
        <ChartControls
          drivers={driverOptions}
          races={data.races}
          selectedDriverIds={selectedDriverIds}
          onDriverSelectionChange={handleSelectionChange}
          onClassChange={handleClassChange}
          selectedClass={selectedClass}
          eventId={data.event.id}
          raceClasses={data.raceClasses}
          onSelectAllClick={handleSelectAllClick}
        />

        {selectedClass &&
          selectedDriverIds.length > 0 &&
          unselectedDriversInClassNames.length > 0 && (
          <ChartDataNotice
            title="Some drivers in this class are not selected"
            description={
              <>
                These drivers are in the selected class but were not included in your selection.
                They may have been manually deselected or were not included when the class was
                selected. You can select them in the driver selection panel above to include them in
                the chart.
              </>
            }
            driverNames={unselectedDriversInClassNames}
            eventId={data.event.id}
            noticeType="unselected-drivers"
          />
        )}
      </section>

      {/* Chart Visualization */}
      <section className="space-y-4">
        <div className="border-b border-[var(--token-border-default)] pb-4">
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)] mb-1">
            Driver Statistics
          </h2>
        </div>

        {missingBestLapDriverNames.length > 0 && (
          <ChartDataNotice
            title="Some selected drivers have no recorded best lap"
            description="LiveRC did not publish a best lap time for these drivers in the selected class, so they are hidden from the chart."
            driverNames={missingBestLapDriverNames}
            eventId={data.event.id}
            noticeType="best-lap"
          />
        )}

        {missingAvgVsFastestDriverNames.length > 0 && (
          <ChartDataNotice
            title="Missing average lap telemetry"
            description="These drivers were selected, but the data feed does not include both best and average lap times for them."
            driverNames={missingAvgVsFastestDriverNames}
            eventId={data.event.id}
            noticeType="avg-vs-fastest"
          />
        )}

        {/* Chart Section */}
        <ChartSection>
          <UnifiedPerformanceChart
            data={unifiedChartData}
            selectedDriverIds={expandedSelectedDriverIds}
            currentPage={currentPage}
            driversPerPage={driversPerPage}
            onPageChange={handlePageChange}
            onDriverToggle={handleDriverToggle}
            chartInstanceId={`overview-${data.event.id}-unified`}
            selectedClass={selectedClass}
            allDriversInClassSelected={allDriversInClassSelected && selectAllClickedForCurrentClass}
            chartView={chartViewState}
            onChartViewChange={setChartViewState}
          />
        </ChartSection>
      </section>
    </div>
  )
}
