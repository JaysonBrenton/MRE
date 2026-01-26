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
 * - src/components/dashboard/EventAnalysisSection.tsx (uses this)
 */

"use client"

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
    </div>
  )
}
