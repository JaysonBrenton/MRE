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
    <div className="rounded-2xl border border-[var(--token-status-success-text)]/40 bg-[var(--token-surface-elevated)] px-5 py-5 h-full w-full transition-all duration-200 hover:border-[var(--token-status-success-text)]/60 hover:bg-[var(--token-surface-raised)] hover:shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-[var(--token-status-success-text)] bg-[var(--token-surface)] px-2.5 py-1 rounded-full border border-[var(--token-status-success-text)]/40">
          #{index + 1}
        </span>
        <span className="text-[10px] font-medium text-[var(--token-status-success-text)] bg-[var(--token-status-success-bg)] px-2 py-0.5 rounded-full">
          ↑ Improved
        </span>
      </div>
      <p className="text-base font-bold text-[var(--token-text-primary)] mb-2 truncate">
        {driver.driverName}
      </p>
      <div className="mb-3">
        <p className="text-sm font-semibold text-[var(--token-text-primary)] mb-1.5 leading-tight">
          Position: <span className="text-[var(--token-status-success-text)]">{positionDisplay}</span>
        </p>
        {driver.lapTimeImprovement !== null && (
          <p className="text-sm font-semibold text-[var(--token-text-primary)] leading-tight">
            Lap Time: <span className="text-[var(--token-status-success-text)]">{lapTimeDisplay}</span>
          </p>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-[10px] text-[var(--token-text-muted)] font-medium truncate">{driver.raceLabel}</p>
        <p className="text-[10px] text-[var(--token-text-muted)] truncate">{driver.className}</p>
      </div>
    </div>
  )
}
