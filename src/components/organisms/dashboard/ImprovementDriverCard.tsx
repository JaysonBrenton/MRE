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
 *          Matches styling of existing driver cards with neutral theme for consistency.
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
    <div className="rounded-2xl border border-[var(--token-border-default)] bg-gradient-to-br from-[var(--token-surface-elevated)] to-[var(--token-surface-raised)] px-5 py-5 h-full w-full transition-all duration-200 hover:border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.2),0_0_1px_rgba(255,255,255,0.1)] shadow-[0_2px_8px_rgba(0,0,0,0.1),0_0_1px_rgba(255,255,255,0.05)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-[var(--token-text-primary)] bg-[var(--token-surface)] px-2.5 py-1 rounded-full border border-[var(--token-border-default)] shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
          #{index + 1}
        </span>
        <span className="text-[10px] font-medium text-[var(--token-text-muted)] bg-[var(--token-surface)] px-2 py-0.5 rounded-full">
          Improved
        </span>
      </div>
      <p className="text-base font-bold text-[var(--token-text-primary)] mb-2 truncate">
        {driver.driverName}
      </p>
      <p className="text-2xl font-bold text-[var(--token-text-primary)] mb-3 leading-tight">
        {positionDisplay}
      </p>
      <div className="space-y-1">
        {driver.lapTimeImprovement !== null && (
          <p className="text-[10px] text-[var(--token-text-muted)] font-medium truncate">
            Lap Time: {lapTimeDisplay}
          </p>
        )}
        <p className="text-[10px] text-[var(--token-text-muted)] font-medium truncate">
          {driver.raceLabel}
        </p>
        <p className="text-[10px] text-[var(--token-text-muted)] truncate">{driver.className}</p>
      </div>
    </div>
  )
}
