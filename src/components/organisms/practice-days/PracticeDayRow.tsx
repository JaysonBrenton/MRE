/**
 * @fileoverview Practice Day Row component
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description Displays individual practice day in search results using the same
 *              table layout as EventRow (Event Name | Event Status | Event Date | Actions).
 */

"use client"

import EventStatusBadge, { type EventStatus } from "@/components/molecules/EventStatusBadge"
import { formatDateDisplay } from "@/lib/date-utils"

export interface PracticeDayRowProps {
  date: string
  trackName: string
  sessionCount?: number
  totalLaps?: number
  uniqueDrivers?: number
  uniqueClasses?: number
  timeRangeStart?: string
  timeRangeEnd?: string
  isIngested?: boolean
  eventId?: string
  onIngest?: () => void
  onView?: () => void
  /** When true, show loading state on Upload button (disabled + "Importing...") */
  isIngesting?: boolean
  /** When true, disable Upload button (e.g. while another practice day is uploading) */
  importDisabled?: boolean
}

export default function PracticeDayRow({
  date,
  trackName,
  sessionCount = 0,
  totalLaps = 0,
  uniqueDrivers = 0,
  uniqueClasses = 0,
  isIngested = false,
  eventId,
  onIngest,
  onView,
  isIngesting = false,
  importDisabled = false,
}: PracticeDayRowProps) {
  const formattedDate = formatDateDisplay(date)
  const status: EventStatus = isIngesting ? "importing" : isIngested ? "imported" : "new"
  const canView = isIngested && eventId && onView
  const canImport = !isIngested && onIngest
  const uploadButtonDisabled = isIngesting || importDisabled

  // Display name: "Practice – {date}" with optional subtitle (sessions, laps)
  const subtitle =
    [sessionCount, totalLaps].some((n) => typeof n === "number" && n > 0) &&
    `${sessionCount} session${sessionCount !== 1 ? "s" : ""}, ${totalLaps.toLocaleString()} laps`

  return (
    <div className="grid grid-cols-[2.5fr_1fr_1fr_1.5fr] items-center gap-4 px-4 py-4 border-b transition-colors duration-200 border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)]">
      {/* Column 1 - Event Name */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-[var(--token-text-primary)] font-medium">
          Practice – {formattedDate}
          {trackName ? (
            <span className="ml-2 text-sm font-normal text-[var(--token-text-secondary)]">
              {trackName}
            </span>
          ) : null}
        </h3>
        {subtitle && (
          <span className="text-xs text-[var(--token-text-secondary)] block w-full mt-0.5">
            {subtitle}
          </span>
        )}
      </div>

      {/* Column 2 - Event Status */}
      <div className="flex flex-col items-center gap-1">
        <EventStatusBadge
          status={status}
          progress={isIngesting ? 25 : undefined}
          stage={isIngesting ? "Importing..." : undefined}
        />
      </div>

      {/* Column 3 - Event Date */}
      <p className="text-sm text-[var(--token-text-secondary)] text-center">{formattedDate}</p>

      {/* Column 4 - Actions (same styling as EventRow: accent Import, success Analyse) */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex gap-2">
          {canImport && (
            <button
              type="button"
              onClick={onIngest}
              disabled={uploadButtonDisabled}
              title={importDisabled && !isIngesting ? "Finish the current upload first" : undefined}
              className="flex items-center justify-center rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)]/10 px-5 text-sm font-medium text-[var(--token-accent)] transition-colors hover:bg-[var(--token-accent)]/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed h-11"
              aria-label={`Upload practice ${formattedDate}`}
            >
              {isIngesting ? "Importing…" : "Upload"}
            </button>
          )}
          {canView && (
            <button
              type="button"
              onClick={onView}
              className="flex items-center justify-center rounded-md border border-[var(--token-status-success-text)] bg-[var(--token-status-success-text)]/10 px-5 text-sm font-medium text-[var(--token-status-success-text)] transition-colors hover:bg-[var(--token-status-success-text)]/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] h-11"
              aria-label={`Analyse practice ${formattedDate}`}
            >
              Analyse
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
