/**
 * @fileoverview Heats schedule card for Event Analysis Overview
 *
 * @description Displays qualifying heats and their start times per class,
 * in the same compact label-value card style as EventStats, WeatherCard, and ClassStatsCard.
 * Each class gets its own card with a heading.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/ClassStatsCard.tsx (styling reference)
 * - src/components/organisms/event-analysis/OverviewTab.tsx (uses this)
 * - docs/design/compact-label-value-card.md
 */

"use client"

import { useMemo } from "react"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { formatTimeUTC } from "@/lib/format-session-data"

const CARD_CLASS =
  "mb-6 w-fit rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2"
const HEADING_CLASS = "text-sm font-semibold text-[var(--token-text-primary)] mb-2"
const GRID_CLASS =
  "grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm text-[var(--token-text-primary)]"
const LABEL_CLASS = "text-[var(--token-text-secondary)]"

function isHeat(raceLabel: string): boolean {
  return raceLabel.toLowerCase().includes("heat")
}

/**
 * Extract heat label for display (e.g. "Heat 1/3" from "1:8th Electric Buggy (Heat 1/3)")
 */
function heatDisplayLabel(raceLabel: string): string {
  const match = raceLabel.match(/\(Heat\s+\d+\/\d+\)/i) ?? raceLabel.match(/Heat\s+\d+\/\d+/i)
  return match ? match[0].replace(/^\(|\)$/g, "") : raceLabel
}

export interface HeatsCardProps {
  races: EventAnalysisData["races"]
}

interface ClassHeats {
  className: string
  heats: Array<{ raceLabel: string; startTime: Date | null }>
}

function computeHeatsByClass(races: EventAnalysisData["races"]): ClassHeats[] {
  const byClass = new Map<string, Array<{ raceLabel: string; startTime: Date | null; raceOrder: number | null }>>()

  for (const r of races) {
    if (!isHeat(r.raceLabel)) continue
    const list = byClass.get(r.className) ?? []
    list.push({ raceLabel: r.raceLabel, startTime: r.startTime, raceOrder: r.raceOrder })
    byClass.set(r.className, list)
  }

  return Array.from(byClass.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([className, heats]) => {
      heats.sort((a, b) => {
        const timeA = a.startTime?.getTime() ?? Number.POSITIVE_INFINITY
        const timeB = b.startTime?.getTime() ?? Number.POSITIVE_INFINITY
        if (timeA !== timeB) return timeA - timeB
        return a.raceLabel.localeCompare(b.raceLabel, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      })
      return {
        className,
        heats: heats.map(({ raceLabel, startTime }) => ({ raceLabel, startTime })),
      }
    })
}

export default function HeatsCard({ races }: HeatsCardProps) {
  const heatsByClass = useMemo(() => computeHeatsByClass(races), [races])

  if (heatsByClass.length === 0) {
    return null
  }

  return (
    <>
      {heatsByClass.map(({ className, heats }) => (
        <div key={className} className={CARD_CLASS}>
          <h3 className={HEADING_CLASS}>{className}</h3>
          <div className={GRID_CLASS}>
            {heats.flatMap((heat, idx) => [
              <span key={`${idx}-heat`} className={LABEL_CLASS}>
                {heatDisplayLabel(heat.raceLabel)}:
              </span>,
              <span key={`${idx}-time`}>{formatTimeUTC(heat.startTime)}</span>,
            ])}
          </div>
        </div>
      ))}
    </>
  )
}
