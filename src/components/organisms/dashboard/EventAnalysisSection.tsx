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
 * - src/app/(authenticated)/eventAnalysis/page.tsx (uses this)
 * - src/store/slices/dashboardSlice.ts (Redux state)
 * - src/components/event-analysis/ (tab components)
 */

"use client"

import { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react"
import { useAppSelector, useAppDispatch } from "@/store/hooks"
import {
  fetchEventAnalysisData,
  selectEvent,
  setActiveEventAnalysisTab,
} from "@/store/slices/dashboardSlice"
import EventAnalysisToolbar from "@/components/organisms/event-analysis/EventAnalysisToolbar"
import type { EventAnalysisSubTabId } from "@/components/organisms/event-analysis/event-analysis-sub-tabs"
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
import TrackLeaderboardTab from "@/components/organisms/event-analysis/TrackLeaderboardTab"
import ClubHighlightsTab from "@/components/organisms/event-analysis/ClubHighlightsTab"
import CountryLeaderboardCard from "@/components/organisms/event-analysis/CountryLeaderboardCard"
import StandardButton from "@/components/atoms/StandardButton"
import { formatDateLong } from "@/lib/date-utils"
import { typography } from "@/lib/typography"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import type { EventAnalysisDataApiResponse } from "@/types/event-analysis-api"

const PRACTICE_DAY_TABS: { id: TabId; label: string }[] = [
  { id: "my-day", label: "My Day" },
  { id: "my-sessions", label: "My Sessions" },
  { id: "class-reference", label: "Class Reference" },
  { id: "all-sessions", label: "All Sessions" },
]
const EVENT_TABS: { id: TabId; label: string }[] = [
  { id: "event-overview", label: "Event Overview" },
  { id: "event-analysis", label: "Event Analysis" },
  { id: "session-analysis", label: "Session Analysis" },
  { id: "drivers", label: "Entry List" },
]

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
      trackId: apiData.event.trackId,
      eventName: apiData.event.eventName,
      eventDate: new Date(apiData.event.eventDate),
      eventDateEnd: apiData.event.eventDateEnd ? new Date(apiData.event.eventDateEnd) : undefined,
      trackName: apiData.event.trackName,
      trackDashboardUrl: apiData.event.trackDashboardUrl ?? undefined,
      eventUrl: apiData.event.eventUrl,
      website: apiData.event.website ?? undefined,
      facebookUrl: apiData.event.facebookUrl ?? undefined,
      address: apiData.event.address ?? undefined,
      phone: apiData.event.phone ?? undefined,
      email: apiData.event.email ?? undefined,
      sourceEventId: apiData.event.sourceEventId,
      trackSlug: apiData.event.trackSlug,
    },
    isPracticeDay: apiData.isPracticeDay,
    registrationClassNames: apiData.registrationClassNames,
    programBucketOrder: apiData.programBucketOrder,
    races: apiData.races.map((race) => ({
      ...race,
      completedAt: race.completedAt ? new Date(race.completedAt) : null,
      startTime: race.startTime ? new Date(race.startTime) : null,
      sessionType: race.sessionType ?? null,
      sectionHeader: race.sectionHeader ?? null,
      vehicleType: race.vehicleType ?? null,
      userCarTaxonomy: race.userCarTaxonomy,
      skillTier: race.skillTier ?? null,
      vehicleClassNormalizationNeedsReview: race.vehicleClassNormalizationNeedsReview ?? false,
      eventRaceClassId: race.eventRaceClassId ?? null,
    })),
    drivers: apiData.drivers,
    entryList: apiData.entryList,
    raceClasses: raceClassesMap,
    multiMainResults: apiData.multiMainResults ?? [],
    qualPointsTopQualifiers: apiData.qualPointsTopQualifiers ?? null,
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
    userHostTrack: apiData.userHostTrack ?? null,
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

  const activeTab = useAppSelector((state) => state.dashboard.activeEventAnalysisTab)
  const [hasInitiatedFetch, setHasInitiatedFetch] = useState(false)
  const eventActions = useEventActions()
  const selectedDriverIds = eventActions.selectedDriverIds
  const selectedClass = eventActions.selectedClass
  const sectionRef = useRef<HTMLElement>(null)
  const lastFetchedEventId = useRef<string | null>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerHeight, setHeaderHeight] = useState(0)
  const [analysisSubTab, setAnalysisSubTab] = useState<EventAnalysisSubTabId>("event-results")

  /** Ladder sub-views apply to Event Analysis only; Session Analysis ignores them. */
  const resolvedAnalysisSubTab = useMemo((): EventAnalysisSubTabId => {
    if (
      activeTab === "session-analysis" &&
      (analysisSubTab === "bump-ups" ||
        analysisSubTab === "driver-progression" ||
        analysisSubTab === "qualification-results")
    ) {
      return "event-results"
    }
    return analysisSubTab
  }, [activeTab, analysisSubTab])

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

  useEffect(() => {
    if (!selectedEventId) return
    queueMicrotask(() => setAnalysisSubTab("event-results"))
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
    // Double-check we still need to fetch (guards may change during render/effects)
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
  }, [selectedEventId, analysisData, isAnalysisLoading, hasInitiatedFetch, dispatch])

  // Also fetch when user clicks on a tab (in case section was already visible)
  const handleTabChange = (tabId: TabId) => {
    if (
      tabId === "session-analysis" &&
      (analysisSubTab === "bump-ups" ||
        analysisSubTab === "driver-progression" ||
        analysisSubTab === "qualification-results")
    ) {
      setAnalysisSubTab("event-results")
    }
    dispatch(setActiveEventAnalysisTab(tabId))

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

  /** Title between tab strip and Actions in the fixed toolbar (event name, else track). */
  const eventAnalysisToolbarTitle = useMemo(() => {
    if (!transformedData) return null
    const name = transformedData.event.eventName?.trim() ?? ""
    const track = transformedData.event.trackName?.trim() ?? ""
    const label = name || track
    return label.length > 0 ? label : null
  }, [transformedData])

  /** Same range string as Event Overview “Event date” row (earliest – latest, or single day). */
  const eventAnalysisToolbarDateRange = useMemo(() => {
    if (!transformedData) return null
    const dr = transformedData.summary.dateRange
    if (!dr || (!dr.earliest && !dr.latest)) return null
    const earliestStr = dr.earliest ? formatDateLong(dr.earliest) : ""
    const latestStr = dr.latest ? formatDateLong(dr.latest) : ""
    if (!earliestStr && !latestStr) return null
    const s =
      earliestStr && latestStr && earliestStr === latestStr
        ? earliestStr
        : `${earliestStr}${earliestStr && latestStr ? " – " : ""}${latestStr}`
    return s.length > 0 ? s : null
  }, [transformedData])

  // When data switches between practice day and event, sync active tab
  useEffect(() => {
    const practiceTabIds: TabId[] = ["my-day", "my-sessions", "class-reference", "all-sessions"]
    const eventTabIds: TabId[] = [
      "event-overview",
      "event-analysis",
      "session-analysis",
      "my-events",
      "drivers",
    ]
    const sync = () => {
      if (isPracticeDay && eventTabIds.includes(activeTab)) {
        dispatch(setActiveEventAnalysisTab("my-day"))
      } else if (!isPracticeDay && practiceTabIds.includes(activeTab)) {
        dispatch(setActiveEventAnalysisTab("event-overview"))
      }
    }
    queueMicrotask(sync)
  }, [isPracticeDay, activeTab, dispatch])

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
      <div className="space-y-[var(--dashboard-gap)]">
        {/* Error state */}
        {selectedEventId && analysisError && (
          <div className="text-center py-12 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]">
            <p className={`${typography.bodySecondary} text-[var(--token-status-error-text)] mb-4`}>
              {analysisError}
            </p>
            <StandardButton
              type="button"
              onClick={() => {
                if (selectedEventId) {
                  setHasInitiatedFetch(true)
                  dispatch(fetchEventAnalysisData(selectedEventId))
                }
              }}
            >
              Retry loading
            </StandardButton>
          </div>
        )}

        {/* No data state - only show if we've tried to fetch and got no data (and no error) */}
        {selectedEventId &&
          !analysisError &&
          !transformedData &&
          !isAnalysisLoading &&
          hasInitiatedFetch && (
            <div className="text-center py-12 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]">
              <p className={typography.bodySecondary}>No analysis data available</p>
            </div>
          )}

        {/* Render analysis content - header+toolbar fixed with position:fixed */}
        {selectedEventId && transformedData && (
          <>
            {/* Spacer - reserves space so content doesn't jump (height matches fixed header) */}
            <div style={{ height: Math.max(0, (headerHeight || 180) - 32) }} aria-hidden />
            {/* Fixed header+toolbar - stays visible when scrolling */}
            <div
              ref={headerRef}
              className="fixed left-0 top-16 right-0 z-20 bg-[var(--token-surface)] px-1 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:px-2 md:px-2 lg:left-[calc(var(--nav-width)_+_var(--nav-content-gutter))] lg:pl-0 lg:pr-2 xl:pl-0 xl:pr-4 2xl:pl-0 2xl:pr-6"
            >
              <div
                className="content-wrapper mx-auto flex w-full min-w-0 max-w-full flex-col pb-2 pt-2 sm:pb-3 sm:pt-3"
                style={{ gap: "var(--token-spacing-md)" }}
              >
                <EventAnalysisHeader
                  eventName={transformedData.event.eventName}
                  eventDate={transformedData.event.eventDate}
                  eventDateEnd={transformedData.event.eventDateEnd}
                  trackName={transformedData.event.trackName}
                  isPracticeDay={isPracticeDay}
                  viewingDriverName={viewingDriverName}
                  isMyEventsSection={activeTab === "my-events"}
                />
                {activeTab !== "my-events" && (
                  <EventAnalysisToolbar
                    tabs={availableTabs}
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    analysisSubTab={resolvedAnalysisSubTab}
                    onAnalysisSubTabChange={setAnalysisSubTab}
                    eventTitle={eventAnalysisToolbarTitle}
                    eventDateRange={eventAnalysisToolbarDateRange}
                  />
                )}
              </div>
            </div>
            {/* Tab content - scrolls normally */}
            <div className="space-y-[var(--dashboard-gap)]">
              {activeTab === "event-overview" && (
                <OverviewTab
                  data={transformedData}
                  selectedDriverIds={selectedDriverIds}
                  onDriverSelectionChange={eventActions.onDriverSelectionChange}
                  selectedClass={selectedClass}
                  onClassChange={eventActions.onClassChange}
                  variant="event-overview-only"
                />
              )}

              {activeTab === "event-analysis" && (
                <OverviewTab
                  data={transformedData}
                  selectedDriverIds={selectedDriverIds}
                  onDriverSelectionChange={eventActions.onDriverSelectionChange}
                  selectedClass={selectedClass}
                  onClassChange={eventActions.onClassChange}
                  variant="event-analysis-only"
                  analysisSubTab={resolvedAnalysisSubTab}
                  onAnalysisSubTabChange={setAnalysisSubTab}
                />
              )}

              {activeTab === "session-analysis" && (
                <OverviewTab
                  data={transformedData}
                  selectedDriverIds={selectedDriverIds}
                  onDriverSelectionChange={eventActions.onDriverSelectionChange}
                  selectedClass={selectedClass}
                  onClassChange={eventActions.onClassChange}
                  variant="session-analysis-only"
                  analysisSubTab={resolvedAnalysisSubTab}
                  onAnalysisSubTabChange={setAnalysisSubTab}
                />
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
                  className="space-y-[var(--dashboard-gap)]"
                  role="region"
                  aria-label="My events"
                >
                  <MyEventsContent
                    onEventSelect={(eventId) => {
                      dispatch(selectEvent(eventId))
                      dispatch(setActiveEventAnalysisTab("event-overview"))
                    }}
                  />
                </div>
              )}

              {activeTab === "track-leader-board" && transformedData && selectedEventId && (
                <div className="space-y-[var(--dashboard-gap)]">
                  <TrackLeaderboardTab
                    eventId={selectedEventId}
                    trackName={transformedData.event.trackName}
                    selectedClass={selectedClass}
                    onClassChange={eventActions.onClassChange}
                  />
                  <CountryLeaderboardCard defaultCountry="Australia" />
                </div>
              )}

              {activeTab === "club-highlights" && transformedData && (
                <ClubHighlightsTab trackName={transformedData.event.trackName} />
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
                  className="space-y-[var(--dashboard-gap)]"
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
                  className="space-y-[var(--dashboard-gap)]"
                  role="tabpanel"
                  id="tabpanel-all-sessions"
                  aria-labelledby="tab-all-sessions"
                >
                  <div>
                    <h2 className={`${typography.h3} mb-2`}>All Sessions</h2>
                    <p className={typography.bodySecondary}>
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
