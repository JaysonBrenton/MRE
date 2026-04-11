"use client"

import { CalendarRange } from "lucide-react"
import { useAppSelector } from "@/store/hooks"
import { useDashboardEventSearch } from "@/components/organisms/dashboard/DashboardEventSearchProvider"

/**
 * Event context button for the shell. Shows current event name when selected,
 * or "Select or change event". Click opens the dashboard event search modal.
 */
export default function ContextRibbon() {
  const eventData = useAppSelector((state) => state.dashboard.eventData)
  const { openEventSearch } = useDashboardEventSearch()

  const eventName = eventData?.event?.eventName ?? null
  const displayLabel = eventName ? `Event: ${eventName}` : "Select or change event"

  return (
    <button
      type="button"
      onClick={openEventSearch}
      className="flex items-center gap-2 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2 transition hover:border-[var(--token-accent)] min-w-0 max-w-[240px] sm:max-w-[320px]"
      aria-label={displayLabel}
    >
      <CalendarRange
        className="h-5 w-5 shrink-0 text-[var(--token-text-muted)]"
        aria-hidden="true"
      />
      <span className="truncate text-sm font-medium text-[var(--token-text-primary)]">
        {displayLabel}
      </span>
    </button>
  )
}
