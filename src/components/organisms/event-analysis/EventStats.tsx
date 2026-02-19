/**
 * @fileoverview Event statistics component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Displays event summary statistics
 *
 * @purpose Shows total races, drivers, laps, and date range in a compact single card.
 *
 * @relatedFiles
 * - src/components/event-analysis/OverviewTab.tsx (uses this)
 */

"use client"

import { formatDateLong } from "@/lib/date-utils"

export interface EventStatsProps {
  trackName?: string | null
  totalRaces: number
  totalDrivers: number
  totalLaps: number
  classCount: number
  entries: number
  dateRange?: {
    earliest: Date | string | null
    latest: Date | string | null
  }
}

export default function EventStats({
  trackName,
  totalRaces,
  totalDrivers,
  totalLaps,
  classCount,
  entries,
  dateRange,
}: EventStatsProps) {
  const dateRangeStr = (() => {
    if (!dateRange || (!dateRange.earliest && !dateRange.latest)) return null
    const earliestStr = dateRange.earliest ? formatDateLong(dateRange.earliest) : ""
    const latestStr = dateRange.latest ? formatDateLong(dateRange.latest) : ""
    if (earliestStr && latestStr && earliestStr === latestStr) return earliestStr
    return `${earliestStr}${earliestStr && latestStr ? " - " : ""}${latestStr}`
  })()

  return (
    <div className="mb-6 w-fit rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2">
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm text-[var(--token-text-primary)]">
        {trackName != null && trackName !== "" && (
          <>
            <span className="text-[var(--token-text-secondary)]">Track:</span>
            <span>{trackName}</span>
          </>
        )}
        {dateRangeStr && (
          <>
            <span className="text-[var(--token-text-secondary)]">Date Range:</span>
            <span>{dateRangeStr}</span>
          </>
        )}
        <span className="text-[var(--token-text-secondary)]">Total Classes:</span>
        <span>{classCount}</span>
        <span className="text-[var(--token-text-secondary)]">Total Races:</span>
        <span>{totalRaces}</span>
        <span className="text-[var(--token-text-secondary)]">Total Entries:</span>
        <span>{entries}</span>
        <span className="text-[var(--token-text-secondary)]">Total Drivers:</span>
        <span>{totalDrivers}</span>
        <span className="text-[var(--token-text-secondary)]">Total Laps:</span>
        <span>{totalLaps.toLocaleString()}</span>
      </div>
    </div>
  )
}
