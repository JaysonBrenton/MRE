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

export interface EventStatsProps {
  totalRaces: number
  totalDrivers: number
  totalLaps: number
  dateRange?: {
    earliest: Date | string | null
    latest: Date | string | null
  }
}

function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date
  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function EventStats({
  totalRaces,
  totalDrivers,
  totalLaps,
  dateRange,
}: EventStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
        <div className="text-sm text-[var(--token-text-secondary)] mb-1">
          Total Races
        </div>
        <div className="text-2xl font-semibold text-[var(--token-text-primary)]">
          {totalRaces}
        </div>
      </div>
      <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
        <div className="text-sm text-[var(--token-text-secondary)] mb-1">
          Total Drivers
        </div>
        <div className="text-2xl font-semibold text-[var(--token-text-primary)]">
          {totalDrivers}
        </div>
      </div>
      <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
        <div className="text-sm text-[var(--token-text-secondary)] mb-1">
          Total Laps
        </div>
        <div className="text-2xl font-semibold text-[var(--token-text-primary)]">
          {totalLaps.toLocaleString()}
        </div>
      </div>
      {dateRange && (dateRange.earliest || dateRange.latest) && (
        <div className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4">
          <div className="text-sm text-[var(--token-text-secondary)] mb-1">
            Date Range
          </div>
          <div className="text-sm font-medium text-[var(--token-text-primary)]">
            {dateRange.earliest && formatDate(dateRange.earliest)}
            {dateRange.earliest && dateRange.latest && " - "}
            {dateRange.latest && formatDate(dateRange.latest)}
          </div>
        </div>
      )}
    </div>
  )
}

