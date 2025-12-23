/**
 * @fileoverview Event analysis header component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Page header component for event analysis page
 * 
 * @purpose Displays event name, date, track name, and back button.
 *          Mobile-friendly layout following MRE design guidelines.
 * 
 * @relatedFiles
 * - src/app/events/analyse/[eventId]/page.tsx (uses this)
 */

"use client"

import Link from "next/link"
import { formatDateLong } from "@/lib/date-utils"

export interface EventAnalysisHeaderProps {
  eventName: string
  eventDate: Date | string
  trackName: string
}

export default function EventAnalysisHeader({
  eventName,
  eventDate,
  trackName,
}: EventAnalysisHeaderProps) {
  return (
    <div className="space-y-4 mb-8">
      <div>
        <Link
          href="/event-search"
          className="text-sm text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] inline-block mb-4"
        >
          ← Back to Event Search
        </Link>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--token-text-primary)]">
          {eventName}
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-sm text-[var(--token-text-secondary)]">
          <span>{formatDateLong(eventDate)}</span>
          <span className="hidden sm:inline">•</span>
          <span>{trackName}</span>
        </div>
      </div>
    </div>
  )
}

