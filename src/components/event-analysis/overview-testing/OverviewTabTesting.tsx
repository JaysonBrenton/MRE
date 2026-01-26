/**
 * @fileoverview Overview tab component for testing
 *
 * @created 2025-01-24
 * @creator Auto-generated
 * @lastModified 2025-01-24
 *
 * @description Overview tab content for event analysis with enhanced UX
 *
 * @purpose Displays event summary statistics and primary highlights chart with
 *          improved information hierarchy, progressive disclosure, and context.
 *          Includes context strip, context bar, and grouped data notes.
 *
 * @relatedFiles
 * - src/components/event-analysis/OverviewTab.tsx (original)
 * - src/components/event-analysis/overview-testing/EventStatsTesting.tsx
 * - src/components/event-analysis/overview-testing/ChartControlsTesting.tsx
 * - src/components/event-analysis/overview-testing/ContextBar.tsx
 */

"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import EventStatsTesting from "./EventStatsTesting"
import ChartControlsTesting from "./ChartControlsTesting"
import ContextBar from "./ContextBar"
import UnifiedPerformanceChart from "../UnifiedPerformanceChart"
import ChartSection from "../ChartSection"
import type { DriverPerformanceData } from "../UnifiedPerformanceChart"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { normalizeDriverName } from "@/core/users/name-normalizer"
import ChartDataNotice from "../ChartDataNotice"
import {
  getDriversMissingAvgVsFastest,
  getDriversMissingBestLap,
  getUnselectedDriversInClass,
} from "@/core/events/event-analysis-notices"
import { clientLogger } from "@/lib/client-logger"
import { getValidClasses } from "@/core/events/class-validator"
import { formatDateLong } from "@/lib/date-utils"

interface WeatherData {
  condition: string
  wind: string
  humidity: number
  air: number
  track: number
  precip: number
  forecast: Array<{ label: string; detail: string }>
  cachedAt?: string
  isCached?: boolean
}

export interface OverviewTabTestingProps {
  data: EventAnalysisData
  selectedDriverIds: string[]
  onDriverSelectionChange: (driverIds: string[]) => void
  selectedClass: string | null
  onClassChange: (className: string | null) => void
  weather: WeatherData | null
  weatherLoading: boolean
  weatherError: string | null
}

// Debug: Verify onClassChange prop
let onClassChangeCallCount = 0

type ClassChangeCallback = ((className: string | null) => void) & { __CALLBACK_ID?: string; __IS_OUR_FUNCTION?: boolean }

export default function OverviewTabTesting({
  data,
  selectedDriverIds,
  onDriverSelectionChange,
  selectedClass,
  onClassChange,
  weather,
  weatherLoading,
  weatherError,
}: OverviewTabTestingProps) {
  // Log the prop immediately when component receives it
  console.log("[OverviewTab] ====== COMPONENT RENDERED ======")
  console.log("[OverviewTab] onClassChange prop received:", onClassChange)
  console.log("[OverviewTab] onClassChange type:", typeof onClassChange)
  console.log("[OverviewTab] onClassChange.__CALLBACK_ID:", (onClassChange as ClassChangeCallback)?.__CALLBACK_ID)
  console.log("[OverviewTab] onClassChange.name:", onClassChange?.name)
  console.log("[OverviewTab] onClassChange.toString():", onClassChange?.toString?.()?.substring(0, 100))
  
  const lastLoggedMissingState = useRef<string | null>(null)

  const [paginationState, setPaginationState] = useState({
    page: 1,
    selectionKey: "",
  })
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

      return {
        driverId: driver.driverId,
        driverName: driver.driverName,
        bestLapTime: driver.bestLapTime,
        bestLapRaceLabel: driver.bestLapRaceLabel,
        avgLapTime,
        averagePosition,
        gapToFastest,
        podiumFinishes,
      }
    })
  }, [filteredRaces])

  // Prepare unified chart data
  const unifiedChartData = useMemo<DriverPerformanceData[]>(() => {
    return driverStatsByClass
      .map((d) => ({
        driverId: d.driverId,
        driverName: d.driverName,
        bestLapTime: d.bestLapTime,
        bestLapRaceLabel: d.bestLapRaceLabel,
        averageLapTime: d.avgLapTime,
        consistency: null, // Future metric
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

  const missingBestLapDriverIds = useMemo(() => {
    if (!shouldShowSelectionNotices) {
      return []
    }
    return getDriversMissingBestLap(expandedSelectedDriverIds, driverStatsByClass)
  }, [shouldShowSelectionNotices, expandedSelectedDriverIds, driverStatsByClass])

  const missingAvgVsFastestDriverIds = useMemo(() => {
    if (!shouldShowSelectionNotices) {
      return []
    }
    return getDriversMissingAvgVsFastest(expandedSelectedDriverIds, driverStatsByClass)
  }, [shouldShowSelectionNotices, expandedSelectedDriverIds, driverStatsByClass])

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

  const handleClassChange = useCallback(
    (className: string | null) => {
      console.log("[OverviewTab] handleClassChange called with:", className)
      
      // Reset pagination when class changes
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
      type ClassChangeCallback = ((className: string | null) => void) & { __CALLBACK_ID?: string; __IS_OUR_FUNCTION?: boolean }
      console.log("[OverviewTab] onClassChange.__CALLBACK_ID:", (onClassChange as ClassChangeCallback)?.__CALLBACK_ID)
      console.log("[OverviewTab] onClassChange.name:", onClassChange?.name)
      
      if (!onClassChange) {
        console.error("[OverviewTab] CRITICAL ERROR: onClassChange is undefined or null!")
        return
      }
      
      // Normalize the value before passing
      const normalized = (className && typeof className === "string" && className.trim() !== "") 
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
  }, [selectedDriverIds, expandedSelectedDriverIds, selectedClass, unifiedChartData.length, driverStatsByClass.length, filteredRaces.length])

  // Collect all notices for grouping
  const allNotices = []
  if (selectedClass && unselectedDriversInClassNames.length > 0) {
    allNotices.push({
      title: "Some drivers in this class are not selected",
      description: (
        <>
          These drivers are in the selected class but were not included in your selection. 
          They may have been manually deselected or were not included when the class was selected. 
          You can select them in the driver selection panel above to include them in the chart.
        </>
      ),
      driverNames: unselectedDriversInClassNames,
      noticeType: "unselected-drivers",
    })
  }
  if (missingBestLapDriverNames.length > 0) {
    allNotices.push({
      title: "Some selected drivers have no recorded best lap",
      description: "LiveRC did not publish a best lap time for these drivers in the selected class, so they are hidden from the chart.",
      driverNames: missingBestLapDriverNames,
      noticeType: "best-lap",
    })
  }
  if (missingAvgVsFastestDriverNames.length > 0) {
    allNotices.push({
      title: "Missing average lap telemetry",
      description: "These drivers were selected, but the data feed does not include both best and average lap times for them.",
      driverNames: missingAvgVsFastestDriverNames,
      noticeType: "avg-vs-fastest",
    })
  }

  return (
    <div
      className="space-y-6"
      role="tabpanel"
      id="tabpanel-overview-testing"
      aria-labelledby="tab-overview-testing"
    >
      {/* Context Strip: Event Stats + Weather */}
      <section className="grid grid-cols-12 gap-4 lg:gap-6 mb-6">
        <div className="col-span-12 lg:col-span-8">
          <EventStatsTesting
            totalRaces={data.summary.totalRaces}
            totalDrivers={data.summary.totalDrivers}
            totalLaps={data.summary.totalLaps}
            dateRange={data.summary.dateRange}
          />
        </div>
        <div className="col-span-12 lg:col-span-4">
          {weather ? (
            <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
              <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)] mb-2">
                Track state
              </p>
              <h3 className="text-lg font-semibold text-[var(--token-text-primary)] mb-1">
                {weather.condition}
              </h3>
              <p className="text-sm text-[var(--token-text-secondary)] mb-4">
                Wind {weather.wind} • Humidity {weather.humidity}%
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--token-text-muted)]">Air</p>
                  <p className="text-sm font-semibold text-[var(--token-text-primary)]">{Math.round(weather.air)}°C</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--token-text-muted)]">Track</p>
                  <p className="text-sm font-semibold text-[var(--token-text-primary)]">{Math.round(weather.track)}°C</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--token-text-muted)]">Chance</p>
                  <p className="text-sm font-semibold text-[var(--token-text-primary)]">{weather.precip}%</p>
                </div>
              </div>
            </div>
          ) : weatherLoading ? (
            <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
              <p className="text-sm text-[var(--token-text-secondary)]">Loading weather...</p>
            </div>
          ) : weatherError ? (
            <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
              <p className="text-sm text-[var(--token-text-secondary)]">Weather unavailable</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Context Bar */}
      <ContextBar
        eventName={data.event.eventName}
        selectedClass={selectedClass}
        selectedDriverCount={expandedSelectedDriverIds.length}
      />

      {/* Chart Configuration Section */}
      <ChartControlsTesting
        drivers={driverOptions}
        races={data.races}
        selectedDriverIds={selectedDriverIds}
        onDriverSelectionChange={handleSelectionChange}
        onClassChange={handleClassChange}
        selectedClass={selectedClass}
        eventId={data.event.id}
        raceClasses={data.raceClasses}
      />

      {/* CTA when no selection */}
      {!selectedClass && selectedDriverIds.length === 0 && (
        <div className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-3">
          <p className="text-sm text-[var(--token-text-secondary)]">
            <span className="font-semibold text-[var(--token-text-primary)]">Tip:</span> Select a class or multiple drivers above to see driver highlights below.
          </p>
        </div>
      )}

      {/* Chart Visualization */}
      <section className="space-y-4">
        <div className="border-b border-[var(--token-border-default)] pb-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--token-text-primary)] mb-1">
              Compare driver performance
            </h2>
            <p className="text-sm text-[var(--token-text-secondary)] mt-2">
              Interactive chart showing selected drivers&rsquo; performance metrics. Chart: compare chosen drivers. Cards below: top performers in each category.
            </p>
            <div className="mt-2 rounded-md bg-[var(--token-surface-elevated)] border border-[var(--token-border-default)] px-3 py-2">
              <p className="text-xs text-[var(--token-text-secondary)]">
                💡 <span className="font-medium">Tip:</span> Click legend items to show or hide metrics.
              </p>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <ChartSection>
          <UnifiedPerformanceChart
            data={unifiedChartData}
            selectedDriverIds={expandedSelectedDriverIds}
            currentPage={currentPage}
            driversPerPage={driversPerPage}
            onPageChange={handlePageChange}
            onDriverToggle={handleDriverToggle}
            chartInstanceId={`overview-testing-${data.event.id}-unified`}
            selectedClass={selectedClass}
          />
        </ChartSection>

        {/* Data Notes - Grouped */}
        {allNotices.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--token-text-primary)]">
              Data notes
            </h3>
            {allNotices.map((notice) => (
              <ChartDataNotice
                key={notice.noticeType}
                title={notice.title}
                description={notice.description}
                driverNames={notice.driverNames}
                eventId={data.event.id}
                noticeType={notice.noticeType}
              />
            ))}
          </div>
        )}
      </section>

      {/* Bridging Copy */}
      <div className="border-t border-[var(--token-border-default)] pt-4">
        <p className="text-sm font-medium text-[var(--token-text-primary)]">
          Top performers in your selection
        </p>
      </div>
    </div>
  )
}
