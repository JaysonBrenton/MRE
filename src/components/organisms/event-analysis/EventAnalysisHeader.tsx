/**
 * @fileoverview Event analysis header component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-01-31
 *
 * @description Page header component for event analysis page
 *
 * @purpose Displays event name as hero on the left, with track and date
 *          metadata on the right. Card treatment and two-column layout.
 *          Desktop-optimized following MRE guidelines.
 *
 * @relatedFiles
 * - src/components/dashboard/EventAnalysisSection.tsx (uses this)
 */

"use client"

import { formatDateLong } from "@/lib/date-utils"

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
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const iconClass = "h-4 w-4 shrink-0 text-[var(--token-text-muted)]"

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
}: EventAnalysisHeaderProps) {
  const dateDisplay = formatDateRange(eventDate, eventDateEnd)
  const hasMetadata = trackName || eventDate
  const primaryTitle = isPracticeDay ? `Practice – ${dateDisplay} @ ${trackName}` : eventName
  const viewingLabel =
    viewingDriverName !== undefined && viewingDriverName !== null && viewingDriverName !== ""
      ? viewingDriverName
      : isPracticeDay
        ? "All sessions"
        : null

  return (
    <div className="mb-8 flex items-start justify-between gap-4 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-5">
      {/* Left: title */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="min-w-0 break-words text-3xl font-semibold tracking-tight text-[var(--token-text-primary)] sm:text-4xl">
          {primaryTitle}
        </h1>
        {isPracticeDay && viewingLabel && (
          <p className="text-sm text-[var(--token-text-secondary)]">Viewing: {viewingLabel}</p>
        )}
      </div>

      {/* Right: date (event) or just metadata (practice) */}
      {hasMetadata && !isPracticeDay && (
        <div className="flex shrink-0 flex-col items-end gap-1 text-sm text-[var(--token-text-muted)]">
          {eventDate && (
            <span className="flex items-center gap-1.5">
              <CalendarIcon className={iconClass} />
              {dateDisplay}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
