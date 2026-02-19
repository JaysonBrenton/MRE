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

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react"
import { useAppSelector, useAppDispatch } from "@/store/hooks"
import { fetchEventAnalysisData, selectEvent } from "@/store/slices/dashboardSlice"
import EventAnalysisToolbar from "@/components/organisms/event-analysis/EventAnalysisToolbar"
import { type TabId } from "@/components/organisms/event-analysis/TabNavigation"
import OverviewTab from "@/components/organisms/event-analysis/OverviewTab"
import DriversTab from "@/components/organisms/event-analysis/DriversTab"
import SessionsTab from "@/components/organisms/event-analysis/SessionsTab"
import MyEventsContent from "@/components/organisms/event-analysis/MyEventsContent"
import EventAnalysisHeader from "@/components/organisms/event-analysis/EventAnalysisHeader"
import { useEventActions } from "@/components/organisms/dashboard/EventActionsContext"
import PracticeMyDayTab from "@/components/organisms/event-analysis/PracticeMyDayTab"
import PracticeMySessionsTab from "@/components/organisms/event-analysis/PracticeMySessionsTab"
import PracticeClassLeaderboard from "@/components/organisms/event-analysis/PracticeClassLeaderboard"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

const PRACTICE_DAY_TABS: { id: TabId; label: string }[] = [
  { id: "my-day", label: "My Day" },
  { id: "my-sessions", label: "My Sessions" },
  { id: "class-reference", label: "Class Reference" },
  { id: "all-sessions", label: "All Sessions" },
]
const EVENT_TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Event Overview" },
  { id: "sessions", label: "Event Sessions" },
  { id: "my-events", label: "My Events" },
  { id: "drivers", label: "Drivers" },
]

// Type for API response with ISO string dates (matches what's stored in Redux)
type EventAnalysisDataApiResponse = {
  event: {
    id: string
    eventName: string
    eventDate: string // ISO string
    trackName: string
  }
  isPracticeDay?: boolean
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
      fastLapLapNumber?: number | null
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
  multiMainResults?: EventAnalysisData["multiMainResults"]
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
  const raceClassesMap = new Map<
    string,
    { vehicleType: string | null; vehicleTypeNeedsReview: boolean }
  >()
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
    isPracticeDay: apiData.isPracticeDay,
    races: apiData.races.map((race) => ({
      ...race,
      startTime: race.startTime ? new Date(race.startTime) : null,
    })),
    drivers: apiData.drivers,
    entryList: apiData.entryList,
    raceClasses: raceClassesMap,
    multiMainResults: apiData.multiMainResults ?? [],
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
  const selectedPracticeDriverId = useAppSelector(
    (state) => state.dashboard.selectedPracticeDriverId
  )
  // Check if Redux has rehydrated from sessionStorage
  // This prevents showing empty states during the brief rehydration window after hard reload
  const isRehydrated = useAppSelector((state) => {
    const dashboardState = state.dashboard as typeof state.dashboard & {
      _persist?: { rehydrated?: boolean }
    }
    return dashboardState._persist?.rehydrated ?? true
  })

  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [hasInitiatedFetch, setHasInitiatedFetch] = useState(false)
  const eventActions = useEventActions()
  const selectedDriverIds = eventActions.selectedDriverIds
  const selectedClass = eventActions.selectedClass
  const sectionRef = useRef<HTMLElement>(null)
  const lastFetchedEventId = useRef<string | null>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerHeight, setHeaderHeight] = useState(0)

  // Reset fetch state when event is deselected or changes
  useEffect(() => {
    if (!selectedEventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasInitiatedFetch(false)
      lastFetchedEventId.current = null
    } else if (lastFetchedEventId.current && lastFetchedEventId.current !== selectedEventId) {
      // Event changed - selections are reset by EventActionsProvider
    }
  }, [selectedEventId])

  // Fetch analysis data when event is selected
  // Trigger fetch immediately when event changes
  useEffect(() => {
    if (!selectedEventId) {
      return
    }

    // If event changed, reset fetch state
    if (lastFetchedEventId.current !== selectedEventId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasInitiatedFetch(false)
      lastFetchedEventId.current = selectedEventId
    }

    // If we already have data for this event, mark as initiated
    if (analysisData && analysisData.event.id === selectedEventId) {
      setHasInitiatedFetch(true)
      return
    }

    // Don't proceed if we're already loading or have initiated fetch
    if (hasInitiatedFetch || isAnalysisLoading) {
      return
    }

    // Trigger fetch immediately when event is selected
    // Use a small delay to ensure component state is stable
    const timeoutId = setTimeout(() => {
      // Double-check we still need to fetch (state might have changed during timeout)
      if (
        selectedEventId &&
        lastFetchedEventId.current === selectedEventId &&
        !hasInitiatedFetch &&
        !isAnalysisLoading &&
        (!analysisData || analysisData.event.id !== selectedEventId)
      ) {
        setHasInitiatedFetch(true)
        dispatch(fetchEventAnalysisData(selectedEventId))
      }
    }, 50)

    return () => {
      clearTimeout(timeoutId)
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

  const isPracticeDay = analysisData?.isPracticeDay ?? eventData?.isPracticeDay ?? false
  const availableTabs = isPracticeDay ? PRACTICE_DAY_TABS : EVENT_TABS
  const viewingDriverName =
    isPracticeDay && transformedData && selectedPracticeDriverId
      ? (transformedData.drivers.find((d) => d.driverId === selectedPracticeDriverId)?.driverName ??
        null)
      : null

  // When data switches between practice day and event, sync active tab
  useEffect(() => {
    const practiceTabIds: TabId[] = ["my-day", "my-sessions", "class-reference", "all-sessions"]
    const eventTabIds: TabId[] = ["overview", "sessions", "my-events", "drivers"]
    const sync = () => {
      if (isPracticeDay && eventTabIds.includes(activeTab)) {
        setActiveTab("my-day")
      } else if (!isPracticeDay && practiceTabIds.includes(activeTab)) {
        setActiveTab("overview")
      }
    }
    queueMicrotask(sync)
  }, [isPracticeDay, activeTab])

  // Measure fixed header height for spacer (must run after transformedData/isPracticeDay are defined)
  useLayoutEffect(() => {
    if (!headerRef.current) return
    const el = headerRef.current
    const observer = new ResizeObserver(() => {
      setHeaderHeight(el.offsetHeight)
    })
    observer.observe(el)
    setHeaderHeight(el.offsetHeight)
    return () => observer.disconnect()
  }, [transformedData?.event.id, activeTab, isPracticeDay])

  // Hide section entirely during rehydration to avoid duplicate loading messages
  // DashboardClient handles the initial loading state
  if (!isRehydrated) {
    return null
  }

  // Hide section when no event is selected (DashboardClient shows the empty state)
  // This prevents duplicate empty state messages
  if (!selectedEventId) {
    return null
  }

  // Show section even while event data is loading - it will show its own loading state
  // This ensures the section is visible and can start fetching analysis data

  return (
    <section ref={sectionRef}>
      <div className="space-y-6">
        {/* Error state */}
        {selectedEventId && analysisError && (
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
        )}

        {/* No data state - only show if we've tried to fetch and got no data */}
        {selectedEventId && !transformedData && !isAnalysisLoading && hasInitiatedFetch && (
          <div className="text-center py-12 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]">
            <p className="text-[var(--token-text-secondary)]">No analysis data available</p>
          </div>
        )}

        {/* Render analysis content - header+toolbar fixed with position:fixed */}
        {selectedEventId && transformedData && (
          <>
            {/* Spacer - reserves space so content doesn't jump (height matches fixed header) */}
            <div style={{ height: headerHeight || 180 }} aria-hidden />
            {/* Fixed header+toolbar - stays visible when scrolling */}
            <div
              ref={headerRef}
              className="fixed left-0 top-16 right-0 z-20 bg-[var(--token-surface)] px-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:px-2 md:px-2 lg:left-[var(--nav-width)] lg:px-2 xl:px-4 2xl:px-6"
            >
              <div className="content-wrapper mx-auto flex w-full min-w-0 max-w-full flex-col gap-6 pb-4 pt-4">
                <EventAnalysisHeader
                  eventName={transformedData.event.eventName}
                  eventDate={transformedData.event.eventDate}
                  trackName={transformedData.event.trackName}
                  isPracticeDay={isPracticeDay}
                  viewingDriverName={viewingDriverName}
                />
                <EventAnalysisToolbar
                  tabs={availableTabs}
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                />
              </div>
            </div>
            {/* Tab content - scrolls normally */}
            <div className="space-y-6">
              {activeTab === "overview" && (
                <>
                  <OverviewTab
                    data={transformedData}
                    selectedDriverIds={selectedDriverIds}
                    onDriverSelectionChange={eventActions.onDriverSelectionChange}
                    selectedClass={selectedClass}
                    onClassChange={eventActions.onClassChange}
                  />
                </>
              )}

              {activeTab === "drivers" && (
                <DriversTab
                  data={transformedData}
                  selectedClass={selectedClass}
                  onClassChange={eventActions.onClassChange}
                />
              )}

              {activeTab === "my-events" && (
                <div
                  className="space-y-6"
                  role="tabpanel"
                  id="tabpanel-my-events"
                  aria-labelledby="tab-my-events"
                >
                  <MyEventsContent
                    onEventSelect={(eventId) => {
                      dispatch(selectEvent(eventId))
                      setActiveTab("overview")
                    }}
                  />
                </div>
              )}

              {activeTab === "sessions" && (
                <SessionsTab
                  data={transformedData}
                  selectedDriverIds={selectedDriverIds}
                  selectedClass={selectedClass}
                  onClassChange={eventActions.onClassChange}
                />
              )}

              {/* Practice day tabs - no driver cards or weather panel */}
              {isPracticeDay && activeTab === "my-day" && transformedData && (
                <PracticeMyDayTab
                  data={transformedData}
                  selectedDriverId={selectedPracticeDriverId}
                />
              )}
              {isPracticeDay && activeTab === "my-sessions" && transformedData && (
                <PracticeMySessionsTab
                  data={transformedData}
                  selectedDriverId={selectedPracticeDriverId}
                  selectedClass={selectedClass}
                  onClassChange={eventActions.onClassChange}
                  eventId={selectedEventId}
                />
              )}
              {isPracticeDay && activeTab === "class-reference" && transformedData && (
                <div
                  className="space-y-6"
                  role="tabpanel"
                  id="tabpanel-class-reference"
                  aria-labelledby="tab-class-reference"
                >
                  <PracticeClassLeaderboard data={transformedData} selectedClass={selectedClass} />
                  <DriversTab
                    data={transformedData}
                    selectedClass={selectedClass}
                    onClassChange={eventActions.onClassChange}
                  />
                </div>
              )}
              {isPracticeDay && activeTab === "all-sessions" && transformedData && (
                <div
                  className="space-y-6"
                  role="tabpanel"
                  id="tabpanel-all-sessions"
                  aria-labelledby="tab-all-sessions"
                >
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--token-text-primary)] mb-2">
                      All Sessions
                    </h2>
                    <p className="text-sm text-[var(--token-text-secondary)]">
                      Full session list for the practice day. Sort by time, driver, or class.
                    </p>
                  </div>
                  <SessionsTab
                    data={transformedData}
                    selectedDriverIds={[]}
                    selectedClass={selectedClass}
                    onClassChange={eventActions.onClassChange}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
