/**
 * @fileoverview My Laps tab content - wizard for race, drivers, then lap time chart
 *
 * @created 2026-02-01
 * @creator Implementation Plan
 * @lastModified 2026-02-01
 *
 * @description Three-step wizard: (1) Select a race, (2) Select drivers (1+),
 *              (3) View lap time line chart for selected race and drivers.
 *
 * @purpose Provides guided flow matching ComparisonTest wizard pattern.
 *          Used in SessionChartTabs My Laps tab when user is in event entry list.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/sessions/SessionChartTabs.tsx
 * - src/components/organisms/event-analysis/LapTimeLineChart.tsx
 * - src/components/organisms/event-analysis/RaceSelector.tsx
 * - src/components/organisms/event-analysis/ComparisonTest.tsx (wizard pattern)
 * - src/components/molecules/Stepper.tsx
 */

"use client"

import { useState, useEffect, useMemo } from "react"
import RaceSelector, { type Race } from "./RaceSelector"
import LapTimeLineChart, { type DriverLapData } from "./LapTimeLineChart"
import Stepper from "@/components/molecules/Stepper"
import LabeledSwitch from "@/components/molecules/LabeledSwitch"
import StandardButton from "@/components/atoms/StandardButton"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { useChartColors } from "@/hooks/useChartColors"
import { formatLapTime } from "@/lib/date-utils"

const WIZARD_STEPS = [
  { id: "race", label: "Select a race" },
  { id: "drivers", label: "Select drivers" },
  { id: "graph", label: "View graph" },
] as const

const defaultDriverColors = [
  "#3a8eff",
  "#ff6b6b",
  "#4ecdc4",
  "#ffe66d",
  "#a8e6cf",
  "#ff8b94",
  "#95a5a6",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f1c40f",
  "#e67e22",
]

interface ApiDriver {
  driverId: string
  driverName: string
  races: Array<{
    raceId: string
    laps: Array<{ lapNumber: number; lapTimeSeconds: number }>
    bestLapTime?: number | null
    positionFinal?: number
  }>
}

interface DriverMetrics {
  driverId: string
  driverName: string
  fastLapTime: number | null
  avgLapTime: number | null
  consistency: number | null
  lapsCompleted: number
}

interface WinnerInfo {
  driverId: string
  driverName: string
  value: number
  gapToSecond?: number
}

/**
 * Calculate driver metrics from lap data
 */
function calculateDriverMetrics(
  apiDrivers: ApiDriver[],
  selectedRaceId: string,
  selectedDriverIds: string[]
): DriverMetrics[] {
  const idSet = new Set(selectedDriverIds)
  const metrics: DriverMetrics[] = []

  for (const driver of apiDrivers) {
    if (!idSet.has(driver.driverId)) continue
    const raceData = driver.races.find((r) => r.raceId === selectedRaceId)
    if (!raceData?.laps?.length) continue

    const lapTimes = raceData.laps.map((l) => l.lapTimeSeconds)
    const lapsCompleted = lapTimes.length

    // Fastest lap
    const fastLapTime = Math.min(...lapTimes)

    // Average lap
    const avgLapTime = lapTimes.reduce((sum, t) => sum + t, 0) / lapsCompleted

    // Consistency (100 - coefficient of variation * 100)
    // Higher is better (less variation = more consistent)
    let consistency: number | null = null
    if (lapsCompleted >= 2) {
      const mean = avgLapTime
      const variance =
        lapTimes.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / lapsCompleted
      const stdDev = Math.sqrt(variance)
      const coefficientOfVariation = (stdDev / mean) * 100
      consistency = Math.max(0, 100 - coefficientOfVariation)
    }

    metrics.push({
      driverId: driver.driverId,
      driverName: driver.driverName,
      fastLapTime,
      avgLapTime,
      consistency,
      lapsCompleted,
    })
  }

  return metrics
}

/**
 * Calculate winners for each metric
 */
function calculateWinners(driverMetrics: DriverMetrics[]): {
  fastest: WinnerInfo | null
  mostConsistent: WinnerInfo | null
  bestAverage: WinnerInfo | null
} {
  if (driverMetrics.length === 0) {
    return { fastest: null, mostConsistent: null, bestAverage: null }
  }

  // Fastest driver
  let fastest: WinnerInfo | null = null
  for (const driver of driverMetrics) {
    if (driver.fastLapTime === null) continue
    if (!fastest || driver.fastLapTime < fastest.value) {
      fastest = {
        driverId: driver.driverId,
        driverName: driver.driverName,
        value: driver.fastLapTime,
      }
    }
  }

  // Most consistent driver
  let mostConsistent: WinnerInfo | null = null
  for (const driver of driverMetrics) {
    if (driver.consistency === null) continue
    if (!mostConsistent || driver.consistency > mostConsistent.value) {
      mostConsistent = {
        driverId: driver.driverId,
        driverName: driver.driverName,
        value: driver.consistency,
      }
    }
  }

  // Best average driver
  let bestAverage: WinnerInfo | null = null
  for (const driver of driverMetrics) {
    if (driver.avgLapTime === null) continue
    if (!bestAverage || driver.avgLapTime < bestAverage.value) {
      bestAverage = {
        driverId: driver.driverId,
        driverName: driver.driverName,
        value: driver.avgLapTime,
      }
    }
  }

  // Calculate gaps to second place
  if (fastest) {
    const sorted = driverMetrics
      .filter((d) => d.fastLapTime !== null)
      .sort((a, b) => (a.fastLapTime || Infinity) - (b.fastLapTime || Infinity))
    if (sorted.length > 1) {
      fastest.gapToSecond = sorted[1].fastLapTime! - sorted[0].fastLapTime!
    }
  }

  if (mostConsistent) {
    const sorted = driverMetrics
      .filter((d) => d.consistency !== null)
      .sort((a, b) => (b.consistency || 0) - (a.consistency || 0))
    if (sorted.length > 1) {
      mostConsistent.gapToSecond = sorted[0].consistency! - sorted[1].consistency!
    }
  }

  if (bestAverage) {
    const sorted = driverMetrics
      .filter((d) => d.avgLapTime !== null)
      .sort((a, b) => (a.avgLapTime || Infinity) - (b.avgLapTime || Infinity))
    if (sorted.length > 1) {
      bestAverage.gapToSecond = sorted[1].avgLapTime! - sorted[0].avgLapTime!
    }
  }

  return { fastest, mostConsistent, bestAverage }
}

/**
 * Get ranking for a driver in a specific metric
 */
function getRanking(
  driverId: string,
  metric: "fastest" | "mostConsistent" | "bestAverage",
  driverMetrics: DriverMetrics[]
): number {
  const sorted = [...driverMetrics].sort((a, b) => {
    switch (metric) {
      case "fastest":
        return (a.fastLapTime || Infinity) - (b.fastLapTime || Infinity)
      case "mostConsistent":
        return (b.consistency || 0) - (a.consistency || 0)
      case "bestAverage":
        return (a.avgLapTime || Infinity) - (b.avgLapTime || Infinity)
    }
  })
  return sorted.findIndex((d) => d.driverId === driverId) + 1
}

/**
 * Normalize value for progress bar (0-100%)
 */
function normalizeValue(
  value: number | null,
  metric: "fastest" | "mostConsistent" | "bestAverage",
  driverMetrics: DriverMetrics[]
): number {
  if (value === null || driverMetrics.length === 0) return 0

  const values = driverMetrics
    .map((d) => {
      switch (metric) {
        case "fastest":
          return d.fastLapTime
        case "mostConsistent":
          return d.consistency
        case "bestAverage":
          return d.avgLapTime
      }
    })
    .filter((v): v is number => v !== null)

  if (values.length === 0) return 0

  const min = Math.min(...values)
  const max = Math.max(...values)

  if (min === max) return 100

  // For fastest and bestAverage, lower is better (invert)
  // For mostConsistent, higher is better
  if (metric === "fastest" || metric === "bestAverage") {
    return ((max - value) / (max - min)) * 100
  } else {
    return ((value - min) / (max - min)) * 100
  }
}

/**
 * Get badge color for ranking
 */
function getBadgeColor(rank: number): string {
  if (rank === 1) return "bg-yellow-500/20 text-yellow-600 border-yellow-500/50"
  if (rank === 2) return "bg-gray-400/20 text-gray-600 border-gray-400/50"
  if (rank === 3) return "bg-orange-600/20 text-orange-700 border-orange-600/50"
  return "bg-[var(--token-surface-elevated)] text-[var(--token-text-secondary)] border-[var(--token-border-default)]"
}

export interface MyLapsContentProps {
  eventId: string
  selectedClass: string | null
  data?: EventAnalysisData
  userDriverName: string | null
}

/**
 * Resolve user's driverId from event entry list
 */
function resolveUserDriverId(
  userDriverName: string | null,
  entryList: EventAnalysisData["entryList"]
): string | null {
  if (!userDriverName || !entryList?.length) return null
  const normalized = userDriverName.trim().toLowerCase()
  const entry = entryList.find(
    (e) => e.driverName.trim().toLowerCase() === normalized
  )
  return entry?.driverId ?? null
}

/**
 * Build chart data for selected drivers in the selected race
 */
function buildChartDataForDrivers(
  apiDrivers: ApiDriver[],
  selectedRaceId: string,
  selectedDriverIds: string[]
): DriverLapData[] {
  const idSet = new Set(selectedDriverIds)
  const chartData: DriverLapData[] = []

  for (const driver of apiDrivers) {
    if (!idSet.has(driver.driverId)) continue
    const raceData = driver.races.find((r) => r.raceId === selectedRaceId)
    if (!raceData?.laps?.length) continue

    const laps = raceData.laps
      .map((l) => ({ lapNumber: l.lapNumber, lapTimeSeconds: l.lapTimeSeconds }))
      .sort((a, b) => a.lapNumber - b.lapNumber)

    chartData.push({
      driverId: driver.driverId,
      driverName: driver.driverName,
      laps,
    })
  }

  return chartData
}

export default function MyLapsContent({
  eventId,
  selectedClass,
  data,
  userDriverName,
}: MyLapsContentProps) {
  const [step, setStep] = useState(0)
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null)
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([])
  const [showOnlyMyRaces, setShowOnlyMyRaces] = useState(false)
  const [lapsApiDrivers, setLapsApiDrivers] = useState<ApiDriver[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userDriverId = useMemo(
    () => resolveUserDriverId(userDriverName, data?.entryList ?? []),
    [userDriverName, data?.entryList]
  )

  const [userRaceIds, setUserRaceIds] = useState<string[] | null>(null)

  useEffect(() => {
    if (!eventId || !userDriverName?.trim()) {
      setUserRaceIds([])
      return
    }

    setUserRaceIds(null)
    let cancelled = false
    const classNameParam = selectedClass
      ? `?className=${encodeURIComponent(selectedClass)}`
      : ""
    const normalizedUserName = userDriverName.trim().toLowerCase()

    fetch(`/api/v1/events/${eventId}/laps${classNameParam}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Failed to fetch"))))
      .then((result: { success?: boolean; data?: { drivers?: ApiDriver[] } }) => {
        if (cancelled) return
        const drivers = result?.data?.drivers ?? []
        const userDriver = drivers.find(
          (d) => d.driverName?.trim().toLowerCase() === normalizedUserName
        )
        const ids = userDriver?.races?.map((r) => r.raceId) ?? []
        setUserRaceIds(ids)
      })
      .catch(() => {
        if (!cancelled) setUserRaceIds([])
      })

    return () => {
      cancelled = true
    }
  }, [eventId, userDriverName, selectedClass])

  const availableRaces = useMemo<Race[]>(() => {
    if (!data?.races || !Array.isArray(data.races)) return []
    return data.races.map((race) => ({
      id: race.id,
      raceLabel: race.raceLabel,
      className: race.className,
      startTime: race.startTime,
    }))
  }, [data])

  const racesUserCompetedIn = useMemo<Race[]>(() => {
    if (userRaceIds === null) return []
    const idSet = new Set(userRaceIds)
    return availableRaces.filter((r) => idSet.has(r.id))
  }, [availableRaces, userRaceIds])

  const filteredRaces = useMemo(() => {
    const baseRaces = showOnlyMyRaces ? racesUserCompetedIn : availableRaces
    if (!selectedClass || selectedClass.trim() === "") return baseRaces
    const filtered = baseRaces.filter((r) => r.className === selectedClass)
    return filtered.length > 0 ? filtered : baseRaces
  }, [showOnlyMyRaces, racesUserCompetedIn, availableRaces, selectedClass])

  useEffect(() => {
    if (filteredRaces.length === 0) {
      setSelectedRaceId(null)
    } else if (!selectedRaceId || !filteredRaces.some((r) => r.id === selectedRaceId)) {
      setSelectedRaceId(filteredRaces[0].id)
    }
  }, [selectedRaceId, filteredRaces])

  // Clear selected drivers when race changes
  useEffect(() => {
    setSelectedDriverIds([])
  }, [selectedRaceId])

  // Fetch laps for selected race (for step 1 driver list and step 2 chart)
  useEffect(() => {
    if (!selectedRaceId || !eventId) {
      setLapsApiDrivers(null)
      return
    }

    const fetchLapData = async () => {
      setLoading(true)
      setError(null)

      try {
        const classNameParam = selectedClass
          ? `?className=${encodeURIComponent(selectedClass)}`
          : ""
        const response = await fetch(
          `/api/v1/events/${eventId}/laps${classNameParam}`
        )

        if (!response.ok) {
          let errorMessage = "Failed to fetch lap data"
          try {
            const errorData = await response.json()
            errorMessage =
              errorData.error?.message || errorData.error?.details || errorMessage
          } catch {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`
          }
          throw new Error(errorMessage)
        }

        const result = await response.json()

        if (!result.success) {
          const errorMessage =
            result.error?.message ||
            result.error?.details ||
            "Failed to fetch lap data"
          throw new Error(errorMessage)
        }

        const allDrivers = (result.data?.drivers || []) as ApiDriver[]
        setLapsApiDrivers(allDrivers)
      } catch (err) {
        console.error("[MyLapsContent] Error fetching lap data:", err)
        setError(
          err instanceof Error ? err.message : "An error occurred while fetching lap data"
        )
        setLapsApiDrivers(null)
      } finally {
        setLoading(false)
      }
    }

    fetchLapData()
  }, [selectedRaceId, eventId, selectedClass])

  const availableDriversForRace = useMemo(() => {
    if (!lapsApiDrivers || !selectedRaceId) return []
    return lapsApiDrivers
      .filter((d) => d.races.some((r) => r.raceId === selectedRaceId && r.laps?.length))
      .map((d) => ({ driverId: d.driverId, driverName: d.driverName }))
  }, [lapsApiDrivers, selectedRaceId])

  const chartData = useMemo(() => {
    if (!lapsApiDrivers || !selectedRaceId || selectedDriverIds.length === 0) return []
    return buildChartDataForDrivers(lapsApiDrivers, selectedRaceId, selectedDriverIds)
  }, [lapsApiDrivers, selectedRaceId, selectedDriverIds])

  const chartInstanceId = `my-laps-chart-${eventId}-${selectedRaceId || "none"}`
  const defaultColors = useMemo(() => {
    const colors: Record<string, string> = {}
    availableDriversForRace.forEach((driver, index) => {
      colors[driver.driverId] = defaultDriverColors[index % defaultDriverColors.length]
    })
    return colors
  }, [availableDriversForRace])
  const { colors } = useChartColors(chartInstanceId, defaultColors)

  // Calculate driver metrics for comparison cards
  const driverMetrics = useMemo(() => {
    if (!lapsApiDrivers || !selectedRaceId || selectedDriverIds.length === 0) return []
    return calculateDriverMetrics(lapsApiDrivers, selectedRaceId, selectedDriverIds)
  }, [lapsApiDrivers, selectedRaceId, selectedDriverIds])

  // Look up final position per driver for the selected race (from laps API response)
  const finalPositionByDriver = useMemo(() => {
    if (!lapsApiDrivers || !selectedRaceId) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const d of lapsApiDrivers) {
      const race = d.races?.find((r) => r.raceId === selectedRaceId)
      if (race && typeof race.positionFinal === "number") {
        map.set(d.driverId, race.positionFinal)
      }
    }
    return map
  }, [lapsApiDrivers, selectedRaceId])

  // Driver metrics sorted by finishing position (1st to last); drivers without position last
  const driverMetricsByPosition = useMemo(() => {
    if (driverMetrics.length === 0) return []
    return [...driverMetrics].sort((a, b) => {
      const posA = finalPositionByDriver.get(a.driverId) ?? 9999
      const posB = finalPositionByDriver.get(b.driverId) ?? 9999
      return posA - posB
    })
  }, [driverMetrics, finalPositionByDriver])

  // Calculate winners for quick stats summary
  const winners = useMemo(() => calculateWinners(driverMetrics), [driverMetrics])

  const handleDriverToggle = (driverId: string) => {
    setSelectedDriverIds((prev) => {
      if (prev.includes(driverId)) {
        return prev.filter((id) => id !== driverId)
      }
      return [...prev, driverId]
    })
  }

  const handleStepClick = (index: number) => {
    if (index >= 0 && index < step) setStep(index)
  }

  return (
    <div
      className="space-y-6"
      role="tabpanel"
      id="tabpanel-my-laps"
      aria-labelledby="charttab-my-laps"
      style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
    >
      <Stepper
        steps={[...WIZARD_STEPS]}
        currentStep={step}
        onStepClick={handleStepClick}
        aria-label="Lap Analysis wizard steps"
      />

      {step === 0 && (
        <div className="flex justify-center">
          <StandardButton
            onClick={() => setStep(1)}
            disabled={!selectedRaceId || filteredRaces.length === 0}
          >
            Next: Select drivers
          </StandardButton>
        </div>
      )}

      {step === 1 && selectedRaceId && (
        <div className="flex justify-center gap-4">
          <StandardButton type="button" onClick={() => setStep(0)}>
            Back
          </StandardButton>
          <StandardButton
            type="button"
            onClick={() => setStep(2)}
            disabled={selectedDriverIds.length < 1}
          >
            Next: View graph
          </StandardButton>
        </div>
      )}

      {step === 2 && selectedRaceId && (
        <div className="flex justify-center">
          <StandardButton type="button" onClick={() => setStep(1)}>
            Back to drivers
          </StandardButton>
        </div>
      )}

      {step === 0 && (
        <div className="space-y-4" style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-sm font-medium text-[var(--token-text-primary)]">
              Select a race
            </h3>
            <LabeledSwitch
              leftLabel="All races"
              rightLabel="My races"
              checked={showOnlyMyRaces}
              onChange={setShowOnlyMyRaces}
              aria-label="Show all races or only races you raced"
            />
          </div>
          {filteredRaces.length > 0 ? (
            <RaceSelector
              races={filteredRaces}
              selectedRaceId={selectedRaceId}
              onRaceSelect={setSelectedRaceId}
              selectedClass={selectedClass}
              hideHeading
            />
          ) : (
        <div
          className="text-center py-8"
          style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
        >
          <p className="text-sm text-[var(--token-text-secondary)]">
            {userRaceIds === null && showOnlyMyRaces
              ? "Loading races you competed in..."
              : !data
                ? "Event data is loading..."
                : !data.races?.length
                  ? "No races available for this event"
                  : showOnlyMyRaces
                    ? selectedClass
                      ? `No races you competed in for class "${selectedClass}"`
                      : "No races you competed in"
                    : selectedClass
                      ? `No races for class "${selectedClass}"`
                      : "No races available for this event"}
          </p>
        </div>
      )}
        </div>
      )}

      {step === 1 && selectedRaceId && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center h-32 text-[var(--token-text-secondary)]">
              Loading drivers...
            </div>
          ) : error ? (
            <div className="flex justify-center h-32 text-[var(--token-text-error)]">
              Error: {error}
            </div>
          ) : availableDriversForRace.length > 0 ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-sm font-medium text-[var(--token-text-primary)]">
                  Select drivers to compare (1 or more)
                </h3>
                <LabeledSwitch
                  leftLabel="Clear"
                  rightLabel="Select all"
                  checked={
                    availableDriversForRace.length > 0 &&
                    selectedDriverIds.length === availableDriversForRace.length
                  }
                  onChange={(checked) => {
                    if (checked) {
                      setSelectedDriverIds(availableDriversForRace.map((d) => d.driverId))
                    } else {
                      setSelectedDriverIds([])
                    }
                  }}
                  aria-label="Select all drivers or clear selection"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {availableDriversForRace.map((driver) => {
                  const isSelected = selectedDriverIds.includes(driver.driverId)
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
                      `}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleDriverToggle(driver.driverId)}
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
              {selectedDriverIds.length === 0 && (
                <p className="text-xs text-[var(--token-text-secondary)]">
                  Select at least 1 driver to view the graph
                </p>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--token-text-secondary)]">
                No drivers with lap data for the selected race
              </p>
            </div>
          )}
        </div>
      )}

      {step === 2 && selectedRaceId && (
        <div
          className="space-y-8"
          style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
        >
          {selectedDriverIds.length < 1 ? (
            <div className="flex justify-center h-64 text-[var(--token-text-secondary)]">
              Select at least 1 driver. Go back to choose drivers.
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex justify-center h-64 text-[var(--token-text-secondary)]">
              No lap data available for the selected drivers
            </div>
          ) : (
            <>
              {/* Lap Time Chart */}
              <LapTimeLineChart
                data={chartData}
                height={500}
                chartInstanceId={chartInstanceId}
                selectedClass={selectedClass}
                highlightBestLaps
                referenceLines={
                  userDriverId && chartData.some((d) => d.driverId === userDriverId)
                    ? (() => {
                        const userData = chartData.find((d) => d.driverId === userDriverId)
                        if (!userData?.laps?.length) return []
                        const avg =
                          userData.laps.reduce((s, l) => s + l.lapTimeSeconds, 0) /
                          userData.laps.length
                        return [{ value: avg, label: "Your average", stroke: "var(--token-accent)" }]
                      })()
                    : []
                }
              />

              {/* Driver Performance Comparison Section */}
              {driverMetrics.length > 0 && (
                <section className="space-y-4">
                  <h3 className="text-lg font-semibold text-[var(--token-text-primary)]">
                    Driver Performance Comparison
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {driverMetricsByPosition.map((driver) => {
                      const driverColor = colors[driver.driverId] || defaultDriverColors[0]
                      const fastestRank = getRanking(driver.driverId, "fastest", driverMetrics)
                      const consistentRank = getRanking(driver.driverId, "mostConsistent", driverMetrics)
                      const averageRank = getRanking(driver.driverId, "bestAverage", driverMetrics)

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
                                    width: `${normalizeValue(driver.fastLapTime, "fastest", driverMetrics)}%`,
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
                                    width: `${normalizeValue(driver.avgLapTime, "bestAverage", driverMetrics)}%`,
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
                                    width: `${normalizeValue(driver.consistency, "mostConsistent", driverMetrics)}%`,
                                    backgroundColor: driverColor,
                                  }}
                                />
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

                            {/* Final Position */}
                            <div>
                              <span className="text-xs text-[var(--token-text-secondary)]">
                                Final Position
                              </span>
                              <div className="text-sm font-medium text-[var(--token-text-primary)]">
                                {finalPositionByDriver.has(driver.driverId)
                                  ? finalPositionByDriver.get(driver.driverId)
                                  : "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Quick Stats Summary Section */}
              {driverMetrics.length >= 2 && (
                <section className="p-4 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]">
                  <h3 className="text-sm font-semibold text-[var(--token-text-primary)] mb-4">
                    Quick Stats Summary
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
