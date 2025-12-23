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
}

type ChartType = "best-lap" | "gap-evolution" | "avg-vs-fastest"

const STORAGE_KEY_SELECTED_DRIVERS = "mre-overview-selected-drivers"
const STORAGE_KEY_CHART_TYPE = "mre-overview-chart-type"

export default function OverviewTab({ data }: OverviewTabProps) {
  // Load persisted state from localStorage
  const [chartType, setChartType] = useState<ChartType>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY_CHART_TYPE)
      if (stored && ["best-lap", "gap-evolution", "avg-vs-fastest"].includes(stored)) {
        return stored as ChartType
      }
    }
    return "best-lap"
  })

  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY_SELECTED_DRIVERS)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            return parsed
          }
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
    return []
  })

  const [currentPage, setCurrentPage] = useState(1)
  const driversPerPage = 25

  // Persist chart type to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_CHART_TYPE, chartType)
    }
  }, [chartType])

  // Persist selected drivers to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_SELECTED_DRIVERS, JSON.stringify(selectedDriverIds))
    }
  }, [selectedDriverIds])

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
  const handleDriverToggle = useCallback(
    (driverId: string) => {
      setSelectedDriverIds((prev) => {
        if (prev.includes(driverId)) {
          return prev.filter((id) => id !== driverId)
        } else {
          return [...prev, driverId]
        }
      })
    },
    []
  )

  // Reset page when selection changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedDriverIds])

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
        onDriverSelectionChange={setSelectedDriverIds}
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
            onPageChange={setCurrentPage}
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
            onPageChange={setCurrentPage}
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
            onPageChange={setCurrentPage}
            onDriverToggle={handleDriverToggle}
          />
        )}
      </ChartSection>
    </div>
  )
}

