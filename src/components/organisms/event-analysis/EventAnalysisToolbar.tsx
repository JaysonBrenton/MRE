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

import { ExternalLink } from "lucide-react"
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
  /** When set, the title opens this URL in a new tab (e.g. LiveRC event page). */
  eventTitleHref?: string | null
  /** Shown to the right of the title, separated by a vertical divider, when set (e.g. event date range). */
  eventDateRange?: string | null
  /** Stronger title treatment when Event Overview is active (page-scoped hierarchy). */
  titleEmphasis?: "default" | "page"
}

export default function EventAnalysisToolbar({
  tabs,
  activeTab,
  onTabChange,
  analysisSubTab,
  onAnalysisSubTabChange,
  eventTitle,
  eventTitleHref,
  eventDateRange,
  titleEmphasis = "default",
}: EventAnalysisToolbarProps) {
  const trimmedTitle = eventTitle?.trim() ?? ""
  const trimmedDateRange = eventDateRange?.trim() ?? ""
  const showTitle = trimmedTitle.length > 0
  const showDateRange = trimmedDateRange.length > 0
  const titleHref = eventTitleHref?.trim() ?? ""

  const titleClassName =
    titleEmphasis === "page"
      ? "block min-w-0 max-w-full truncate text-center text-lg font-semibold leading-snug tracking-tight text-[var(--token-text-primary)] md:text-xl"
      : "block min-w-0 max-w-full truncate text-center text-sm font-semibold leading-snug text-[var(--token-text-primary)] md:text-base"
  const titleLinkUnderlineClass =
    "underline decoration-[var(--token-accent)]/50 underline-offset-2 hover:decoration-[var(--token-accent)]"
  const titleLinkRowClassName =
    titleEmphasis === "page"
      ? `inline-flex min-w-0 max-w-full items-center justify-center gap-1 text-center text-lg font-semibold leading-snug tracking-tight text-[var(--token-text-primary)] transition-colors hover:text-[var(--token-accent)] md:text-xl`
      : `inline-flex min-w-0 max-w-full items-center justify-center gap-1 text-center text-sm font-semibold leading-snug text-[var(--token-text-primary)] transition-colors hover:text-[var(--token-accent)] md:text-base`

  return (
    <div
      className={`items-stretch gap-0 rounded-xl border border-[var(--token-border-default)] bg-[color-mix(in_oklab,var(--token-surface-elevated)_94%,transparent)] px-2.5 py-1.5 shadow-md backdrop-blur-sm supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--token-surface-elevated)_88%,transparent)] sm:px-3 sm:py-2 ${
        showTitle ? "grid w-full grid-cols-[minmax(0,1fr)_auto]" : "flex w-full"
      }`}
    >
      <div
        className={`min-w-0 overflow-x-hidden sm:pr-3 ${
          showTitle
            ? "w-max max-w-full justify-self-start border-r border-[var(--token-border-muted)] pr-2.5 sm:pr-4"
            : "flex-1 pr-2 sm:pr-3"
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
        <div className="flex min-w-0 max-w-full items-center justify-center justify-self-center self-center gap-2 pl-2.5 sm:gap-2.5 sm:pl-3">
          {titleHref ? (
            <a
              href={titleHref}
              target="_blank"
              rel="noopener noreferrer"
              className={titleLinkRowClassName}
              aria-label="View event on LiveRC (opens in new tab)"
            >
              <span className={`min-w-0 truncate ${titleLinkUnderlineClass}`}>{trimmedTitle}</span>
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            </a>
          ) : (
            <span className={titleClassName}>{trimmedTitle}</span>
          )}
          {showDateRange ? (
            <>
              <span
                className="h-4 w-px shrink-0 self-center bg-[var(--token-border-default)]"
                aria-hidden
              />
              <span
                className={
                  titleEmphasis === "page"
                    ? "shrink-0 whitespace-nowrap text-center text-sm font-medium leading-snug text-[var(--token-text-secondary)]"
                    : "shrink-0 whitespace-nowrap text-center text-sm font-semibold leading-snug text-[var(--token-text-primary)] md:text-base"
                }
              >
                {trimmedDateRange}
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
