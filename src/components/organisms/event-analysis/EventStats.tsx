/**
 * @fileoverview Event statistics component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Displays event summary statistics
 *
 * @purpose Shows total races, drivers, laps, and date range for quick overview.
 *          Mobile-friendly card layout.
 *
 * @relatedFiles
 * - src/components/event-analysis/OverviewTab.tsx (uses this)
 */

"use client"

import { formatDateLong } from "@/lib/date-utils"

export interface EventStatsProps {
  totalRaces: number
  totalDrivers: number
  totalLaps: number
  dateRange?: {
    earliest: Date | string | null
    latest: Date | string | null
  }
}

export default function EventStats({
  totalRaces,
  totalDrivers,
  totalLaps,
  dateRange,
}: EventStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
        <div className="text-sm text-[var(--token-text-secondary)] mb-1">Total Races</div>
        <div className="text-2xl font-semibold text-[var(--token-text-primary)]">{totalRaces}</div>
      </div>
      <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
        <div className="text-sm text-[var(--token-text-secondary)] mb-1">Total Drivers</div>
        <div className="text-2xl font-semibold text-[var(--token-text-primary)]">
          {totalDrivers}
        </div>
      </div>
      <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
        <div className="text-sm text-[var(--token-text-secondary)] mb-1">Total Laps</div>
        <div className="text-2xl font-semibold text-[var(--token-text-primary)]">
          {totalLaps.toLocaleString()}
        </div>
      </div>
      {dateRange && (dateRange.earliest || dateRange.latest) && (
        <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
          <div className="text-sm text-[var(--token-text-secondary)] mb-1">Date Range</div>
          <div className="text-sm font-medium text-[var(--token-text-primary)]">
            {dateRange.earliest && formatDateLong(dateRange.earliest)}
            {dateRange.earliest && dateRange.latest && " - "}
            {dateRange.latest && formatDateLong(dateRange.latest)}
          </div>
        </div>
      )}
    </div>
  )
}
