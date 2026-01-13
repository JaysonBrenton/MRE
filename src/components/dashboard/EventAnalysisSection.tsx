/**
 * @fileoverview Event Analysis Section component for dashboard
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Displays event analysis features in dashboard when an event is selected
 *
 * @purpose Provides the same event analysis functionality as the Event Analysis page
 *          but embedded in the dashboard. Uses Redux for state management and
 *          fetches data client-side when an event is selected.
 *
 * @relatedFiles
 * - src/app/(authenticated)/dashboard/page.tsx (uses this)
 * - src/store/slices/dashboardSlice.ts (Redux state)
 * - src/components/event-analysis/ (tab components)
 */

"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useAppSelector, useAppDispatch } from "@/store/hooks"
import { fetchEventAnalysisData } from "@/store/slices/dashboardSlice"
import TabNavigation, { type TabId } from "@/components/event-analysis/TabNavigation"
import OverviewTab from "@/components/event-analysis/OverviewTab"
import DriversTab from "@/components/event-analysis/DriversTab"
import EntryListTab from "@/components/event-analysis/EntryListTab"
import SessionsTab from "@/components/event-analysis/SessionsTab"
import ComparisonsTab from "@/components/event-analysis/ComparisonsTab"
import EventAnalysisHeader from "@/components/event-analysis/EventAnalysisHeader"
import { DriverCardsAndWeatherGrid } from "@/components/dashboard/DashboardClient"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

// Type for API response with ISO string dates (matches what's stored in Redux)
type EventAnalysisDataApiResponse = {
  event: {
    id: string
    eventName: string
    eventDate: string // ISO string
    trackName: string
  }
  races: Array<{
    id: string
    raceId: string
    className: string
    raceLabel: string
    raceOrder: number | null
    startTime: string | null // ISO string
    durationSeconds: number | null
    results: Array<{
      raceResultId: string
      raceDriverId: string
      driverId: string
      driverName: string
      positionFinal: number
      lapsCompleted: number
      totalTimeSeconds: number | null
      fastLapTime: number | null
      avgLapTime: number | null
      consistency: number | null
      // laps array removed - not used by any components
    }>
  }>
  drivers: Array<{
    driverId: string
    driverName: string
    racesParticipated: number
    bestLapTime: number | null
    avgLapTime: number | null
    consistency: number | null
  }>
  entryList: Array<{
    id: string
    driverId: string
    driverName: string
    className: string
    transponderNumber: string | null
    carNumber: string | null
  }>
  raceClasses: Record<string, { vehicleType: string | null; vehicleTypeNeedsReview: boolean }>
  summary: {
    totalRaces: number
    totalDrivers: number
    totalLaps: number
    dateRange: {
      earliest: string | null // ISO string
      latest: string | null // ISO string
    }
  }
}

/**
 * Transform API response (with ISO string dates) to EventAnalysisData (with Date objects)
 */
function transformApiResponseToEventAnalysisData(
  apiData: EventAnalysisDataApiResponse
): EventAnalysisData {
  // Convert raceClasses object back to Map
  const raceClassesMap = new Map<string, { vehicleType: string | null; vehicleTypeNeedsReview: boolean }>()
  if (apiData.raceClasses) {
    Object.entries(apiData.raceClasses).forEach(([key, value]) => {
      raceClassesMap.set(key, value)
    })
  }

  return {
    event: {
      id: apiData.event.id,
      eventName: apiData.event.eventName,
      eventDate: new Date(apiData.event.eventDate),
      trackName: apiData.event.trackName,
    },
    races: apiData.races.map((race) => ({
      ...race,
      startTime: race.startTime ? new Date(race.startTime) : null,
    })),
    drivers: apiData.drivers,
    entryList: apiData.entryList,
    raceClasses: raceClassesMap,
    summary: {
      totalRaces: apiData.summary.totalRaces,
      totalDrivers: apiData.summary.totalDrivers,
      totalLaps: apiData.summary.totalLaps,
      dateRange: {
        earliest: apiData.summary.dateRange.earliest
          ? new Date(apiData.summary.dateRange.earliest)
          : null,
        latest: apiData.summary.dateRange.latest
          ? new Date(apiData.summary.dateRange.latest)
          : null,
      },
    },
  }
}

export default function EventAnalysisSection() {
  const dispatch = useAppDispatch()
  const selectedEventId = useAppSelector((state) => state.dashboard.selectedEventId)
  const analysisData = useAppSelector((state) => state.dashboard.analysisData)
  const isAnalysisLoading = useAppSelector((state) => state.dashboard.isAnalysisLoading)
  const analysisError = useAppSelector((state) => state.dashboard.analysisError)
  const eventData = useAppSelector((state) => state.dashboard.eventData)
  
  // Weather state - moved from DashboardClient
  const [weather, setWeather] = useState<{
    condition: string
    wind: string
    humidity: number
    air: number
    track: number
    precip: number
    forecast: Array<{ label: string; detail: string }>
    cachedAt?: string
    isCached?: boolean
  } | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  
  // Fetch weather data when event is selected
  useEffect(() => {
    if (!selectedEventId) {
      // Reset weather state when no event is selected
      // Using setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setWeather(null)
        setWeatherError(null)
      }, 0)
      return
    }

    // Use setTimeout to avoid synchronous setState in effect
    setTimeout(() => {
      setWeatherLoading(true)
      setWeatherError(null)
    }, 0)

    fetch(`/api/v1/events/${selectedEventId}/weather`, { cache: "no-store" })
      .then(async (response) => {
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
        if (result.success && result.data) {
          setWeather(result.data)
        } else {
          setWeatherError("Invalid response from server")
        }
      })
      .catch((error) => {
        console.error("Error fetching weather data", error)
        setWeatherError("Failed to fetch weather data")
      })
      .finally(() => {
        setWeatherLoading(false)
      })
  }, [selectedEventId])

  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([])
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [hasInitiatedFetch, setHasInitiatedFetch] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const lastFetchedEventId = useRef<string | null>(null)

  // Reset fetch state when event is deselected
  useEffect(() => {
    if (!selectedEventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasInitiatedFetch(false)
      lastFetchedEventId.current = null
    }
  }, [selectedEventId])

  // Lazy load: Only fetch analysis data when section becomes visible or user interacts
  // This prevents loading heavy data when event is selected but user hasn't scrolled to analysis section
  useEffect(() => {
    if (!selectedEventId) {
      return
    }

    // If event changed, reset fetch state and trigger fetch if section is visible
    if (lastFetchedEventId.current !== selectedEventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasInitiatedFetch(false)
      lastFetchedEventId.current = selectedEventId

      // If section is already visible, trigger fetch immediately
      // This fixes the issue where switching events doesn't trigger a fetch
      // if the section is already visible (IntersectionObserver won't fire again)
      // Note: We don't check isAnalysisLoading here because selectEvent sets it to true
      // before the fetch is dispatched, which would prevent the fetch from happening
      // We also don't check hasInitiatedFetch because state updates are async - we use
      // the fact that lastFetchedEventId changed to know we need to fetch
      const section = sectionRef.current
      if (section) {
        const rect = section.getBoundingClientRect()
        const isVisible = rect.top < window.innerHeight + 200 && rect.bottom > -200

        // Trigger fetch if visible and we don't have data for this event
        // We know we need to fetch because lastFetchedEventId just changed
        if (isVisible && (!analysisData || analysisData.event.id !== selectedEventId)) {
          setHasInitiatedFetch(true)
          dispatch(fetchEventAnalysisData(selectedEventId))
          return
        }
      }
    }

    // If we already have data for this event, mark as initiated
    if (analysisData && analysisData.event.id === selectedEventId) {
      setHasInitiatedFetch(true)
      return
    }

    // Use IntersectionObserver to detect when section is visible
    const section = sectionRef.current
    if (!section || hasInitiatedFetch) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        // When section becomes visible and we haven't fetched yet, fetch the data
        if (
          entry.isIntersecting &&
          selectedEventId &&
          !hasInitiatedFetch &&
          !isAnalysisLoading &&
          (!analysisData || analysisData.event.id !== selectedEventId)
        ) {
          setHasInitiatedFetch(true)
          dispatch(fetchEventAnalysisData(selectedEventId))
        }
      },
      {
        rootMargin: "200px", // Start loading 200px before section is visible
        threshold: 0.1,
      }
    )

    observer.observe(section)

    return () => {
      observer.disconnect()
    }
  }, [selectedEventId, analysisData, isAnalysisLoading, hasInitiatedFetch, dispatch])

  // Also fetch when user clicks on a tab (in case section was already visible)
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId)

    // If we haven't fetched yet and event is selected, fetch now
    if (
      selectedEventId &&
      !hasInitiatedFetch &&
      !isAnalysisLoading &&
      (!analysisData || analysisData.event.id !== selectedEventId)
    ) {
      setHasInitiatedFetch(true)
      dispatch(fetchEventAnalysisData(selectedEventId))
    }
  }

  // Transform API response to EventAnalysisData format
  const transformedData = useMemo(() => {
    if (!analysisData) {
      return null
    }
    return transformApiResponseToEventAnalysisData(analysisData)
  }, [analysisData])

  const availableTabs = [
    { id: "overview" as TabId, label: "Event Overview" },
    { id: "sessions" as TabId, label: "Sessions / Heats" },
    { id: "comparisons" as TabId, label: "Comparisons" },
    { id: "entry-list" as TabId, label: "Entry List" },
    { id: "drivers" as TabId, label: "Drivers" },
  ]

  // Empty state - no event selected (handled by DashboardClient)
  if (!selectedEventId) {
    return null
  }

  // Loading state
  if (isAnalysisLoading) {
    return (
      <section ref={sectionRef} className="mt-6 space-y-4">
        <div className="text-center py-12 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]">
          <p className="text-[var(--token-text-secondary)]">Loading event analysis data...</p>
        </div>
      </section>
    )
  }

  // Error state
  if (analysisError) {
    return (
      <section ref={sectionRef} className="mt-6 space-y-4">
        <div className="text-center py-12 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]">
          <p className="text-[var(--token-text-error)] mb-4">{analysisError}</p>
          <button
            type="button"
            onClick={() => {
              if (selectedEventId) {
                setHasInitiatedFetch(true)
                dispatch(fetchEventAnalysisData(selectedEventId))
              }
            }}
            className="px-4 py-2 rounded-lg bg-[var(--token-accent)] text-[var(--token-text-on-accent)] hover:opacity-90 transition"
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  // No data state - show lazy loading prompt if we haven't initiated fetch yet
  if (!transformedData) {
    return (
      <section ref={sectionRef} className="mt-6 space-y-4">
        <div className="text-center py-12 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]">
          {!hasInitiatedFetch ? (
            <p className="text-[var(--token-text-secondary)]">
              Scroll down or click a tab to load event analysis data
            </p>
          ) : (
            <p className="text-[var(--token-text-secondary)]">No analysis data available</p>
          )}
        </div>
      </section>
    )
  }

  // Render analysis content
  return (
    <section ref={sectionRef} className="mt-6 space-y-6">
      {transformedData && (
        <>
          <EventAnalysisHeader
            eventName={transformedData.event.eventName}
            eventDate={transformedData.event.eventDate}
            trackName={transformedData.event.trackName}
          />
        </>
      )}

      {transformedData && (
        <>

          <div className="space-y-6">
            <TabNavigation
              tabs={availableTabs}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />

            {activeTab === "overview" && (
              <>
                <OverviewTab
                  data={transformedData}
                  selectedDriverIds={selectedDriverIds}
                  onDriverSelectionChange={setSelectedDriverIds}
                  selectedClass={selectedClass}
                  onClassChange={setSelectedClass}
                />
                {/* Driver Cards and Weather Grid - moved from DashboardHero */}
                {eventData && transformedData && (
                  <DriverCardsAndWeatherGrid
                    event={eventData.event}
                    topDrivers={eventData.topDrivers}
                    mostConsistentDrivers={eventData.mostConsistentDrivers}
                    bestAvgLapDrivers={eventData.bestAvgLapDrivers}
                    mostImprovedDrivers={eventData.mostImprovedDrivers}
                    userBestLap={eventData.userBestLap}
                    userBestConsistency={eventData.userBestConsistency}
                    userBestAvgLap={eventData.userBestAvgLap}
                    weather={weather}
                    weatherLoading={weatherLoading}
                    weatherError={weatherError}
                    selectedClass={selectedClass}
                    races={transformedData.races}
                  />
                )}
              </>
            )}

            {activeTab === "drivers" && (
              <DriversTab
                data={transformedData}
                selectedDriverIds={selectedDriverIds}
                onSelectionChange={setSelectedDriverIds}
              />
            )}

            {activeTab === "entry-list" && <EntryListTab data={transformedData} />}

            {activeTab === "sessions" && (
              <SessionsTab
                data={transformedData}
                selectedDriverIds={selectedDriverIds}
                selectedClass={selectedClass}
              />
            )}

            {activeTab === "comparisons" && <ComparisonsTab />}
          </div>
        </>
      )}

      {/* Show loading state if event is selected but data hasn't been fetched yet */}
      {selectedEventId && !hasInitiatedFetch && !isAnalysisLoading && !analysisData && (
        <div className="text-center py-12 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]">
          <p className="text-[var(--token-text-secondary)]">
            Scroll down or click a tab to load event analysis data
          </p>
        </div>
      )}
    </section>
  )
}
