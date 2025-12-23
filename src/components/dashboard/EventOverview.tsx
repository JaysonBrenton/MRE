/**
 * @fileoverview Event overview component for dashboard
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Simplified event overview displayed on dashboard when an event is selected
 * 
 * @purpose Shows key event information (name, date, track, metrics) with a link to full analysis.
 *          Mobile-friendly layout following MRE design guidelines.
 * 
 * @relatedFiles
 * - src/app/dashboard/page.tsx (uses this)
 * - src/components/icons/ChartIcon.tsx (chart icon)
 * - src/core/events/get-event-analysis-data.ts (data structure)
 * - docs/design/mre-mobile-ux-guidelines.md (UX guidelines)
 */

"use client"

import Link from "next/link"
import ChartIcon from "@/components/icons/ChartIcon"
import { formatDateLong } from "@/lib/date-utils"

export interface EventOverviewProps {
  eventId: string
  eventName: string
  eventDate: Date | string
  trackName: string
  totalRaces: number
  totalDrivers: number
  totalLaps: number
}

export default function EventOverview({
  eventId,
  eventName,
  eventDate,
  trackName,
  totalRaces,
  totalDrivers,
  totalLaps,
}: EventOverviewProps) {
  return (
    <div className="space-y-6">
      {/* Event Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-[var(--token-text-primary)] truncate">
              {eventName}
            </h3>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 text-sm text-[var(--token-text-secondary)] mt-1">
              <span>{formatDateLong(eventDate)}</span>
              <span className="hidden sm:inline">•</span>
              <span className="truncate">{trackName}</span>
            </div>
          </div>
          {/* Chart Icon Link */}
          <Link
            href={`/events/analyse/${eventId}`}
            className="flex-shrink-0 p-2 rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            aria-label="View full event analysis"
          >
            <ChartIcon size={20} />
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
          <div className="text-xs text-[var(--token-text-secondary)] mb-1">
            Total Races
          </div>
          <div className="text-xl font-semibold text-[var(--token-text-primary)]">
            {totalRaces}
          </div>
        </div>
        <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
          <div className="text-xs text-[var(--token-text-secondary)] mb-1">
            Total Drivers
          </div>
          <div className="text-xl font-semibold text-[var(--token-text-primary)]">
            {totalDrivers}
          </div>
        </div>
        <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
          <div className="text-xs text-[var(--token-text-secondary)] mb-1">
            Total Laps
          </div>
          <div className="text-xl font-semibold text-[var(--token-text-primary)]">
            {totalLaps.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  )
}

