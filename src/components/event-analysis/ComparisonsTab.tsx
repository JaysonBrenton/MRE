/**
 * @fileoverview Comparisons tab - lap time line graph for race comparison
 * 
 * @created 2025-01-28
 * @creator Auto-generated
 * @lastModified 2025-01-28
 * 
 * @description Tab content for comparing lap times across drivers in a selected race
 * 
 * @purpose Provides race selection and lap time visualization for driver comparisons.
 * 
 * @relatedFiles
 * - src/components/event-analysis/RaceSelector.tsx (race selection)
 * - src/components/event-analysis/LapTimeLineChart.tsx (chart component)
 */

"use client"

import { useState, useEffect, useMemo } from "react"
import RaceSelector, { type Race } from "./RaceSelector"
import LapTimeLineChart, { type DriverLapData } from "./LapTimeLineChart"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import type { DriverLapData as ApiDriverLapData } from "@/core/events/get-lap-data"

export interface ComparisonsTabProps {
  selectedClass: string | null
  eventId: string
  data?: EventAnalysisData
}

export default function ComparisonsTab({
  selectedClass,
  eventId,
  data,
}: ComparisonsTabProps) {
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null)
  const [lapData, setLapData] = useState<ApiDriverLapData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debug: Log data on mount and when it changes
  useEffect(() => {
    console.log("[ComparisonsTab] ====== Component mounted/updated =====", {
      hasData: !!data,
      racesCount: data?.races?.length ?? 0,
      selectedClass,
      eventId,
      dataKeys: data ? Object.keys(data) : [],
      dataType: typeof data,
      racesType: typeof data?.races,
      isRacesArray: Array.isArray(data?.races),
    })
    if (data) {
      console.log("[ComparisonsTab] Full data structure:", {
        event: data.event,
        summary: data.summary,
        racesLength: data.races?.length,
        races: data.races,
      })
    }
    if (data?.races && Array.isArray(data.races)) {
      console.log("[ComparisonsTab] Races data:", data.races.map(r => ({
        id: r.id,
        raceLabel: r.raceLabel,
        className: r.className,
        startTime: r.startTime,
      })))
    } else if (data?.races) {
      console.warn("[ComparisonsTab] races is not an array!", {
        races: data.races,
        type: typeof data.races,
        constructor: data.races?.constructor?.name,
      })
    }
  }, [data, selectedClass, eventId])

  // Get available races from data
  const availableRaces = useMemo<Race[]>(() => {
    console.log("[ComparisonsTab] Computing availableRaces", {
      hasData: !!data,
      hasRaces: !!data?.races,
      racesLength: data?.races?.length ?? 0,
    })
    
    if (!data) {
      console.warn("[ComparisonsTab] No data prop provided")
      return []
    }
    if (!data.races) {
      console.warn("[ComparisonsTab] No races property in data", { 
        dataKeys: Object.keys(data),
        data 
      })
      return []
    }
    if (!Array.isArray(data.races)) {
      console.warn("[ComparisonsTab] races is not an array", { 
        racesType: typeof data.races,
        races: data.races 
      })
      return []
    }
    if (data.races.length === 0) {
      console.warn("[ComparisonsTab] Races array is empty", { 
        eventId: data.event.id,
        eventName: data.event.eventName,
        summary: data.summary 
      })
      return []
    }
    const races = data.races.map((race) => ({
      id: race.id,
      raceLabel: race.raceLabel,
      className: race.className,
      startTime: race.startTime,
    }))
    console.log("[ComparisonsTab] Mapped races:", races.length, races)
    return races
  }, [data])

  // Filter races by selected class
  const filteredRaces = useMemo(() => {
    console.log("[ComparisonsTab] Filtering races", {
      availableRacesCount: availableRaces.length,
      selectedClass,
      selectedClassType: typeof selectedClass,
      willFilter: !!selectedClass,
    })
    
    // If no class is selected, show all races
    if (!selectedClass || selectedClass === null || selectedClass === undefined || selectedClass.trim() === "") {
      console.log("[ComparisonsTab] No class filter, returning all races:", availableRaces.length)
      return availableRaces
    }
    
    // Filter by class
    const filtered = availableRaces.filter((race) => {
      const matches = race.className === selectedClass
      console.log("[ComparisonsTab] Race filter check:", {
        raceLabel: race.raceLabel,
        raceClassName: race.className,
        selectedClass,
        matches,
      })
      return matches
    })
    
    console.log("[ComparisonsTab] Filtered races by class:", {
      selectedClass,
      before: availableRaces.length,
      after: filtered.length,
      availableClasses: Array.from(new Set(availableRaces.map(r => r.className))),
      races: filtered.map(r => ({ id: r.id, label: r.raceLabel, className: r.className })),
    })
    
    // If filtering resulted in no races but we have races available, show all races as fallback
    if (filtered.length === 0 && availableRaces.length > 0) {
      console.warn("[ComparisonsTab] Filtering by class resulted in 0 races, showing all races as fallback")
      return availableRaces
    }
    
    return filtered
  }, [availableRaces, selectedClass])

  // Auto-select first race if available and none selected
  useEffect(() => {
    if (!selectedRaceId && filteredRaces.length > 0) {
      setSelectedRaceId(filteredRaces[0].id)
    }
  }, [selectedRaceId, filteredRaces])

  // Fetch lap data when race is selected
  useEffect(() => {
    if (!selectedRaceId || !eventId) {
      setLapData([])
      return
    }

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
          } catch (parseError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`
          }
          throw new Error(errorMessage)
        }

        const result = await response.json()

        if (!result.success) {
          const errorMessage =
            result.error?.message || result.error?.details || "Failed to fetch lap data"
          throw new Error(errorMessage)
        }

        // Transform API data to chart format, filtering by selected race
        const allDrivers = result.data.drivers || []
        const chartData: DriverLapData[] = []

        for (const driver of allDrivers) {
          // Find the race data for the selected race
          const raceData = driver.races.find((r: { raceId: string }) => r.raceId === selectedRaceId)

          if (raceData && raceData.laps && raceData.laps.length > 0) {
            chartData.push({
              driverId: driver.driverId,
              driverName: driver.driverName,
              laps: raceData.laps
                .map((lap: { lapNumber: number; lapTimeSeconds: number }) => ({
                  lapNumber: lap.lapNumber,
                  lapTimeSeconds: lap.lapTimeSeconds,
                }))
                .sort((a: { lapNumber: number }, b: { lapNumber: number }) => a.lapNumber - b.lapNumber),
            })
          }
        }

        setLapData(chartData)
      } catch (err) {
        console.error("[ComparisonsTab] Error fetching lap data:", err)
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred while fetching lap data"
        setError(errorMessage)
        setLapData([])
      } finally {
        setLoading(false)
      }
    }

    fetchLapData()
  }, [selectedRaceId, eventId, selectedClass])

  return (
    <div
      className="space-y-6"
      role="tabpanel"
      id="tabpanel-comparisons"
      aria-labelledby="tab-comparisons"
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
              : !data.races
                ? "Race data is not available"
                : data.races.length === 0
                  ? "This event has no races"
                  : selectedClass
                    ? `No races available for class "${selectedClass}". Available classes: ${Array.from(new Set(availableRaces.map(r => r.className))).join(", ")}`
                    : `No races available. Available races: ${availableRaces.length}, Filtered: ${filteredRaces.length}`}
          </p>
          {!data && (
            <p className="text-xs text-[var(--token-text-muted)] mt-2">
              If this message persists, the event data may not have loaded correctly.
            </p>
          )}
          {data && data.races && data.races.length > 0 && filteredRaces.length === 0 && (
            <p className="text-xs text-[var(--token-text-muted)] mt-2">
              Debug: {availableRaces.length} races available, but {filteredRaces.length} after filtering by class "{selectedClass}"
            </p>
          )}
        </div>
      )}

      {/* Lap Time Chart */}
      {selectedRaceId && (
        <div>
          {loading ? (
            <div className="flex items-center justify-center h-64 text-[var(--token-text-secondary)]">
              Loading lap data...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-[var(--token-text-error)]">
              Error: {error}
            </div>
          ) : lapData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-[var(--token-text-secondary)]">
              No lap data available for the selected race
            </div>
          ) : (
            <LapTimeLineChart
              data={lapData}
              height={500}
              chartInstanceId={`lap-time-chart-${eventId}-${selectedRaceId}`}
              selectedClass={selectedClass}
            />
          )}
        </div>
      )}
    </div>
  )
}
