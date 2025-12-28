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

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  startTransition,
  useRef,
} from "react"
import EventStats from "./EventStats"
import ChartControls from "./ChartControls"
import BestLapBarChart from "./BestLapBarChart"
import GapEvolutionLineChart from "./GapEvolutionLineChart"
import AvgVsFastestChart from "./AvgVsFastestChart"
import ChartSection from "./ChartSection"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { calculateGapEvolution } from "@/core/events/calculate-gap-evolution"
import { normalizeDriverName } from "@/core/users/name-normalizer"
import ChartDataNotice from "./ChartDataNotice"
import {
  getDriversMissingAvgVsFastest,
  getDriversMissingBestLap,
  getDriversMissingGapSeries,
} from "@/core/events/event-analysis-notices"
import { logger } from "@/lib/logger"

export interface OverviewTabProps {
  data: EventAnalysisData
  selectedDriverIds: string[]
  onDriverSelectionChange: (driverIds: string[]) => void
}

type ChartType = "best-lap" | "gap-evolution" | "avg-vs-fastest"

const STORAGE_KEY_CHART_TYPE = "mre-overview-chart-type"

export default function OverviewTab({
  data,
  selectedDriverIds,
  onDriverSelectionChange,
}: OverviewTabProps) {
  // Initialize with deterministic default and hydrate from localStorage on client
  const [chartType, setChartType] = useState<ChartType>("best-lap")
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const lastLoggedMissingState = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const storedChartType = window.localStorage.getItem(
      STORAGE_KEY_CHART_TYPE
    )
    if (
      storedChartType &&
      ["best-lap", "gap-evolution", "avg-vs-fastest"].includes(
        storedChartType
      )
    ) {
      startTransition(() => {
        setChartType(storedChartType as ChartType)
      })
    }
  }, [])

  const [paginationState, setPaginationState] = useState({
    page: 1,
    selectionKey: "",
  })
  const selectionKey = selectedDriverIds.join("|")
  const currentPage =
    paginationState.selectionKey === selectionKey
      ? paginationState.page
      : 1
  const driversPerPage = 25

  // Persist chart type to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_CHART_TYPE, chartType)
    }
  }, [chartType])

  // Filter races by selected class
  const filteredRaces = useMemo(() => {
    if (selectedClass === null) {
      return data.races
    }
    return data.races.filter((race) => race.className === selectedClass)
  }, [data.races, selectedClass])

  // Calculate driver stats from filtered races only
  const driverStatsByClass = useMemo(() => {
    const driverMap = new Map<
      string,
      {
        driverId: string
        driverName: string
        bestLapTime: number | null
        avgLapTimes: number[]
      }
    >()

    // Process each race in filtered races
    filteredRaces.forEach((race) => {
      race.results.forEach((result) => {
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
          if (
            driverData.bestLapTime === null ||
            result.fastLapTime < driverData.bestLapTime
          ) {
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
          ? driver.avgLapTimes.reduce((a, b) => a + b, 0) /
            driver.avgLapTimes.length
          : null

      return {
        driverId: driver.driverId,
        driverName: driver.driverName,
        bestLapTime: driver.bestLapTime,
        avgLapTime,
      }
    })
  }, [filteredRaces])

  // Prepare chart data
  const bestLapData = useMemo(() => {
    return driverStatsByClass
      .filter((d) => d.bestLapTime !== null && d.bestLapTime > 0 && isFinite(d.bestLapTime))
      .map((d) => ({
        driverId: d.driverId,
        driverName: d.driverName,
        bestLapTime: d.bestLapTime!,
      }))
      .sort((a, b) => a.bestLapTime - b.bestLapTime)
  }, [driverStatsByClass])

  const gapEvolutionData = useMemo(() => {
    const driverMap = new Map<
      string,
      {
        driverId: string
        driverName: string
        laps: Array<{
          lapNumber: number
          lapTimeSeconds: number
          elapsedRaceTime: number
          positionOnLap: number
        }>
      }
    >()

    filteredRaces.forEach((race) => {
      race.results.forEach((result) => {
        if (!driverMap.has(result.driverId)) {
          driverMap.set(result.driverId, {
            driverId: result.driverId,
            driverName: result.driverName,
            laps: [],
          })
        }
        const driverSeries = driverMap.get(result.driverId)!
        driverSeries.laps.push(
          ...result.laps.map((lap) => ({
            lapNumber: lap.lapNumber,
            lapTimeSeconds: lap.lapTimeSeconds,
            elapsedRaceTime: lap.elapsedRaceTime,
            positionOnLap: lap.positionOnLap,
          }))
        )
      })
    })

    const seriesArray = Array.from(driverMap.values())
    const bestLapLookup = new Map<string, number>()
    seriesArray.forEach((series) => {
      const fastestLap = series.laps.reduce((best, lap) => {
        return Math.min(best, lap.lapTimeSeconds)
      }, Infinity)
      bestLapLookup.set(series.driverId, fastestLap)
    })

    const gapSeries = calculateGapEvolution(seriesArray)
    return gapSeries.sort((a, b) => {
      const aLap = bestLapLookup.get(a.driverId) ?? Infinity
      const bLap = bestLapLookup.get(b.driverId) ?? Infinity
      return aLap - bLap
    })
  }, [filteredRaces])

  const avgVsFastestData = useMemo(() => {
    return driverStatsByClass
      .filter((d) => d.bestLapTime !== null && d.avgLapTime !== null)
      .map((d) => ({
        driverId: d.driverId,
        driverName: d.driverName,
        fastestLap: d.bestLapTime!,
        averageLap: d.avgLapTime!,
      }))
      .sort((a, b) => a.fastestLap - b.fastestLap)
  }, [driverStatsByClass])

  const driverOptions = useMemo(() => {
    return data.drivers.map((d) => ({
      driverId: d.driverId,
      driverName: d.driverName,
    }))
  }, [data.drivers])

  const driverNameLookup = useMemo(() => {
    const map = new Map<string, string>()
    data.drivers.forEach((driver) => {
      map.set(driver.driverId, driver.driverName)
    })
    data.races.forEach((race) => {
      race.results.forEach((result) => {
        if (!map.has(result.driverId)) {
          map.set(result.driverId, result.driverName)
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
    filteredRaces.forEach((race) => {
      race.results.forEach((result) => {
        const normalizedName = normalizeDriverName(result.driverName)
        if (selectedNormalizedNames.has(normalizedName)) {
          expandedIds.add(result.driverId)
        }
      })
    })
    
    // Also check all races (not just filtered) to catch drivers in other classes
    data.races.forEach((race) => {
      race.results.forEach((result) => {
        const normalizedName = normalizeDriverName(result.driverName)
        if (selectedNormalizedNames.has(normalizedName)) {
          expandedIds.add(result.driverId)
        }
      })
    })
    
    return Array.from(expandedIds)
  }, [selectedDriverIds, data.drivers, driverStatsByClass, filteredRaces, data.races])

  const shouldShowSelectionNotices = expandedSelectedDriverIds.length > 0

  const missingBestLapDriverIds = useMemo(() => {
    if (!shouldShowSelectionNotices) {
      return []
    }
    return getDriversMissingBestLap(
      expandedSelectedDriverIds,
      driverStatsByClass
    )
  }, [shouldShowSelectionNotices, expandedSelectedDriverIds, driverStatsByClass])

  const missingAvgVsFastestDriverIds = useMemo(() => {
    if (!shouldShowSelectionNotices) {
      return []
    }
    return getDriversMissingAvgVsFastest(
      expandedSelectedDriverIds,
      driverStatsByClass
    )
  }, [shouldShowSelectionNotices, expandedSelectedDriverIds, driverStatsByClass])

  const missingGapDriverIds = useMemo(() => {
    if (!shouldShowSelectionNotices) {
      return []
    }
    return getDriversMissingGapSeries(
      expandedSelectedDriverIds,
      gapEvolutionData
    )
  }, [shouldShowSelectionNotices, expandedSelectedDriverIds, gapEvolutionData])

  const mapDriverIdsToNames = useCallback(
    (driverIds: string[]) => {
      return driverIds.map((driverId) =>
        driverNameLookup.get(driverId) ?? "Unknown Driver"
      )
    },
    [driverNameLookup]
  )

  const missingBestLapDriverNames = useMemo(
    () => mapDriverIdsToNames(missingBestLapDriverIds),
    [mapDriverIdsToNames, missingBestLapDriverIds]
  )

  const missingAvgVsFastestDriverNames = useMemo(
    () => mapDriverIdsToNames(missingAvgVsFastestDriverIds),
    [mapDriverIdsToNames, missingAvgVsFastestDriverIds]
  )

  const missingGapDriverNames = useMemo(
    () => mapDriverIdsToNames(missingGapDriverIds),
    [mapDriverIdsToNames, missingGapDriverIds]
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

  const handleClassChange = useCallback((className: string | null) => {
    setSelectedClass(className)
    // Reset pagination when class changes
    setPaginationState({
      page: 1,
      selectionKey: "",
    })
    
    // Auto-select all drivers in the selected class
    if (className !== null) {
      // Get all drivers who raced in this class
      const driversInClass = new Set<string>()
      data.races
        .filter((race) => race.className === className)
        .forEach((race) => {
          race.results.forEach((result) => {
            driversInClass.add(result.driverId)
          })
        })
      
      // Select all drivers in this class
      const driverIdsArray = Array.from(driversInClass)
      handleSelectionChange(driverIdsArray)
    } else {
      // When "All Classes" is selected, clear selection
      handleSelectionChange([])
    }
  }, [data.races, handleSelectionChange])

  useEffect(() => {
    if (!shouldShowSelectionNotices) {
      lastLoggedMissingState.current = null
      return
    }

    if (
      missingBestLapDriverIds.length === 0 &&
      missingAvgVsFastestDriverIds.length === 0 &&
      missingGapDriverIds.length === 0
    ) {
      lastLoggedMissingState.current = null
      return
    }

    const payload = JSON.stringify({
      missingBestLapDriverIds,
      missingAvgVsFastestDriverIds,
      missingGapDriverIds,
    })

    if (lastLoggedMissingState.current === payload) {
      return
    }

    lastLoggedMissingState.current = payload

    logger.warn("event_analysis_missing_driver_metrics", {
      eventId: data.event.id,
      classFilter: selectedClass ?? "all",
      selectedDriverCount: expandedSelectedDriverIds.length,
      missingBestLapDriverIds,
      missingAvgVsFastestDriverIds,
      missingGapDriverIds,
    })
  }, [
    shouldShowSelectionNotices,
    missingBestLapDriverIds,
    missingAvgVsFastestDriverIds,
    missingGapDriverIds,
    data.event.id,
    selectedClass,
    expandedSelectedDriverIds.length,
  ])

  return (
    <div className="space-y-6" role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview">
      {/* Event Statistics */}
      <EventStats
        totalRaces={data.summary.totalRaces}
        totalDrivers={data.summary.totalDrivers}
        totalLaps={data.summary.totalLaps}
        dateRange={data.summary.dateRange}
      />

      {/* Chart Configuration Section */}
      <section className="space-y-4">
        <div className="border-b border-[var(--token-border-default)] pb-4">
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)] mb-1">
            Chart Configuration
          </h2>
          <p className="text-sm text-[var(--token-text-secondary)]">
            Select drivers and choose a chart type to visualize race performance data.
          </p>
        </div>

        <ChartControls
          drivers={driverOptions}
          races={data.races}
          selectedDriverIds={selectedDriverIds}
          onDriverSelectionChange={handleSelectionChange}
          chartType={chartType}
          onChartTypeChange={setChartType}
          onClassChange={handleClassChange}
        />
      </section>

      {/* Chart Visualization */}
      <section className="space-y-4">
        <div className="border-b border-[var(--token-border-default)] pb-4">
          <h2 className="text-lg font-semibold text-[var(--token-text-primary)] mb-1">
            Performance Visualization
          </h2>
          <p className="text-sm text-[var(--token-text-secondary)]">
            Interactive chart showing selected drivers' performance metrics.
          </p>
        </div>

        {chartType === "best-lap" && missingBestLapDriverNames.length > 0 && (
          <ChartDataNotice
            title="Some selected drivers have no recorded fastest lap"
            description="LiveRC did not publish a fastest lap for these drivers in the selected class, so they are hidden from the chart."
            driverNames={missingBestLapDriverNames}
          />
        )}

        {chartType === "avg-vs-fastest" &&
          missingAvgVsFastestDriverNames.length > 0 && (
            <ChartDataNotice
              title="Missing average lap telemetry"
              description="These drivers were selected, but the data feed does not include both fastest and average lap times for them."
              driverNames={missingAvgVsFastestDriverNames}
            />
          )}

        {chartType === "gap-evolution" && missingGapDriverNames.length > 0 && (
          <ChartDataNotice
            title="Gap evolution unavailable"
            description="The selected drivers below have no lap-by-lap telemetry in the current class, so their gap lines cannot be rendered."
            driverNames={missingGapDriverNames}
          />
        )}

        {/* Chart Section */}
        <ChartSection>
        {chartType === "best-lap" && (
          <BestLapBarChart
            data={bestLapData}
            selectedDriverIds={expandedSelectedDriverIds}
            currentPage={currentPage}
            driversPerPage={driversPerPage}
            onPageChange={handlePageChange}
            onDriverToggle={handleDriverToggle}
          />
        )}

        {chartType === "gap-evolution" && (
          <GapEvolutionLineChart
            data={gapEvolutionData}
            selectedDriverIds={expandedSelectedDriverIds}
            currentPage={currentPage}
            driversPerPage={driversPerPage}
            onPageChange={handlePageChange}
            onDriverToggle={handleDriverToggle}
          />
        )}

        {chartType === "avg-vs-fastest" && (
          <AvgVsFastestChart
            data={avgVsFastestData}
            selectedDriverIds={expandedSelectedDriverIds}
            currentPage={currentPage}
            driversPerPage={driversPerPage}
            onPageChange={handlePageChange}
            onDriverToggle={handleDriverToggle}
          />
        )}
      </ChartSection>
      </section>
    </div>
  )
}
