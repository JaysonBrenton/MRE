/**
 * @fileoverview Event analysis toolbar: tabs + Actions menu in one row
 *
 * @description Tab strip (TabNavigation) with optional event title column; Actions sits in the
 *              scrollable strip after Entry List, tab-styled via EventAnalysisActionsMenu.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/TabNavigation.tsx
 * - src/components/organisms/event-analysis/EventAnalysisActionsMenu.tsx
 */

"use client"

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
  /** Trailing column when set; sizes to show the full name (one line when it fits). */
  eventTitle?: string | null
  /** Shown to the right of the title, separated by a vertical divider, when set (e.g. event date range). */
  eventDateRange?: string | null
}

export default function EventAnalysisToolbar({
  tabs,
  activeTab,
  onTabChange,
  analysisSubTab,
  onAnalysisSubTabChange,
  eventTitle,
  eventDateRange,
}: EventAnalysisToolbarProps) {
  const trimmedTitle = eventTitle?.trim() ?? ""
  const trimmedDateRange = eventDateRange?.trim() ?? ""
  const showTitle = trimmedTitle.length > 0
  const showDateRange = trimmedDateRange.length > 0

  return (
    <div
      className={`items-stretch gap-0 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]/80 px-2.5 py-1.5 shadow-sm sm:px-3 ${
        showTitle ? "grid w-full grid-cols-[minmax(0,1fr)_auto]" : "flex w-full"
      }`}
    >
      <div
        className={`min-w-0 overflow-x-hidden pr-2 sm:pr-3 ${
          showTitle ? "w-max max-w-full justify-self-start" : "flex-1"
        }`}
      >
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          embedded
          analysisSubTab={analysisSubTab}
          onAnalysisSubTabChange={onAnalysisSubTabChange}
          tabListTrailing={<EventAnalysisActionsMenu tabStripTrigger />}
        />
      </div>
      {showTitle ? (
        <div className="flex min-w-0 max-w-full items-center justify-center justify-self-center self-center gap-2 px-2 sm:gap-2.5 sm:px-2.5">
          <span className="block min-w-0 max-w-full truncate text-center text-sm font-semibold leading-snug text-[var(--token-text-primary)] md:text-base">
            {trimmedTitle}
          </span>
          {showDateRange ? (
            <>
              <span
                className="h-4 w-px shrink-0 self-center bg-[var(--token-border-default)]"
                aria-hidden
              />
              <span className="shrink-0 whitespace-nowrap text-center text-sm font-semibold leading-snug text-[var(--token-text-primary)] md:text-base">
                {trimmedDateRange}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
