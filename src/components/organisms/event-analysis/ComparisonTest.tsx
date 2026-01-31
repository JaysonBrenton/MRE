/**
 * @fileoverview Comparison Test tab - enhanced driver comparison interface
 *
 * @created 2025-01-28
 * @creator Auto-generated
 * @lastModified 2025-01-28
 *
 * @description Tab content for comparing multiple drivers with side-by-side cards,
 *              quick stats, and visual performance indicators
 *
 * @purpose Provides an enhanced user-friendly interface for driver comparisons
 *          with multi-driver selection, visual indicators, and summary statistics.
 *
 * @relatedFiles
 * - src/components/event-analysis/RaceSelector.tsx (race selection)
 * - src/components/event-analysis/TabNavigation.tsx (tab navigation)
 */

"use client"

import { useState, useEffect, useMemo } from "react"
import RaceSelector, { type Race } from "./RaceSelector"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { formatLapTime } from "@/lib/date-utils"
import { useChartColors } from "@/hooks/useChartColors"

// Default color palette for drivers (matching LapTimeLineChart)
const defaultDriverColors = [
  "#3a8eff", // Blue
  "#ff6b6b", // Red
  "#4ecdc4", // Teal
  "#ffe66d", // Yellow
  "#a8e6cf", // Green
  "#ff8b94", // Pink
  "#95a5a6", // Gray
  "#f39c12", // Orange
  "#9b59b6", // Purple
  "#1abc9c", // Turquoise
  "#e74c3c", // Dark Red
  "#3498db", // Light Blue
  "#2ecc71", // Dark Green
  "#f1c40f", // Gold
  "#e67e22", // Dark Orange
]

export interface ComparisonTestProps {
  selectedClass: string | null
  eventId: string
  data?: EventAnalysisData
}

interface DriverResult {
  driverId: string
  driverName: string
  positionFinal: number
  lapsCompleted: number
  fastLapTime: number | null
  avgLapTime: number | null
  consistency: number | null
}

interface WinnerInfo {
  driverId: string
  driverName: string
  value: number
  gapToSecond?: number
}

export default function ComparisonTest({ selectedClass, eventId, data }: ComparisonTestProps) {
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null)
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([])

  // Get available races from data
  const availableRaces = useMemo<Race[]>(() => {
    if (!data?.races || !Array.isArray(data.races)) {
      return []
    }
    return data.races.map((race) => ({
      id: race.id,
      raceLabel: race.raceLabel,
      className: race.className,
      startTime: race.startTime,
    }))
  }, [data])

  // Filter races by selected class
  const filteredRaces = useMemo(() => {
    if (!selectedClass) {
      return availableRaces
    }
    return availableRaces.filter((race) => race.className === selectedClass)
  }, [availableRaces, selectedClass])

  // Auto-select first race if available and none selected
  useEffect(() => {
    if (!selectedRaceId && filteredRaces.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedRaceId(filteredRaces[0].id)
    }
  }, [selectedRaceId, filteredRaces])

  // Get race results for selected race
  const raceResults = useMemo<DriverResult[]>(() => {
    if (!selectedRaceId || !data?.races) {
      return []
    }

    const race = data.races.find((r) => r.id === selectedRaceId)
    if (!race || !race.results) {
      return []
    }

    return race.results.map((result) => ({
      driverId: result.driverId,
      driverName: result.driverName,
      positionFinal: result.positionFinal,
      lapsCompleted: result.lapsCompleted,
      fastLapTime: result.fastLapTime,
      avgLapTime: result.avgLapTime,
      consistency: result.consistency,
    }))
  }, [selectedRaceId, data])

  // Get available drivers for selection (only those who participated in selected race)
  const availableDrivers = useMemo(() => {
    return raceResults.map((result) => ({
      driverId: result.driverId,
      driverName: result.driverName,
    }))
  }, [raceResults])

  // Get selected driver results
  const selectedDriverResults = useMemo(() => {
    return raceResults.filter((result) => selectedDriverIds.includes(result.driverId))
  }, [raceResults, selectedDriverIds])

  // Chart colors for drivers
  const chartInstanceId = `comparison-test-${eventId}-${selectedRaceId || "none"}`
  const defaultColors = useMemo(() => {
    const colors: Record<string, string> = {}
    availableDrivers.forEach((driver, index) => {
      colors[driver.driverId] = defaultDriverColors[index % defaultDriverColors.length]
    })
    return colors
  }, [availableDrivers])

  const { colors } = useChartColors(chartInstanceId, defaultColors)

  // Calculate winners for each metric
  const winners = useMemo(() => {
    if (selectedDriverResults.length === 0) {
      return {
        fastest: null,
        mostConsistent: null,
        bestAverage: null,
        bestPosition: null,
      }
    }

    const fastest = selectedDriverResults.reduce<WinnerInfo | null>((best, driver) => {
      if (driver.fastLapTime === null) return best
      if (!best || driver.fastLapTime < best.value) {
        return {
          driverId: driver.driverId,
          driverName: driver.driverName,
          value: driver.fastLapTime,
        }
      }
      return best
    }, null)

    const mostConsistent = selectedDriverResults.reduce<WinnerInfo | null>((best, driver) => {
      if (driver.consistency === null) return best
      if (!best || (driver.consistency > best.value && driver.consistency > 0)) {
        return {
          driverId: driver.driverId,
          driverName: driver.driverName,
          value: driver.consistency,
        }
      }
      return best
    }, null)

    const bestAverage = selectedDriverResults.reduce<WinnerInfo | null>((best, driver) => {
      if (driver.avgLapTime === null) return best
      if (!best || driver.avgLapTime < best.value) {
        return {
          driverId: driver.driverId,
          driverName: driver.driverName,
          value: driver.avgLapTime,
        }
      }
      return best
    }, null)

    const bestPosition = selectedDriverResults.reduce<WinnerInfo | null>((best, driver) => {
      if (!best || driver.positionFinal < best.value) {
        return {
          driverId: driver.driverId,
          driverName: driver.driverName,
          value: driver.positionFinal,
        }
      }
      return best
    }, null)

    // Calculate gaps to second place
    if (fastest) {
      const sorted = selectedDriverResults
        .filter((d) => d.fastLapTime !== null)
        .sort((a, b) => (a.fastLapTime || Infinity) - (b.fastLapTime || Infinity))
      if (sorted.length > 1) {
        fastest.gapToSecond = sorted[1].fastLapTime! - sorted[0].fastLapTime!
      }
    }

    if (mostConsistent) {
      const sorted = selectedDriverResults
        .filter((d) => d.consistency !== null && d.consistency > 0)
        .sort((a, b) => (b.consistency || 0) - (a.consistency || 0))
      if (sorted.length > 1) {
        mostConsistent.gapToSecond = sorted[0].consistency! - sorted[1].consistency!
      }
    }

    if (bestAverage) {
      const sorted = selectedDriverResults
        .filter((d) => d.avgLapTime !== null)
        .sort((a, b) => (a.avgLapTime || Infinity) - (b.avgLapTime || Infinity))
      if (sorted.length > 1) {
        bestAverage.gapToSecond = sorted[1].avgLapTime! - sorted[0].avgLapTime!
      }
    }

    if (bestPosition) {
      const sorted = selectedDriverResults.sort((a, b) => a.positionFinal - b.positionFinal)
      if (sorted.length > 1) {
        bestPosition.gapToSecond = sorted[1].positionFinal - sorted[0].positionFinal
      }
    }

    return { fastest, mostConsistent, bestAverage, bestPosition }
  }, [selectedDriverResults])

  // Get ranking for a driver in a metric
  const getRanking = (
    driverId: string,
    metric: "fastest" | "mostConsistent" | "bestAverage" | "bestPosition"
  ): number => {
    const sorted = [...selectedDriverResults].sort((a, b) => {
      switch (metric) {
        case "fastest":
          return (a.fastLapTime || Infinity) - (b.fastLapTime || Infinity)
        case "mostConsistent":
          return (b.consistency || 0) - (a.consistency || 0)
        case "bestAverage":
          return (a.avgLapTime || Infinity) - (b.avgLapTime || Infinity)
        case "bestPosition":
          return a.positionFinal - b.positionFinal
      }
    })
    return sorted.findIndex((d) => d.driverId === driverId) + 1
  }

  // Normalize value for progress bar (0-100%)
  const normalizeValue = (
    value: number | null,
    metric: "fastest" | "mostConsistent" | "bestAverage" | "bestPosition"
  ): number => {
    if (value === null || selectedDriverResults.length === 0) return 0

    const values = selectedDriverResults
      .map((d) => {
        switch (metric) {
          case "fastest":
            return d.fastLapTime
          case "mostConsistent":
            return d.consistency
          case "bestAverage":
            return d.avgLapTime
          case "bestPosition":
            return d.positionFinal
        }
      })
      .filter((v): v is number => v !== null)

    if (values.length === 0) return 0

    const min = Math.min(...values)
    const max = Math.max(...values)

    if (min === max) return 100

    // For fastest and bestAverage, lower is better (invert)
    // For mostConsistent and bestPosition, higher is better
    if (metric === "fastest" || metric === "bestAverage") {
      return ((max - value) / (max - min)) * 100
    } else {
      return ((value - min) / (max - min)) * 100
    }
  }

  // Handle driver selection
  const handleDriverToggle = (driverId: string) => {
    setSelectedDriverIds((prev) => {
      if (prev.includes(driverId)) {
        return prev.filter((id) => id !== driverId)
      } else {
        if (prev.length >= 4) {
          return prev // Don't allow more than 4
        }
        return [...prev, driverId]
      }
    })
  }

  // Get badge color for ranking
  const getBadgeColor = (rank: number): string => {
    if (rank === 1) return "bg-yellow-500/20 text-yellow-600 border-yellow-500/50"
    if (rank === 2) return "bg-gray-400/20 text-gray-600 border-gray-400/50"
    if (rank === 3) return "bg-orange-600/20 text-orange-700 border-orange-600/50"
    return "bg-[var(--token-surface-elevated)] text-[var(--token-text-secondary)] border-[var(--token-border-default)]"
  }

  return (
    <div
      className="space-y-6"
      role="tabpanel"
      id="tabpanel-comparison-test"
      aria-labelledby="tab-comparison-test"
    >
      {/* Race Selector */}
      {filteredRaces.length > 0 ? (
        <RaceSelector
          races={filteredRaces}
          selectedRaceId={selectedRaceId}
          onRaceSelect={setSelectedRaceId}
          selectedClass={selectedClass}
        />
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--token-text-secondary)]">
            {!data
              ? "Event data is loading..."
              : data.races.length === 0
                ? "This event has no races"
                : selectedClass
                  ? `No races available for class "${selectedClass}"`
                  : "No races available"}
          </p>
        </div>
      )}

      {/* Driver Selector */}
      {selectedRaceId && availableDrivers.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--token-text-primary)]">
              Select Drivers to Compare (2-4 drivers)
            </h3>
            {selectedDriverIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedDriverIds([])}
                className="text-xs text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)]"
              >
                Clear Selection
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {availableDrivers.map((driver) => {
              const isSelected = selectedDriverIds.includes(driver.driverId)
              const isDisabled = !isSelected && selectedDriverIds.length >= 4
              const driverColor = colors[driver.driverId] || defaultDriverColors[0]

              return (
                <label
                  key={driver.driverId}
                  className={`
                    relative flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all
                    ${
                      isSelected
                        ? "border-[var(--token-accent)] bg-[var(--token-accent)]/10"
                        : "border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] hover:border-[var(--token-accent)]/50"
                    }
                    ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleDriverToggle(driver.driverId)}
                    disabled={isDisabled}
                    className="w-4 h-4 rounded border-[var(--token-border-default)] text-[var(--token-accent)] focus:ring-[var(--token-interactive-focus-ring)]"
                  />
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: driverColor }}
                    aria-hidden="true"
                  />
                  <span className="text-sm text-[var(--token-text-primary)] truncate flex-1">
                    {driver.driverName}
                  </span>
                </label>
              )
            })}
          </div>
          {selectedDriverIds.length < 2 && selectedDriverIds.length > 0 && (
            <p className="text-xs text-[var(--token-text-secondary)]">
              Select at least 2 drivers to compare
            </p>
          )}
        </div>
      )}

      {/* Comparison Cards */}
      {selectedRaceId && selectedDriverResults.length >= 2 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {selectedDriverResults.map((driver) => {
              const driverColor = colors[driver.driverId] || defaultDriverColors[0]
              const fastestRank = getRanking(driver.driverId, "fastest")
              const consistentRank = getRanking(driver.driverId, "mostConsistent")
              const averageRank = getRanking(driver.driverId, "bestAverage")
              const positionRank = getRanking(driver.driverId, "bestPosition")

              return (
                <div
                  key={driver.driverId}
                  className="p-4 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] space-y-4"
                >
                  {/* Driver Header */}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: driverColor }}
                      aria-hidden="true"
                    />
                    <h4 className="font-semibold text-sm text-[var(--token-text-primary)] flex-1">
                      {driver.driverName}
                    </h4>
                  </div>

                  {/* Metrics */}
                  <div className="space-y-3">
                    {/* Fastest Lap */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--token-text-secondary)]">
                          Fastest Lap
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded border ${getBadgeColor(fastestRank)}`}
                        >
                          {fastestRank === 1
                            ? "🥇"
                            : fastestRank === 2
                              ? "🥈"
                              : fastestRank === 3
                                ? "🥉"
                                : `#${fastestRank}`}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-[var(--token-text-primary)]">
                        {formatLapTime(driver.fastLapTime)}
                      </div>
                      <div className="w-full h-1.5 bg-[var(--token-surface)] rounded-full mt-1">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${normalizeValue(driver.fastLapTime, "fastest")}%`,
                            backgroundColor: driverColor,
                          }}
                        />
                      </div>
                    </div>

                    {/* Average Lap */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--token-text-secondary)]">
                          Average Lap
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded border ${getBadgeColor(averageRank)}`}
                        >
                          {averageRank === 1
                            ? "🥇"
                            : averageRank === 2
                              ? "🥈"
                              : averageRank === 3
                                ? "🥉"
                                : `#${averageRank}`}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-[var(--token-text-primary)]">
                        {formatLapTime(driver.avgLapTime)}
                      </div>
                      <div className="w-full h-1.5 bg-[var(--token-surface)] rounded-full mt-1">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${normalizeValue(driver.avgLapTime, "bestAverage")}%`,
                            backgroundColor: driverColor,
                          }}
                        />
                      </div>
                    </div>

                    {/* Consistency */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--token-text-secondary)]">
                          Consistency
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded border ${getBadgeColor(consistentRank)}`}
                        >
                          {consistentRank === 1
                            ? "🥇"
                            : consistentRank === 2
                              ? "🥈"
                              : consistentRank === 3
                                ? "🥉"
                                : `#${consistentRank}`}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-[var(--token-text-primary)]">
                        {driver.consistency !== null ? driver.consistency.toFixed(2) : "N/A"}
                      </div>
                      <div className="w-full h-1.5 bg-[var(--token-surface)] rounded-full mt-1">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${normalizeValue(driver.consistency, "mostConsistent")}%`,
                            backgroundColor: driverColor,
                          }}
                        />
                      </div>
                    </div>

                    {/* Final Position */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--token-text-secondary)]">
                          Final Position
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded border ${getBadgeColor(positionRank)}`}
                        >
                          {positionRank === 1
                            ? "🥇"
                            : positionRank === 2
                              ? "🥈"
                              : positionRank === 3
                                ? "🥉"
                                : `#${positionRank}`}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-[var(--token-text-primary)]">
                        {driver.positionFinal}
                        {driver.positionFinal === 1 && " 🏆"}
                      </div>
                    </div>

                    {/* Laps Completed */}
                    <div>
                      <span className="text-xs text-[var(--token-text-secondary)]">
                        Laps Completed
                      </span>
                      <div className="text-sm font-medium text-[var(--token-text-primary)]">
                        {driver.lapsCompleted}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Quick Stats Panel */}
          <div className="mt-6 p-4 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]">
            <h3 className="text-sm font-semibold text-[var(--token-text-primary)] mb-4">
              Quick Stats Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Fastest Driver */}
              {winners.fastest && (
                <div className="p-3 rounded border border-[var(--token-border-default)] bg-[var(--token-surface)]">
                  <div className="text-xs text-[var(--token-text-secondary)] mb-1">
                    Fastest Driver
                  </div>
                  <div className="text-sm font-semibold text-[var(--token-text-primary)] mb-1">
                    {winners.fastest.driverName}
                  </div>
                  <div className="text-xs text-[var(--token-text-secondary)]">
                    {formatLapTime(winners.fastest.value)}
                    {winners.fastest.gapToSecond !== undefined && (
                      <span className="ml-1 text-[var(--token-text-muted)]">
                        (+{formatLapTime(winners.fastest.gapToSecond)} gap)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Most Consistent */}
              {winners.mostConsistent && (
                <div className="p-3 rounded border border-[var(--token-border-default)] bg-[var(--token-surface)]">
                  <div className="text-xs text-[var(--token-text-secondary)] mb-1">
                    Most Consistent
                  </div>
                  <div className="text-sm font-semibold text-[var(--token-text-primary)] mb-1">
                    {winners.mostConsistent.driverName}
                  </div>
                  <div className="text-xs text-[var(--token-text-secondary)]">
                    {winners.mostConsistent.value.toFixed(2)}
                    {winners.mostConsistent.gapToSecond !== undefined && (
                      <span className="ml-1 text-[var(--token-text-muted)]">
                        (+{winners.mostConsistent.gapToSecond.toFixed(2)} gap)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Best Average */}
              {winners.bestAverage && (
                <div className="p-3 rounded border border-[var(--token-border-default)] bg-[var(--token-surface)]">
                  <div className="text-xs text-[var(--token-text-secondary)] mb-1">
                    Best Average Lap
                  </div>
                  <div className="text-sm font-semibold text-[var(--token-text-primary)] mb-1">
                    {winners.bestAverage.driverName}
                  </div>
                  <div className="text-xs text-[var(--token-text-secondary)]">
                    {formatLapTime(winners.bestAverage.value)}
                    {winners.bestAverage.gapToSecond !== undefined && (
                      <span className="ml-1 text-[var(--token-text-muted)]">
                        (+{formatLapTime(winners.bestAverage.gapToSecond)} gap)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Best Position */}
              {winners.bestPosition && (
                <div className="p-3 rounded border border-[var(--token-border-default)] bg-[var(--token-surface)]">
                  <div className="text-xs text-[var(--token-text-secondary)] mb-1">
                    Best Position
                  </div>
                  <div className="text-sm font-semibold text-[var(--token-text-primary)] mb-1">
                    {winners.bestPosition.driverName}
                  </div>
                  <div className="text-xs text-[var(--token-text-secondary)]">
                    {winners.bestPosition.value}
                    {winners.bestPosition.gapToSecond !== undefined && (
                      <span className="ml-1 text-[var(--token-text-muted)]">
                        ({winners.bestPosition.gapToSecond} position gap)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Empty States */}
      {selectedRaceId && availableDrivers.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--token-text-secondary)]">
            No drivers found for the selected race
          </p>
        </div>
      )}

      {selectedRaceId && selectedDriverIds.length === 0 && availableDrivers.length > 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--token-text-secondary)]">
            Select 2-4 drivers above to compare their performance
          </p>
        </div>
      )}
    </div>
  )
}
