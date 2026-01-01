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
 *          Desktop-optimized layout following MRE design guidelines.
 * 
 * @relatedFiles
 * - src/app/events/analyse/[eventId]/page.tsx (uses this)
 */

"use client"

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
    <div className="space-y-2 mb-8">
      <h1 className="text-3xl font-semibold text-[var(--token-text-primary)]">
        {eventName}
      </h1>
      <div className="flex items-center gap-4 text-sm text-[var(--token-text-secondary)]">
        <span>{formatDateLong(eventDate)}</span>
        <span>•</span>
        <span>{trackName}</span>
      </div>
    </div>
  )
}
