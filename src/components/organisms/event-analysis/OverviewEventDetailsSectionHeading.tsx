"use client"

import { typography } from "@/lib/typography"

/** Shared copy for the Event details subtitle (under “Event details”). */
export const EVENT_DETAILS_SECTION_SUBTITLE_DEFAULT =
  "Venue, conditions and event structure." as const

export type OverviewEventDetailsSectionHeadingProps = {
  title?: string
  subtitle?: string
  headingId?: string
  subtitleId?: string
}

/**
 * Title + subtitle stack above the Event details Host / Track / Weather / Mix panels.
 * Omit entirely on Event Overview (minimal).
 */
export function OverviewEventDetailsSectionHeading({
  title = "Event details",
  subtitle = EVENT_DETAILS_SECTION_SUBTITLE_DEFAULT,
  headingId = "event-overview-event-details-heading",
  subtitleId = "event-overview-event-details-subtitle",
}: OverviewEventDetailsSectionHeadingProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <h3
        id={headingId}
        className={`min-w-0 ${typography.h3} tracking-tight text-[var(--token-text-primary)]`}
      >
        {title}
      </h3>
      <p
        id={subtitleId}
        className={`self-start w-fit max-w-full text-pretty ${typography.bodyMuted}`}
      >
        {subtitle}
      </p>
    </div>
  )
}
