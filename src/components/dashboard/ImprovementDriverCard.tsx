/**
 * @fileoverview Improvement driver card component for dashboard carousel
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Displays driver improvement metrics in dashboard carousel
 *
 * @purpose Shows position and lap time improvements for most improved drivers.
 *          Matches styling of existing driver cards with green highlight for improvement.
 *
 * @relatedFiles
 * - src/components/dashboard/DashboardClient.tsx (uses this)
 * - src/lib/date-utils.ts (formatting utilities)
 */

"use client"

import { formatPositionImprovement, formatLapTimeImprovement } from "@/lib/date-utils"
import type { EventAnalysisSummary } from "@root-types/dashboard"

type MostImprovedDriver = NonNullable<EventAnalysisSummary["mostImprovedDrivers"]>[number]

export interface ImprovementDriverCardProps {
  driver: MostImprovedDriver
  index: number
}

export default function ImprovementDriverCard({ driver, index }: ImprovementDriverCardProps) {
  const positionDisplay = formatPositionImprovement(
    driver.firstRacePosition,
    driver.lastRacePosition
  )

  const lapTimeDisplay = formatLapTimeImprovement(driver.lapTimeImprovement)

  return (
    <div className="rounded-2xl border border-[var(--token-status-success-border)] bg-[var(--token-surface-elevated)] px-4 py-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[var(--token-status-success-text)]">
          #{index + 1}
        </span>
        <span className="text-[10px] text-[var(--token-status-success-text)]">↑ Improved</span>
      </div>
      <p className="text-base font-semibold text-[var(--token-text-primary)] mb-1">
        {driver.driverName}
      </p>
      <div className="mb-2">
        <p className="text-sm font-medium text-[var(--token-text-primary)] mb-1">
          Position: {positionDisplay}
        </p>
        {driver.lapTimeImprovement !== null && (
          <p className="text-sm font-medium text-[var(--token-text-primary)]">
            Lap Time: {lapTimeDisplay}
          </p>
        )}
      </div>
      <p className="text-[10px] text-[var(--token-text-muted)]">{driver.raceLabel}</p>
      <p className="text-[10px] text-[var(--token-text-muted)]">{driver.className}</p>
    </div>
  )
}
