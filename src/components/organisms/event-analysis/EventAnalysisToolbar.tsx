/**
 * @fileoverview Event analysis toolbar: tabs + Actions menu in one row
 *
 * @description Single horizontal bar with TabNavigation (left) and EventAnalysisActionsMenu (right).
 *              Visible when viewing Event Overview, Event Sessions, or Drivers.
 *
 * @relatedFiles
 * - src/components/event-analysis/TabNavigation.tsx
 * - src/components/event-analysis/EventAnalysisActionsMenu.tsx
 */

"use client"

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
}

export default function EventAnalysisToolbar({
  tabs,
  activeTab,
  onTabChange,
  venueCorrectionCanSubmit = false,
  onCorrectVenueClick,
}: EventAnalysisToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/80 px-3 py-2 shadow-sm">
      <div className="min-w-0 flex-1 overflow-x-auto">
        <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} embedded />
      </div>
      <EventAnalysisActionsMenu
        venueCorrectionCanSubmit={venueCorrectionCanSubmit}
        onCorrectVenueClick={onCorrectVenueClick}
      />
    </div>
  )
}
