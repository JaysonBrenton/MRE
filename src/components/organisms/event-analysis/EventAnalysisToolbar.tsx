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

import { useRef } from "react"
import TabNavigation, {
  type Tab,
  type TabId,
} from "@/components/organisms/event-analysis/TabNavigation"
import EventAnalysisActionsMenu from "@/components/organisms/event-analysis/EventAnalysisActionsMenu"
import type { AnalysisPrimarySubTabId } from "@/components/organisms/event-analysis/event-analysis-sub-tabs"
import { useFitText } from "@/hooks/useFitText"

export interface EventAnalysisToolbarProps {
  tabs: Tab[]
  activeTab: TabId
  onTabChange: (tabId: TabId) => void
  analysisMenuSelectedId?: string
  onAnalysisMenuDispatch?: (id: AnalysisPrimarySubTabId) => void
  /** Event name for the trailing welcome column. */
  eventName?: string | null
  /** Track name for the trailing welcome column (user host venue when set, else event track). */
  trackName?: string | null
  /** Stronger title treatment when Event Overview is active (page-scoped hierarchy). */
  titleEmphasis?: "default" | "page"
}

const tabStripTrailingDividerClass = "w-px shrink-0 self-stretch bg-[var(--token-border-muted)]"

/** Opaque surface for sticky strip chrome (no see-through gaps or glass boxes). */
const EVENT_ANALYSIS_STRIP_SURFACE_CLASS = "bg-[var(--token-surface-page)]"

/** Inner shell for overview clear strips (tabs row or title row) inside the sticky strip. */
const EVENT_OVERVIEW_STRIP_BOX_INNER_CLASS = `min-w-0 overflow-hidden rounded-2xl border border-[var(--glass-border)] shadow-none ${EVENT_ANALYSIS_STRIP_SURFACE_CLASS}`

/**
 * Pins the strip under the dashboard top bar inside `[data-scroll-container]` and fully masks
 * scrolling content (`before:` covers scroll-region top padding; parent must be tall tabpanel).
 */
const EVENT_ANALYSIS_STRIP_STICKY_SHELL_CLASS = [
  "sticky top-0 z-20 isolate -mt-2 mb-3 border-b border-[var(--token-border-muted)] pt-2 pb-3",
  EVENT_ANALYSIS_STRIP_SURFACE_CLASS,
  "backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl",
  "before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-2 before:bg-[var(--token-surface-page)]",
  "after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-px after:bg-[var(--token-surface-page)]",
].join(" ")

const EVENT_ANALYSIS_STRIP_STICKY_ROW_CLASS = `relative z-0 w-full ${EVENT_ANALYSIS_STRIP_SURFACE_CLASS}`

/** Full accessibility / tooltip string (compact copy). */
function formatToolbarWelcomeTitle(eventName: string, trackName: string): string {
  if (trackName.length > 0) {
    return `Welcome to the ${eventName} · ${trackName}`
  }
  return `Welcome to the ${eventName}`
}

const TITLE_FIT_BOUNDS = {
  page: { minPx: 12, maxPx: 20 },
  default: { minPx: 10, maxPx: 16 },
} as const

function EventAnalysisToolbarTitleContent({
  eventName,
  trackName,
  titleEmphasis = "default",
}: Pick<EventAnalysisToolbarProps, "eventName" | "trackName" | "titleEmphasis">) {
  const containerRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  const trimmedEventName = eventName?.trim() ?? ""
  const trimmedTrackName = trackName?.trim() ?? ""
  const welcomeTitleFull = formatToolbarWelcomeTitle(trimmedEventName, trimmedTrackName)
  const hasTitle = trimmedEventName.length > 0
  const fitBounds = TITLE_FIT_BOUNDS[titleEmphasis]

  useFitText(titleRef, containerRef, {
    ...fitBounds,
    enabled: hasTitle,
    deps: [welcomeTitleFull, titleEmphasis],
  })

  if (!hasTitle) return null

  const titleClassName =
    titleEmphasis === "page"
      ? "block w-full min-w-0 max-w-full whitespace-nowrap text-center font-semibold leading-snug tracking-tight"
      : "block w-full min-w-0 max-w-full whitespace-nowrap text-center font-semibold leading-snug"

  return (
    <div
      ref={containerRef}
      className="flex min-w-0 w-full max-w-full items-center justify-center gap-2 px-2.5 py-1 sm:gap-2.5 sm:px-3"
    >
      <h2
        ref={titleRef}
        className={titleClassName}
        style={{ fontSize: `${fitBounds.maxPx}px` }}
        aria-label={welcomeTitleFull}
      >
        <span className="text-[var(--token-text-muted)]">Welcome to the </span>
        <span className="text-[var(--token-text-muted)]">{trimmedEventName}</span>
        {trimmedTrackName.length > 0 ? (
          <>
            <span className="text-[var(--token-text-muted)]"> · </span>
            <span className="text-[var(--token-text-muted)]">{trimmedTrackName}</span>
          </>
        ) : null}
      </h2>
    </div>
  )
}

/** Event Overview: one row — tab strip box + optional same-style title box. */
export function EventAnalysisToolbarAboveEventDetailsStrip(props: EventAnalysisToolbarProps) {
  const hasTitle = (props.eventName?.trim() ?? "").length > 0

  return (
    <div className={EVENT_ANALYSIS_STRIP_STICKY_SHELL_CLASS}>
      <div
        className={`scrollbar-none flex min-w-0 w-full flex-nowrap items-stretch gap-3 overflow-x-auto overscroll-x-contain ${EVENT_ANALYSIS_STRIP_STICKY_ROW_CLASS}`}
      >
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
          <div className="min-w-0 min-h-0 flex-1 basis-[clamp(14rem,36vw,28rem)] max-w-full self-stretch">
            <div
              className={`flex h-full min-h-full w-full items-center justify-center ${EVENT_OVERVIEW_STRIP_BOX_INNER_CLASS}`}
            >
              <EventAnalysisToolbarTitleContent
                eventName={props.eventName}
                trackName={props.trackName}
                titleEmphasis={props.titleEmphasis}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function EventAnalysisToolbar({
  tabs,
  activeTab,
  onTabChange,
  analysisMenuSelectedId,
  onAnalysisMenuDispatch,
  eventName,
  trackName,
  titleEmphasis = "default",
}: EventAnalysisToolbarProps) {
  const title = (
    <EventAnalysisToolbarTitleContent
      eventName={eventName}
      trackName={trackName}
      titleEmphasis={titleEmphasis}
    />
  )

  return (
    <div
      className={`items-stretch gap-0 rounded-xl bg-[color-mix(in_oklab,var(--token-surface-elevated)_94%,transparent)] px-0 py-1.5 shadow-md backdrop-blur-sm supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--token-surface-elevated)_88%,transparent)] sm:py-2 ${
        title ? "grid w-full grid-cols-[minmax(0,auto)_minmax(0,1fr)]" : "flex w-full"
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
      {title ? (
        <div className="min-w-0 w-full max-w-full overflow-hidden justify-self-stretch self-center">
          {title}
        </div>
      ) : null}
    </div>
  )
}
