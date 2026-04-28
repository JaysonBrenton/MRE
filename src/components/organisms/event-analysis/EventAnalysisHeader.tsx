/**
 * @fileoverview Event analysis header component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2026-04-24
 *
 * @description Optional context line above the event analysis toolbar (e.g. practice “Viewing”).
 *
 * @purpose Event title lives in page content (e.g. Event overview); this slot is for supplementary header context only.
 *
 * @relatedFiles
 * - src/components/eventAnalysis/EventAnalysisSection.tsx (uses this)
 */

"use client"

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

export default function EventAnalysisHeader({
  isPracticeDay = false,
  viewingDriverName = null,
}: EventAnalysisHeaderProps) {
  const viewingLabel =
    viewingDriverName !== undefined && viewingDriverName !== null && viewingDriverName !== ""
      ? viewingDriverName
      : isPracticeDay
        ? "All sessions"
        : null

  if (!isPracticeDay || !viewingLabel) {
    return null
  }

  return <p className={typography.bodySecondary}>Viewing: {viewingLabel}</p>
}
