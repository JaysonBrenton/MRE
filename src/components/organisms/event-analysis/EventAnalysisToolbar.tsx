/**
 * @fileoverview Event analysis toolbar: tabs + Actions menu in one row
 *
 * @description Single horizontal bar with TabNavigation (left) and EventAnalysisActionsMenu (right).
 *              Visible when viewing Overview or Entry List.
 *
 * @relatedFiles
 * - src/components/event-analysis/TabNavigation.tsx
 * - src/components/event-analysis/EventAnalysisActionsMenu.tsx
 */

"use client"

import type { ReactNode } from "react"
import TabNavigation, {
  type TabId,
  type Tab,
} from "@/components/organisms/event-analysis/TabNavigation"
import EventAnalysisActionsMenu from "@/components/organisms/event-analysis/EventAnalysisActionsMenu"

export interface EventAnalysisToolbarProps {
  tabs: Tab[]
  activeTab: TabId
  onTabChange: (tabId: TabId) => void
  /** When true, show "Correct venue" in Actions menu */
  venueCorrectionCanSubmit?: boolean
  /** Called when user selects "Correct venue" from Actions menu */
  onCorrectVenueClick?: () => void
  /**
   * Shown only below `lg` when primary navigation lives in the rail (e.g. My Events)
   * so narrow viewports still have access.
   */
  belowLgRailFallback?: ReactNode
}

export default function EventAnalysisToolbar({
  tabs,
  activeTab,
  onTabChange,
  venueCorrectionCanSubmit = false,
  onCorrectVenueClick,
  belowLgRailFallback,
}: EventAnalysisToolbarProps) {
  return (
    <div className="flex items-stretch gap-0 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/80 px-2.5 py-1.5 shadow-sm sm:px-3">
      <div className="flex min-w-0 flex-1 items-stretch gap-2 overflow-x-hidden pr-2 sm:gap-3 sm:pr-3">
        {belowLgRailFallback ? (
          <div className="shrink-0 border-r border-[var(--token-border-subtle)] pr-2 lg:hidden">
            {belowLgRailFallback}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 overflow-x-hidden">
          <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} embedded />
        </div>
      </div>
      <div className="flex shrink-0 items-center pl-2.5 sm:border-l sm:border-[var(--token-border-subtle)] sm:pl-4">
        <EventAnalysisActionsMenu
          venueCorrectionCanSubmit={venueCorrectionCanSubmit}
          onCorrectVenueClick={onCorrectVenueClick}
        />
      </div>
    </div>
  )
}
