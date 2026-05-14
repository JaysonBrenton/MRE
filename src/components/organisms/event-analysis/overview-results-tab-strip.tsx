"use client"

import { useCallback, type KeyboardEvent } from "react"

export type OverviewResultsTab = "event-results" | "session-results"

export const OVERVIEW_RESULTS_TAB_IDS: Record<OverviewResultsTab, string> = {
  "event-results": "event-overview-event-results-tab",
  "session-results": "event-overview-session-results-tab",
}

export const OVERVIEW_RESULTS_PANEL_IDS: Record<OverviewResultsTab, string> = {
  "event-results": "event-overview-event-results-panel",
  "session-results": "event-overview-session-results-panel",
}

const TABS: readonly { id: OverviewResultsTab; label: string }[] = [
  { id: "event-results", label: "Event Results" },
  { id: "session-results", label: "Session Results" },
]

export interface OverviewResultsTabStripProps {
  activeTab: OverviewResultsTab
  onTabChange: (tab: OverviewResultsTab) => void
}

export function OverviewResultsTabStrip({ activeTab, onTabChange }: OverviewResultsTabStripProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, tabId: OverviewResultsTab) => {
      const currentIndex = TABS.findIndex((tab) => tab.id === tabId)
      const lastIndex = TABS.length - 1
      let nextIndex: number | null = null

      if (event.key === "ArrowLeft") {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : lastIndex
      } else if (event.key === "ArrowRight") {
        nextIndex = currentIndex < lastIndex ? currentIndex + 1 : 0
      } else if (event.key === "Home") {
        nextIndex = 0
      } else if (event.key === "End") {
        nextIndex = lastIndex
      }

      if (nextIndex == null) return
      event.preventDefault()

      const nextTab = TABS[nextIndex]
      onTabChange(nextTab.id)
      queueMicrotask(() => document.getElementById(OVERVIEW_RESULTS_TAB_IDS[nextTab.id])?.focus())
    },
    [onTabChange]
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="whitespace-nowrap text-xs font-medium text-[var(--token-text-secondary)]">
        View
      </span>
      <div
        className="inline-flex rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] p-0.5"
        role="tablist"
        aria-label="Results view"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              id={OVERVIEW_RESULTS_TAB_IDS[tab.id]}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={OVERVIEW_RESULTS_PANEL_IDS[tab.id]}
              tabIndex={isActive ? 0 : -1}
              className={[
                "shrink-0 rounded-[0.25rem] px-2.5 py-1 text-xs font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)]",
                isActive
                  ? "bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)] shadow-sm"
                  : "text-[var(--token-text-secondary)] hover:bg-[var(--token-surface-raised)]/90 hover:text-[var(--token-text-primary)]",
              ].join(" ")}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
