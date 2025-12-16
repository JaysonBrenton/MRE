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

import { useState, useMemo } from "react"
import EventStats from "./EventStats"
import ChartControls from "./ChartControls"
import BestLapBarChart from "./BestLapBarChart"
import GapEvolutionLineChart from "./GapEvolutionLineChart"
import AvgVsFastestChart from "./AvgVsFastestChart"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { calculateTopNGapEvolution } from "@/core/events/calculate-gap-evolution"

export interface OverviewTabProps {
  data: EventAnalysisData
}

type ChartType = "best-lap" | "gap-evolution" | "avg-vs-fastest"

export default function OverviewTab({ data }: OverviewTabProps) {
  const [chartType, setChartType] = useState<ChartType>("best-lap")
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([])

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

      {/* Chart */}
      {chartType === "best-lap" && (
        <BestLapBarChart
          data={bestLapData}
          selectedDriverIds={
            selectedDriverIds.length > 0 ? selectedDriverIds : undefined
          }
        />
      )}

      {chartType === "gap-evolution" && (
        <GapEvolutionLineChart
          data={gapEvolutionData}
          selectedDriverIds={
            selectedDriverIds.length > 0 ? selectedDriverIds : undefined
          }
        />
      )}

      {chartType === "avg-vs-fastest" && (
        <AvgVsFastestChart
          data={avgVsFastestData}
          selectedDriverIds={
            selectedDriverIds.length > 0 ? selectedDriverIds : undefined
          }
        />
      )}
    </div>
  )
}

