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
      <div className="flex flex-col mt-6" style={{ gap: "var(--dashboard-gap)" }}>
        <div className="rounded-3xl border border-[var(--token-border-default)] bg-gradient-to-br from-[var(--token-surface-elevated)] to-[var(--token-surface-raised)] p-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.15),0_0_1px_rgba(255,255,255,0.05)]">
          <p className={typography.bodySecondary}>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Show loading state when event is selected but data is still loading
  if (selectedEventId && !selectedEvent && isEventLoading) {
    return (
      <div className="flex flex-col mt-6" style={{ gap: "var(--dashboard-gap)" }}>
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
    <div className="flex flex-col mt-6" style={{ gap: "var(--dashboard-gap)" }}>
      <div className="rounded-3xl border border-[var(--token-border-default)] bg-gradient-to-br from-[var(--token-surface-elevated)] to-[var(--token-surface-raised)] p-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.15),0_0_1px_rgba(255,255,255,0.05)]">
        <h2 className={`${typography.h2} mb-2`}>Select an Event</h2>
        <p className={`${typography.bodySecondary} mb-6`}>
          Search for an event to view analysis and insights
        </p>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--token-status-error-bg)] border border-[var(--token-status-error-text)]/20">
            <p className={`${typography.bodySecondary} text-[var(--token-status-error-text)]`}>
              {error}
            </p>
          </div>
        )}
        <div className="flex justify-center">
          <Button type="button" variant="primary" onClick={onOpenEventSearch} className="px-6 py-3">
            Search for Events
          </Button>
        </div>
      </div>
    </div>
  )
}
