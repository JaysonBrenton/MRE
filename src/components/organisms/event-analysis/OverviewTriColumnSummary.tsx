"use client"

import type { KeyboardEvent, ReactNode } from "react"
import { ExternalLink, Map as MapIcon } from "lucide-react"
import {
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "@/components/organisms/event-analysis/overview-glass-surface"
import { typography } from "@/lib/typography"

/** Tri-column panels: full glass chrome (blur + glass tokens) like dashboard toolbars. */
const TRI_COLUMN_PANEL_LAYOUT_CLASS = "flex min-h-0 min-w-0 flex-col items-center gap-3 p-4"

const triColumnSectionProps = {
  className: `${TRI_COLUMN_PANEL_LAYOUT_CLASS} ${OVERVIEW_GLASS_SURFACE_CLASS}`,
  style: OVERVIEW_GLASS_SURFACE_STYLE,
} as const

/** Third column: stretch weather slot full width so content aligns with chip grid. */
const triColumnConditionsSectionBaseClass = `flex min-h-0 min-w-0 flex-col items-stretch gap-3 p-4 ${OVERVIEW_GLASS_SURFACE_CLASS}`

const triColumnConditionsSectionProps = {
  className: triColumnConditionsSectionBaseClass,
  style: OVERVIEW_GLASS_SURFACE_STYLE,
} as const

const CONDITIONS_INTERACTIVE_CLASS = [
  "cursor-pointer transition-[box-shadow,filter]",
  "hover:brightness-[1.03] hover:shadow-lg",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)]",
].join(" ")

export type OverviewTriColumnSummaryProps = {
  /** Column 1 left pane — track / map / address */
  trackLocationSlot?: ReactNode
  /** Column 1 right pane — contact */
  contactDetailsSlot?: ReactNode
  /** Column 2 heading — event name on the event overview. */
  statisticsHeading?: string
  /** Optional external link for the column 2 heading. */
  statisticsHeadingHref?: string | null
  /** Column 2 body — races, drivers, laps, etc. */
  statisticsSlot?: ReactNode
  /** Column 3 body — weather and related conditions */
  conditionsSlot?: ReactNode
  /**
   * When true and `onConditionsActivate` is set, the Event Conditions glass panel is keyboard-
   * activatable and opens the full-weather dialog (parent owns the modal).
   */
  conditionsInteractive?: boolean
  onConditionsActivate?: () => void
}

function conditionsSectionKeyActivate(e: KeyboardEvent<HTMLElement>, onActivate?: () => void) {
  if (!onActivate) return
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault()
    onActivate()
  }
}

/**
 * Three-column summary layout for Event Overview (minimal): h4-scale column titles (muted) plus slots.
 */
export function OverviewTriColumnSummary({
  trackLocationSlot,
  contactDetailsSlot,
  statisticsHeading = "Event Statistics",
  statisticsHeadingHref,
  statisticsSlot,
  conditionsSlot,
  conditionsInteractive = false,
  onConditionsActivate,
}: OverviewTriColumnSummaryProps) {
  const conditionsActivatable = Boolean(conditionsInteractive && onConditionsActivate)
  const statisticsHref = statisticsHeadingHref?.trim() ?? ""

  return (
    <div
      className="grid min-h-0 w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-3 md:gap-1"
      role="presentation"
    >
      <section
        {...triColumnSectionProps}
        aria-labelledby="event-overview-track-location-heading event-overview-contact-details-heading"
      >
        <div className="flex w-full min-w-0 min-h-0 flex-1 items-stretch gap-3 sm:gap-4">
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-3"
            aria-labelledby="event-overview-track-location-heading"
          >
            <h4
              id="event-overview-track-location-heading"
              className={typography.overviewSectionCardTitle}
            >
              Track Location
            </h4>
            <div className="min-h-0 w-full min-w-0">
              {trackLocationSlot ? (
                <div className="flex w-full min-w-0 items-start gap-1.5">
                  <span className="mt-0.5 inline-flex shrink-0" title="Google Maps">
                    <MapIcon className="h-3.5 w-3.5 text-[var(--token-text-muted)]" aria-hidden />
                  </span>
                  <div className="min-h-0 min-w-0 flex-1">{trackLocationSlot}</div>
                </div>
              ) : null}
            </div>
          </div>
          <span className="w-px shrink-0 self-stretch bg-[var(--token-border-muted)]" aria-hidden />
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-3"
            aria-labelledby="event-overview-contact-details-heading"
          >
            <h4
              id="event-overview-contact-details-heading"
              className={typography.overviewSectionCardTitle}
            >
              Contact Details
            </h4>
            <div className="min-h-0 w-full min-w-0">{contactDetailsSlot}</div>
          </div>
        </div>
      </section>
      <section {...triColumnSectionProps} aria-labelledby="event-overview-col-statistics-heading">
        <h4
          id="event-overview-col-statistics-heading"
          className={typography.overviewSectionCardTitle}
        >
          {statisticsHref ? (
            <a
              href={statisticsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-inherit no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)]"
              aria-label="View event on LiveRC (opens in new tab)"
            >
              {statisticsHeading}
              <ExternalLink className="ml-1 inline h-3.5 w-3.5 align-[-0.125em]" aria-hidden />
            </a>
          ) : (
            statisticsHeading
          )}
        </h4>
        <div className="min-h-0 min-w-0 w-full">{statisticsSlot}</div>
      </section>
      <section
        {...triColumnConditionsSectionProps}
        className={
          conditionsActivatable
            ? `${triColumnConditionsSectionBaseClass} ${CONDITIONS_INTERACTIVE_CLASS}`
            : triColumnConditionsSectionProps.className
        }
        aria-labelledby="event-overview-col-conditions-heading"
        tabIndex={conditionsActivatable ? 0 : undefined}
        title={conditionsActivatable ? "Open full weather forecast" : undefined}
        onClick={conditionsActivatable ? () => onConditionsActivate?.() : undefined}
        onKeyDown={
          conditionsActivatable
            ? (e) => conditionsSectionKeyActivate(e, onConditionsActivate)
            : undefined
        }
      >
        <h4
          id="event-overview-col-conditions-heading"
          className={typography.overviewSectionCardTitle}
        >
          Event Conditions
        </h4>
        <div className="min-h-0 min-w-0 w-full">{conditionsSlot}</div>
      </section>
    </div>
  )
}
