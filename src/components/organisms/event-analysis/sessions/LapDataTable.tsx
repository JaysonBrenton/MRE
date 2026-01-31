/**
 * @fileoverview Lap data table component - displays all lap data grouped by driver or race
 *
 * @created 2025-01-27
 * @creator Auto-generated
 * @lastModified 2025-01-27
 *
 * @description Comprehensive lap data table with driver or race grouping, filtering, and sorting
 *
 * @purpose Displays all lap data for each driver and each race in a grouped, expandable table.
 *          Supports driver name filtering with autocomplete and respects class selection.
 *          Supports two view modes: Driver View (default) and Race View (alternate).
 *
 * @relatedFiles
 * - src/core/events/get-lap-data.ts (data source)
 * - src/components/event-analysis/sessions/DriverNameFilter.tsx (driver filter)
 * - src/components/event-analysis/ChartContainer.tsx (wrapper)
 */

"use client"

import { useState, useEffect, useMemo, useCallback, Fragment } from "react"
import ChartContainer from "../ChartContainer"
import DriverNameFilter from "./DriverNameFilter"
import ViewModeToggle from "./ViewModeToggle"
import ListPagination from "../ListPagination"
import { formatLapTime } from "@/lib/format-session-data"
import type { DriverLapData, RaceLapData, LapData } from "@/core/events/get-lap-data"

export interface LapDataTableProps {
  eventId: string
  selectedClass: string | null
  className?: string
}

interface ExpandedState {
  drivers: Set<string>
  races: Set<string>
}

type ViewMode = "driver" | "race"

interface RaceGroupedLapData {
  raceId: string
  raceLabel: string
  className: string
  drivers: {
    driverId: string
    driverName: string
    races: RaceLapData[] // Will contain only the matching race
    overallBestLap: number | null
    totalLaps: number
  }[]
  bestLapTime: number | null // Best lap across all drivers in this race
  totalLaps: number // Total laps across all drivers
  totalDrivers: number
}

export default function LapDataTable({
  eventId,
  selectedClass,
  className = "",
}: LapDataTableProps) {
  const [lapData, setLapData] = useState<DriverLapData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [driverFilter, setDriverFilter] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("driver")
  const [expanded, setExpanded] = useState<ExpandedState>({
    drivers: new Set(),
    races: new Set(),
  })
  const [expandedRaces, setExpandedRaces] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [sortField, setSortField] = useState<"driver" | "bestLap" | "totalLaps">("driver")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  // Fetch lap data
  useEffect(() => {
    const fetchLapData = async () => {
      setLoading(true)
      setError(null)

      try {
        const classNameParam = selectedClass
          ? `?className=${encodeURIComponent(selectedClass)}`
          : ""
        const response = await fetch(`/api/v1/events/${eventId}/laps${classNameParam}`)

        if (!response.ok) {
          let errorMessage = "Failed to fetch lap data"
          try {
            const errorData = await response.json()
            errorMessage = errorData.error?.message || errorData.error?.details || errorMessage
            console.error("[LapDataTable] API error response:", {
              status: response.status,
              statusText: response.statusText,
              error: errorData,
            })
          } catch (parseError) {
            console.error("[LapDataTable] Failed to parse error response:", parseError)
            errorMessage = `HTTP ${response.status}: ${response.statusText}`
          }
          throw new Error(errorMessage)
        }

        const result = await response.json()

        if (!result.success) {
          const errorMessage =
            result.error?.message || result.error?.details || "Failed to fetch lap data"
          console.error("[LapDataTable] API returned error:", result.error)
          throw new Error(errorMessage)
        }

        setLapData(result.data.drivers || [])
      } catch (err) {
        console.error("[LapDataTable] Error fetching lap data:", err)
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred while fetching lap data"
        setError(errorMessage)
        setLapData([])
      } finally {
        setLoading(false)
      }
    }

    if (eventId) {
      fetchLapData()
    }
  }, [eventId, selectedClass])

  // Transform driver-centric data to race-centric data
  const raceGroupedData = useMemo(() => {
    const raceMap = new Map<string, RaceGroupedLapData>()

    for (const driver of lapData) {
      for (const race of driver.races) {
        if (!raceMap.has(race.raceId)) {
          raceMap.set(race.raceId, {
            raceId: race.raceId,
            raceLabel: race.raceLabel,
            className: race.className,
            drivers: [],
            bestLapTime: null,
            totalLaps: 0,
            totalDrivers: 0,
          })
        }

        const raceData = raceMap.get(race.raceId)!

        // Add driver to this race
        raceData.drivers.push({
          driverId: driver.driverId,
          driverName: driver.driverName,
          races: [race], // Only the matching race
          overallBestLap: race.bestLapTime,
          totalLaps: race.totalLaps,
        })

        // Update race aggregates
        raceData.totalLaps += race.totalLaps
        raceData.totalDrivers += 1

        // Update best lap time (best across all drivers in this race)
        if (race.bestLapTime !== null) {
          if (raceData.bestLapTime === null || race.bestLapTime < raceData.bestLapTime) {
            raceData.bestLapTime = race.bestLapTime
          }
        }
      }
    }

    return Array.from(raceMap.values())
  }, [lapData])

  // Get all unique driver names for filter
  const driverNames = useMemo(() => {
    return Array.from(new Set(lapData.map((driver) => driver.driverName))).sort()
  }, [lapData])

  // Filter and sort drivers (for driver view)
  const filteredAndSortedDrivers = useMemo(() => {
    let filtered = [...lapData]

    // Apply driver name filter
    if (driverFilter && driverFilter.trim() !== "") {
      const filterLower = driverFilter.toLowerCase().trim()
      filtered = filtered.filter((driver) => driver.driverName.toLowerCase().includes(filterLower))
    }

    // Sort drivers
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case "driver":
          comparison = a.driverName.localeCompare(b.driverName)
          break
        case "bestLap":
          const aBest = a.overallBestLap ?? Infinity
          const bBest = b.overallBestLap ?? Infinity
          comparison = aBest - bBest
          break
        case "totalLaps":
          comparison = a.totalLaps - b.totalLaps
          break
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return filtered
  }, [lapData, driverFilter, sortField, sortDirection])

  // Filter and sort races (for race view)
  const filteredAndSortedRaces = useMemo(() => {
    let filtered = [...raceGroupedData]

    // Apply driver name filter (filter races that contain matching drivers)
    if (driverFilter && driverFilter.trim() !== "") {
      const filterLower = driverFilter.toLowerCase().trim()
      filtered = filtered.filter((race) =>
        race.drivers.some((driver) => driver.driverName.toLowerCase().includes(filterLower))
      )
    }

    // Sort races
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case "driver":
          // Sort by race label
          comparison = a.raceLabel.localeCompare(b.raceLabel)
          break
        case "bestLap":
          const aBest = a.bestLapTime ?? Infinity
          const bBest = b.bestLapTime ?? Infinity
          comparison = aBest - bBest
          break
        case "totalLaps":
          comparison = a.totalLaps - b.totalLaps
          break
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return filtered
  }, [raceGroupedData, driverFilter, sortField, sortDirection])

  // Pagination
  const displayItems = viewMode === "driver" ? filteredAndSortedDrivers : filteredAndSortedRaces
  const totalPages = Math.ceil(displayItems.length / pageSize)
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return displayItems.slice(startIndex, endIndex)
  }, [displayItems, currentPage, pageSize])

  // Toggle driver expansion
  const toggleDriver = useCallback(
    (driverId: string) => {
      setExpanded((prev) => {
        const newDrivers = new Set(prev.drivers)
        if (newDrivers.has(driverId)) {
          newDrivers.delete(driverId)
          // Also collapse all races for this driver
          const newRaces = new Set(prev.races)
          lapData
            .find((d) => d.driverId === driverId)
            ?.races.forEach((race) => newRaces.delete(race.raceId))
          return { drivers: newDrivers, races: newRaces }
        } else {
          newDrivers.add(driverId)
          return { ...prev, drivers: newDrivers }
        }
      })
    },
    [lapData]
  )

  // Toggle race expansion (for driver view)
  const toggleRace = useCallback((raceId: string) => {
    setExpanded((prev) => {
      const newRaces = new Set(prev.races)
      if (newRaces.has(raceId)) {
        newRaces.delete(raceId)
      } else {
        newRaces.add(raceId)
      }
      return { ...prev, races: newRaces }
    })
  }, [])

  // Toggle race expansion (for race view)
  const toggleRaceView = useCallback(
    (raceId: string) => {
      setExpandedRaces((prev) => {
        const newRaces = new Set(prev)
        if (newRaces.has(raceId)) {
          newRaces.delete(raceId)
          // Also collapse all drivers for this race
          setExpanded((prevExpanded) => {
            const newDrivers = new Set(prevExpanded.drivers)
            const raceData = raceGroupedData.find((r) => r.raceId === raceId)
            raceData?.drivers.forEach((driver) => newDrivers.delete(driver.driverId))
            return { ...prevExpanded, drivers: newDrivers }
          })
        } else {
          newRaces.add(raceId)
        }
        return newRaces
      })
    },
    [raceGroupedData]
  )

  // Handle sort
  const handleSort = useCallback(
    (field: typeof sortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      } else {
        setSortField(field)
        setSortDirection("asc")
      }
      setCurrentPage(1)
    },
    [sortField]
  )

  // Calculate time delta from best lap
  const getTimeDelta = useCallback((lapTime: number, bestLap: number | null): number | null => {
    if (bestLap === null) {
      return null
    }
    return lapTime - bestLap
  }, [])

  // Check if lap is best lap
  const isBestLap = useCallback((lapTime: number, bestLap: number | null): boolean => {
    if (bestLap === null) {
      return false
    }
    return Math.abs(lapTime - bestLap) < 0.001 // Small epsilon for floating point comparison
  }, [])

  // Check if class is selected
  const hasSelectedClass = selectedClass && selectedClass.trim() !== ""

  if (loading) {
    return (
      <ChartContainer title="Lap Data" className={className} aria-label="Lap data table - loading">
        <div className="flex items-center justify-center h-64 text-[var(--token-text-secondary)]">
          Loading lap data...
        </div>
      </ChartContainer>
    )
  }

  if (error) {
    return (
      <ChartContainer title="Lap Data" className={className} aria-label="Lap data table - error">
        <div className="flex items-center justify-center h-64 text-[var(--token-text-error)]">
          Error: {error}
        </div>
      </ChartContainer>
    )
  }

  // Show message if no class is selected
  if (!hasSelectedClass) {
    return (
      <ChartContainer
        title="Lap Data"
        className={className}
        aria-label="Lap data table - no class selected"
      >
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--token-surface-elevated)] rounded border border-[var(--token-border-default)]">
            <span className="text-sm text-[var(--token-text-secondary)]">
              Please select a class in the Overview tab to view session data. Go to the Overview tab
              and use the &quot;Filter by Class&quot; dropdown to select a class.
            </span>
          </div>
        </div>
      </ChartContainer>
    )
  }

  if (lapData.length === 0) {
    return (
      <ChartContainer title="Lap Data" className={className} aria-label="Lap data table - no data">
        <div className="flex items-center justify-center h-64 text-[var(--token-text-secondary)]">
          {selectedClass
            ? `No lap data available for class "${selectedClass}"`
            : "No lap data available"}
        </div>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer
      title="Lap Data"
      className={className}
      aria-label="Lap data table with driver grouping, filtering, and sorting"
    >
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Left side: Driver filter */}
          <div className="w-full sm:flex-1 sm:max-w-sm sm:min-w-[280px]">
            <DriverNameFilter
              driverNames={driverNames}
              value={driverFilter}
              onChange={setDriverFilter}
              placeholder="Filter by driver name..."
            />
          </div>
          {/* Right side: View toggle */}
          <div className="flex items-center gap-2">
            <ViewModeToggle
              value={viewMode}
              onChange={(newMode) => {
                setViewMode(newMode)
                setCurrentPage(1)
                // Reset expansion states when switching views
                setExpanded({ drivers: new Set(), races: new Set() })
                setExpandedRaces(new Set())
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-[var(--token-border-default)]">
          <table className="w-full min-w-[1200px]" aria-label="Lap data table">
            <thead className="bg-[var(--token-surface-alt)] border-b border-[var(--token-border-default)]">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                >
                  Driver
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]"
                >
                  Best Lap
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-sm font-medium text-[var(--token-text-secondary)]"
                >
                  Total Laps
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-center text-sm font-medium text-[var(--token-text-secondary)]"
                >
                  Races
                </th>
              </tr>
            </thead>
            <tbody className="bg-[var(--token-surface)]">
              {viewMode === "driver"
                ? // Driver View
                  (paginatedItems as DriverLapData[]).map((driver) => {
                    const isDriverExpanded = expanded.drivers.has(driver.driverId)

                    return (
                      <Fragment key={driver.driverId}>
                        {/* Driver Row */}
                        <tr
                          className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)] transition-colors cursor-pointer"
                          onClick={() => toggleDriver(driver.driverId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              toggleDriver(driver.driverId)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-expanded={isDriverExpanded}
                          aria-label={`${driver.driverName} - Click to ${isDriverExpanded ? "collapse" : "expand"} races`}
                        >
                          <td className="px-4 py-3 text-sm font-normal">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[var(--token-text-secondary)] transition-transform"
                                style={{
                                  transform: isDriverExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                  display: "inline-block",
                                }}
                                aria-hidden="true"
                              >
                                ▶
                              </span>
                              <span className="text-[var(--token-text-primary)]">
                                {driver.driverName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)]">
                            {formatLapTime(driver.overallBestLap)}
                          </td>
                          <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)] text-center">
                            {driver.totalLaps}
                          </td>
                          <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)] text-center">
                            {driver.races.length}
                          </td>
                        </tr>

                        {/* Races for this driver */}
                        {isDriverExpanded &&
                          driver.races.map((race) => {
                            const isRaceExpanded = expanded.races.has(race.raceId)

                            return (
                              <Fragment key={`${driver.driverId}-${race.raceId}`}>
                                {/* Race Row */}
                                <tr
                                  className="bg-[var(--token-surface-raised)] border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-elevated)] transition-colors cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleRace(race.raceId)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault()
                                      toggleRace(race.raceId)
                                    }
                                  }}
                                  tabIndex={0}
                                  role="button"
                                  aria-expanded={isRaceExpanded}
                                  aria-label={`${race.raceLabel} - Click to ${isRaceExpanded ? "collapse" : "expand"} laps`}
                                >
                                  <td className="px-4 py-2 pl-12 text-sm font-normal">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="text-[var(--token-text-secondary)] transition-transform"
                                        style={{
                                          transform: isRaceExpanded
                                            ? "rotate(90deg)"
                                            : "rotate(0deg)",
                                          display: "inline-block",
                                        }}
                                        aria-hidden="true"
                                      >
                                        ▶
                                      </span>
                                      <span className="text-[var(--token-text-primary)]">
                                        {race.raceLabel}
                                      </span>
                                      <span className="text-xs text-[var(--token-text-secondary)]">
                                        ({race.className})
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-sm font-normal text-[var(--token-text-primary)]">
                                    {formatLapTime(race.bestLapTime)}
                                  </td>
                                  <td className="px-4 py-2 text-sm font-normal text-[var(--token-text-primary)] text-center">
                                    {race.totalLaps}
                                  </td>
                                  <td className="px-4 py-2 text-sm font-normal text-[var(--token-text-secondary)] text-center">
                                    Avg: {formatLapTime(race.avgLapTime)}
                                  </td>
                                </tr>

                                {/* Laps for this race */}
                                {isRaceExpanded && (
                                  <tr key={`${driver.driverId}-${race.raceId}-laps`}>
                                    <td colSpan={4} className="px-4 py-2 pl-20">
                                      <div className="overflow-x-auto">
                                        <table className="w-full min-w-[800px]">
                                          <thead className="bg-[var(--token-surface-alt)]">
                                            <tr>
                                              <th className="px-3 py-2 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                                                Lap #
                                              </th>
                                              <th className="px-3 py-2 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                                                Lap Time
                                              </th>
                                              <th className="px-3 py-2 text-center text-sm font-medium text-[var(--token-text-secondary)]">
                                                Position
                                              </th>
                                              <th className="px-3 py-2 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                                                Elapsed Time
                                              </th>
                                              <th className="px-3 py-2 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                                                Pace
                                              </th>
                                              <th className="px-3 py-2 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                                                Delta
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {race.laps.map((lap) => {
                                              const delta = getTimeDelta(
                                                lap.lapTimeSeconds,
                                                race.bestLapTime
                                              )
                                              const isBest = isBestLap(
                                                lap.lapTimeSeconds,
                                                race.bestLapTime
                                              )

                                              return (
                                                <tr
                                                  key={lap.lapId}
                                                  className={`border-b border-[var(--token-border-default)]/50 ${
                                                    isBest
                                                      ? "bg-[var(--token-accent)]/10"
                                                      : "hover:bg-[var(--token-surface-raised)]"
                                                  }`}
                                                >
                                                  <td className="px-3 py-2 text-sm text-[var(--token-text-primary)]">
                                                    {lap.lapNumber}
                                                    {isBest && (
                                                      <span
                                                        className="ml-1 text-[var(--token-accent)]"
                                                        aria-label="Best lap"
                                                        title="Best lap"
                                                      >
                                                        ★
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="px-3 py-2 text-sm text-[var(--token-text-primary)] font-mono">
                                                    {formatLapTime(lap.lapTimeSeconds)}
                                                  </td>
                                                  <td className="px-3 py-2 text-sm text-[var(--token-text-primary)] text-center">
                                                    {lap.positionOnLap}
                                                  </td>
                                                  <td className="px-3 py-2 text-sm text-[var(--token-text-secondary)] font-mono">
                                                    {formatLapTime(lap.elapsedRaceTime)}
                                                  </td>
                                                  <td className="px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                                                    {lap.paceString || "—"}
                                                  </td>
                                                  <td className="px-3 py-2 text-sm font-mono">
                                                    {delta !== null ? (
                                                      <span
                                                        className={
                                                          delta === 0
                                                            ? "text-[var(--token-accent)]"
                                                            : delta > 0
                                                              ? "text-[var(--token-text-secondary)]"
                                                              : "text-[var(--token-text-error)]"
                                                        }
                                                      >
                                                        {delta > 0 ? "+" : delta < 0 ? "-" : ""}
                                                        {formatLapTime(Math.abs(delta))}
                                                      </span>
                                                    ) : (
                                                      <span className="text-[var(--token-text-secondary)]">
                                                        —
                                                      </span>
                                                    )}
                                                  </td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          })}
                      </Fragment>
                    )
                  })
                : // Race View
                  (paginatedItems as RaceGroupedLapData[]).map((race) => {
                    const isRaceExpanded = expandedRaces.has(race.raceId)

                    return (
                      <Fragment key={race.raceId}>
                        {/* Race Row */}
                        <tr
                          className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)] transition-colors cursor-pointer"
                          onClick={() => toggleRaceView(race.raceId)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              toggleRaceView(race.raceId)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-expanded={isRaceExpanded}
                          aria-label={`${race.raceLabel} - Click to ${isRaceExpanded ? "collapse" : "expand"} drivers`}
                        >
                          <td className="px-4 py-3 text-sm font-normal">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[var(--token-text-secondary)] transition-transform"
                                style={{
                                  transform: isRaceExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                  display: "inline-block",
                                }}
                                aria-hidden="true"
                              >
                                ▶
                              </span>
                              <span className="text-[var(--token-text-primary)]">
                                {race.raceLabel}
                              </span>
                              <span className="text-xs text-[var(--token-text-secondary)]">
                                ({race.className})
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)]">
                            {formatLapTime(race.bestLapTime)}
                          </td>
                          <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)] text-center">
                            {race.totalLaps}
                          </td>
                          <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)] text-center">
                            {race.totalDrivers}
                          </td>
                        </tr>

                        {/* Drivers for this race */}
                        {isRaceExpanded &&
                          race.drivers.map((driver) => {
                            const driverRace = driver.races[0] // Only one race per driver in race view
                            const isDriverExpanded = expanded.drivers.has(driver.driverId)

                            return (
                              <Fragment key={`${race.raceId}-${driver.driverId}`}>
                                {/* Driver Row */}
                                <tr
                                  className="bg-[var(--token-surface-raised)] border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-elevated)] transition-colors cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleDriver(driver.driverId)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault()
                                      toggleDriver(driver.driverId)
                                    }
                                  }}
                                  tabIndex={0}
                                  role="button"
                                  aria-expanded={isDriverExpanded}
                                  aria-label={`${driver.driverName} - Click to ${isDriverExpanded ? "collapse" : "expand"} laps`}
                                >
                                  <td className="px-4 py-2 pl-12 text-sm font-normal">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="text-[var(--token-text-secondary)] transition-transform"
                                        style={{
                                          transform: isDriverExpanded
                                            ? "rotate(90deg)"
                                            : "rotate(0deg)",
                                          display: "inline-block",
                                        }}
                                        aria-hidden="true"
                                      >
                                        ▶
                                      </span>
                                      <span className="text-[var(--token-text-primary)]">
                                        {driver.driverName}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 text-sm font-normal text-[var(--token-text-primary)]">
                                    {formatLapTime(driverRace.bestLapTime)}
                                  </td>
                                  <td className="px-4 py-2 text-sm font-normal text-[var(--token-text-primary)] text-center">
                                    {driverRace.totalLaps}
                                  </td>
                                  <td className="px-4 py-2 text-sm font-normal text-[var(--token-text-secondary)] text-center">
                                    Avg: {formatLapTime(driverRace.avgLapTime)}
                                  </td>
                                </tr>

                                {/* Laps for this driver in this race */}
                                {isDriverExpanded && (
                                  <tr key={`${race.raceId}-${driver.driverId}-laps`}>
                                    <td colSpan={4} className="px-4 py-2 pl-20">
                                      <div className="overflow-x-auto">
                                        <table className="w-full min-w-[800px]">
                                          <thead className="bg-[var(--token-surface-alt)]">
                                            <tr>
                                              <th className="px-3 py-2 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                                                Lap #
                                              </th>
                                              <th className="px-3 py-2 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                                                Lap Time
                                              </th>
                                              <th className="px-3 py-2 text-center text-sm font-medium text-[var(--token-text-secondary)]">
                                                Position
                                              </th>
                                              <th className="px-3 py-2 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                                                Elapsed Time
                                              </th>
                                              <th className="px-3 py-2 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                                                Pace
                                              </th>
                                              <th className="px-3 py-2 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                                                Delta
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {driverRace.laps.map((lap) => {
                                              const delta = getTimeDelta(
                                                lap.lapTimeSeconds,
                                                driverRace.bestLapTime
                                              )
                                              const isBest = isBestLap(
                                                lap.lapTimeSeconds,
                                                driverRace.bestLapTime
                                              )

                                              return (
                                                <tr
                                                  key={lap.lapId}
                                                  className={`border-b border-[var(--token-border-default)]/50 ${
                                                    isBest
                                                      ? "bg-[var(--token-accent)]/10"
                                                      : "hover:bg-[var(--token-surface-raised)]"
                                                  }`}
                                                >
                                                  <td className="px-3 py-2 text-sm text-[var(--token-text-primary)]">
                                                    {lap.lapNumber}
                                                    {isBest && (
                                                      <span
                                                        className="ml-1 text-[var(--token-accent)]"
                                                        aria-label="Best lap"
                                                        title="Best lap"
                                                      >
                                                        ★
                                                      </span>
                                                    )}
                                                  </td>
                                                  <td className="px-3 py-2 text-sm text-[var(--token-text-primary)] font-mono">
                                                    {formatLapTime(lap.lapTimeSeconds)}
                                                  </td>
                                                  <td className="px-3 py-2 text-sm text-[var(--token-text-primary)] text-center">
                                                    {lap.positionOnLap}
                                                  </td>
                                                  <td className="px-3 py-2 text-sm text-[var(--token-text-secondary)] font-mono">
                                                    {formatLapTime(lap.elapsedRaceTime)}
                                                  </td>
                                                  <td className="px-3 py-2 text-sm text-[var(--token-text-secondary)]">
                                                    {lap.paceString || "—"}
                                                  </td>
                                                  <td className="px-3 py-2 text-sm font-mono">
                                                    {delta !== null ? (
                                                      <span
                                                        className={
                                                          delta === 0
                                                            ? "text-[var(--token-accent)]"
                                                            : delta > 0
                                                              ? "text-[var(--token-text-secondary)]"
                                                              : "text-[var(--token-text-error)]"
                                                        }
                                                      >
                                                        {delta > 0 ? "+" : delta < 0 ? "-" : ""}
                                                        {formatLapTime(Math.abs(delta))}
                                                      </span>
                                                    ) : (
                                                      <span className="text-[var(--token-text-secondary)]">
                                                        —
                                                      </span>
                                                    )}
                                                  </td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          })}
                      </Fragment>
                    )
                  })}
            </tbody>
          </table>

          {displayItems.length === 0 && (
            <div className="flex items-center justify-center py-12 text-[var(--token-text-secondary)]">
              {driverFilter
                ? viewMode === "driver"
                  ? `No drivers match "${driverFilter}"`
                  : `No races match "${driverFilter}"`
                : viewMode === "driver"
                  ? "No drivers found"
                  : "No races found"}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <ListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={pageSize}
            totalItems={filteredAndSortedDrivers.length}
            itemLabel={viewMode === "driver" ? "drivers" : "races"}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
            onRowsPerPageChange={(newRowsPerPage) => {
              setPageSize(newRowsPerPage)
              setCurrentPage(1)
            }}
          />
        )}

        {/* Results summary */}
        <div className="text-sm text-[var(--token-text-secondary)] text-center">
          <span>
            Showing {paginatedItems.length} of {displayItems.length}{" "}
            {viewMode === "driver" ? "driver" : "race"}
            {displayItems.length !== 1 ? "s" : ""}
            {driverFilter && ` matching "${driverFilter}"`}
          </span>
        </div>
      </div>
    </ChartContainer>
  )
}
