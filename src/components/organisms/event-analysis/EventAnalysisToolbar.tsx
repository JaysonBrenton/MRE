/**
 * @fileoverview Event analysis toolbar: tabs + Actions menu in one row
 *
 * @description Tab strip (TabNavigation) with optional event title column; Actions after tabs,
 *              tab-styled via EventAnalysisActionsMenu. {@link EventAnalysisToolbarAboveEventDetailsStrip}
 *              uses one row: tab strip box + matching title box (clear bordered chrome).
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/TabNavigation.tsx
 * - src/components/organisms/event-analysis/EventAnalysisActionsMenu.tsx
 */

"use client"

import TabNavigation, {
  type Tab,
  type TabId,
} from "@/components/organisms/event-analysis/TabNavigation"
import EventAnalysisActionsMenu from "@/components/organisms/event-analysis/EventAnalysisActionsMenu"
import type { EventAnalysisSubTabId } from "@/components/organisms/event-analysis/event-analysis-sub-tabs"

export interface EventAnalysisToolbarProps {
  tabs: Tab[]
  activeTab: TabId
  onTabChange: (tabId: TabId) => void
  /** Event Analysis / Session Analysis sub-views (menus under those tab buttons). */
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

const tabStripTrailingDividerClass = "w-px shrink-0 self-stretch bg-[var(--token-border-muted)]"

/** Inner shell for overview clear strips (tabs row or title row). */
const EVENT_OVERVIEW_STRIP_BOX_INNER_CLASS =
  "min-w-0 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-transparent shadow-none"

function EventAnalysisToolbarTitleContent({
  eventTitle,
  eventTitleHref,
  eventDateRange,
  titleEmphasis = "default",
}: Pick<
  EventAnalysisToolbarProps,
  "eventTitle" | "eventTitleHref" | "eventDateRange" | "titleEmphasis"
>) {
  const trimmedTitle = eventTitle?.trim() ?? ""
  const trimmedDateRange = eventDateRange?.trim() ?? ""
  if (trimmedTitle.length === 0) return null
  const showDateRange = trimmedDateRange.length > 0
  const titleHref = eventTitleHref?.trim() ?? ""

  const titleClassName =
    titleEmphasis === "page"
      ? "block min-w-0 max-w-full truncate text-center text-lg font-semibold leading-snug tracking-tight text-[var(--token-text-primary)] md:text-xl"
      : "block min-w-0 max-w-full truncate text-center text-sm font-semibold leading-snug text-[var(--token-text-primary)] md:text-base"
  const titleLinkUnderlineClass =
    "underline decoration-[var(--token-accent)]/50 underline-offset-2 hover:decoration-[var(--token-accent)]"
  const titleLinkClassName =
    titleEmphasis === "page"
      ? `inline-block min-w-0 max-w-full truncate text-center text-lg font-semibold leading-snug tracking-tight text-[var(--token-text-primary)] transition-colors hover:text-[var(--token-accent)] md:text-xl ${titleLinkUnderlineClass}`
      : `inline-block min-w-0 max-w-full truncate text-center text-sm font-semibold leading-snug text-[var(--token-text-primary)] transition-colors hover:text-[var(--token-accent)] md:text-base ${titleLinkUnderlineClass}`

  return (
    <div className="flex min-w-0 max-w-full items-center justify-center gap-2 px-2.5 py-0 sm:gap-2.5 sm:px-3">
      {titleHref ? (
        <a
          href={titleHref}
          target="_blank"
          rel="noopener noreferrer"
          className={titleLinkClassName}
          aria-label="View event on LiveRC (opens in new tab)"
        >
          {trimmedTitle}
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
  )
}

/** Event Overview: one row — tab strip box + same-style title box (no elevated card below). */
export function EventAnalysisToolbarAboveEventDetailsStrip(props: EventAnalysisToolbarProps) {
  const hasTitle = (props.eventTitle?.trim() ?? "").length > 0

  return (
    <div className="scrollbar-none flex w-full min-w-0 flex-nowrap items-stretch gap-3 overflow-x-auto overscroll-x-contain">
      <div className="min-w-0 w-max max-w-full shrink-0">
        <div className={`w-max max-w-full ${EVENT_OVERVIEW_STRIP_BOX_INNER_CLASS}`}>
          <TabNavigation
            tabs={props.tabs}
            activeTab={props.activeTab}
            onTabChange={props.onTabChange}
            embedded
            embeddedChrome="none"
            analysisSubTab={props.analysisSubTab}
            onAnalysisSubTabChange={props.onAnalysisSubTabChange}
            tabListTrailing={
              <div className="flex items-stretch gap-2 pr-1">
                <span className={tabStripTrailingDividerClass} aria-hidden />
                <div className="flex items-center self-center">
                  <EventAnalysisActionsMenu tabStripTrigger />
                </div>
              </div>
            }
          />
        </div>
      </div>
      {hasTitle ? (
        <div className="min-w-0 min-h-0 flex-1 basis-[12rem] max-w-full self-stretch">
          <div
            className={`flex h-full min-h-full w-full items-center justify-center ${EVENT_OVERVIEW_STRIP_BOX_INNER_CLASS}`}
          >
            <EventAnalysisToolbarTitleContent
              eventTitle={props.eventTitle}
              eventTitleHref={props.eventTitleHref}
              eventDateRange={props.eventDateRange}
              titleEmphasis={props.titleEmphasis}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
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
  const title = (
    <EventAnalysisToolbarTitleContent
      eventTitle={eventTitle}
      eventTitleHref={eventTitleHref}
      eventDateRange={eventDateRange}
      titleEmphasis={titleEmphasis}
    />
  )

  return (
    <div
      className={`items-stretch gap-0 rounded-xl bg-[color-mix(in_oklab,var(--token-surface-elevated)_94%,transparent)] px-0 py-1.5 shadow-md backdrop-blur-sm supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--token-surface-elevated)_88%,transparent)] sm:py-2 ${
        title ? "grid w-full grid-cols-[minmax(0,1fr)_auto]" : "flex w-full"
      }`}
    >
      <div
        className={`min-w-0 overflow-x-hidden sm:pr-3 ${
          title
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
      {title ? <div className="justify-self-center self-center">{title}</div> : null}
    </div>
  )
}
