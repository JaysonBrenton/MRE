/**
 * @fileoverview Practice Day Row component
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description Displays individual practice day in search results using the same
 *              table layout as EventRow (Event Name | Track Name | Event Status | Event Date | Actions).
 */

"use client"

import EventStatusBadge, { type EventStatus } from "@/components/molecules/EventStatusBadge"
import {
  EVENT_SEARCH_TABLE_BODY_CELL_CLASS,
  EVENT_SEARCH_TABLE_BODY_ROW_CLASS,
  EVENT_SEARCH_TABLE_EVENT_NAME_TEXT_CLASS,
  EVENT_SEARCH_TABLE_NAME_CELL_CLASS,
  EVENT_SEARCH_TABLE_NAME_SCROLL_CLASS,
  EVENT_SEARCH_TABLE_NAME_TEXT_CLASS,
} from "@/components/organisms/event-search/event-search-table-layout"
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
  uniqueDrivers: _uniqueDrivers = 0,
  uniqueClasses: _uniqueClasses = 0,
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
    <tr className={EVENT_SEARCH_TABLE_BODY_ROW_CLASS}>
      {/* Column 1 - Event Name */}
      <td className={`${EVENT_SEARCH_TABLE_BODY_CELL_CLASS} ${EVENT_SEARCH_TABLE_NAME_CELL_CLASS}`}>
        <div className="flex min-w-0 flex-col gap-1">
          <div className={EVENT_SEARCH_TABLE_NAME_SCROLL_CLASS}>
            {canView ? (
              <button
                type="button"
                onClick={onView}
                className={`${EVENT_SEARCH_TABLE_EVENT_NAME_TEXT_CLASS} text-left font-medium underline decoration-[var(--token-accent)]/50 underline-offset-2 transition-colors hover:text-[var(--token-accent)] hover:decoration-[var(--token-accent)]`}
                aria-label={
                  trackName
                    ? `Analyse practice ${formattedDate} at ${trackName}`
                    : `Analyse practice ${formattedDate}`
                }
              >
                Practice – {formattedDate}
              </button>
            ) : (
              <h3 className={`${EVENT_SEARCH_TABLE_EVENT_NAME_TEXT_CLASS} font-medium`}>
                Practice – {formattedDate}
              </h3>
            )}
          </div>
          {subtitle ? (
            <span className="text-xs text-[var(--token-text-secondary)]">{subtitle}</span>
          ) : null}
        </div>
      </td>

      {/* Column 2 - Track Name */}
      <td className={`${EVENT_SEARCH_TABLE_BODY_CELL_CLASS} ${EVENT_SEARCH_TABLE_NAME_CELL_CLASS}`}>
        <div className={EVENT_SEARCH_TABLE_NAME_SCROLL_CLASS}>
          <p className={EVENT_SEARCH_TABLE_NAME_TEXT_CLASS} title={trackName || undefined}>
            {trackName || "—"}
          </p>
        </div>
      </td>

      {/* Column 3 - Event Status */}
      <td className={`${EVENT_SEARCH_TABLE_BODY_CELL_CLASS} text-center`}>
        <div className="inline-flex flex-col items-center gap-1">
          <EventStatusBadge
            status={status}
            progress={isIngesting ? 25 : undefined}
            stage={isIngesting ? "Importing..." : undefined}
          />
        </div>
      </td>

      {/* Column 4 - Event Date */}
      <td className={`${EVENT_SEARCH_TABLE_BODY_CELL_CLASS} text-center`}>
        <p className={`${EVENT_SEARCH_TABLE_NAME_TEXT_CLASS} text-center`}>{formattedDate}</p>
      </td>

      {/* Column 5 - Actions */}
      <td className={EVENT_SEARCH_TABLE_BODY_CELL_CLASS}>
        <div className="flex justify-start">
          <div className="flex gap-2">
            {canImport && (
              <button
                type="button"
                onClick={onIngest}
                disabled={uploadButtonDisabled}
                title={
                  importDisabled && !isIngesting ? "Finish the current upload first" : undefined
                }
                className="flex items-center justify-center rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)]/10 px-5 text-sm font-medium text-[var(--token-accent)] transition-colors hover:bg-[var(--token-accent)]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed h-11"
                aria-label={`Upload practice ${formattedDate}`}
              >
                {isIngesting ? "Importing…" : "Upload"}
              </button>
            )}
            {canView && (
              <button
                type="button"
                onClick={onView}
                className="flex items-center justify-center rounded-md border border-[var(--token-status-success-text)] bg-[var(--token-status-success-text)]/10 px-5 text-sm font-medium text-[var(--token-status-success-text)] transition-colors hover:bg-[var(--token-status-success-text)]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] h-11"
                aria-label={`Analyse practice ${formattedDate}`}
              >
                Analyse
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}
