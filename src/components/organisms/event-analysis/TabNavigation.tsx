/**
 * @fileoverview Tab navigation component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Tab navigation component for event analysis tabs
 *
 * @purpose Provides horizontal tab navigation with keyboard support.
 *          Mobile-friendly with scrollable tabs on small screens.
 *
 * @relatedFiles
 * - src/components/event-analysis/OverviewTab.tsx (tab content)
 * - src/components/event-analysis/DriversTab.tsx (tab content)
 */

"use client"

import { KeyboardEvent } from "react"

export type TabId =
  | "overview"
  | "sessions"
  | "my-events"
  | "drivers"
  // Practice day tabs
  | "my-day"
  | "my-sessions"
  | "class-reference"
  | "all-sessions"

export interface Tab {
  id: TabId
  label: string
}

export interface TabNavigationProps {
  tabs: Tab[]
  activeTab: TabId
  onTabChange: (tabId: TabId) => void
  /** When true, omit bottom border (e.g. when used inside EventAnalysisToolbar which provides the border). */
  embedded?: boolean
}

const defaultTabs: Tab[] = [
  { id: "overview", label: "Event Overview" },
  { id: "sessions", label: "Event Sessions" },
  { id: "my-events", label: "My Events" },
  { id: "drivers", label: "Drivers" },
]

export default function TabNavigation({
  tabs = defaultTabs,
  activeTab,
  onTabChange,
  embedded = false,
}: TabNavigationProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tabId: TabId) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onTabChange(tabId)
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      const currentIndex = tabs.findIndex((t) => t.id === activeTab)
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
      onTabChange(tabs[prevIndex].id)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      const currentIndex = tabs.findIndex((t) => t.id === activeTab)
      const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
      onTabChange(tabs[nextIndex].id)
    }
  }

  return (
    <div
      className={`overflow-x-auto ${embedded ? "" : "border-b border-[var(--token-border-default)]"}`}
      role="tablist"
      aria-label="Event analysis tabs"
    >
      <div className="flex min-w-max">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] ${
                isActive
                  ? "border-[var(--token-accent)] text-[var(--token-accent)]"
                  : "border-transparent text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)]"
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
