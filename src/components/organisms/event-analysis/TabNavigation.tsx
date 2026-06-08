/**
 * @fileoverview Tab navigation component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-06-07
 *
 * @description Primary tabs for event analysis (Event Overview, Analysis, Entry List, etc.).
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/OverviewTab.tsx (tab content)
 * - src/components/organisms/event-analysis/DriversTab.tsx (tab content)
 */

"use client"

import { Fragment, type ReactNode, KeyboardEvent } from "react"

import {
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "@/components/organisms/event-analysis/overview-glass-surface"

export type TabId =
  | "event-overview"
  | "analysis"
  | "event-sessions"
  | "event-analysis"
  | "session-analysis"
  | "my-events"
  | "drivers"
  | "track-leader-board"
  | "club-highlights"
  | "my-day"
  | "my-sessions"
  | "class-reference"
  | "all-sessions"

export interface Tab {
  id: TabId
  label: string
}

/** Embedded primary tab surface for the Event Overview glass strip (pill row). */
function embeddedGlassStripPrimaryControlClass(selected: boolean): string {
  const focusRing =
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-[var(--token-interactive-focus-ring)]"
  return (
    `shrink-0 snap-start rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${focusRing} ` +
    (selected
      ? "bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]"
      : "text-[var(--token-text-secondary)] hover:bg-[var(--token-surface)]/35 hover:text-[var(--token-text-primary)]")
  )
}

export interface TabNavigationProps {
  tabs: Tab[]
  activeTab: TabId
  onTabChange: (tabId: TabId) => void
  embedded?: boolean
  /** After the last tab in the scrollable strip (not part of the tablist). */
  tabListTrailing?: ReactNode
  /**
   * When `embedded`, how the tablist is chromed. `glass` matches the default pill; `none` is bare
   * tablist for a parent outline (e.g. overview strip above the main toolbar).
   */
  embeddedChrome?: "glass" | "none"
}

const defaultTabs: Tab[] = [
  { id: "event-overview", label: "Event Overview" },
  { id: "analysis", label: "Analysis" },
  { id: "drivers", label: "Entry List" },
]

export default function TabNavigation({
  tabs = defaultTabs,
  activeTab,
  onTabChange,
  embedded = false,
  embeddedChrome = "glass",
  tabListTrailing,
}: TabNavigationProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tabId: TabId) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onTabChange(tabId)
      return
    }
    if (event.key === "ArrowLeft") {
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

  const tabButtonClass = (isActive: boolean) => {
    const focusRing = embedded
      ? "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-[var(--token-interactive-focus-ring)]"
      : "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
    if (embedded) {
      return embeddedGlassStripPrimaryControlClass(isActive)
    }
    return (
      `shrink-0 snap-start px-6 py-3 text-sm font-medium transition-colors ${focusRing} ` +
      (isActive
        ? "text-[var(--token-accent)]"
        : "text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)]")
    )
  }

  const tabButtons = tabs.map((tab) => {
    const isActive = activeTab === tab.id

    return (
      <Fragment key={tab.id}>
        <button
          type="button"
          role="tab"
          aria-selected={isActive}
          aria-controls={`tabpanel-${tab.id}`}
          id={`tab-${tab.id}`}
          onClick={() => onTabChange(tab.id)}
          onKeyDown={(e) => handleKeyDown(e, tab.id)}
          className={tabButtonClass(isActive)}
        >
          {tab.label}
        </button>
      </Fragment>
    )
  })

  const tabList = (
    <div
      role="tablist"
      aria-label="Event analysis tabs"
      className={`flex min-w-0 flex-nowrap ${embedded ? "gap-1 px-1 py-1" : ""}`}
    >
      {tabButtons}
    </div>
  )

  return (
    <div
      className={`scrollbar-none snap-x snap-mandatory scroll-smooth min-w-0 overflow-x-auto overscroll-x-contain ${embedded ? "w-max max-w-full" : "w-full border-b border-[var(--token-border-default)]"}`}
    >
      <div className={`flex w-max min-w-0 flex-nowrap items-stretch ${embedded ? "gap-2" : ""}`}>
        {embedded ? (
          embeddedChrome === "glass" ? (
            <div
              className={`inline-flex min-w-0 max-w-full overflow-hidden ${OVERVIEW_GLASS_SURFACE_CLASS}`}
              style={OVERVIEW_GLASS_SURFACE_STYLE}
            >
              {tabList}
            </div>
          ) : (
            tabList
          )
        ) : (
          tabList
        )}
        {tabListTrailing ? (
          <div className="flex shrink-0 snap-none items-stretch">{tabListTrailing}</div>
        ) : null}
      </div>
    </div>
  )
}
