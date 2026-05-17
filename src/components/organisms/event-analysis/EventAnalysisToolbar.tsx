/**
 * @fileoverview Event analysis toolbar: tabs + Actions menu in one row
 *
 * @description Tab strip (TabNavigation) with optional event title column; Actions after tabs,
 *              tab-styled via EventAnalysisActionsMenu. {@link EventAnalysisToolbarAboveEventDetailsStrip}
 *              matches the overview strip chrome (glass border row + optional title column).
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
import type { AnalysisPrimarySubTabId } from "@/components/organisms/event-analysis/event-analysis-sub-tabs"

export interface EventAnalysisToolbarProps {
  tabs: Tab[]
  activeTab: TabId
  onTabChange: (tabId: TabId) => void
  analysisMenuSelectedId?: string
  onAnalysisMenuDispatch?: (id: AnalysisPrimarySubTabId) => void
  /** Trailing column when set; sizes to show the full name (one line when it fits). */
  eventTitle?: string | null
  /** Stronger title treatment when Event Overview is active (page-scoped hierarchy). */
  titleEmphasis?: "default" | "page"
}

const tabStripTrailingDividerClass = "w-px shrink-0 self-stretch bg-[var(--token-border-muted)]"

/** Inner shell for overview clear strips (tabs row or title row). */
const EVENT_OVERVIEW_STRIP_BOX_INNER_CLASS =
  "min-w-0 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-transparent shadow-none"

function EventAnalysisToolbarTitleContent({
  eventTitle,
  titleEmphasis = "default",
}: Pick<EventAnalysisToolbarProps, "eventTitle" | "titleEmphasis">) {
  const trimmedTitle = eventTitle?.trim() ?? ""
  if (trimmedTitle.length === 0) return null

  const titleClassName =
    titleEmphasis === "page"
      ? "block min-w-0 max-w-full truncate text-center text-lg font-semibold leading-snug tracking-tight text-[var(--token-text-primary)] md:text-xl"
      : "block min-w-0 max-w-full truncate text-center text-sm font-semibold leading-snug text-[var(--token-text-primary)] md:text-base"

  return (
    <div className="flex min-w-0 max-w-full items-center justify-center gap-2 px-2.5 py-0 sm:gap-2.5 sm:px-3">
      <h2 className={titleClassName}>Welcome to the {trimmedTitle}</h2>
    </div>
  )
}

/** Event Overview: one row — tab strip box + optional same-style title box. */
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
            analysisMenuSelectedId={props.analysisMenuSelectedId}
            onAnalysisMenuDispatch={props.onAnalysisMenuDispatch}
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
  analysisMenuSelectedId,
  onAnalysisMenuDispatch,
  eventTitle,
  titleEmphasis = "default",
}: EventAnalysisToolbarProps) {
  const title = (
    <EventAnalysisToolbarTitleContent eventTitle={eventTitle} titleEmphasis={titleEmphasis} />
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
          analysisMenuSelectedId={analysisMenuSelectedId}
          onAnalysisMenuDispatch={onAnalysisMenuDispatch}
          tabListTrailing={<EventAnalysisActionsMenu tabStripTrigger />}
        />
      </div>
      {title ? <div className="justify-self-center self-center">{title}</div> : null}
    </div>
  )
}
