/**
 * @fileoverview Event statistics component for testing tab
 *
 * @created 2025-01-24
 * @creator Auto-generated
 * @lastModified 2025-01-24
 *
 * @description Displays event summary statistics with progressive disclosure
 *
 * @purpose Shows primary metrics (2-3) by default with "See all" expandable option.
 *          Includes section heading "Event at a glance".
 *
 * @relatedFiles
 * - src/components/event-analysis/EventStats.tsx (original)
 * - src/components/event-analysis/overview-testing/OverviewTabTesting.tsx (uses this)
 */

"use client"

import { useState } from "react"
import { formatDateLong } from "@/lib/date-utils"

export interface EventStatsTestingProps {
  totalRaces: number
  totalDrivers: number
  totalLaps: number
  dateRange?: {
    earliest: Date | string | null
    latest: Date | string | null
  }
}

export default function EventStatsTesting({
  totalRaces,
  totalDrivers,
  totalLaps,
  dateRange,
}: EventStatsTestingProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const primaryStats = [
    { label: "Total Races", value: totalRaces },
    { label: "Total Drivers", value: totalDrivers },
    { label: "Total Laps", value: totalLaps.toLocaleString() },
  ]

  const secondaryStats =
    dateRange && (dateRange.earliest || dateRange.latest)
      ? [
          {
            label: "Date Range",
            value: (
              <>
                {dateRange.earliest && formatDateLong(dateRange.earliest)}
                {dateRange.earliest && dateRange.latest && " - "}
                {dateRange.latest && formatDateLong(dateRange.latest)}
              </>
            ),
          },
        ]
      : []

  const statsToShow = isExpanded ? [...primaryStats, ...secondaryStats] : primaryStats

  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold text-[var(--token-text-primary)] mb-4">
        Event at a glance
      </h2>
      <div className={`grid gap-4 ${statsToShow.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {statsToShow.map((stat, index) => (
          <div
            key={index}
            className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4"
          >
            <div className="text-sm text-[var(--token-text-secondary)] mb-1">{stat.label}</div>
            <div className="text-2xl font-semibold text-[var(--token-text-primary)]">
              {typeof stat.value === "string" || typeof stat.value === "number"
                ? stat.value
                : stat.value}
            </div>
          </div>
        ))}
        {secondaryStats.length > 0 && !isExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4 hover:bg-[var(--token-surface-raised)] transition-colors text-left"
          >
            <div className="text-sm text-[var(--token-text-secondary)] mb-1">See all</div>
            <div className="text-sm font-medium text-[var(--token-accent)]">
              +{secondaryStats.length} more
            </div>
          </button>
        )}
        {isExpanded && secondaryStats.length > 0 && (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="bg-[var(--token-surface-elevated)] rounded-md border border-[var(--token-border-default)] p-4 hover:bg-[var(--token-surface-raised)] transition-colors text-left"
          >
            <div className="text-sm text-[var(--token-text-secondary)] mb-1">Show less</div>
            <div className="text-sm font-medium text-[var(--token-text-primary)]">Hide details</div>
          </button>
        )}
      </div>
    </section>
  )
}
