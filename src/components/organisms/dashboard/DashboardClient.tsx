"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { fetchEventData, fetchRecentEvents } from "@/store/slices/dashboardSlice"
import {
  formatDateLong,
  formatLapTime,
  formatPositionImprovement,
  formatLapTimeImprovement,
} from "@/lib/date-utils"
import type { EventAnalysisSummary, ImportedEventSummary } from "@root-types/dashboard"
import ImprovementDriverCard from "./ImprovementDriverCard"
import ChartContainer from "../event-analysis/ChartContainer"
import { useDashboardEventSearch } from "./DashboardEventSearchProvider"
// Event analysis functionality is now handled by EventAnalysisSection component
// which uses the same analysis data endpoints but displays in the dashboard
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

interface WeatherData {
  condition: string
  wind: string
  humidity: number
  air: number
  track: number
  precip: number
  forecast: Array<{ label: string; detail: string }>
  cachedAt?: string
  isCached?: boolean
}

interface KpiDatum {
  id: string
  label: string
  value: string
  helper: string
  trendLabel: string
  trendDelta: number
  trendValueDisplay: string
  sparkline: number[]
}

interface AlertItem {
  id: string
  label: string
  severity: "green" | "amber" | "red"
  timestamp: string
  detail: string
}

interface ActivityItem {
  id: string
  title: string
  detail: string
  timestamp: string
  type: "engineer" | "system"
}

export default function DashboardClient() {
  const dispatch = useAppDispatch()
  const selectedEventId = useAppSelector((state) => state.dashboard.selectedEventId)
  const eventData = useAppSelector((state) => state.dashboard.eventData)
  const eventError = useAppSelector((state) => state.dashboard.eventError)
  const isEventLoading = useAppSelector((state) => state.dashboard.isEventLoading)
  // Check if Redux has rehydrated from sessionStorage
  // This prevents showing empty states during the brief rehydration window after hard reload
  const isRehydrated = useAppSelector((state) => {
    const dashboardState = state.dashboard as typeof state.dashboard & {
      _persist?: { rehydrated?: boolean }
    }
    return dashboardState._persist?.rehydrated ?? true
  })

  // Extract event data fields
  const selectedEvent = eventData?.event ?? null
  const eventSummary = eventData?.summary ?? null
  const topDrivers = eventData?.topDrivers
  const mostConsistentDrivers = eventData?.mostConsistentDrivers
  const bestAvgLapDrivers = eventData?.bestAvgLapDrivers
  const mostImprovedDrivers = eventData?.mostImprovedDrivers
  const userBestLap = eventData?.userBestLap
  const userBestConsistency = eventData?.userBestConsistency
  const userBestAvgLap = eventData?.userBestAvgLap

  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const { openEventSearch } = useDashboardEventSearch()
  // analysisData removed - dashboard now uses summary data from Redux store only
  // Full analysis data is loaded by EventAnalysisSection component on the dashboard

  // Fetch recent events on mount (runs in background, doesn't block UI)
  useEffect(() => {
    dispatch(fetchRecentEvents("all"))
  }, [dispatch])

  // Fetch event data when selectedEventId changes
  useEffect(() => {
    if (!selectedEventId) {
      return
    }

    const promise = dispatch(fetchEventData(selectedEventId))

    return () => {
      promise.abort()
    }
  }, [dispatch, selectedEventId])

  // Reset weather state when event is deselected
  useEffect(() => {
    if (!selectedEvent?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWeather(null)

      setWeatherError(null)
    }
  }, [selectedEvent?.id])

  // Fetch weather data when event is selected
  useEffect(() => {
    if (!selectedEvent?.id) {
      return
    }

    // Create AbortController to cancel request if event changes
    const abortController = new AbortController()
    const eventId = selectedEvent.id

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWeatherLoading(true)

    setWeatherError(null)

    fetch(`/api/v1/events/${eventId}/weather`, {
      cache: "no-store",
      signal: abortController.signal,
    })
      .then(async (response) => {
        // Check if request was aborted
        if (abortController.signal.aborted) {
          return
        }

        if (!response.ok) {
          if (response.status === 404) {
            setWeatherError("Event not found")
            return
          }
          const errorData = await response.json().catch(() => ({}))
          setWeatherError(errorData.error?.message || "Failed to load weather data")
          return
        }

        const result = await response.json()

        // Check again if request was aborted before updating state
        if (abortController.signal.aborted) {
          return
        }

        // Verify this response is for the current event
        if (selectedEvent?.id === eventId) {
          if (result.success && result.data) {
            setWeather(result.data)
          } else {
            setWeatherError("Invalid response from server")
          }
        }
      })
      .catch((error) => {
        // Ignore abort errors
        if (error.name === "AbortError") {
          return
        }
        console.error("Error fetching weather data", error)
        // Only set error if this is still the active event
        if (selectedEvent?.id === eventId) {
          setWeatherError("Failed to fetch weather data")
        }
      })
      .finally(() => {
        // Only update loading state if this is still the active event
        if (selectedEvent?.id === eventId) {
          setWeatherLoading(false)
        }
      })

    // Cleanup: abort request if event changes or component unmounts
    return () => {
      abortController.abort()
    }
  }, [selectedEvent?.id])

  // Full analysis data fetching removed - dashboard now uses summary endpoint only
  // Summary data is provided by Redux store (fetches from /api/v1/events/[eventId]/summary)
  // Full analysis data is loaded by EventAnalysisSection component on the dashboard

  // Show loading state during rehydration (prevents showing empty state when event is being restored)
  // This is the only loading message shown during initial page load
  if (!isRehydrated) {
    return (
      <div className="flex flex-col gap-6 mt-6">
        <div className="rounded-3xl border border-[var(--token-border-default)] bg-gradient-to-br from-[var(--token-surface-elevated)] to-[var(--token-surface-raised)] p-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.15),0_0_1px_rgba(255,255,255,0.05)]">
          <p className="text-sm text-[var(--token-text-secondary)]">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Show loading state when event is selected but data is still loading
  if (selectedEventId && !selectedEvent && isEventLoading) {
    return (
      <div className="flex flex-col gap-6 mt-6">
        <div className="rounded-3xl border border-[var(--token-border-default)] bg-gradient-to-br from-[var(--token-surface-elevated)] to-[var(--token-surface-raised)] p-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.15),0_0_1px_rgba(255,255,255,0.05)]">
          <p className="text-sm text-[var(--token-text-secondary)]">Loading event data...</p>
        </div>
      </div>
    )
  }

  // Empty state - no event selected (only show after rehydration confirms no event)
  if (!selectedEvent) {
    return <DashboardEmptyState onOpenEventSearch={openEventSearch} />
  }

  // Error state - show empty state with error message
  if (eventError && !selectedEvent) {
    return <DashboardEmptyState onOpenEventSearch={openEventSearch} error={eventError} />
  }

  return (
    <div className="flex flex-col gap-[var(--dashboard-gap)]">
      {/* Event Analysis Features removed from dashboard
          Full analysis is available in the Event Analysis section below
          Dashboard uses summary data from Redux store for performance */}
    </div>
  )
}

function DashboardEmptyState({
  onOpenEventSearch,
  error,
}: {
  onOpenEventSearch: () => void
  error?: string | null
}) {
  return (
    <div className="flex flex-col gap-6 mt-6">
      <div className="rounded-3xl border border-[var(--token-border-default)] bg-gradient-to-br from-[var(--token-surface-elevated)] to-[var(--token-surface-raised)] p-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.15),0_0_1px_rgba(255,255,255,0.05)]">
        <h2 className="text-2xl font-bold text-[var(--token-text-primary)] mb-2">
          Select an Event
        </h2>
        <p className="text-sm text-[var(--token-text-secondary)] mb-6">
          Search for an event to view analysis and insights
        </p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--token-status-error-bg)] border border-[var(--token-status-error-text)]/20">
            <p className="text-sm text-[var(--token-status-error-text)]">{error}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onOpenEventSearch}
          className="px-6 py-3 rounded-lg bg-[var(--token-accent)] text-[var(--token-text-on-accent)] font-semibold hover:opacity-90 transition shadow-[0_2px_8px_rgba(58,142,255,0.3)] hover:shadow-[0_4px_12px_rgba(58,142,255,0.4)]"
        >
          Search for Events
        </button>
      </div>
    </div>
  )
}

function DashboardHero({
  event,
  summary,
  weather,
  weatherLoading,
  weatherError,
}: {
  event: EventAnalysisSummary["event"]
  summary: EventAnalysisSummary["summary"] | null
  weather: WeatherData | null
  weatherLoading: boolean
  weatherError: string | null
}) {
  const eventDate = event?.eventDate ? new Date(event.eventDate) : null

  return null
}

// DriverCardsAndWeatherGrid component - moved from DashboardHero
// This component contains the driver cards carousel and weather panel grid
export function DriverCardsAndWeatherGrid({
  event,
  topDrivers,
  mostConsistentDrivers,
  bestAvgLapDrivers,
  mostImprovedDrivers,
  userBestLap,
  userBestConsistency,
  userBestAvgLap,
  userBestImprovement,
  weather,
  weatherLoading,
  weatherError,
  selectedClass,
  selectedDriverIds,
  races,
}: {
  event: EventAnalysisSummary["event"]
  topDrivers?: EventAnalysisSummary["topDrivers"]
  mostConsistentDrivers?: EventAnalysisSummary["mostConsistentDrivers"]
  bestAvgLapDrivers?: EventAnalysisSummary["bestAvgLapDrivers"]
  mostImprovedDrivers?: EventAnalysisSummary["mostImprovedDrivers"]
  userBestLap?: EventAnalysisSummary["userBestLap"]
  userBestConsistency?: EventAnalysisSummary["userBestConsistency"]
  userBestAvgLap?: EventAnalysisSummary["userBestAvgLap"]
  userBestImprovement?: EventAnalysisSummary["userBestImprovement"]
  weather: WeatherData | null
  weatherLoading: boolean
  weatherError: string | null
  selectedClass?: string | null
  selectedDriverIds?: string[]
  races?: EventAnalysisData["races"]
}) {
  const eventDate = event?.eventDate ? new Date(event.eventDate) : null
  const [currentSection, setCurrentSection] = useState(0)
  const [currentClassIndex, setCurrentClassIndex] = useState<number>(0)
  const carouselRef = useRef<HTMLDivElement>(null)
  const sectionRef0 = useRef<HTMLDivElement>(null)
  const sectionRef1 = useRef<HTMLDivElement>(null)
  const sectionRef2 = useRef<HTMLDivElement>(null)
  const sectionRef3 = useRef<HTMLDivElement>(null)

  const sectionRefs = useMemo(() => [sectionRef0, sectionRef1, sectionRef2, sectionRef3], [])
  const autoScrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isUserInteractingRef = useRef(false)
  const currentSectionRef = useRef(0)
  const previousSectionRef = useRef<number>(0)
  const isProgrammaticScrollRef = useRef(false)
  const userInteractionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const programmaticScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const sections = [
    { title: "Fastest Laps", data: topDrivers, type: "fastest" as const },
    { title: "Most Consistent Drivers", data: mostConsistentDrivers, type: "consistency" as const },
    { title: "Best Overall Average Lap", data: bestAvgLapDrivers, type: "avgLap" as const },
    { title: "Most Improved", data: mostImprovedDrivers, type: "improvement" as const },
  ]

  const hasData =
    topDrivers?.length ||
    mostConsistentDrivers?.length ||
    bestAvgLapDrivers?.length ||
    mostImprovedDrivers?.length

  // Only show driver cards if a class is selected OR more than 1 driver is selected
  const shouldShowDriverCards =
    hasData &&
    ((selectedClass !== null && selectedClass !== undefined) ||
      (selectedDriverIds && selectedDriverIds.length > 1))

  // Get union of all classes from all sections (all classes that appear in any section)
  const getAllClasses = (): string[] => {
    const allClassesSet = new Set<string>()

    // Add all classes from each section
    topDrivers?.forEach((d) => allClassesSet.add(d.className))
    mostConsistentDrivers?.forEach((d) => allClassesSet.add(d.className))
    bestAvgLapDrivers?.forEach((d) => allClassesSet.add(d.className))
    mostImprovedDrivers?.forEach((d) => allClassesSet.add(d.className))

    // Add all classes from races data
    races?.forEach((race) => {
      if (race.className) {
        allClassesSet.add(race.className)
      }
    })

    // Return sorted array of all unique classes
    return Array.from(allClassesSet).sort()
  }

  const allClasses = getAllClasses()

  // Calculate user metrics filtered by selected class
  const filteredUserMetrics = useMemo(() => {
    // If no class is selected (null, undefined, or empty string), use original metrics (show all classes)
    // Don't require races or userBestLap when no class is selected - always show original metrics
    if (
      !selectedClass ||
      selectedClass === "" ||
      selectedClass === null ||
      selectedClass === undefined
    ) {
      return {
        userBestLap,
        userBestConsistency,
        userBestAvgLap,
        userBestImprovement,
      }
    }

    // If class is selected but we don't have races data, return original metrics (fallback)
    // This ensures the card still shows even if races data isn't loaded yet
    if (!races || races.length === 0) {
      return {
        userBestLap,
        userBestConsistency,
        userBestAvgLap,
        userBestImprovement,
      }
    }

    // If class is selected but we don't have userBestLap data, return null (hide card)
    // This means the user has no lap data at all
    if (!userBestLap) {
      return {
        userBestLap: null,
        userBestConsistency: null,
        userBestAvgLap: null,
        userBestImprovement: null,
      }
    }

    // Find user's driverId by matching userBestLap time in races
    // We search ALL races (not just selected class) to find the user's driverId
    // Then we filter by class to get their metrics for that class
    let userDriverId: string | null = null

    // First pass: exact match (within floating point precision)
    for (const race of races) {
      for (const result of race.results) {
        if (
          result.fastLapTime !== null &&
          Math.abs(result.fastLapTime - userBestLap.lapTime) < 0.0001
        ) {
          userDriverId = result.driverId
          break
        }
      }
      if (userDriverId) break
    }

    // Second pass: if no exact match, try with tolerance (0.01s)
    if (!userDriverId) {
      for (const race of races) {
        for (const result of race.results) {
          if (
            result.fastLapTime !== null &&
            Math.abs(result.fastLapTime - userBestLap.lapTime) < 0.01
          ) {
            userDriverId = result.driverId
            break
          }
        }
        if (userDriverId) break
      }
    }

    // Third pass: if still no match, find the driver with the closest lap time
    if (!userDriverId) {
      let closestDriverId: string | null = null
      let closestDiff = Infinity
      for (const race of races) {
        for (const result of race.results) {
          if (result.fastLapTime !== null) {
            const diff = Math.abs(result.fastLapTime - userBestLap.lapTime)
            if (diff < closestDiff) {
              closestDiff = diff
              closestDriverId = result.driverId
            }
          }
        }
      }
      // Only use closest match if it's within 0.1s (reasonable tolerance)
      if (closestDiff < 0.1 && closestDriverId) {
        userDriverId = closestDriverId
      }
    }

    // If we still couldn't find the user's driverId, fall back to showing original metrics
    // This ensures the card still shows even if matching fails (better UX than hiding it)
    if (!userDriverId) {
      return {
        userBestLap,
        userBestConsistency,
        userBestAvgLap,
        userBestImprovement,
      }
    }

    // Filter races by selected class
    const classRaces = races.filter((r) => r.className === selectedClass)

    // Check if user has any results in the selected class
    const userHasResultsInClass = classRaces.some((race) =>
      race.results.some((result) => result.driverId === userDriverId)
    )

    // If user has no results in selected class, return null metrics (hide card)
    if (!userHasResultsInClass) {
      return {
        userBestLap: null,
        userBestConsistency: null,
        userBestAvgLap: null,
        userBestImprovement: null,
      }
    }

    // Calculate user's best lap in selected class
    let userBestLapInClass: number | null = null
    let userBestLapRaceLabel: string | null = null
    for (const race of classRaces) {
      for (const result of race.results) {
        if (
          result.driverId === userDriverId &&
          result.fastLapTime !== null &&
          (userBestLapInClass === null || result.fastLapTime < userBestLapInClass)
        ) {
          userBestLapInClass = result.fastLapTime
          userBestLapRaceLabel = race.raceLabel
        }
      }
    }

    // Calculate user's best consistency in selected class
    let userBestConsistencyInClass: number | null = null
    for (const race of classRaces) {
      for (const result of race.results) {
        if (
          result.driverId === userDriverId &&
          result.consistency !== null &&
          (userBestConsistencyInClass === null || result.consistency > userBestConsistencyInClass)
        ) {
          userBestConsistencyInClass = result.consistency
        }
      }
    }

    // Calculate user's best average lap in selected class
    let userBestAvgLapInClass: number | null = null
    for (const race of classRaces) {
      for (const result of race.results) {
        if (
          result.driverId === userDriverId &&
          result.avgLapTime !== null &&
          (userBestAvgLapInClass === null || result.avgLapTime < userBestAvgLapInClass)
        ) {
          userBestAvgLapInClass = result.avgLapTime
        }
      }
    }

    // Calculate user's improvement in selected class
    let userImprovementInClass: {
      positionImprovement: number
      lapTimeImprovement: number | null
      firstRacePosition: number
      lastRacePosition: number
      className: string
      raceLabel: string
    } | null = null

    // Get all user's results in selected class, sorted by race order
    const userResultsInClass: Array<{
      positionFinal: number
      fastLapTime: number | null
      raceOrder: number | null
      startTime: Date | null
      raceLabel: string
    }> = []

    for (const race of classRaces) {
      for (const result of race.results) {
        if (result.driverId === userDriverId) {
          userResultsInClass.push({
            positionFinal: result.positionFinal,
            fastLapTime: result.fastLapTime,
            raceOrder: race.raceOrder,
            startTime: race.startTime,
            raceLabel: race.raceLabel,
          })
        }
      }
    }

    // Sort by raceOrder, then by startTime
    userResultsInClass.sort((a, b) => {
      const orderA = a.raceOrder ?? 0
      const orderB = b.raceOrder ?? 0
      if (orderA !== orderB) {
        return orderA - orderB
      }
      const timeA = a.startTime?.getTime() ?? 0
      const timeB = b.startTime?.getTime() ?? 0
      return timeA - timeB
    })

    if (userResultsInClass.length >= 2) {
      const firstRace = userResultsInClass[0]
      const lastRace = userResultsInClass[userResultsInClass.length - 1]
      const positionImprovement = firstRace.positionFinal - lastRace.positionFinal
      const lapTimeImprovement =
        firstRace.fastLapTime !== null && lastRace.fastLapTime !== null
          ? firstRace.fastLapTime - lastRace.fastLapTime
          : null

      userImprovementInClass = {
        positionImprovement,
        lapTimeImprovement,
        firstRacePosition: firstRace.positionFinal,
        lastRacePosition: lastRace.positionFinal,
        className: selectedClass,
        raceLabel: lastRace.raceLabel,
      }
    }

    // Calculate positions and gaps relative to other drivers in the class
    // For best lap: find position among all drivers' best laps in class
    let userBestLapPosition = 1
    let fastestLapInClass: number | null = null
    if (userBestLapInClass !== null) {
      const driverBestLaps = new Map<string, number>()
      for (const race of classRaces) {
        for (const result of race.results) {
          if (result.fastLapTime !== null) {
            const existing = driverBestLaps.get(result.driverId)
            if (!existing || result.fastLapTime < existing) {
              driverBestLaps.set(result.driverId, result.fastLapTime)
            }
          }
        }
      }
      const sortedBestLaps = Array.from(driverBestLaps.values()).sort((a, b) => a - b)
      fastestLapInClass = sortedBestLaps[0] ?? userBestLapInClass
      userBestLapPosition = sortedBestLaps.filter((time) => time < userBestLapInClass!).length + 1
    }

    // For consistency: find position among all drivers' best consistency in class
    let userConsistencyPosition = 1
    let bestConsistencyInClass: number | null = null
    if (userBestConsistencyInClass !== null) {
      const driverBestConsistencies = new Map<string, number>()
      for (const race of classRaces) {
        for (const result of race.results) {
          if (result.consistency !== null) {
            const existing = driverBestConsistencies.get(result.driverId)
            if (!existing || result.consistency > existing) {
              driverBestConsistencies.set(result.driverId, result.consistency)
            }
          }
        }
      }
      const sortedConsistencies = Array.from(driverBestConsistencies.values()).sort((a, b) => b - a)
      bestConsistencyInClass = sortedConsistencies[0] ?? userBestConsistencyInClass
      userConsistencyPosition =
        sortedConsistencies.filter((consistency) => consistency > userBestConsistencyInClass!)
          .length + 1
    }

    // For average lap: find position among all drivers' best average lap in class
    let userAvgLapPosition = 1
    let bestAvgLapInClass: number | null = null
    if (userBestAvgLapInClass !== null) {
      const driverBestAvgLaps = new Map<string, number>()
      for (const race of classRaces) {
        for (const result of race.results) {
          if (result.avgLapTime !== null) {
            const existing = driverBestAvgLaps.get(result.driverId)
            if (!existing || result.avgLapTime < existing) {
              driverBestAvgLaps.set(result.driverId, result.avgLapTime)
            }
          }
        }
      }
      const sortedAvgLaps = Array.from(driverBestAvgLaps.values()).sort((a, b) => a - b)
      bestAvgLapInClass = sortedAvgLaps[0] ?? userBestAvgLapInClass
      userAvgLapPosition =
        sortedAvgLaps.filter((avgLap) => avgLap < userBestAvgLapInClass!).length + 1
    }

    // For improvement: find position among all drivers' improvements in class
    let userImprovementPosition = 1
    let bestImprovementInClass = 0
    if (userImprovementInClass !== null) {
      // Calculate improvement for all drivers in class
      const driverImprovements = new Map<
        string,
        {
          positionImprovement: number
          firstRacePosition: number
          lastRacePosition: number
        }
      >()

      for (const driverId of new Set(
        classRaces.flatMap((race) => race.results.map((r) => r.driverId))
      )) {
        const driverResults: Array<{
          positionFinal: number
          raceOrder: number | null
          startTime: Date | null
        }> = []

        for (const race of classRaces) {
          for (const result of race.results) {
            if (result.driverId === driverId) {
              driverResults.push({
                positionFinal: result.positionFinal,
                raceOrder: race.raceOrder,
                startTime: race.startTime,
              })
            }
          }
        }

        driverResults.sort((a, b) => {
          const orderA = a.raceOrder ?? 0
          const orderB = b.raceOrder ?? 0
          if (orderA !== orderB) {
            return orderA - orderB
          }
          const timeA = a.startTime?.getTime() ?? 0
          const timeB = b.startTime?.getTime() ?? 0
          return timeA - timeB
        })

        if (driverResults.length >= 2) {
          const firstRace = driverResults[0]
          const lastRace = driverResults[driverResults.length - 1]
          const positionImprovement = firstRace.positionFinal - lastRace.positionFinal

          driverImprovements.set(driverId, {
            positionImprovement,
            firstRacePosition: firstRace.positionFinal,
            lastRacePosition: lastRace.positionFinal,
          })
        }
      }

      const sortedImprovements = Array.from(driverImprovements.values()).sort(
        (a, b) => b.positionImprovement - a.positionImprovement
      )
      bestImprovementInClass =
        sortedImprovements[0]?.positionImprovement ?? userImprovementInClass.positionImprovement
      userImprovementPosition =
        sortedImprovements.filter(
          (imp) => imp.positionImprovement > userImprovementInClass!.positionImprovement
        ).length + 1
    }

    return {
      userBestLap:
        userBestLapInClass !== null
          ? {
              lapTime: userBestLapInClass,
              position: userBestLapPosition,
              gapToFastest: fastestLapInClass !== null ? userBestLapInClass - fastestLapInClass : 0,
            }
          : null,
      userBestConsistency:
        userBestConsistencyInClass !== null
          ? {
              consistency: userBestConsistencyInClass,
              position: userConsistencyPosition,
              gapToBest:
                bestConsistencyInClass !== null
                  ? bestConsistencyInClass - userBestConsistencyInClass
                  : 0,
            }
          : null,
      userBestAvgLap:
        userBestAvgLapInClass !== null
          ? {
              avgLapTime: userBestAvgLapInClass,
              position: userAvgLapPosition,
              gapToBest: bestAvgLapInClass !== null ? userBestAvgLapInClass - bestAvgLapInClass : 0,
            }
          : null,
      userBestImprovement: userImprovementInClass
        ? {
            ...userImprovementInClass,
            position: userImprovementPosition,
            gapToBest: bestImprovementInClass - userImprovementInClass.positionImprovement,
          }
        : null,
    }
  }, [selectedClass, races, userBestLap, userBestConsistency, userBestAvgLap, userBestImprovement])

  // Calculate top drivers for a class from race data
  const calculateTopDriversForClass = useMemo(() => {
    return (className: string): NonNullable<EventAnalysisSummary["topDrivers"]> => {
      if (!races) return []

      const classRaces = races.filter((r) => r.className === className)
      const driverMap = new Map<
        string,
        {
          fastestLapTime: number
          driverName: string
          driverId: string
          className: string
          raceLabel: string
          raceId: string
        }
      >()

      classRaces.forEach((race) => {
        race.results.forEach((result) => {
          if (result.fastLapTime !== null && result.fastLapTime !== undefined) {
            const existing = driverMap.get(result.driverId)
            if (!existing || result.fastLapTime < existing.fastestLapTime) {
              driverMap.set(result.driverId, {
                fastestLapTime: result.fastLapTime,
                driverName: result.driverName,
                driverId: result.driverId,
                className: race.className,
                raceLabel: race.raceLabel,
                raceId: race.id,
              })
            }
          }
        })
      })

      return Array.from(driverMap.values())
        .sort((a, b) => a.fastestLapTime - b.fastestLapTime)
        .slice(0, 4)
    }
  }, [races])

  const calculateMostConsistentForClass = useMemo(() => {
    return (className: string): NonNullable<EventAnalysisSummary["mostConsistentDrivers"]> => {
      if (!races) return []

      const classRaces = races.filter((r) => r.className === className)
      const driverMap = new Map<
        string,
        {
          consistency: number
          driverName: string
          driverId: string
          className: string
          raceLabel: string
          raceId: string
        }
      >()

      classRaces.forEach((race) => {
        race.results.forEach((result) => {
          if (result.consistency !== null && result.consistency !== undefined) {
            const existing = driverMap.get(result.driverId)
            if (!existing || result.consistency > existing.consistency) {
              driverMap.set(result.driverId, {
                consistency: result.consistency,
                driverName: result.driverName,
                driverId: result.driverId,
                className: race.className,
                raceLabel: race.raceLabel,
                raceId: race.id,
              })
            }
          }
        })
      })

      return Array.from(driverMap.values())
        .sort((a, b) => b.consistency - a.consistency)
        .slice(0, 4)
    }
  }, [races])

  const calculateBestAvgLapForClass = useMemo(() => {
    return (className: string): NonNullable<EventAnalysisSummary["bestAvgLapDrivers"]> => {
      if (!races) return []

      const classRaces = races.filter((r) => r.className === className)
      const driverMap = new Map<
        string,
        {
          avgLapTime: number
          driverName: string
          driverId: string
          className: string
          raceLabel: string
          raceId: string
        }
      >()

      classRaces.forEach((race) => {
        race.results.forEach((result) => {
          if (result.avgLapTime !== null && result.avgLapTime !== undefined) {
            const existing = driverMap.get(result.driverId)
            if (!existing || result.avgLapTime < existing.avgLapTime) {
              driverMap.set(result.driverId, {
                avgLapTime: result.avgLapTime,
                driverName: result.driverName,
                driverId: result.driverId,
                className: race.className,
                raceLabel: race.raceLabel,
                raceId: race.id,
              })
            }
          }
        })
      })

      return Array.from(driverMap.values())
        .sort((a, b) => a.avgLapTime - b.avgLapTime)
        .slice(0, 4)
    }
  }, [races])

  // Group drivers by className for each section
  const groupDriversByClass = (
    drivers:
      | EventAnalysisSummary["topDrivers"]
      | EventAnalysisSummary["mostConsistentDrivers"]
      | EventAnalysisSummary["bestAvgLapDrivers"]
      | EventAnalysisSummary["mostImprovedDrivers"],
    type: "fastest" | "consistency" | "avgLap" | "improvement"
  ) => {
    if (!drivers || drivers.length === 0) return {}

    type DriverUnion =
      | NonNullable<EventAnalysisSummary["topDrivers"]>[number]
      | NonNullable<EventAnalysisSummary["mostConsistentDrivers"]>[number]
      | NonNullable<EventAnalysisSummary["bestAvgLapDrivers"]>[number]
      | NonNullable<EventAnalysisSummary["mostImprovedDrivers"]>[number]

    const grouped = drivers.reduce(
      (acc, driver) => {
        const className = driver.className
        if (!acc[className]) {
          acc[className] = []
        }
        acc[className].push(driver as DriverUnion)
        return acc
      },
      {} as Record<string, DriverUnion[]>
    )

    // Sort drivers within each class by their metric
    Object.keys(grouped).forEach((className) => {
      grouped[className].sort((a, b) => {
        if (type === "fastest" && "fastestLapTime" in a && "fastestLapTime" in b) {
          return (
            (a as { fastestLapTime: number }).fastestLapTime -
            (b as { fastestLapTime: number }).fastestLapTime
          )
        } else if (type === "consistency" && "consistency" in a && "consistency" in b) {
          return (
            (b as { consistency: number }).consistency - (a as { consistency: number }).consistency
          ) // Higher is better
        } else if (type === "avgLap" && "avgLapTime" in a && "avgLapTime" in b) {
          return (a as { avgLapTime: number }).avgLapTime - (b as { avgLapTime: number }).avgLapTime
        } else if (type === "improvement" && "improvementScore" in a && "improvementScore" in b) {
          return (
            (b as { improvementScore: number }).improvementScore -
            (a as { improvementScore: number }).improvementScore
          ) // Higher is better
        }
        return 0
      })
    })

    return grouped
  }

  // Get current class drivers for a section (using selectedClass prop or cycling)
  const getCurrentClassDrivers = (section: (typeof sections)[number]): DriverCardData[] => {
    // Use selectedClass prop when provided, otherwise use cycling with currentClassIndex
    const currentClass =
      selectedClass !== null && selectedClass !== undefined
        ? selectedClass
        : allClasses[currentClassIndex % allClasses.length]

    if (!currentClass) {
      // If no class selected and no classes available, show all drivers (top 4)
      if (allClasses.length === 0 && section.data) {
        return section.data.slice(0, 4) as DriverCardData[]
      }
      return []
    }

    // When a class is selected, always calculate from race data
    if (selectedClass !== null && selectedClass !== undefined && races) {
      let calculatedDrivers: DriverCardData[] = []

      if (section.type === "fastest") {
        calculatedDrivers = calculateTopDriversForClass(currentClass) as DriverCardData[]
      } else if (section.type === "consistency") {
        calculatedDrivers = calculateMostConsistentForClass(currentClass) as DriverCardData[]
      } else if (section.type === "avgLap") {
        calculatedDrivers = calculateBestAvgLapForClass(currentClass) as DriverCardData[]
      } else if (section.type === "improvement") {
        // For improvement, still use the summary data as it's calculated differently
        const grouped = groupDriversByClass(section.data, section.type)
        calculatedDrivers = (grouped[currentClass] || []).slice(0, 4) as DriverCardData[]
      }

      return calculatedDrivers.slice(0, 4)
    }

    // When cycling (no class selected), use summary data
    if (!section.data || section.data.length === 0) return []

    const grouped = groupDriversByClass(section.data, section.type)
    if (!grouped[currentClass]) return []

    // Return top 4 drivers from current class
    return grouped[currentClass].slice(0, 4) as DriverCardData[]
  }

  const scrollToSection = (index: number, isUserAction = false) => {
    if (isUserAction) {
      isUserInteractingRef.current = true
    } else {
      isProgrammaticScrollRef.current = true
      // Reset flag after scroll animation completes
      setTimeout(() => {
        isProgrammaticScrollRef.current = false
      }, 600)
    }
    const targetRef = sectionRefs[index]
    const carousel = carouselRef.current
    if (targetRef.current && carousel) {
      const sectionWidth = carousel.clientWidth
      carousel.scrollTo({
        left: index * sectionWidth,
        behavior: "smooth",
      })
      // Track previous section to detect cycle completion
      previousSectionRef.current = currentSection
      setCurrentSection(index)
      currentSectionRef.current = index
      // Class index stays the same when manually navigating
    }
  }

  const handlePrev = () => {
    if (currentSection > 0) {
      scrollToSection(currentSection - 1, true)
    }
  }

  const handleNext = () => {
    if (currentSection < sections.length - 1) {
      scrollToSection(currentSection + 1, true)
    }
  }

  // Auto-scroll functionality
  useEffect(() => {
    if (!shouldShowDriverCards || sections.length === 0) return

    // Initialize the ref with current section
    currentSectionRef.current = currentSection

    const autoScroll = () => {
      if (isUserInteractingRef.current) {
        // Reset the flag after a delay so auto-scroll resumes
        if (userInteractionTimeoutRef.current) {
          clearTimeout(userInteractionTimeoutRef.current)
        }
        userInteractionTimeoutRef.current = setTimeout(() => {
          isUserInteractingRef.current = false
          userInteractionTimeoutRef.current = null
        }, 10000) // Resume auto-scroll 10 seconds after user interaction
        return
      }

      const carousel = carouselRef.current
      if (!carousel) return

      const currentSectionIndex = currentSectionRef.current
      const nextSection = (currentSectionIndex + 1) % sections.length
      const targetRef = sectionRefs[nextSection]

      if (targetRef.current) {
        isProgrammaticScrollRef.current = true
        const sectionWidth = carousel.clientWidth
        carousel.scrollTo({
          left: nextSection * sectionWidth,
          behavior: "smooth",
        })

        // Detect cycle completion: when going from last section (2) to first (0)
        const isCycleComplete = currentSectionIndex === sections.length - 1 && nextSection === 0

        // Only advance class index when cycling automatically (selectedClass is null/undefined)
        if (
          isCycleComplete &&
          allClasses.length > 0 &&
          (selectedClass === null || selectedClass === undefined)
        ) {
          // Advance to next class when cycle completes
          setCurrentClassIndex((prev) => {
            const nextIndex = (prev + 1) % allClasses.length
            return nextIndex
          })
        }

        previousSectionRef.current = currentSectionIndex
        setCurrentSection(nextSection)
        currentSectionRef.current = nextSection

        // Reset flag after scroll animation completes
        if (programmaticScrollTimeoutRef.current) {
          clearTimeout(programmaticScrollTimeoutRef.current)
        }
        programmaticScrollTimeoutRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false
          programmaticScrollTimeoutRef.current = null
        }, 600)
      }
    }

    // Auto-scroll every 5 seconds (adjust as needed)
    autoScrollIntervalRef.current = setInterval(autoScroll, 5000)

    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current)
        autoScrollIntervalRef.current = null
      }
      if (userInteractionTimeoutRef.current) {
        clearTimeout(userInteractionTimeoutRef.current)
        userInteractionTimeoutRef.current = null
      }
      if (programmaticScrollTimeoutRef.current) {
        clearTimeout(programmaticScrollTimeoutRef.current)
        programmaticScrollTimeoutRef.current = null
      }
    }
  }, [shouldShowDriverCards, sections.length, currentSection, allClasses.length, selectedClass])

  // Update current section based on scroll position
  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    const handleScroll = () => {
      // Ignore scroll events from programmatic scrolling
      if (isProgrammaticScrollRef.current) return

      const scrollLeft = carousel.scrollLeft
      const sectionWidth = carousel.clientWidth
      const newSection = Math.round(scrollLeft / sectionWidth)
      if (newSection !== currentSection && newSection >= 0 && newSection < sections.length) {
        previousSectionRef.current = currentSection
        setCurrentSection(newSection)
        currentSectionRef.current = newSection
        // If scroll happened without using buttons, treat as user interaction
        isUserInteractingRef.current = true
        if (userInteractionTimeoutRef.current) {
          clearTimeout(userInteractionTimeoutRef.current)
        }
        userInteractionTimeoutRef.current = setTimeout(() => {
          isUserInteractingRef.current = false
          userInteractionTimeoutRef.current = null
        }, 10000)
      }
    }

    carousel.addEventListener("scroll", handleScroll, { passive: true })
    return () => carousel.removeEventListener("scroll", handleScroll)
  }, [currentSection, sections.length])

  return (
    <section className="grid grid-cols-12 gap-4 lg:gap-6">
      <div
        className="col-span-12 lg:col-span-8 relative"
        style={{
          borderRadius: "24px",
          border: "1px solid var(--glass-border)",
          backgroundColor: "var(--glass-bg)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
          boxShadow: "var(--glass-shadow), var(--glass-shadow-inset)",
          padding: "var(--dashboard-card-padding)",
          overflow: "hidden",
        }}
      >
        {/* Subtle gradient overlay for extra glass depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%)",
            borderRadius: "24px",
          }}
        />
        {/* Subtle top highlight for glass edge effect */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)",
            borderRadius: "24px 24px 0 0",
          }}
        />
        {/* Content wrapper */}
        <div className="relative z-10">
          {shouldShowDriverCards ? (
            <>
              <div className="mb-6">
                {/* Navigation header with chevrons and section indicators */}
                <div className="flex items-center gap-3 mb-5 max-w-full md:max-w-[880px] mx-auto">
                  <button
                    onClick={handlePrev}
                    disabled={currentSection === 0}
                    className={`flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-200 ${
                      currentSection === 0
                        ? "border-[var(--token-border-muted)] text-[var(--token-text-muted)] cursor-not-allowed bg-[var(--token-surface)]"
                        : "border-[var(--token-border-default)] text-[var(--token-text-secondary)] bg-[var(--token-surface-elevated)] hover:border-[var(--token-accent)] hover:text-[var(--token-accent)] hover:bg-[var(--token-surface-raised)] hover:shadow-[0_2px_8px_rgba(58,142,255,0.2)] active:scale-95 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                    }`}
                    aria-label="Previous section"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--token-text-secondary)] font-medium">
                      {sections[currentSection]?.title}
                    </p>
                    {allClasses.length > 0 ? (
                      <p className="text-sm text-[var(--token-text-primary)] mt-1.5 font-semibold truncate">
                        {selectedClass !== null && selectedClass !== undefined
                          ? selectedClass
                          : allClasses[currentClassIndex % allClasses.length]}
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--token-text-muted)] mt-1.5 italic">
                        No classes available
                      </p>
                    )}
                  </div>

                  {/* Section indicators */}
                  <div className="flex items-center gap-1.5 mx-2">
                    {sections.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => scrollToSection(index, true)}
                        className={`transition-all duration-200 rounded-full ${
                          index === currentSection
                            ? "w-2 h-2 bg-[var(--token-accent)]"
                            : "w-1.5 h-1.5 bg-[var(--token-border-default)] hover:bg-[var(--token-text-muted)]"
                        }`}
                        aria-label={`Go to section ${index + 1}`}
                        aria-current={index === currentSection ? "true" : "false"}
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleNext}
                    disabled={currentSection === sections.length - 1}
                    className={`flex items-center justify-center w-9 h-9 rounded-full border transition-all duration-200 ${
                      currentSection === sections.length - 1
                        ? "border-[var(--token-border-muted)] text-[var(--token-text-muted)] cursor-not-allowed bg-[var(--token-surface)]"
                        : "border-[var(--token-border-default)] text-[var(--token-text-secondary)] bg-[var(--token-surface-elevated)] hover:border-[var(--token-accent)] hover:text-[var(--token-accent)] hover:bg-[var(--token-surface-raised)] hover:shadow-[0_2px_8px_rgba(58,142,255,0.2)] active:scale-95 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                    }`}
                    aria-label="Next section"
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                {/* Carousel container */}
                <div
                  ref={carouselRef}
                  className="overflow-x-auto snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  <div className="flex">
                    {sections.map((section, sectionIndex) => (
                      <div
                        key={sectionIndex}
                        ref={sectionRefs[sectionIndex]}
                        className="w-full flex-shrink-0 snap-start"
                      >
                        {section.data && section.data.length > 0 ? (
                          (() => {
                            const currentClassDrivers = getCurrentClassDrivers(section)
                            if (currentClassDrivers.length === 0) {
                              return (
                                <div className="rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-6 py-8 text-center">
                                  <p className="text-sm text-[var(--token-text-muted)]">
                                    No drivers available for this class
                                  </p>
                                </div>
                              )
                            }
                            return (
                              <div className="flex gap-4 justify-start items-stretch max-w-full md:max-w-[880px] mx-auto">
                                {currentClassDrivers.map((driver, driverIndex) => {
                                  // Use driverIndex directly since currentClassDrivers is already sorted by metric
                                  // Position will be driverIndex + 1 (1, 2, 3, 4)
                                  return (
                                    <div
                                      key={driver.driverId}
                                      className="flex-shrink-0 w-full md:w-[208px] flex transition-transform duration-200 hover:scale-[1.02]"
                                    >
                                      {section.type === "improvement" &&
                                      "improvementScore" in driver ? (
                                        <ImprovementDriverCard
                                          driver={
                                            driver as NonNullable<
                                              EventAnalysisSummary["mostImprovedDrivers"]
                                            >[number]
                                          }
                                          index={driverIndex}
                                        />
                                      ) : (
                                        <DriverCard
                                          driver={driver}
                                          index={driverIndex}
                                          type={section.type}
                                          sectionData={currentClassDrivers as typeof section.data}
                                        />
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })()
                        ) : (
                          <div className="rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-6 py-8 text-center">
                            <p className="text-sm text-[var(--token-text-muted)]">
                              No data available for {section.title.toLowerCase()}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {(() => {
                // Use filtered user metrics (filtered by selected class)
                const {
                  userBestLap: filteredUserBestLap,
                  userBestConsistency: filteredUserBestConsistency,
                  userBestAvgLap: filteredUserBestAvgLap,
                  userBestImprovement: filteredUserBestImprovement,
                } = filteredUserMetrics

                // Determine which user metric to display based on current section
                let userMetric: {
                  label: string
                  value: string
                  position: number
                  gapLabel: string
                  gapValue: string
                } | null = null

                if (currentSection === 0 && filteredUserBestLap) {
                  // Top Performers section - show fastest lap
                  userMetric = {
                    label: "Your Best Lap",
                    value: formatLapTime(filteredUserBestLap.lapTime),
                    position: filteredUserBestLap.position,
                    gapLabel: "Gap to fastest",
                    gapValue: `+${formatLapTime(filteredUserBestLap.gapToFastest)}`,
                  }
                } else if (currentSection === 1 && filteredUserBestConsistency) {
                  // Most Consistent Drivers section - show consistency
                  userMetric = {
                    label: "Your Consistency",
                    value: `${filteredUserBestConsistency.consistency.toFixed(1)}%`,
                    position: filteredUserBestConsistency.position,
                    gapLabel: "Gap to best",
                    gapValue: `-${filteredUserBestConsistency.gapToBest.toFixed(1)}%`,
                  }
                } else if (currentSection === 2 && filteredUserBestAvgLap) {
                  // Best Overall Average Lap section - show average lap
                  userMetric = {
                    label: "Your Average Lap",
                    value: formatLapTime(filteredUserBestAvgLap.avgLapTime),
                    position: filteredUserBestAvgLap.position,
                    gapLabel: "Gap to best",
                    gapValue: `+${formatLapTime(filteredUserBestAvgLap.gapToBest)}`,
                  }
                } else if (currentSection === 3 && filteredUserBestImprovement) {
                  // Most Improved section - show improvement with rich data like driver cards
                  const positionDisplay = formatPositionImprovement(
                    filteredUserBestImprovement.firstRacePosition,
                    filteredUserBestImprovement.lastRacePosition
                  )
                  const lapTimeDisplay =
                    filteredUserBestImprovement.lapTimeImprovement !== null
                      ? formatLapTimeImprovement(filteredUserBestImprovement.lapTimeImprovement)
                      : null

                  userMetric = {
                    label: "Your Improvement",
                    value: positionDisplay,
                    position: filteredUserBestImprovement.position,
                    gapLabel: "Gap to best",
                    gapValue:
                      filteredUserBestImprovement.gapToBest > 0
                        ? `-${filteredUserBestImprovement.gapToBest} positions`
                        : "Best!",
                  }

                  // Return custom layout for improvement section with extra details
                  return (
                    <div className="max-w-full md:max-w-[880px] mx-auto">
                      <div className="mb-6 rounded-2xl border border-[var(--token-accent)]/40 bg-gradient-to-br from-[var(--token-accent)]/10 to-[var(--token-accent)]/5 px-5 py-5 transition-all duration-200 hover:border-[var(--token-accent)]/60 hover:shadow-[0_4px_16px_rgba(58,142,255,0.2)] shadow-[0_2px_8px_rgba(58,142,255,0.15)]">
                        <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--token-accent)] mb-3 font-medium">
                          {userMetric.label}
                        </p>
                        <div className="flex items-baseline justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-3xl font-bold text-[var(--token-text-primary)] leading-tight">
                              {userMetric.value}
                            </p>
                            <div className="mt-2 space-y-1">
                              {lapTimeDisplay && (
                                <p className="text-xs text-[var(--token-text-secondary)] font-medium">
                                  Lap Time: {lapTimeDisplay}
                                </p>
                              )}
                              <p className="text-xs text-[var(--token-text-muted)] font-medium">
                                {filteredUserBestImprovement.raceLabel}
                              </p>
                              <p className="text-xs text-[var(--token-text-muted)]">
                                {filteredUserBestImprovement.className}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-[var(--token-text-secondary)] mb-1 font-medium">
                              Position #{userMetric.position}
                            </p>
                            {filteredUserBestImprovement.gapToBest > 0 && (
                              <>
                                <p className="text-xs text-[var(--token-text-muted)] mb-1 font-medium">
                                  {userMetric.gapLabel}
                                </p>
                                <p className="text-xl font-bold text-[var(--token-text-primary)]">
                                  {userMetric.gapValue}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                }

                if (!userMetric) return null

                return (
                  <div className="max-w-full md:max-w-[880px] mx-auto">
                    <div className="mb-6 rounded-2xl border border-[var(--token-accent)]/40 bg-gradient-to-br from-[var(--token-accent)]/10 to-[var(--token-accent)]/5 px-5 py-5 transition-all duration-200 hover:border-[var(--token-accent)]/60 hover:shadow-[0_4px_16px_rgba(58,142,255,0.2)] shadow-[0_2px_8px_rgba(58,142,255,0.15)]">
                      <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--token-accent)] mb-3 font-medium">
                        {userMetric.label}
                      </p>
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-3xl font-bold text-[var(--token-text-primary)] leading-tight">
                            {userMetric.value}
                          </p>
                          <p className="text-xs text-[var(--token-text-secondary)] mt-2 font-medium">
                            Position #{userMetric.position}
                          </p>
                        </div>
                        {((currentSection === 0 &&
                          filteredUserBestLap?.gapToFastest &&
                          filteredUserBestLap.gapToFastest > 0) ||
                          (currentSection === 1 &&
                            filteredUserBestConsistency?.gapToBest &&
                            filteredUserBestConsistency.gapToBest > 0) ||
                          (currentSection === 2 &&
                            filteredUserBestAvgLap?.gapToBest &&
                            filteredUserBestAvgLap.gapToBest > 0)) && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-[var(--token-text-muted)] mb-1 font-medium">
                              {userMetric.gapLabel}
                            </p>
                            <p className="text-xl font-bold text-[var(--token-text-primary)]">
                              {userMetric.gapValue}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </>
          ) : hasData ? (
            <div className="flex items-center justify-center min-h-[200px] text-[var(--token-text-secondary)]">
              Select a class or more than one driver to view driver cards
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[200px] text-[var(--token-text-secondary)]">
              No lap time data available for this event
            </div>
          )}
        </div>
      </div>

      {weather ? (
        <WeatherPanel
          className="col-span-12 lg:col-span-4"
          weather={weather}
          eventDate={event?.eventDate}
          trackName={event?.trackName}
          eventName={event?.eventName}
        />
      ) : weatherLoading ? (
        <WeatherLoadingState className="col-span-12 lg:col-span-4" />
      ) : weatherError ? (
        <WeatherErrorState className="col-span-12 lg:col-span-4" error={weatherError} />
      ) : (
        <div className="col-span-12 rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] lg:col-span-4" />
      )}
    </section>
  )
}

type DriverCardData =
  | NonNullable<EventAnalysisSummary["topDrivers"]>[number]
  | NonNullable<EventAnalysisSummary["mostConsistentDrivers"]>[number]
  | NonNullable<EventAnalysisSummary["bestAvgLapDrivers"]>[number]
  | NonNullable<EventAnalysisSummary["mostImprovedDrivers"]>[number]

function DriverCard({
  driver,
  index,
  type,
  sectionData,
}: {
  driver: DriverCardData
  index: number
  type: "fastest" | "consistency" | "avgLap" | "improvement"
  sectionData:
    | EventAnalysisSummary["topDrivers"]
    | EventAnalysisSummary["mostConsistentDrivers"]
    | EventAnalysisSummary["bestAvgLapDrivers"]
    | EventAnalysisSummary["mostImprovedDrivers"]
}) {
  let valueDisplay: string
  let gapDisplay: React.ReactNode = null

  if (type === "fastest" && "fastestLapTime" in driver) {
    valueDisplay = formatLapTime(driver.fastestLapTime)
    if (
      sectionData &&
      Array.isArray(sectionData) &&
      sectionData.length > 0 &&
      "fastestLapTime" in sectionData[0]
    ) {
      const fastestLapTime = (sectionData[0] as { fastestLapTime: number }).fastestLapTime
      const sameClass = driver.className === sectionData[0].className
      const gapToFastest = index > 0 && sameClass ? driver.fastestLapTime - fastestLapTime : 0
      if (gapToFastest > 0) {
        gapDisplay = (
          <span className="text-[10px] font-medium text-[var(--token-text-muted)] bg-[var(--token-surface)] px-2 py-0.5 rounded-full">
            +{formatLapTime(gapToFastest)}
          </span>
        )
      }
    }
  } else if (type === "consistency" && "consistency" in driver) {
    valueDisplay = `${driver.consistency.toFixed(1)}%`
  } else if (type === "avgLap" && "avgLapTime" in driver) {
    valueDisplay = formatLapTime(driver.avgLapTime)
  } else if (type === "improvement" && "positionImprovement" in driver) {
    const improvedDriver = driver as NonNullable<
      EventAnalysisSummary["mostImprovedDrivers"]
    >[number]
    valueDisplay = formatPositionImprovement(
      improvedDriver.firstRacePosition,
      improvedDriver.lastRacePosition
    )
  } else {
    valueDisplay = "N/A"
  }

  return (
    <div className="rounded-2xl border border-[var(--token-border-default)] bg-gradient-to-br from-[var(--token-surface-elevated)] to-[var(--token-surface-raised)] px-5 py-5 h-full w-full transition-all duration-200 hover:border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.2),0_0_1px_rgba(255,255,255,0.1)] shadow-[0_2px_8px_rgba(0,0,0,0.1),0_0_1px_rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-[var(--token-text-primary)] bg-[var(--token-surface)] px-2.5 py-1 rounded-full border border-[var(--token-border-default)] shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
          #{index + 1}
        </span>
        {gapDisplay}
      </div>
      <p className="text-base font-bold text-[var(--token-text-primary)] mb-2 truncate">
        {driver.driverName}
      </p>
      <p className="text-2xl font-bold text-[var(--token-text-primary)] mb-3 leading-tight">
        {valueDisplay}
      </p>
      <div className="space-y-1">
        <p className="text-[10px] text-[var(--token-text-muted)] font-medium truncate">
          {driver.raceLabel}
        </p>
        <p className="text-[10px] text-[var(--token-text-muted)] truncate">{driver.className}</p>
      </div>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[var(--token-text-primary)]">{value}</p>
    </div>
  )
}

function KpiCard({
  label,
  value,
  helper,
  trendLabel,
  trendDelta,
  trendValueDisplay,
  sparkline,
  className = "",
}: KpiDatum & { className?: string }) {
  const tone =
    trendDelta >= 0
      ? "text-[var(--token-status-success-text)]"
      : "text-[var(--token-status-warning-text)]"
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-[var(--token-text-primary)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--token-text-secondary)]">{helper}</p>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className={tone}>{trendLabel}</span>
        <span className={tone}>{trendValueDisplay}</span>
      </div>
      <Sparkline data={sparkline} />
    </article>
  )
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) {
    return (
      <svg viewBox="0 0 100 60" className="mt-4 h-16 w-full text-[var(--token-accent)]" fill="none">
        <polyline
          points=""
          stroke="currentColor"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  const max = Math.max(...data)
  const min = Math.min(...data)
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = ((value - min) / (max - min || 1)) * 60
    return `${x},${60 - y}`
  })
  return (
    <svg viewBox="0 0 100 60" className="mt-4 h-16 w-full text-[var(--token-accent)]" fill="none">
      <polyline
        points={points.join(" ")}
        stroke="currentColor"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TelemetrySnapshot({
  className,
  data,
}: {
  className?: string
  data: ReturnType<typeof generateTelemetrySnapshot>
}) {
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
            Telemetry
          </p>
          <h3 className="text-lg font-semibold">Speed trace snapshot</h3>
        </div>
        <span className="rounded-full bg-[var(--token-status-info-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--token-status-info-text)]">
          {data.reference}
        </span>
      </header>
      <svg viewBox="0 0 400 160" className="w-full">
        <TelemetryPath points={data.speed} color="var(--token-telemetry-speed)" height={160} />
        <TelemetryPath
          points={data.throttle}
          color="var(--token-telemetry-throttle)"
          height={160}
        />
        <TelemetryPath points={data.brake} color="var(--token-telemetry-brake)" height={160} />
        {data.sectors.map((sector, index) => (
          <line
            key={sector}
            x1={(sector / 100) * 400}
            x2={(sector / 100) * 400}
            y1={0}
            y2={160}
            stroke={
              ["var(--token-sector-s1)", "var(--token-sector-s2)", "var(--token-sector-s3)"][
                index % 3
              ]
            }
            strokeDasharray="4 4"
            strokeWidth={1}
          />
        ))}
      </svg>
      <p className="mt-4 text-xs text-[var(--token-text-muted)]">
        Compare toggle overlays teammate baselines on the trace.
      </p>
    </article>
  )
}

function TelemetryPath({
  points,
  color,
  height,
}: {
  points: number[]
  color: string
  height: number
}) {
  if (points.length === 0) {
    return <path d="" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
  }
  const max = Math.max(...points)
  const min = Math.min(...points)
  const d = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 400
      const y = height - ((value - min) / (max - min || 1)) * height
      return `${index === 0 ? "M" : "L"}${x},${y}`
    })
    .join(" ")
  return <path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
}

function WeatherPanel({
  className,
  weather,
  eventDate,
  trackName,
  eventName,
}: {
  className?: string
  weather: WeatherData
  eventDate?: string
  trackName?: string
  eventName?: string
}) {
  return (
    <article
      className={`relative ${className || ""}`}
      style={{
        borderRadius: "24px",
        border: "1px solid var(--glass-border)",
        backgroundColor: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        boxShadow: "var(--glass-shadow), var(--glass-shadow-inset)",
        padding: "var(--dashboard-card-padding)",
        overflow: "hidden",
      }}
    >
      {/* Subtle gradient overlay for extra glass depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%)",
          borderRadius: "24px",
        }}
      />
      {/* Subtle top highlight for glass edge effect */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)",
          borderRadius: "24px 24px 0 0",
        }}
      />
      {/* Content wrapper */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
            Track state
          </p>
          {weather.isCached && weather.cachedAt && (
            <p className="text-[9px] uppercase tracking-[0.3em] text-[var(--token-text-muted)]">
              Cached
            </p>
          )}
        </div>
        {eventName && trackName && eventDate && (
          <p className="text-sm text-[var(--token-text-secondary)] mt-2">
            {eventName} • {trackName} • {formatDateLong(eventDate)}
          </p>
        )}
        <h3 className="mt-2 text-xl font-semibold text-[var(--token-text-primary)]">
          {weather.condition}
        </h3>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Wind {weather.wind} • Humidity {weather.humidity}%
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <WeatherStat label="Air" value={`${Math.round(weather.air)}°C`} />
          <WeatherStat label="Track" value={`${Math.round(weather.track)}°C`} />
          <WeatherStat label="Chance" value={`${weather.precip}%`} />
        </div>
        <div className="mt-6 space-y-2 text-xs text-[var(--token-text-secondary)]">
          {weather.forecast.map((entry) => (
            <div
              key={entry.label}
              className="flex items-center justify-between rounded-2xl border border-[var(--token-border-muted)] px-3 py-2"
            >
              <span>{entry.label}</span>
              <span>{entry.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function WeatherStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2 shadow-[0_2px_6px_rgba(0,0,0,0.1)]">
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-[var(--token-text-primary)]">{value}</p>
    </div>
  )
}

function AlertStack({ className, alerts }: { className?: string; alerts: AlertItem[] }) {
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
            Alert stack
          </p>
          <h3 className="text-lg font-semibold">Live flags</h3>
        </div>
        <span className="text-xs text-[var(--token-text-muted)]">Auto-refresh</span>
      </header>
      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start justify-between rounded-2xl border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-3 py-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                    alert.severity === "green"
                      ? "bg-[var(--token-status-success-bg)] text-[var(--token-status-success-text)]"
                      : alert.severity === "amber"
                        ? "bg-[var(--token-status-warning-bg)] text-[var(--token-status-warning-text)]"
                        : "bg-[var(--token-status-error-bg)] text-[var(--token-status-error-text)]"
                  }`}
                >
                  {alert.severity}
                </span>
                <p className="text-sm font-semibold text-[var(--token-text-primary)]">
                  {alert.label}
                </p>
              </div>
              <p className="mt-1 text-xs text-[var(--token-text-secondary)]">{alert.detail}</p>
            </div>
            <span className="text-xs text-[var(--token-text-muted)]">{alert.timestamp}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

function ActivityTimeline({
  className,
  activity,
}: {
  className?: string
  activity: ActivityItem[]
}) {
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
        Activity
      </p>
      <h3 className="mt-2 text-lg font-semibold">Race engineer feed</h3>
      <div className="mt-4 space-y-4">
        {activity.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            <span
              className={`mt-1 h-2 w-2 rounded-full ${item.type === "engineer" ? "bg-[var(--token-accent)]" : "bg-[var(--token-status-warning-text)]"}`}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--token-text-primary)]">
                  {item.title}
                </p>
                <span className="text-xs text-[var(--token-text-muted)]">{item.timestamp}</span>
              </div>
              <p className="text-sm text-[var(--token-text-secondary)]">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

function DataQualityHeatmap({
  className,
  matrix,
}: {
  className?: string
  matrix: { lap: string; completeness: number[] }[]
}) {
  const channels = ["Speed", "Throttle", "Brake", "Gear", "GPS", "Temp"]
  return (
    <ChartContainer
      title="Channel completeness"
      description="Data quality"
      className={className}
      aria-label="Data quality heatmap showing channel completeness by lap"
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="py-2 text-left text-xs uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
                Lap
              </th>
              {channels.map((channel) => (
                <th
                  key={channel}
                  className="px-2 py-2 text-xs uppercase tracking-[0.3em] text-[var(--token-text-muted)]"
                >
                  {channel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.lap}>
                <td className="py-2 text-xs text-[var(--token-text-secondary)]">{row.lap}</td>
                {row.completeness.map((score, index) => (
                  <td key={`${row.lap}-${index}`} className="px-2 py-1">
                    <div className="h-6 w-full rounded-full bg-[var(--token-border-muted)]">
                      <div
                        className={`h-full rounded-full ${score > 80 ? "bg-[var(--token-status-success-text)]" : score > 60 ? "bg-[var(--token-status-warning-text)]" : "bg-[var(--token-status-error-text)]"}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartContainer>
  )
}

function SessionSchedule({
  className,
  sessions,
}: {
  className?: string
  sessions: { id: string; label: string; detail: string; status: string }[]
}) {
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
        Program
      </p>
      <h3 className="mt-2 text-lg font-semibold">Sessions timeline</h3>
      <div className="mt-4 space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between rounded-2xl border border-[var(--token-border-muted)] px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--token-text-primary)]">
                {session.label}
              </p>
              <p className="text-xs text-[var(--token-text-muted)]">{session.detail}</p>
            </div>
            <span className="text-xs uppercase tracking-[0.4em] text-[var(--token-text-secondary)]">
              {session.status}
            </span>
          </div>
        ))}
      </div>
    </article>
  )
}

function generateKpiData(summary: EventAnalysisSummary["summary"] | null): KpiDatum[] {
  const baseLaps = summary?.totalLaps ?? 58
  return [
    {
      id: "lap-delta",
      label: "Lap Delta",
      value: "-0.182s",
      helper: "vs target",
      trendLabel: "Improving",
      trendDelta: 0.12,
      trendValueDisplay: "-0.12s",
      sparkline: [0.32, 0.28, 0.2, 0.15, 0.12, 0.08, 0.1],
    },
    {
      id: "sector",
      label: "Sector Gains",
      value: "S1 +0.08s",
      helper: "S2 -0.03s / S3 -0.01s",
      trendLabel: "S1 purple",
      trendDelta: 0.03,
      trendValueDisplay: "+0.03s",
      sparkline: [0.12, 0.1, 0.08, 0.05, 0.02, -0.01, 0.01],
    },
    {
      id: "tire",
      label: "Tire Life",
      value: `${Math.min(baseLaps / 2, 18).toFixed(0)} laps`,
      helper: "Medium compound",
      trendLabel: "+1 lap",
      trendDelta: 1,
      trendValueDisplay: "+1 lap",
      sparkline: [12, 12.5, 13, 13.4, 14, 14.5, 15],
    },
    {
      id: "consistency",
      label: "Consistency",
      value: `${Math.min(98, 75 + baseLaps * 0.2).toFixed(1)}%`,
      helper: "Fastest 5 laps",
      trendLabel: "Stable",
      trendDelta: 0,
      trendValueDisplay: "±0",
      sparkline: [90, 91, 92, 94, 95, 94, 93],
    },
  ]
}

function generateTelemetrySnapshot(summary: EventAnalysisSummary["summary"] | null) {
  const laps = summary?.totalLaps ?? 50
  const baseSpeed = 280 + (laps % 5)
  const points = Array.from(
    { length: 30 },
    (_, index) => baseSpeed - Math.sin(index / 2) * 40 - index
  )
  const throttle = points.map((value, index) => 50 + Math.sin(index) * 40)
  const brake = points.map((value, index) => Math.max(0, 30 - Math.cos(index) * 30))
  return {
    reference: "vs. baseline",
    speed: points,
    throttle,
    brake,
    sectors: [33, 66, 99],
  }
}

function WeatherLoadingState({ className }: { className?: string }) {
  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <div className="animate-pulse">
        <div className="h-4 w-24 bg-[var(--token-surface)] rounded mb-4" />
        <div className="h-6 w-48 bg-[var(--token-surface)] rounded mb-2" />
        <div className="h-4 w-32 bg-[var(--token-surface)] rounded mb-6" />
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[var(--token-surface)] rounded-2xl" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-[var(--token-surface)] rounded-2xl" />
          ))}
        </div>
      </div>
    </article>
  )
}

function WeatherErrorState({ className, error }: { className?: string; error: string }) {
  // Parse error message to show user-friendly version
  const getUserFriendlyError = (errorMsg: string): string => {
    // Check for network connectivity issues first
    if (
      errorMsg.includes("Network error") ||
      errorMsg.includes("network connectivity") ||
      errorMsg.includes("Unable to reach")
    ) {
      return "Unable to load weather data - network connectivity issue"
    }
    if (errorMsg.includes("geocode") || errorMsg.includes("Geocoding")) {
      return "Weather data unavailable for this location"
    }
    if (errorMsg.includes("404") || errorMsg.includes("not found")) {
      return "Weather data not available"
    }
    if (errorMsg.includes("Failed to fetch") || errorMsg.includes("network")) {
      return "Unable to load weather data"
    }
    // Default fallback - show first sentence or truncate long technical errors
    const firstSentence = errorMsg.split(".")[0]
    if (firstSentence.length > 100) {
      return "Weather data unavailable"
    }
    return firstSentence
  }

  const friendlyError = getUserFriendlyError(error)

  return (
    <article
      className={`rounded-3xl border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] p-[var(--dashboard-card-padding)] ${className}`}
    >
      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
        Track state
      </p>
      <p className="mt-4 text-sm text-[var(--token-text-secondary)]">{friendlyError}</p>
    </article>
  )
}

function generateAlerts(event?: EventAnalysisSummary["event"] | null): AlertItem[] {
  const eventName = event?.eventName ?? "Session"
  return [
    {
      id: "alert-1",
      label: `${eventName} • Yellow S2`,
      severity: "amber",
      timestamp: "1m",
      detail: "Slow car clearing T9 apex",
    },
    {
      id: "alert-2",
      label: "Track limits",
      severity: "red",
      timestamp: "8m",
      detail: "Lap 14 invalidated at T4",
    },
    {
      id: "alert-3",
      label: "Grip window",
      severity: "green",
      timestamp: "14m",
      detail: "Medium compound optimum",
    },
  ]
}

function generateActivityStream(events: ImportedEventSummary[]): ActivityItem[] {
  const base: ActivityItem[] = [
    {
      id: "activity-1",
      title: "Engineer",
      detail: "Adjust brake bias +0.2% for next push lap",
      timestamp: "Just now",
      type: "engineer",
    },
    {
      id: "activity-2",
      title: "System",
      detail: "Sector 1 purple delta -0.032s",
      timestamp: "2m",
      type: "system",
    },
    {
      id: "activity-3",
      title: "Engineer",
      detail: "Plan Box + 2 for short run on scrubbed mediums",
      timestamp: "8m",
      type: "engineer",
    },
  ]
  return base.concat(
    events.slice(0, 2).map((event, index) => ({
      id: `activity-r-${event.id}`,
      title: "Recent Event",
      detail: `${event.eventName} ready for review`,
      timestamp: `${15 + index * 4}m`,
      type: "system" as const,
    }))
  )
}

function generateSessionSchedule(event?: EventAnalysisSummary["event"] | null) {
  const baseDate = event?.eventDate ? new Date(event.eventDate) : new Date()
  return [
    {
      id: "fp1",
      label: "Practice",
      detail: new Date(baseDate).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" }),
      status: "Live",
    },
    {
      id: "fp2",
      label: "Qualifying",
      detail: new Date(baseDate.getTime() + 2 * 60 * 60 * 1000).toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "Next",
    },
    {
      id: "race",
      label: "Race",
      detail: new Date(baseDate.getTime() + 4 * 60 * 60 * 1000).toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "T-4h",
    },
  ]
}

function generateDataQualityMatrix() {
  return Array.from({ length: 5 }).map((_, index) => ({
    lap: `Lap ${index + 10}`,
    completeness: Array.from({ length: 6 }).map(() => 50 + Math.random() * 50),
  }))
}
