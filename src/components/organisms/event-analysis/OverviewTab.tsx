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
import WeatherCard from "./WeatherCard"
import ClassStatsCard from "./ClassStatsCard"
import ClassTopFastestLapsCard from "./ClassTopFastestLapsCard"
import ClassTopAverageLapsCard from "./ClassTopAverageLapsCard"
import ClassMostImprovedCard from "./ClassMostImprovedCard"
import MainPodiumCard from "./MainPodiumCard"
import MultiMainOverallCard from "./MultiMainOverallCard"
import ChartControls from "./ChartControls"
import UnifiedPerformanceChart, { type ChartViewType } from "./UnifiedPerformanceChart"
import ChartSection from "./ChartSection"
import ChartDriverPicker from "./ChartDriverPicker"
import LapByLapTrendChart from "./LapByLapTrendChart"
import type { DriverPerformanceData } from "./UnifiedPerformanceChart"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import type { EventLapTrendResponse } from "@/core/events/get-lap-data"
import type { EventWeatherData } from "@/types/weather"
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

export default function OverviewTab({
  data,
  selectedDriverIds,
  onDriverSelectionChange,
  selectedClass,
  onClassChange,
}: OverviewTabProps) {
  const lastLoggedMissingState = useRef<string | null>(null)

  const [weather, setWeather] = useState<EventWeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [isEventSummaryOpen, setIsEventSummaryOpen] = useState(false)
  const [isFastestLapsOpen, setIsFastestLapsOpen] = useState(false)
  const [isBestAverageOpen, setIsBestAverageOpen] = useState(false)
  const [isMostImprovedOpen, setIsMostImprovedOpen] = useState(false)
  const [isResultsOpen, setIsResultsOpen] = useState(false)
  const [isDriverPerformanceOpen, setIsDriverPerformanceOpen] = useState(false)
  const [isLapTrendOpen, setIsLapTrendOpen] = useState(false)

  useEffect(() => {
    const eventId = data.event.id
    if (!eventId) {
      setWeather(null)
      setWeatherError(null)
      return
    }
    setWeatherLoading(true)
    setWeatherError(null)
    const fetchWeather = (refresh = false) => {
      const url = `/api/v1/events/${eventId}/weather${refresh ? "?refresh=true" : ""}`
      return fetch(url, { cache: "no-store" }).then(async (response) => {
        if (!response.ok) {
          if (response.status === 404) {
            setWeatherError("Event not found")
            return null
          }
          const errorData = await response.json().catch(() => ({}))
          setWeatherError(errorData.error?.message ?? "Failed to load weather data")
          return null
        }
        const result = await response.json()
        if (result.success && result.data) {
          return result.data as EventWeatherData
        }
        setWeatherError("Invalid response from server")
        return null
      })
    }
    fetchWeather()
      .then((data) => {
        if (!data) return
        setWeather(data)
        setWeatherError(null)
        // If cached response lacks daily temperature summary, refetch once to populate and upgrade cache
        if (!data.dailyTemperatureSummary) {
          return fetchWeather(true).then((fresh) => {
            if (fresh) setWeather(fresh)
          })
        }
      })
      .catch((error) => {
        clientLogger.error("Error fetching weather data", { error })
        setWeatherError("Failed to fetch weather data")
      })
      .finally(() => {
        setWeatherLoading(false)
      })
  }, [data.event.id])

  const [paginationState, setPaginationState] = useState({
    page: 1,
    selectionKey: "",
  })
  const [selectAllClickedForCurrentClass, setSelectAllClickedForCurrentClass] = useState(false)
  const [chartViewState, setChartViewState] = useState<ChartViewType>("column")
  const [lapTrendData, setLapTrendData] = useState<EventLapTrendResponse | null>(null)
  const [lapTrendLoading, setLapTrendLoading] = useState(false)
  const [lapTrendError, setLapTrendError] = useState<string | null>(null)
  // Per-chart driver selection for unified chart only; lap trend uses global selection (Actions menu)
  const [unifiedChartDriverIds, setUnifiedChartDriverIds] = useState<string[]>([])
  // Lap-trend chart: which drivers to show (subset of expandedSelectedDriverIds); cap at 8 when many selected
  const [lapTrendChartDriverIds, setLapTrendChartDriverIds] = useState<string[]>([])
  // Lap-trend sort: order drivers in chart/legend by this metric
  const [lapTrendSortBy, setLapTrendSortBy] = useState<
    "bestLap" | "averageLap" | "consistency" | "gapToFastest" | "averagePosition" | "podiumFinishes"
  >("bestLap")
  const selectionKey = selectedDriverIds.join("|")
  const driversPerPage = 25
  const MAX_LAP_TREND_DRIVERS = 8

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

  // Helper: expand driver IDs by normalized name (same logic for overview and per-chart)
  const expandDriverIdsByName = useCallback(
    (seedIds: string[]) => {
      if (seedIds.length === 0) return []
      const selectedNormalizedNames = new Set<string>()
      data.drivers.forEach((driver) => {
        if (seedIds.includes(driver.driverId)) {
          selectedNormalizedNames.add(normalizeDriverName(driver.driverName))
        }
      })
      driverStatsByClass.forEach((driver) => {
        if (seedIds.includes(driver.driverId)) {
          selectedNormalizedNames.add(normalizeDriverName(driver.driverName))
        }
      })
      const expandedIds = new Set<string>(seedIds)
      data.drivers.forEach((driver) => {
        if (selectedNormalizedNames.has(normalizeDriverName(driver.driverName))) {
          expandedIds.add(driver.driverId)
        }
      })
      driverStatsByClass.forEach((driver) => {
        if (selectedNormalizedNames.has(normalizeDriverName(driver.driverName))) {
          expandedIds.add(driver.driverId)
        }
      })
      filteredRaces.forEach((race) => {
        race.results.forEach((result) => {
          if (result.lapsCompleted > 0 && selectedNormalizedNames.has(normalizeDriverName(result.driverName))) {
            expandedIds.add(result.driverId)
          }
        })
      })
      data.races.forEach((race) => {
        race.results.forEach((result) => {
          if (selectedNormalizedNames.has(normalizeDriverName(result.driverName))) {
            expandedIds.add(result.driverId)
          }
        })
      })
      const driverNameLookupSnapshot = new Map(driverNameLookup)
      return Array.from(expandedIds).filter((id) => driverNameLookupSnapshot.has(id))
    },
    [data.drivers, data.races, driverStatsByClass, filteredRaces, driverNameLookup]
  )

  // Expand selectedDriverIds to include all driverIds that match by normalized name
  const expandedSelectedDriverIds = useMemo(
    () => expandDriverIdsByName(selectedDriverIds),
    [expandDriverIdsByName, selectedDriverIds]
  )

  // Per-chart expanded IDs (unified chart only); lap trend uses expandedSelectedDriverIds
  const expandedUnifiedChartDriverIds = useMemo(
    () => expandDriverIdsByName(unifiedChartDriverIds),
    [expandDriverIdsByName, unifiedChartDriverIds]
  )

  // Pagination for unified chart is keyed by that chart's driver selection
  const unifiedChartSelectionKey = expandedUnifiedChartDriverIds.join("|")
  const currentPage =
    paginationState.selectionKey === unifiedChartSelectionKey ? paginationState.page : 1

  const shouldShowSelectionNotices = expandedSelectedDriverIds.length > 0

  // Sync per-chart driver state from overview when event or class changes (start in sync)
  const prevEventIdRef = useRef<string | null>(null)
  const prevSelectedClassRef = useRef<string | null>(null)
  useEffect(() => {
    const eventChanged = prevEventIdRef.current !== data.event.id
    const classChanged = prevSelectedClassRef.current !== selectedClass
    prevEventIdRef.current = data.event.id
    prevSelectedClassRef.current = selectedClass
    if (eventChanged || classChanged) {
      setUnifiedChartDriverIds(selectedDriverIds)
    }
  }, [data.event.id, selectedClass, selectedDriverIds])

  // When event changes, default lap trend chart to 0 drivers selected (user picks via chart "Select Drivers")
  useEffect(() => {
    setLapTrendChartDriverIds([])
  }, [data.event.id])

  // Fetch lap-by-lap trend for drivers selected in the chart (lapTrendChartDriverIds)
  useEffect(() => {
    if (lapTrendChartDriverIds.length === 0) {
      setLapTrendData(null)
      setLapTrendError(null)
      return
    }
    setLapTrendLoading(true)
    setLapTrendError(null)
    const url = `/api/v1/events/${data.event.id}/lap-trend?driverIds=${encodeURIComponent(lapTrendChartDriverIds.join(","))}`
    fetch(url, { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          const message =
            err?.error?.message ?? `Failed to load lap trend (${res.status})`
          throw new Error(message)
        }
        const json = await res.json()
        if (json.success && json.data) {
          setLapTrendData(json.data as EventLapTrendResponse)
        } else {
          setLapTrendData({ drivers: [] })
        }
      })
      .catch((err) => {
        setLapTrendError(err instanceof Error ? err.message : "Failed to load lap trend")
        setLapTrendData(null)
      })
      .finally(() => setLapTrendLoading(false))
  }, [data.event.id, lapTrendChartDriverIds])

  // Lap-trend driver options: drivers that are in global selection (for chart-specific picker)
  const lapTrendDriverOptions = useMemo(
    () =>
      driverStatsByClass
        .filter((d) => expandedSelectedDriverIds.includes(d.driverId))
        .map((d) => ({ driverId: d.driverId, driverName: d.driverName })),
    [driverStatsByClass, expandedSelectedDriverIds]
  )

  // Sort lap-trend drivers by selected metric (order in chart/legend)
  const sortedLapTrendDrivers = useMemo(() => {
    if (!lapTrendData?.drivers?.length) return []
    const statsMap = new Map(driverStatsByClass.map((d) => [d.driverId, d]))
    const key =
      lapTrendSortBy === "bestLap"
        ? "bestLapTime"
        : lapTrendSortBy === "averageLap"
          ? "avgLapTime"
          : lapTrendSortBy === "consistency"
            ? "averageConsistency"
            : lapTrendSortBy === "gapToFastest"
              ? "gapToFastest"
              : lapTrendSortBy === "averagePosition"
                ? "averagePosition"
                : "podiumFinishes"
    const ascending =
      lapTrendSortBy === "consistency" || lapTrendSortBy === "podiumFinishes" ? false : true
    return [...lapTrendData.drivers].sort((a, b) => {
      const sa = statsMap.get(a.driverId)
      const sb = statsMap.get(b.driverId)
      const va = sa ? (sa as Record<string, unknown>)[key] : null
      const vb = sb ? (sb as Record<string, unknown>)[key] : null
      const aNum =
        va === null || va === undefined || (typeof va === "number" && !isFinite(va))
          ? ascending
            ? Infinity
            : -Infinity
          : (va as number)
      const bNum =
        vb === null || vb === undefined || (typeof vb === "number" && !isFinite(vb))
          ? ascending
            ? Infinity
            : -Infinity
          : (vb as number)
      if (ascending) return aNum - bNum
      return bNum - aNum
    })
  }, [lapTrendData, driverStatsByClass, lapTrendSortBy])

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

  // Per-chart: toggle one driver in the unified chart's selection (legend click)
  const handleUnifiedChartDriverToggle = useCallback((driverId: string) => {
    setUnifiedChartDriverIds((prev) =>
      prev.includes(driverId) ? prev.filter((id) => id !== driverId) : [...prev, driverId]
    )
  }, [])

  const handlePageChange = useCallback(
    (page: number) => {
      setPaginationState({ page, selectionKey: unifiedChartSelectionKey })
    },
    [unifiedChartSelectionKey]
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

      if (!onClassChange) return

      const normalized =
        className && typeof className === "string" && className.trim() !== ""
          ? className.trim()
          : null
      onClassChange(normalized)
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

  const eventSummaryContentId = "event-summary-content"
  const fastestLapsContentId = "fastest-laps-content"
  const bestAverageContentId = "best-average-lap-content"
  const mostImprovedContentId = "most-improved-content"
  const resultsContentId = "results-content"
  const driverPerformanceContentId = "driver-performance-content"
  const lapTrendContentId = "lap-trend-content"

  return (
    <div
      className="space-y-6"
      role="tabpanel"
      id="tabpanel-overview"
      aria-labelledby="tab-overview"
    >
      {/* Always-visible event headline metrics */}
      <section className="space-y-3">
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 px-4 py-3 shadow-sm transition-colors hover:border-[var(--token-accent-soft-border)] hover:bg-[var(--token-surface-elevated)]/80"
          style={{
            backgroundColor: "var(--glass-bg)",
            backdropFilter: "var(--glass-blur)",
            borderRadius: 16,
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--token-text-secondary)]">
              Event overview
            </p>
            <p className="truncate text-sm font-medium text-[var(--token-text-primary)]">
              {data.event.trackName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--token-text-secondary)]">
            <span className="rounded-full bg-[var(--token-surface-elevated)]/80 px-2 py-1">
              {data.summary.totalRaces} races
            </span>
            <span className="rounded-full bg-[var(--token-surface-elevated)]/80 px-2 py-1">
              {data.summary.totalDrivers} drivers
            </span>
            <span className="rounded-full bg-[var(--token-surface-elevated)]/80 px-2 py-1">
              {data.entryList.length} entries
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-6">
          <div
            className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 shadow-sm"
            style={{
              backgroundColor: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur)",
              borderRadius: 16,
              border: "1px solid var(--glass-border)",
              boxShadow: "var(--glass-shadow)",
            }}
          >
            <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--token-surface-elevated)]/80"
                aria-expanded={isEventSummaryOpen}
                aria-controls={eventSummaryContentId}
                onClick={() => setIsEventSummaryOpen((prev) => !prev)}
              >
                <span className="flex min-w-0 flex-col">
                  <span>Event summary</span>
                  <span className="mt-0.5 truncate text-xs font-normal text-[var(--token-text-secondary)]">
                    {data.summary.totalRaces} races • {data.summary.totalDrivers} drivers •{" "}
                    {data.entryList.length} entries
                  </span>
                </span>
                <span
                  className={`shrink-0 transition-transform duration-150 ${
                    isEventSummaryOpen ? "rotate-0" : "-rotate-90"
                  }`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
            </h2>
            {isEventSummaryOpen && (
              <div
                id={eventSummaryContentId}
                className="flex flex-wrap gap-4 border-t border-[var(--token-border-default)] px-4 py-4"
              >
                <EventStats
                  trackName={data.event.trackName}
                  totalRaces={data.summary.totalRaces}
                  totalDrivers={data.summary.totalDrivers}
                  totalLaps={data.summary.totalLaps}
                  classCount={data.raceClasses.size}
                  entries={data.entryList.length}
                  dateRange={data.summary.dateRange}
                />
                <WeatherCard
                  weather={weather}
                  weatherLoading={weatherLoading}
                  weatherError={weatherError}
                />
                <ClassStatsCard
                  raceClasses={data.raceClasses}
                  races={data.races}
                  entryList={data.entryList}
                />
              </div>
            )}
          </div>

          <div
            className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 shadow-sm"
            style={{
              backgroundColor: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur)",
              borderRadius: 16,
              border: "1px solid var(--glass-border)",
              boxShadow: "var(--glass-shadow)",
            }}
          >
            <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--token-surface-elevated)]/80"
                aria-expanded={isFastestLapsOpen}
                aria-controls={fastestLapsContentId}
                onClick={() => setIsFastestLapsOpen((prev) => !prev)}
              >
                <span className="flex min-w-0 flex-col">
                  <span>Fastest Laps for Event</span>
                  <span className="mt-0.5 truncate text-xs font-normal text-[var(--token-text-secondary)]">
                    {data.raceClasses.size} classes with fastest lap data
                  </span>
                </span>
                <span
                  className={`shrink-0 transition-transform duration-150 ${
                    isFastestLapsOpen ? "rotate-0" : "-rotate-90"
                  }`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
            </h2>
            {isFastestLapsOpen && (
              <div
                id={fastestLapsContentId}
                className="flex flex-wrap gap-4 border-t border-[var(--token-border-default)] px-4 py-4"
              >
                <ClassTopFastestLapsCard races={data.races} />
              </div>
            )}
          </div>

          <div
            className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 shadow-sm"
            style={{
              backgroundColor: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur)",
              borderRadius: 16,
              border: "1px solid var(--glass-border)",
              boxShadow: "var(--glass-shadow)",
            }}
          >
            <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--token-surface-elevated)]/80"
                aria-expanded={isBestAverageOpen}
                aria-controls={bestAverageContentId}
                onClick={() => setIsBestAverageOpen((prev) => !prev)}
              >
                <span className="flex min-w-0 flex-col">
                  <span>Fastest Average Laps for Event</span>
                  <span className="mt-0.5 truncate text-xs font-normal text-[var(--token-text-secondary)]">
                    Average pace across {driverStatsByClass.length} drivers in current view
                  </span>
                </span>
                <span
                  className={`shrink-0 transition-transform duration-150 ${
                    isBestAverageOpen ? "rotate-0" : "-rotate-90"
                  }`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
            </h2>
            {isBestAverageOpen && (
              <div
                id={bestAverageContentId}
                className="flex flex-wrap gap-4 border-t border-[var(--token-border-default)] px-4 py-4"
              >
                <ClassTopAverageLapsCard races={data.races} />
              </div>
            )}
          </div>

          <div
            className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 shadow-sm"
            style={{
              backgroundColor: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur)",
              borderRadius: 16,
              border: "1px solid var(--glass-border)",
              boxShadow: "var(--glass-shadow)",
            }}
          >
            <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--token-surface-elevated)]/80"
                aria-expanded={isMostImprovedOpen}
                aria-controls={mostImprovedContentId}
                onClick={() => setIsMostImprovedOpen((prev) => !prev)}
              >
                <span className="flex min-w-0 flex-col">
                  <span>Most Improved Drivers for Event</span>
                  <span className="mt-0.5 truncate text-xs font-normal text-[var(--token-text-secondary)]">
                    Improvement across {data.races.length} races
                  </span>
                </span>
                <span
                  className={`shrink-0 transition-transform duration-150 ${
                    isMostImprovedOpen ? "rotate-0" : "-rotate-90"
                  }`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
            </h2>
            {isMostImprovedOpen && (
              <div
                id={mostImprovedContentId}
                className="flex flex-wrap gap-4 border-t border-[var(--token-border-default)] px-4 py-4"
              >
                <ClassMostImprovedCard
                  races={data.races}
                  isPracticeDay={data.isPracticeDay}
                />
              </div>
            )}
          </div>

          <div
            className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 shadow-sm"
            style={{
              backgroundColor: "var(--glass-bg)",
              backdropFilter: "var(--glass-blur)",
              borderRadius: 16,
              border: "1px solid var(--glass-border)",
              boxShadow: "var(--glass-shadow)",
            }}
          >
            <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--token-surface-elevated)]/80"
                aria-expanded={isResultsOpen}
                aria-controls={resultsContentId}
                onClick={() => setIsResultsOpen((prev) => !prev)}
              >
                <span className="flex min-w-0 flex-col">
                  <span>Event Results</span>
                  <span className="mt-0.5 truncate text-xs font-normal text-[var(--token-text-secondary)]">
                    Final results from {data.races.length} races
                  </span>
                </span>
                <span
                  className={`shrink-0 transition-transform duration-150 ${
                    isResultsOpen ? "rotate-0" : "-rotate-90"
                  }`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
            </h2>
            {isResultsOpen && (
              <div
                id={resultsContentId}
                className="flex flex-wrap gap-4 border-t border-[var(--token-border-default)] px-4 py-4"
              >
                <MainPodiumCard races={data.races} />
                <MultiMainOverallCard multiMainResults={data.multiMainResults ?? []} />
              </div>
            )}
          </div>
        </div>
      </section>

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

      <section className="space-y-4">
        <div
          className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 shadow-sm"
          style={{
            backgroundColor: "var(--glass-bg)",
            backdropFilter: "var(--glass-blur)",
            borderRadius: 16,
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--token-surface-elevated)]/80"
              aria-expanded={isDriverPerformanceOpen}
              aria-controls={driverPerformanceContentId}
              onClick={() => setIsDriverPerformanceOpen((prev) => !prev)}
            >
              <span className="flex min-w-0 flex-col">
                <span>Driver performance comparison</span>
                <span className="mt-0.5 truncate text-xs font-normal text-[var(--token-text-secondary)]">
                  Best lap, average lap, consistency, and position by driver.
                </span>
              </span>
              <span
                className={`shrink-0 transition-transform duration-150 ${
                  isDriverPerformanceOpen ? "rotate-0" : "-rotate-90"
                }`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>
          </h2>
          {isDriverPerformanceOpen && (
            <div
              id={driverPerformanceContentId}
              className="space-y-4 border-t border-[var(--token-border-default)] px-4 py-4"
            >
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
              <ChartSection>
                <UnifiedPerformanceChart
                  data={unifiedChartData}
                  selectedDriverIds={expandedUnifiedChartDriverIds}
                  currentPage={currentPage}
                  driversPerPage={driversPerPage}
                  onPageChange={handlePageChange}
                  onDriverToggle={handleUnifiedChartDriverToggle}
                  chartInstanceId={`overview-${data.event.id}-unified`}
                  selectedClass={selectedClass}
                  allDriversInClassSelected={allDriversInClassSelected && selectAllClickedForCurrentClass}
                  chartView={chartViewState}
                  onChartViewChange={setChartViewState}
                  chartDriverOptions={driverStatsByClass.map((d) => ({ driverId: d.driverId, driverName: d.driverName }))}
                  chartSelectedDriverIds={unifiedChartDriverIds}
                  onChartDriverSelectionChange={setUnifiedChartDriverIds}
                  availableClasses={validClasses}
                  onClassChange={onClassChange}
                />
              </ChartSection>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div
          className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 shadow-sm"
          style={{
            backgroundColor: "var(--glass-bg)",
            backdropFilter: "var(--glass-blur)",
            borderRadius: 16,
            border: "1px solid var(--glass-border)",
            boxShadow: "var(--glass-shadow)",
          }}
        >
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[var(--token-surface-elevated)]/80"
              aria-expanded={isLapTrendOpen}
              aria-controls={lapTrendContentId}
              onClick={() => setIsLapTrendOpen((prev) => !prev)}
            >
              <span className="flex min-w-0 flex-col">
                <span>Lap-by-lap trend</span>
                <span className="mt-0.5 truncate text-xs font-normal text-[var(--token-text-secondary)]">
                  All lap times from first session to last. Use Actions to select class or drivers.
                </span>
              </span>
              <span
                className={`shrink-0 transition-transform duration-150 ${
                  isLapTrendOpen ? "rotate-0" : "-rotate-90"
                }`}
                aria-hidden="true"
              >
                ▾
              </span>
            </button>
          </h2>
          {isLapTrendOpen && (
            <div
              id={lapTrendContentId}
              className="space-y-4 border-t border-[var(--token-border-default)] px-4 py-4"
            >
              <ChartSection>
                {expandedSelectedDriverIds.length === 0 ? (
                  <div
                    className="flex items-center justify-center text-[var(--token-text-secondary)] rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] min-h-[400px]"
                    style={{
                      minWidth: 0,
                      backgroundColor: "var(--glass-bg)",
                      backdropFilter: "var(--glass-blur)",
                      borderRadius: 16,
                      border: "1px solid var(--glass-border)",
                      boxShadow: "var(--glass-shadow), var(--glass-shadow-lg)",
                    }}
                  >
                    Select drivers via Actions (class or Select Drivers) to view lap-by-lap trend.
                  </div>
                ) : (
                  <>
                    {expandedSelectedDriverIds.length > MAX_LAP_TREND_DRIVERS &&
                      lapTrendChartDriverIds.length === MAX_LAP_TREND_DRIVERS && (
                        <p className="mb-2 text-sm text-[var(--token-text-secondary)]">
                          Showing first {MAX_LAP_TREND_DRIVERS} of{" "}
                          {expandedSelectedDriverIds.length} selected. Use Drivers to add or change.
                        </p>
                      )}
                    <LapByLapTrendChart
                      drivers={
                        lapTrendData?.drivers?.some((d) => d.laps.length > 0)
                          ? sortedLapTrendDrivers
                          : []
                      }
                      height={450}
                      chartInstanceId={`overview-${data.event.id}-lap-trend`}
                      chartTitle={
                        selectedClass === null ? "All Classes" : selectedClass ?? "All Classes"
                      }
                      headerControls={
                        <div className="flex flex-wrap items-center gap-4">
                          {validClasses.length > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[var(--token-text-secondary)]">
                                Choose a Class:
                              </span>
                              <select
                                value={selectedClass ?? ""}
                                onChange={(e) => onClassChange(e.target.value || null)}
                                className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-1.5 text-sm text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-accent)]"
                                aria-label="Choose a Class for lap trend"
                              >
                                <option value="">All Classes</option>
                                {validClasses.map((cls) => (
                                  <option key={cls} value={cls}>
                                    {cls}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {lapTrendDriverOptions.length > 0 && (
                            <ChartDriverPicker
                              drivers={lapTrendDriverOptions}
                              selectedDriverIds={lapTrendChartDriverIds}
                              onSelectionChange={setLapTrendChartDriverIds}
                              label="Select Drivers"
                            />
                          )}
                        </div>
                      }
                      emptyMessage={
                        lapTrendLoading
                          ? "Loading lap data…"
                          : lapTrendError ??
                            (lapTrendChartDriverIds.length === 0
                              ? "No drivers selected for this chart. Use Drivers to add."
                              : "No lap data for selected drivers.")
                      }
                    />
                  </>
                )}
              </ChartSection>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
