/**
 * @fileoverview Event analysis toolbar: tabs + Actions menu in one row
 *
 * @description Single horizontal bar with TabNavigation (left; Event Analysis / Session Analysis
 *              sub-views open under those tab buttons when sub-tab props are passed) and
 *              EventAnalysisActionsMenu (right).
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/TabNavigation.tsx
 * - src/components/organisms/event-analysis/EventAnalysisActionsMenu.tsx
 */

"use client"

import type { ReactNode } from "react"
import TabNavigation, {
  type TabId,
  type Tab,
} from "@/components/organisms/event-analysis/TabNavigation"
import EventAnalysisActionsMenu from "@/components/organisms/event-analysis/EventAnalysisActionsMenu"
import type { EventAnalysisSubTabId } from "@/components/organisms/event-analysis/event-analysis-sub-tabs"

export interface EventAnalysisToolbarProps {
  tabs: Tab[]
  activeTab: TabId
  onTabChange: (tabId: TabId) => void
  /** Event Analysis / Session Analysis sub-views (menus under those tabs). */
  analysisSubTab?: EventAnalysisSubTabId
  onAnalysisSubTabChange?: (id: EventAnalysisSubTabId) => void
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
  analysisSubTab,
  onAnalysisSubTabChange,
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
          <TabNavigation
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
            embedded
            analysisSubTab={analysisSubTab}
            onAnalysisSubTabChange={onAnalysisSubTabChange}
          />
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
