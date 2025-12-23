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

import { useState, useMemo, useEffect, useCallback } from "react"
import EventStats from "./EventStats"
import ChartControls from "./ChartControls"
import BestLapBarChart from "./BestLapBarChart"
import GapEvolutionLineChart from "./GapEvolutionLineChart"
import AvgVsFastestChart from "./AvgVsFastestChart"
import ChartSection from "./ChartSection"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { calculateTopNGapEvolution } from "@/core/events/calculate-gap-evolution"

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
  // Initialize with default values for SSR consistency
  const [chartType, setChartType] = useState<ChartType>(() => {
    if (typeof window === "undefined") {
      return "best-lap"
    }
    const storedChartType = window.localStorage.getItem(
      STORAGE_KEY_CHART_TYPE
    )
    return storedChartType &&
      ["best-lap", "gap-evolution", "avg-vs-fastest"].includes(
        storedChartType
      )
      ? (storedChartType as ChartType)
      : "best-lap"
  })

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

  // Prepare chart data
  const bestLapData = useMemo(() => {
    return data.drivers
      .filter((d) => d.bestLapTime !== null)
      .map((d) => ({
        driverId: d.driverId,
        driverName: d.driverName,
        bestLapTime: d.bestLapTime!,
      }))
      .sort((a, b) => a.bestLapTime - b.bestLapTime)
  }, [data.drivers])

  const gapEvolutionData = useMemo(() => {
    // Get lap data for gap calculation
    const driverSeries = data.races.flatMap((race) =>
      race.results.map((result) => ({
        driverId: result.driverId,
        driverName: result.driverName,
        laps: result.laps.map((lap) => ({
          lapNumber: lap.lapNumber,
          lapTimeSeconds: lap.lapTimeSeconds,
          elapsedRaceTime: lap.elapsedRaceTime,
          positionOnLap: lap.positionOnLap,
        })),
      }))
    )

    // Group by driver using normalized driverId
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

    for (const series of driverSeries) {
      if (!driverMap.has(series.driverId)) {
        driverMap.set(series.driverId, {
          driverId: series.driverId,
          driverName: series.driverName,
          laps: [],
        })
      }
      const driver = driverMap.get(series.driverId)!
      driver.laps.push(...series.laps)
    }

    const allDriverSeries = Array.from(driverMap.values())
    return calculateTopNGapEvolution(allDriverSeries, 3)
  }, [data.races])

  const avgVsFastestData = useMemo(() => {
    return data.drivers
      .filter((d) => d.bestLapTime !== null && d.avgLapTime !== null)
      .map((d) => ({
        driverId: d.driverId,
        driverName: d.driverName,
        fastestLap: d.bestLapTime!,
        averageLap: d.avgLapTime!,
      }))
      .sort((a, b) => a.fastestLap - b.fastestLap)
  }, [data.drivers])

  const driverOptions = useMemo(() => {
    return data.drivers.map((d) => ({
      driverId: d.driverId,
      driverName: d.driverName,
    }))
  }, [data.drivers])

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

  return (
    <div className="space-y-6" role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview">
      {/* Event Statistics */}
      <EventStats
        totalRaces={data.summary.totalRaces}
        totalDrivers={data.summary.totalDrivers}
        totalLaps={data.summary.totalLaps}
        dateRange={data.summary.dateRange}
      />

      {/* Chart Controls */}
      <ChartControls
        drivers={driverOptions}
        races={data.races}
        selectedDriverIds={selectedDriverIds}
        onDriverSelectionChange={handleSelectionChange}
        chartType={chartType}
        onChartTypeChange={setChartType}
      />

      {/* Chart Section */}
      <ChartSection>
        {chartType === "best-lap" && (
          <BestLapBarChart
            data={bestLapData}
            selectedDriverIds={
              selectedDriverIds.length > 0 ? selectedDriverIds : undefined
            }
            currentPage={currentPage}
            driversPerPage={driversPerPage}
            onPageChange={handlePageChange}
            onDriverToggle={handleDriverToggle}
          />
        )}

        {chartType === "gap-evolution" && (
          <GapEvolutionLineChart
            data={gapEvolutionData}
            selectedDriverIds={
              selectedDriverIds.length > 0 ? selectedDriverIds : undefined
            }
            currentPage={currentPage}
            driversPerPage={driversPerPage}
            onPageChange={handlePageChange}
            onDriverToggle={handleDriverToggle}
          />
        )}

        {chartType === "avg-vs-fastest" && (
          <AvgVsFastestChart
            data={avgVsFastestData}
            selectedDriverIds={
              selectedDriverIds.length > 0 ? selectedDriverIds : undefined
            }
            currentPage={currentPage}
            driversPerPage={driversPerPage}
            onPageChange={handlePageChange}
            onDriverToggle={handleDriverToggle}
          />
        )}
      </ChartSection>
    </div>
  )
}
