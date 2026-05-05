"use client"

import type { ReactNode } from "react"
import { Map as MapIcon } from "lucide-react"
import {
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "@/components/organisms/event-analysis/overview-glass-surface"

/** Tri-column panels: full glass chrome (blur + glass tokens) like dashboard toolbars. */
const TRI_COLUMN_PANEL_LAYOUT_CLASS = "flex min-h-0 min-w-0 flex-col items-center gap-3 p-4"

const triColumnSectionProps = {
  className: `${TRI_COLUMN_PANEL_LAYOUT_CLASS} ${OVERVIEW_GLASS_SURFACE_CLASS}`,
  style: OVERVIEW_GLASS_SURFACE_STYLE,
} as const

export type OverviewTriColumnSummaryProps = {
  /** Column 1 left pane — track / map / address */
  trackLocationSlot?: ReactNode
  /** Column 1 right pane — contact */
  contactDetailsSlot?: ReactNode
  /** Column 2 body — races, drivers, laps, etc. */
  statisticsSlot?: ReactNode
  /** Column 3 body — weather and related conditions */
  conditionsSlot?: ReactNode
}

/** Shared title style: h4 scale with overview eyebrow color. */
const TRI_COLUMN_HEADING_CLASS = `min-w-0 w-full text-center text-lg font-semibold tracking-tight text-[var(--token-text-muted)]`

/**
 * Three-column summary layout for Event Overview (minimal): h4-scale column titles (muted) plus slots.
 */
export function OverviewTriColumnSummary({
  trackLocationSlot,
  contactDetailsSlot,
  statisticsSlot,
  conditionsSlot,
}: OverviewTriColumnSummaryProps) {
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
            <h4 id="event-overview-track-location-heading" className={TRI_COLUMN_HEADING_CLASS}>
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
            <h4 id="event-overview-contact-details-heading" className={TRI_COLUMN_HEADING_CLASS}>
              Contact Details
            </h4>
            <div className="min-h-0 w-full min-w-0">{contactDetailsSlot}</div>
          </div>
        </div>
      </section>
      <section {...triColumnSectionProps} aria-labelledby="event-overview-col-statistics-heading">
        <h4 id="event-overview-col-statistics-heading" className={TRI_COLUMN_HEADING_CLASS}>
          Event Statistics
        </h4>
        <div className="min-h-0 min-w-0">{statisticsSlot}</div>
      </section>
      <section {...triColumnSectionProps} aria-labelledby="event-overview-col-conditions-heading">
        <h4 id="event-overview-col-conditions-heading" className={TRI_COLUMN_HEADING_CLASS}>
          Event Conditions
        </h4>
        <div className="min-h-0 min-w-0">{conditionsSlot}</div>
      </section>
    </div>
  )
}
