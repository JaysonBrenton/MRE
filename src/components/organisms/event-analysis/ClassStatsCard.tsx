/**
 * @fileoverview Compact class summary card for Event Analysis Overview
 *
 * @description Displays per-class statistics (races, entries, drivers)
 * in the same compact label-value card style as EventStats and WeatherCard.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/EventStats.tsx (styling reference)
 * - src/components/organisms/event-analysis/WeatherCard.tsx (styling reference)
 * - src/components/organisms/event-analysis/OverviewTab.tsx (uses this)
 * - docs/design/compact-label-value-card.md
 */

"use client"

import { useMemo } from "react"
import Tooltip from "@/components/molecules/Tooltip"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

const CARD_CLASS =
  "mb-6 w-fit max-h-64 overflow-y-auto rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2"
const GRID_CLASS =
  "grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm text-[var(--token-text-primary)]"
const LABEL_CLASS = "text-[var(--token-text-secondary)]"

interface ClassStatRow {
  className: string
  raceCount: number
  entryCount: number
  driverCount: number
}

export interface ClassStatsCardProps {
  raceClasses: EventAnalysisData["raceClasses"]
  races: EventAnalysisData["races"]
  entryList: EventAnalysisData["entryList"]
}

function computeClassStats(
  raceClasses: EventAnalysisData["raceClasses"],
  races: EventAnalysisData["races"],
  entryList: EventAnalysisData["entryList"]
): ClassStatRow[] {
  const allClassNames = new Set<string>([
    ...raceClasses.keys(),
    ...races.map((r) => r.className),
    ...entryList.map((e) => e.className),
  ])

  const sortedClassNames = Array.from(allClassNames).sort()

  return sortedClassNames.map((className) => {
    const raceCount = races.filter((r) => r.className === className).length
    const entriesForClass = entryList.filter((e) => e.className === className)
    const entryCount = entriesForClass.length
    const driverCount = new Set(entriesForClass.map((e) => e.driverId)).size

    return {
      className,
      raceCount,
      entryCount,
      driverCount,
    }
  })
}

export default function ClassStatsCard({
  raceClasses,
  races,
  entryList,
}: ClassStatsCardProps) {
  const classStats = useMemo(
    () => computeClassStats(raceClasses, races, entryList),
    [raceClasses, races, entryList]
  )

  if (classStats.length === 0) {
    return null
  }

  return (
    <div className={CARD_CLASS}>
      <div className={GRID_CLASS}>
        {classStats.flatMap((stat) => [
          <span key={`${stat.className}-class`} className={LABEL_CLASS}>
            Class:
          </span>,
          <span key={`${stat.className}-class-val`}>{stat.className}</span>,
          <span key={`${stat.className}-races`} className={`${LABEL_CLASS} pl-3`}>
            Races:
          </span>,
          <span key={`${stat.className}-races-val`}>{stat.raceCount}</span>,
          <Tooltip
            key={`${stat.className}-drivers`}
            text="Number of unique drivers in this class. Lower than entries when a driver runs multiple cars."
            position="top"
          >
            <span className={`${LABEL_CLASS} pl-3`}>Drivers:</span>
          </Tooltip>,
          <span key={`${stat.className}-drivers-val`}>{stat.driverCount}</span>,
        ])}
      </div>
    </div>
  )
}
