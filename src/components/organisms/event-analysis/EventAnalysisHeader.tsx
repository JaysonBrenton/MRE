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
 *          metadata on the right. Uses left accent bar, card treatment,
 *          and two-column layout. Desktop-optimized following MRE guidelines.
 *
 * @relatedFiles
 * - src/components/dashboard/EventAnalysisSection.tsx (uses this)
 */

"use client"

import { formatDateLong } from "@/lib/date-utils"

export interface EventAnalysisHeaderProps {
  eventName: string
  eventDate: Date | string
  trackName: string
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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

export default function EventAnalysisHeader({
  eventName,
  eventDate,
  trackName,
}: EventAnalysisHeaderProps) {
  const hasMetadata = trackName || eventDate

  return (
    <div className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-5">
      {/* Left: accent bar + event name */}
      <div className="flex min-w-0 items-center">
        <div
          className="mr-4 w-1 shrink-0 self-stretch rounded-full bg-[var(--token-accent)]"
          aria-hidden
        />
        <h1 className="truncate text-3xl font-semibold tracking-tight text-[var(--token-text-primary)] sm:text-4xl">
          {eventName}
        </h1>
      </div>

      {/* Right: track and date */}
      {hasMetadata && (
        <div className="flex shrink-0 flex-col items-end gap-1 text-sm text-[var(--token-text-muted)]">
          {trackName && (
            <span className="flex items-center gap-1.5">
              <MapPinIcon className={iconClass} />
              {trackName}
            </span>
          )}
          {eventDate && (
            <span className="flex items-center gap-1.5">
              <CalendarIcon className={iconClass} />
              {formatDateLong(eventDate)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
