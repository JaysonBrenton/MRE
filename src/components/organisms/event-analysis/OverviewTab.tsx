/**
 * @fileoverview Overview tab component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-04-03
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
import EventTopFastestLapsPerClassTable from "./EventTopFastestLapsPerClassTable"
import EventTopAverageLapsPerClassTable from "./EventTopAverageLapsPerClassTable"
import EventFastestLapsTable from "./EventFastestLapsTable"
import EventFastestAverageLapsTable from "./EventFastestAverageLapsTable"
import EventTopMostImprovedPerClassTable from "./EventTopMostImprovedPerClassTable"
import EventMostImprovedTable from "./EventMostImprovedTable"
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
import EventWinnersTable from "./EventWinnersTable"
import {
  getDriversMissingAvgVsFastest,
  getDriversMissingBestLap,
  getUnselectedDriversInClass,
} from "@/core/events/event-analysis-notices"
import { clientLogger } from "@/lib/client-logger"
import { getValidClasses } from "@/core/events/class-validator"
import { Facebook, MapPin, Calendar, Phone, Globe, Mail } from "lucide-react"
import { formatDateLong } from "@/lib/date-utils"
import Tooltip from "@/components/molecules/Tooltip"

/** Compute driver stats from a set of races (for chart display and sorting) */
function computeDriverStatsFromRaces(
  races: Array<{
    raceLabel: string
    results: Array<{
      driverId: string
      driverName: string
      lapsCompleted: number
      fastLapTime: number | null
      avgLapTime: number | null
      consistency: number | null
      positionFinal: number
    }>
  }>
): Array<{
  driverId: string
  driverName: string
  bestLapTime: number | null
  bestLapRaceLabel: string | null
  avgLapTime: number | null
  averagePosition: number | null
  gapToFastest: number | null
  podiumFinishes: number
  averageConsistency: number | null
}> {
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

  races.forEach((race) => {
    race.results.forEach((result) => {
      if (result.lapsCompleted === 0) return

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

      if (result.fastLapTime !== null) {
        if (driverData.bestLapTime === null || result.fastLapTime < driverData.bestLapTime) {
          driverData.bestLapTime = result.fastLapTime
          driverData.bestLapRaceLabel = race.raceLabel
        }
      }

      if (result.avgLapTime !== null) driverData.avgLapTimes.push(result.avgLapTime)
      if (result.consistency !== null) driverData.consistencies.push(result.consistency)
      driverData.positions.push(result.positionFinal)
    })
  })

  let fastestLapInClass: number | null = null
  for (const driver of driverMap.values()) {
    if (driver.bestLapTime !== null) {
      if (fastestLapInClass === null || driver.bestLapTime < fastestLapInClass) {
        fastestLapInClass = driver.bestLapTime
      }
    }
  }

  return Array.from(driverMap.values()).map((driver) => {
    const avgLapTime =
      driver.avgLapTimes.length > 0
        ? driver.avgLapTimes.reduce((a, b) => a + b, 0) / driver.avgLapTimes.length
        : null

    const averagePosition =
      driver.positions.length > 0
        ? driver.positions.reduce((a, b) => a + b, 0) / driver.positions.length
        : null

    const gapToFastest =
      driver.bestLapTime !== null && fastestLapInClass !== null
        ? driver.bestLapTime - fastestLapInClass
        : null

    const podiumFinishes = driver.positions.filter((pos) => pos >= 1 && pos <= 3).length

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
}

export interface OverviewTabProps {
  data: EventAnalysisData
  selectedDriverIds: string[]
  onDriverSelectionChange: (driverIds: string[]) => void
  selectedClass: string | null
  onClassChange: (className: string | null) => void
}

const eventAnalysisTabs = [
  { id: "event-results", label: "Session Results" },
  { id: "fastest-laps", label: "Fastest Laps" },
  { id: "fastest-average-laps", label: "Fastest Average Laps" },
  { id: "most-improved-drivers", label: "Most Improved Drivers" },
  { id: "driver-analysis", label: "Driver Analysis" },
] as const

type EventAnalysisTabId = (typeof eventAnalysisTabs)[number]["id"]

export default function OverviewTab({
  data,
  selectedDriverIds,
  onDriverSelectionChange,
  selectedClass,
  onClassChange,
}: OverviewTabProps) {
  const lastLoggedMissingState = useRef<string | null>(null)
  const lastLoggedUnselectedInClassState = useRef<string | null>(null)

  const [weatherByDay, setWeatherByDay] = useState<Array<{
    date: string
    weather: EventWeatherData
  }> | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [isEventOverviewOpen, setIsEventOverviewOpen] = useState(true)
  const [isSessionAnalysisSectionOpen, setIsSessionAnalysisSectionOpen] = useState(true)
  const [isEventAnalysisSectionOpen, setIsEventAnalysisSectionOpen] = useState(true)
  const [isDriverPerformanceOpen, setIsDriverPerformanceOpen] = useState(false)
  const [isLapTrendOpen, setIsLapTrendOpen] = useState(false)
  const [isVenueInfoOpen, setIsVenueInfoOpen] = useState(false)
  const [isEventWeatherDataOpen, setIsEventWeatherDataOpen] = useState(false)
  const [eventAnalysisTab, setEventAnalysisTab] = useState<EventAnalysisTabId>("fastest-laps")
  const [eventClassFilter, setEventClassFilter] = useState<string | null>(null)
  const classFilterButtonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const eventSectionClassFilterButtonRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    queueMicrotask(() => setEventAnalysisTab("fastest-laps"))
  }, [data.event.id])

  useEffect(() => {
    const eventId = data.event.id
    if (!eventId) {
      queueMicrotask(() => {
        setWeatherByDay(null)
        setWeatherError(null)
      })
      return
    }
    queueMicrotask(() => {
      setWeatherLoading(true)
      setWeatherError(null)
    })
    const url = `/api/v1/events/${eventId}/weather?perDay=true`
    fetch(url, { cache: "no-store" })
      .then(async (response) => {
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
        if (result.success && result.data?.days && Array.isArray(result.data.days)) {
          return result.data.days as Array<{ date: string; weather: EventWeatherData }>
        }
        setWeatherError("Invalid response from server")
        return null
      })
      .then((days) => {
        if (days) {
          setWeatherByDay(days)
          setWeatherError(null)
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
  // Lap-trend section: class filter for driver picker only (independent of global selectedClass)
  const [lapTrendSelectedClass, setLapTrendSelectedClass] = useState<string | null>(null)
  // Lap-trend sort: order drivers in chart/legend by this metric
  const [lapTrendSortBy] = useState<
    "bestLap" | "averageLap" | "consistency" | "gapToFastest" | "averagePosition" | "podiumFinishes"
  >("bestLap")
  const driversPerPage = 25
  const MAX_LAP_TREND_DRIVERS = 8

  const eventClassFilterTabs: EventAnalysisTabId[] = [
    "event-results",
    "fastest-laps",
    "fastest-average-laps",
    "most-improved-drivers",
  ]

  // Get race classes from entry list
  const validClasses = useMemo(() => getValidClasses(data), [data])

  // Filter races by selected class
  const filteredRaces = useMemo(() => {
    if (selectedClass === null) {
      return data.races
    }
    return data.races.filter((race) => race.className === selectedClass)
  }, [data.races, selectedClass])

  const eventLevelFilteredRaces = useMemo(() => {
    if (!eventClassFilter) return data.races
    return data.races.filter((race) => race.className === eventClassFilter)
  }, [data.races, eventClassFilter])

  // Lap-trend: races filtered by lap-trend-specific class (independent of global selectedClass)
  const lapTrendFilteredRaces = useMemo(() => {
    if (lapTrendSelectedClass === null) {
      return data.races
    }
    return data.races.filter((race) => race.className === lapTrendSelectedClass)
  }, [data.races, lapTrendSelectedClass])

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
  const driverStatsByClass = useMemo(
    () => computeDriverStatsFromRaces(filteredRaces),
    [filteredRaces]
  )

  // Lap-trend: driver stats from lap-trend-filtered races (for ChartDriverPicker options and sorting)
  const lapTrendDriverStats = useMemo(
    () => computeDriverStatsFromRaces(lapTrendFilteredRaces),
    [lapTrendFilteredRaces]
  )

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
          if (
            result.lapsCompleted > 0 &&
            selectedNormalizedNames.has(normalizeDriverName(result.driverName))
          ) {
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
      queueMicrotask(() => setUnifiedChartDriverIds(selectedDriverIds))
    }
  }, [data.event.id, selectedClass, selectedDriverIds])

  // When event changes, reset lap trend state
  useEffect(() => {
    queueMicrotask(() => {
      setLapTrendChartDriverIds([])
      setLapTrendSelectedClass(null)
    })
  }, [data.event.id])

  // When lap-trend class filter changes, clear driver selection (user re-picks from filtered list)
  useEffect(() => {
    queueMicrotask(() => setLapTrendChartDriverIds([]))
  }, [lapTrendSelectedClass])

  // Fetch lap-by-lap trend for drivers selected in the chart (lapTrendChartDriverIds)
  useEffect(() => {
    if (lapTrendChartDriverIds.length === 0) {
      queueMicrotask(() => {
        setLapTrendData(null)
        setLapTrendError(null)
      })
      return
    }
    queueMicrotask(() => {
      setLapTrendLoading(true)
      setLapTrendError(null)
    })
    const params = new URLSearchParams({
      driverIds: lapTrendChartDriverIds.join(","),
    })
    if (lapTrendSelectedClass) params.set("className", lapTrendSelectedClass)
    const url = `/api/v1/events/${data.event.id}/lap-trend?${params.toString()}`
    fetch(url, { cache: "no-store", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          const message = err?.error?.message ?? `Failed to load lap trend (${res.status})`
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
  }, [data.event.id, lapTrendChartDriverIds, lapTrendSelectedClass])

  // Lap-trend driver options: drivers from lap-trend class filter, in global selection (for ChartDriverPicker)
  const lapTrendDriverOptions = useMemo(
    () =>
      lapTrendDriverStats
        .filter((d) => expandedSelectedDriverIds.includes(d.driverId))
        .map((d) => ({ driverId: d.driverId, driverName: d.driverName })),
    [lapTrendDriverStats, expandedSelectedDriverIds]
  )

  // Sort lap-trend drivers by selected metric (order in chart/legend)
  const sortedLapTrendDrivers = useMemo(() => {
    if (!lapTrendData?.drivers?.length) return []
    const statsMap = new Map(lapTrendDriverStats.map((d) => [d.driverId, d]))
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
  }, [lapTrendData, lapTrendDriverStats, lapTrendSortBy])

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
      queueMicrotask(() => setSelectAllClickedForCurrentClass(false))
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

  const handleEventClassFilterClick = useCallback((className: string) => {
    setEventClassFilter((prev) => (prev === className ? null : className))
  }, [])

  const handleEventClassFilterKeyDown = useCallback(
    (
      event: React.KeyboardEvent<HTMLButtonElement>,
      index: number,
      refs: React.MutableRefObject<Array<HTMLButtonElement | null>>
    ) => {
      if (validClasses.length === 0) return
      const totalButtons = validClasses.length + 1
      let nextIndex = index
      if (event.key === "ArrowRight") {
        nextIndex = (index + 1) % totalButtons
      } else if (event.key === "ArrowLeft") {
        nextIndex = (index - 1 + totalButtons) % totalButtons
      } else {
        return
      }
      event.preventDefault()
      const nextButton = refs.current[nextIndex]
      nextButton?.focus()
    },
    [validClasses.length]
  )

  const handleEventClassFilterAllClassesClick = useCallback(() => {
    setEventClassFilter(null)
  }, [])

  const handleClassChange = useCallback(
    (className: string | null) => {
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

  const handleSessionClassChipClick = useCallback(
    (className: string) => {
      if (selectedClass === className) {
        handleClassChange(null)
      } else {
        handleClassChange(className)
      }
    },
    [selectedClass, handleClassChange]
  )

  const handleSessionClassFilterAllClassesClick = useCallback(() => {
    handleClassChange(null)
  }, [handleClassChange])

  /** Default Event Analysis class filter to first entry list class when event (or class list) loads. */
  const eventClassFilterInitRef = useRef<{ eventId: string; applied: boolean }>({
    eventId: "",
    applied: false,
  })
  useEffect(() => {
    const eventId = data.event.id
    if (eventClassFilterInitRef.current.eventId !== eventId) {
      eventClassFilterInitRef.current = { eventId, applied: false }
    }
    if (validClasses.length === 0) return
    if (!eventClassFilterInitRef.current.applied) {
      eventClassFilterInitRef.current.applied = true
      queueMicrotask(() => {
        setEventClassFilter(validClasses[0] ?? null)
      })
    }
  }, [data.event.id, validClasses])

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
        queueMicrotask(() => handleSelectionChange(allDriverIds))
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

  useEffect(() => {
    if (
      !selectedClass ||
      selectedDriverIds.length === 0 ||
      unselectedDriversInClassIds.length === 0
    ) {
      lastLoggedUnselectedInClassState.current = null
      return
    }

    const payload = JSON.stringify({
      eventId: data.event.id,
      selectedClass,
      unselectedDriverIds: [...unselectedDriversInClassIds].sort(),
    })

    if (lastLoggedUnselectedInClassState.current === payload) {
      return
    }

    lastLoggedUnselectedInClassState.current = payload

    clientLogger.info("event_analysis_unselected_drivers_in_class", {
      eventId: data.event.id,
      selectedClass,
      unselectedDriverIds: unselectedDriversInClassIds,
      unselectedDriverNames: unselectedDriversInClassNames,
    })
  }, [
    selectedClass,
    selectedDriverIds.length,
    unselectedDriversInClassIds,
    unselectedDriversInClassNames,
    data.event.id,
  ])

  const eventOverviewSectionContentId = "event-overview-section-content"
  const sessionAnalysisSectionContentId = "session-analysis-section-content"
  const eventAnalysisSectionContentId = "event-analysis-section-content"
  const driverPerformanceContentId = "driver-performance-content"
  const lapTrendContentId = "lap-trend-content"

  return (
    <div
      className="space-y-6"
      role="tabpanel"
      id="tabpanel-overview"
      aria-labelledby="tab-overview"
    >
      {/* Event headline metrics (collapsible) */}
      <section className="space-y-3">
        <h2
          id="event-overview-heading"
          className="text-lg font-semibold text-[var(--token-text-primary)]"
        >
          <button
            type="button"
            className="flex w-full items-center justify-start gap-2 px-0 py-0 text-left transition-colors hover:text-[var(--token-accent)] hover:opacity-90"
            aria-expanded={isEventOverviewOpen}
            aria-controls={eventOverviewSectionContentId}
            onClick={() => setIsEventOverviewOpen((prev) => !prev)}
          >
            <span>
              <span className="underline decoration-2 underline-offset-2 decoration-[var(--token-accent)]">
                Event
              </span>{" "}
              <span className="underline decoration-2 underline-offset-2 decoration-[var(--token-accent)]">
                Overview
              </span>
            </span>
            <span
              className={`shrink-0 transition-transform duration-150 ${
                isEventOverviewOpen ? "rotate-0" : "-rotate-90"
              }`}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>
        </h2>
        {isEventOverviewOpen && (
          <div id={eventOverviewSectionContentId} className="space-y-3">
            <div
              className="flex flex-col flex-wrap gap-4 rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60 px-4 py-4 shadow-sm transition-colors hover:border-[var(--token-accent-soft-border)] hover:bg-[var(--token-surface-elevated)]/80 sm:flex-row sm:items-center sm:justify-between"
              style={{
                backgroundColor: "var(--glass-bg)",
                backdropFilter: "var(--glass-blur)",
                borderRadius: 16,
                border: "1px solid var(--glass-border)",
                boxShadow: "var(--glass-shadow)",
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="mt-1 flex items-center gap-3">
                  <div className="min-w-0 max-w-full">
                    {data.event.eventUrl ? (
                      <Tooltip text="Click to view this event on LiveRC.com" position="top">
                        <a
                          href={data.event.eventUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 max-w-full items-center gap-1.5 text-base font-semibold text-[var(--token-text-primary)] decoration-[var(--token-accent)]/50 underline-offset-4 transition-colors hover:text-[var(--token-accent)] hover:underline hover:decoration-[var(--token-accent)]"
                          aria-label="View event on LiveRC (opens in new tab)"
                        >
                          <MapPin
                            className="h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                            aria-hidden
                          />
                          <span className="truncate">{data.event.trackName}</span>
                        </a>
                      </Tooltip>
                    ) : (
                      <h2 className="flex min-w-0 items-center gap-1.5 text-base font-semibold text-[var(--token-text-primary)]">
                        <MapPin
                          className="h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                          aria-hidden
                        />
                        <span className="truncate">{data.event.trackName}</span>
                      </h2>
                    )}
                  </div>
                  {(() => {
                    const dr = data.summary.dateRange
                    const hasDateRange = dr && (dr.earliest || dr.latest)
                    if (!hasDateRange) return null
                    const earliestStr = dr.earliest ? formatDateLong(dr.earliest) : ""
                    const latestStr = dr.latest ? formatDateLong(dr.latest) : ""
                    const dateRangeStr =
                      earliestStr && latestStr && earliestStr === latestStr
                        ? earliestStr
                        : `${earliestStr}${earliestStr && latestStr ? " – " : ""}${latestStr}`
                    return (
                      <>
                        <div
                          className="h-4 w-px shrink-0 bg-[var(--token-border-default)]"
                          aria-hidden
                        />
                        <span className="text-sm text-[var(--token-text-secondary)]">
                          {dateRangeStr}
                        </span>
                      </>
                    )
                  })()}
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-x-6 gap-y-2 text-right sm:text-left sm:pl-4 sm:border-l sm:border-[var(--token-border-subtle)]">
                <div className="flex flex-col">
                  <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]">
                    Races
                  </span>
                  <span className="text-xl font-semibold text-[var(--token-text-primary)]">
                    {data.summary.totalRaces}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]">
                    Drivers
                  </span>
                  <span className="text-xl font-semibold text-[var(--token-text-primary)]">
                    {data.summary.totalDrivers}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]">
                    Entries
                  </span>
                  <span className="text-xl font-semibold text-[var(--token-text-primary)]">
                    {data.entryList.length}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]">
                    Total Laps
                  </span>
                  <span className="text-xl font-semibold text-[var(--token-text-primary)]">
                    {data.summary.totalLaps.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[0.7rem] font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]">
                    Total Classes
                  </span>
                  <span className="text-xl font-semibold text-[var(--token-text-primary)]">
                    {data.raceClasses.size}
                  </span>
                </div>
              </div>

              {/* Collapsible Venue info */}
              {(() => {
                const dr = data.summary.dateRange
                const hasDateRange = dr && (dr.earliest || dr.latest)
                const hasAddress = !!(
                  data.event.address &&
                  typeof data.event.address === "string" &&
                  data.event.address.trim()
                )
                const hasPhone = !!(
                  data.event.phone &&
                  typeof data.event.phone === "string" &&
                  data.event.phone.trim()
                )
                const hasWebsite = !!(
                  data.event.website &&
                  typeof data.event.website === "string" &&
                  data.event.website.trim()
                )
                const hasEmail = !!(
                  data.event.email &&
                  typeof data.event.email === "string" &&
                  data.event.email.trim()
                )
                const hasFacebook = !!(
                  data.event.facebookUrl &&
                  typeof data.event.facebookUrl === "string" &&
                  data.event.facebookUrl.trim()
                )
                const hasVenueInfo =
                  hasDateRange || hasAddress || hasPhone || hasWebsite || hasEmail || hasFacebook
                if (!hasVenueInfo) return null

                const dateRangeStr = (() => {
                  if (!hasDateRange) return null
                  const earliestStr = dr.earliest ? formatDateLong(dr.earliest) : ""
                  const latestStr = dr.latest ? formatDateLong(dr.latest) : ""
                  if (earliestStr && latestStr && earliestStr === latestStr) return earliestStr
                  return `${earliestStr}${earliestStr && latestStr ? " – " : ""}${latestStr}`
                })()

                const venueInfoContentId = "venue-info-content"
                return (
                  <div className="w-full shrink-0 basis-full border-t border-[var(--token-border-default)] pt-4">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-left text-sm font-medium text-[var(--token-text-secondary)] transition-colors hover:text-[var(--token-text-primary)]"
                      aria-expanded={isVenueInfoOpen}
                      aria-controls={venueInfoContentId}
                      onClick={() => setIsVenueInfoOpen((prev) => !prev)}
                    >
                      <span>Venue info</span>
                      <span
                        className={`shrink-0 transition-transform duration-150 ${
                          isVenueInfoOpen ? "rotate-0" : "-rotate-90"
                        }`}
                        aria-hidden
                      >
                        ▾
                      </span>
                    </button>
                    {isVenueInfoOpen && (
                      <div
                        id={venueInfoContentId}
                        className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2"
                      >
                        {dateRangeStr && (
                          <div className="flex items-start gap-2">
                            <Calendar
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                              aria-hidden
                            />
                            <span className="text-[var(--token-text-primary)]">{dateRangeStr}</span>
                          </div>
                        )}
                        {hasAddress && (
                          <div className="flex items-start gap-2">
                            <MapPin
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                              aria-hidden
                            />
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[var(--token-text-primary)]">
                                {data.event.address}
                              </span>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.event.address!)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--token-accent)] underline-offset-2 hover:underline"
                              >
                                Open in Maps
                              </a>
                            </span>
                          </div>
                        )}
                        {hasPhone && (
                          <div className="flex items-start gap-2">
                            <Phone
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                              aria-hidden
                            />
                            <a
                              href={`tel:${data.event.phone!.replace(/\s/g, "")}`}
                              className="text-[var(--token-text-primary)] text-[var(--token-accent)] underline-offset-2 hover:underline"
                            >
                              {data.event.phone}
                            </a>
                          </div>
                        )}
                        {hasWebsite && (
                          <div className="flex items-start gap-2">
                            <Globe
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                              aria-hidden
                            />
                            <a
                              href={
                                data.event.website!.startsWith("http")
                                  ? data.event.website!
                                  : `https://${data.event.website}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-[var(--token-text-primary)] text-[var(--token-accent)] underline-offset-2 hover:underline"
                            >
                              {data.event.website}
                            </a>
                          </div>
                        )}
                        {hasFacebook && (
                          <div className="flex items-start gap-2">
                            <Facebook
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                              aria-hidden
                            />
                            <a
                              href={data.event.facebookUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="truncate text-[var(--token-text-primary)] text-[var(--token-accent)] underline-offset-2 hover:underline"
                            >
                              View on Facebook
                            </a>
                          </div>
                        )}
                        {hasEmail && (
                          <div className="flex items-start gap-2">
                            <Mail
                              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--token-text-muted)]"
                              aria-hidden
                            />
                            <a
                              href={`mailto:${data.event.email}`}
                              className="truncate text-[var(--token-text-primary)] text-[var(--token-accent)] underline-offset-2 hover:underline"
                            >
                              {data.event.email}
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Collapsible Event Weather Data */}
              <div className="w-full shrink-0 basis-full border-t border-[var(--token-border-default)] pt-4">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-left text-sm font-medium text-[var(--token-text-secondary)] transition-colors hover:text-[var(--token-text-primary)]"
                  aria-expanded={isEventWeatherDataOpen}
                  aria-controls="event-weather-data-content"
                  onClick={() => setIsEventWeatherDataOpen((prev) => !prev)}
                >
                  <span>Event Weather Data</span>
                  <span
                    className={`shrink-0 transition-transform duration-150 ${
                      isEventWeatherDataOpen ? "rotate-0" : "-rotate-90"
                    }`}
                    aria-hidden
                  >
                    ▾
                  </span>
                </button>
                {isEventWeatherDataOpen && (
                  <div id="event-weather-data-content" className="mt-3 flex flex-wrap gap-4">
                    {weatherLoading ? (
                      <WeatherCard weather={null} weatherLoading={true} weatherError={null} />
                    ) : weatherError ? (
                      <WeatherCard
                        weather={null}
                        weatherLoading={false}
                        weatherError={weatherError}
                      />
                    ) : weatherByDay && weatherByDay.length > 0 ? (
                      weatherByDay.map(({ date, weather }) => (
                        <div key={date} className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-[var(--token-text-secondary)]">
                            {formatDateLong(date)}
                          </span>
                          <WeatherCard
                            weather={weather}
                            weatherLoading={false}
                            weatherError={null}
                          />
                        </div>
                      ))
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2
          id="session-analysis-heading"
          className="text-lg font-semibold text-[var(--token-text-primary)]"
        >
          <button
            type="button"
            className="flex w-full items-center justify-start gap-2 px-0 py-0 text-left transition-colors hover:text-[var(--token-accent)] hover:opacity-90"
            aria-expanded={isSessionAnalysisSectionOpen}
            aria-controls={sessionAnalysisSectionContentId}
            onClick={() => setIsSessionAnalysisSectionOpen((prev) => !prev)}
          >
            <span>
              <span className="underline decoration-2 underline-offset-2 decoration-[var(--token-accent)]">
                Session
              </span>{" "}
              <span className="underline decoration-2 underline-offset-2 decoration-[var(--token-accent)]">
                Analysis
              </span>
            </span>
            <span
              className={`shrink-0 transition-transform duration-150 ${
                isSessionAnalysisSectionOpen ? "rotate-0" : "-rotate-90"
              }`}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>
        </h2>
        {isSessionAnalysisSectionOpen && (
          <div id={sessionAnalysisSectionContentId} className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/80 px-3 py-2 shadow-sm">
              <div className="min-w-0 flex-1 overflow-x-auto">
                <div className="flex min-w-max">
                  {eventAnalysisTabs.map((tab) => {
                    const isActive = eventAnalysisTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                          isActive
                            ? "border-[var(--token-accent)] text-[var(--token-accent)]"
                            : "border-transparent text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)]"
                        }`}
                        onClick={() => setEventAnalysisTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            {eventClassFilterTabs.includes(eventAnalysisTab) && validClasses.length > 0 && (
              <div
                className="mt-2 -mx-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
                role="toolbar"
                aria-label="Filter session analysis by class (charts and driver selection). All Classes shows every class; it is the last control."
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              >
                <div className="flex min-w-max gap-2 px-1 py-1 [scroll-snap-type:x_mandatory]">
                  {validClasses.map((className, index) => {
                    const isActive = selectedClass === className
                    return (
                      <button
                        key={className}
                        type="button"
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] [scroll-snap-align:start] ${
                          isActive
                            ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                            : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60"
                        }`}
                        onClick={(event) => {
                          handleSessionClassChipClick(className)
                          event.currentTarget.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                            inline: "center",
                          })
                        }}
                        aria-pressed={isActive}
                        onKeyDown={(event) =>
                          handleEventClassFilterKeyDown(event, index, classFilterButtonRefs)
                        }
                        ref={(el) => {
                          classFilterButtonRefs.current[index] = el
                        }}
                      >
                        <span>{className}</span>
                      </button>
                    )
                  })}
                  <button
                    key="__all-classes__"
                    type="button"
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] [scroll-snap-align:start] ${
                      selectedClass === null
                        ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                        : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60"
                    }`}
                    onClick={(event) => {
                      handleSessionClassFilterAllClassesClick()
                      event.currentTarget.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "center",
                      })
                    }}
                    aria-pressed={selectedClass === null}
                    onKeyDown={(event) =>
                      handleEventClassFilterKeyDown(
                        event,
                        validClasses.length,
                        classFilterButtonRefs
                      )
                    }
                    ref={(el) => {
                      classFilterButtonRefs.current[validClasses.length] = el
                    }}
                  >
                    <span>All Classes</span>
                  </button>
                </div>
              </div>
            )}
            {eventAnalysisTab === "event-results" && (
              <EventWinnersTable
                races={
                  selectedClass && eventClassFilterTabs.includes("event-results")
                    ? filteredRaces
                    : data.races
                }
              />
            )}
            {eventAnalysisTab === "fastest-laps" && (
              <EventFastestLapsTable
                races={
                  selectedClass && eventClassFilterTabs.includes("fastest-laps")
                    ? filteredRaces
                    : data.races
                }
              />
            )}
            {eventAnalysisTab === "fastest-average-laps" && (
              <EventFastestAverageLapsTable
                races={
                  selectedClass && eventClassFilterTabs.includes("fastest-average-laps")
                    ? filteredRaces
                    : data.races
                }
              />
            )}
            {eventAnalysisTab === "most-improved-drivers" && (
              <EventMostImprovedTable
                races={
                  selectedClass && eventClassFilterTabs.includes("most-improved-drivers")
                    ? filteredRaces
                    : data.races
                }
                isPracticeDay={data.isPracticeDay}
              />
            )}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2
          id="event-analysis-heading"
          className="text-lg font-semibold text-[var(--token-text-primary)]"
        >
          <button
            type="button"
            className="flex w-full items-center justify-start gap-2 px-0 py-0 text-left transition-colors hover:text-[var(--token-accent)] hover:opacity-90"
            aria-expanded={isEventAnalysisSectionOpen}
            aria-controls={eventAnalysisSectionContentId}
            onClick={() => setIsEventAnalysisSectionOpen((prev) => !prev)}
          >
            <span>
              <span className="underline decoration-2 underline-offset-2 decoration-[var(--token-accent)]">
                Event
              </span>{" "}
              <span className="underline decoration-2 underline-offset-2 decoration-[var(--token-accent)]">
                Analysis
              </span>
            </span>
            <span
              className={`shrink-0 transition-transform duration-150 ${
                isEventAnalysisSectionOpen ? "rotate-0" : "-rotate-90"
              }`}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>
        </h2>
        {isEventAnalysisSectionOpen && (
          <>
            <div id={eventAnalysisSectionContentId} className="space-y-6">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/80 px-3 py-2 shadow-sm">
                <div className="min-w-0 flex-1 overflow-x-auto">
                  <div className="flex min-w-max">
                    {eventAnalysisTabs
                      .filter((tab) => tab.id !== "event-results")
                      .map((tab) => {
                        const isActive = eventAnalysisTab === tab.id
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                              isActive
                                ? "border-[var(--token-accent)] text-[var(--token-accent)]"
                                : "border-transparent text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)]"
                            }`}
                            onClick={() => setEventAnalysisTab(tab.id)}
                          >
                            {tab.label}
                          </button>
                        )
                      })}
                  </div>
                </div>
              </div>
              {eventClassFilterTabs.includes(eventAnalysisTab) && validClasses.length > 0 && (
                <div
                  className="mt-2 -mx-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
                  role="toolbar"
                  aria-label="Filter event analysis by class (event section). All Classes shows every class; it is the last control."
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  <div className="flex min-w-max gap-2 px-1 py-1 [scroll-snap-type:x_mandatory]">
                    {validClasses.map((className, index) => {
                      const isActive = eventClassFilter === className
                      return (
                        <button
                          key={className}
                          type="button"
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] [scroll-snap-align:start] ${
                            isActive
                              ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                              : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60"
                          }`}
                          onClick={(event) => {
                            handleEventClassFilterClick(className)
                            event.currentTarget.scrollIntoView({
                              behavior: "smooth",
                              block: "nearest",
                              inline: "center",
                            })
                          }}
                          aria-pressed={isActive}
                          onKeyDown={(event) =>
                            handleEventClassFilterKeyDown(
                              event,
                              index,
                              eventSectionClassFilterButtonRefs
                            )
                          }
                          ref={(el) => {
                            eventSectionClassFilterButtonRefs.current[index] = el
                          }}
                        >
                          <span>{className}</span>
                        </button>
                      )
                    })}
                    <button
                      key="__event-section-all-classes__"
                      type="button"
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] [scroll-snap-align:start] ${
                        eventClassFilter === null
                          ? "border-[var(--token-accent)] bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
                          : "border-[var(--token-border-subtle)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/60"
                      }`}
                      onClick={(event) => {
                        handleEventClassFilterAllClassesClick()
                        event.currentTarget.scrollIntoView({
                          behavior: "smooth",
                          block: "nearest",
                          inline: "center",
                        })
                      }}
                      aria-pressed={eventClassFilter === null}
                      onKeyDown={(event) =>
                        handleEventClassFilterKeyDown(
                          event,
                          validClasses.length,
                          eventSectionClassFilterButtonRefs
                        )
                      }
                      ref={(el) => {
                        eventSectionClassFilterButtonRefs.current[validClasses.length] = el
                      }}
                    >
                      <span>All Classes</span>
                    </button>
                  </div>
                </div>
              )}
              {eventAnalysisTab === "fastest-laps" && (
                <EventTopFastestLapsPerClassTable
                  races={eventClassFilter ? eventLevelFilteredRaces : data.races}
                />
              )}
              {eventAnalysisTab === "fastest-average-laps" && (
                <EventTopAverageLapsPerClassTable
                  races={eventClassFilter ? eventLevelFilteredRaces : data.races}
                />
              )}
              {eventAnalysisTab === "most-improved-drivers" && (
                <EventTopMostImprovedPerClassTable
                  races={eventClassFilter ? eventLevelFilteredRaces : data.races}
                  isPracticeDay={data.isPracticeDay}
                />
              )}
            </div>

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
                      <span>Driver Performance Comparison</span>
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
                        allDriversInClassSelected={
                          allDriversInClassSelected && selectAllClickedForCurrentClass
                        }
                        chartView={chartViewState}
                        onChartViewChange={setChartViewState}
                        chartDriverOptions={driverStatsByClass.map((d) => ({
                          driverId: d.driverId,
                          driverName: d.driverName,
                        }))}
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
                      <span>Driver Analysis</span>
                      <span className="mt-0.5 truncate text-xs font-normal text-[var(--token-text-secondary)]">
                        Track each driver&apos;s pace across every session. Use Actions to filter by
                        class and pick drivers.
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
                          Select drivers via Actions (class or Select Drivers) to view lap-by-lap
                          trend.
                        </div>
                      ) : (
                        <>
                          {lapTrendDriverOptions.length > MAX_LAP_TREND_DRIVERS &&
                            lapTrendChartDriverIds.length === MAX_LAP_TREND_DRIVERS && (
                              <p className="mb-2 text-sm text-[var(--token-text-secondary)]">
                                Showing first {MAX_LAP_TREND_DRIVERS} of{" "}
                                {lapTrendDriverOptions.length} selected. Use Drivers to add or
                                change.
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
                              lapTrendSelectedClass === null
                                ? "All Classes"
                                : (lapTrendSelectedClass ?? "All Classes")
                            }
                            headerControls={
                              <div className="flex flex-wrap items-center gap-4">
                                {validClasses.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-[var(--token-text-secondary)]">
                                      Choose a Class:
                                    </span>
                                    <select
                                      value={lapTrendSelectedClass ?? ""}
                                      onChange={(e) =>
                                        setLapTrendSelectedClass(e.target.value || null)
                                      }
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
                                    singleSelect
                                    disabled={lapTrendSelectedClass === null}
                                    disabledTooltip="Select a class first to choose drivers"
                                  />
                                )}
                              </div>
                            }
                            emptyMessage={
                              lapTrendLoading
                                ? "Loading lap data…"
                                : (lapTrendError ??
                                  (lapTrendChartDriverIds.length === 0
                                    ? "Select a class above, then choose a driver from that class to view lap-by-lap data."
                                    : "No lap data for selected drivers."))
                            }
                          />
                        </>
                      )}
                    </ChartSection>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </section>
    </div>
  )
}
