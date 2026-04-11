"use client"

import { useEffect } from "react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import { fetchEventData, fetchRecentEvents } from "@/store/slices/dashboardSlice"
import { useDashboardEventSearch } from "./DashboardEventSearchProvider"
import Button from "@/components/atoms/Button"
import { typography } from "@/lib/typography"

/**
 * Dashboard guard/orchestrator: handles loading states, empty state, and event data fetching.
 * Actual dashboard content (event analysis, driver cards, weather) is rendered by
 * EventAnalysisSection as a sibling on the dashboard page.
 */
export default function DashboardClient() {
  const dispatch = useAppDispatch()
  const selectedEventId = useAppSelector((state) => state.dashboard.selectedEventId)
  const eventData = useAppSelector((state) => state.dashboard.eventData)
  const eventError = useAppSelector((state) => state.dashboard.eventError)
  const isEventLoading = useAppSelector((state) => state.dashboard.isEventLoading)
  const isRehydrated = useAppSelector((state) => {
    const dashboardState = state.dashboard as typeof state.dashboard & {
      _persist?: { rehydrated?: boolean }
    }
    return dashboardState._persist?.rehydrated ?? true
  })

  const selectedEvent = eventData?.event ?? null
  const { openEventSearch } = useDashboardEventSearch()

  // Fetch recent events on mount (runs in background, doesn't block UI)
  useEffect(() => {
    dispatch(fetchRecentEvents("all"))
  }, [dispatch])

  // Fetch event data when selectedEventId changes
  useEffect(() => {
    if (!selectedEventId) return
    const promise = dispatch(fetchEventData(selectedEventId))
    return () => {
      promise.abort()
    }
  }, [dispatch, selectedEventId])

  // Show loading state during rehydration (prevents empty state flash on hard reload)
  if (!isRehydrated) {
    return (
      <div className="mt-6 flex flex-col" style={{ gap: "var(--dashboard-gap)" }}>
        <div className="rounded-3xl border border-[var(--token-border-default)] bg-gradient-to-br from-[var(--token-surface-elevated)] to-[var(--token-surface-raised)] p-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.15),0_0_1px_rgba(255,255,255,0.05)]">
          <p className={typography.bodySecondary}>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Show loading state when event is selected but data is still loading
  if (selectedEventId && !selectedEvent && isEventLoading) {
    return (
      <div className="mt-6 flex flex-col" style={{ gap: "var(--dashboard-gap)" }}>
        <div className="rounded-3xl border border-[var(--token-border-default)] bg-gradient-to-br from-[var(--token-surface-elevated)] to-[var(--token-surface-raised)] p-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.15),0_0_1px_rgba(255,255,255,0.05)]">
          <p className={typography.bodySecondary}>Loading event data...</p>
        </div>
      </div>
    )
  }

  // Empty state - no event selected
  if (!selectedEvent) {
    return <DashboardEmptyState onOpenEventSearch={openEventSearch} error={eventError} />
  }

  // Event selected: EventAnalysisSection (sibling) renders the content
  return null
}

function DashboardEmptyState({
  onOpenEventSearch,
  error,
}: {
  onOpenEventSearch: () => void
  error?: string | null
}) {
  return (
    <div
      className="mt-6 mx-auto flex w-full max-w-3xl shrink-0 flex-col"
      style={{ gap: "var(--token-spacing-md)" }}
    >
      <div className="rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-4 text-left shadow-sm sm:px-5 sm:py-5">
        <h2 className={`${typography.h2} mb-3`}>Select an event</h2>
        <p className={`${typography.bodySecondary} mb-4`}>
          Search for a race or pick one from your recent list. After it loads, the analysis
          workspace opens here with tabs for each area.
        </p>
        <ul
          className="w-full list-disc space-y-2 pl-5 text-sm leading-snug text-[var(--token-text-secondary)] marker:text-[var(--token-text-muted)]"
          aria-label="What becomes available after you select an event"
        >
          <li>
            <span className="font-medium text-[var(--token-text-primary)]">Overview</span> — summary
            stats, charts, and lap trends
          </li>
          <li>
            <span className="font-medium text-[var(--token-text-primary)]">Event sessions</span> —
            race grid, lap analysis, and bump-ups when they apply
          </li>
          <li>
            <span className="font-medium text-[var(--token-text-primary)]">Entry list</span> and
            optional leaderboards or highlights
          </li>
        </ul>
      </div>
      {error && (
        <div className="rounded-lg border border-[var(--token-status-error-text)]/20 bg-[var(--token-status-error-bg)] p-3 text-left">
          <p className={`${typography.bodySecondary} text-[var(--token-status-error-text)]`}>
            {error}
          </p>
        </div>
      )}
      <div className="flex justify-center">
        <Button type="button" variant="default" onClick={onOpenEventSearch} className="px-6 py-3">
          Search for events
        </Button>
      </div>
    </div>
  )
}
