/**
 * @fileoverview Event analysis header component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-31
 *
 * @description Page header component for event analysis page
 *
 * @purpose Displays event name with accent underline. Minimal, compact header.
 *
 * @relatedFiles
 * - src/components/dashboard/EventAnalysisSection.tsx (uses this)
 */

"use client"

import { formatDateLong } from "@/lib/date-utils"
import { typography } from "@/lib/typography"

export interface EventAnalysisHeaderProps {
  eventName: string
  eventDate: Date | string
  /** End date for multi-day events; when set, displays date range (e.g. "Mar 5, 2026 to Mar 8, 2026") */
  eventDateEnd?: Date | string | null
  trackName: string
  /** When true, show practice day format: "Practice – {date} @ {trackName}" */
  isPracticeDay?: boolean
  /** When set, show "Viewing: [Driver Name]" (practice day). */
  viewingDriverName?: string | null
  /** My Events rail tab: heading is "Current Event: {event}". Main analysis uses event name only. */
  isMyEventsSection?: boolean
}

function formatDateRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): string {
  if (!start) return "Date not available"
  if (!end) return formatDateLong(start)
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return formatDateLong(start)
  return `${formatDateLong(start)} to ${formatDateLong(end)}`
}

export default function EventAnalysisHeader({
  eventName,
  eventDate,
  eventDateEnd,
  trackName,
  isPracticeDay = false,
  viewingDriverName = null,
  isMyEventsSection = false,
}: EventAnalysisHeaderProps) {
  const dateDisplay = formatDateRange(eventDate, eventDateEnd)
  const primaryTitle = isPracticeDay ? `Practice – ${dateDisplay} @ ${trackName}` : eventName
  const viewingLabel =
    viewingDriverName !== undefined && viewingDriverName !== null && viewingDriverName !== ""
      ? viewingDriverName
      : isPracticeDay
        ? "All sessions"
        : null

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <h1
        className={`w-fit min-w-0 break-words border-b-2 border-[var(--token-accent)] pb-1.5 leading-tight tracking-tight sm:text-3xl ${typography.h2}`}
      >
        {isMyEventsSection ? `Current Event: ${primaryTitle}` : primaryTitle}
      </h1>
      {isPracticeDay && viewingLabel && (
        <p className={typography.bodySecondary}>Viewing: {viewingLabel}</p>
      )}
    </div>
  )
}
