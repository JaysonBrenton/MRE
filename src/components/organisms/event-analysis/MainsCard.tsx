/**
 * @fileoverview Mains schedule card for Event Analysis Overview
 *
 * @description Displays main events (A-Main, B-Main, C1-Main, etc.) and their
 * start times per class, in the same compact label-value card style as HeatsCard.
 * Each class gets its own card with a heading.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/HeatsCard.tsx (structure reference)
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

function isMain(raceLabel: string): boolean {
  return raceLabel.toLowerCase().includes("main")
}

/**
 * Extract main label for display (e.g. "A1-Main" from "1:8th Electric Buggy A1-Main")
 */
function mainDisplayLabel(raceLabel: string): string {
  const match = raceLabel.match(/[\w\d]+-Main$/i)
  return match ? match[0] : raceLabel
}

export interface MainsCardProps {
  races: EventAnalysisData["races"]
}

interface ClassMains {
  className: string
  mains: Array<{ raceLabel: string; startTime: Date | null }>
}

function computeMainsByClass(races: EventAnalysisData["races"]): ClassMains[] {
  const byClass = new Map<string, Array<{ raceLabel: string; startTime: Date | null; raceOrder: number | null }>>()

  for (const r of races) {
    if (!isMain(r.raceLabel)) continue
    const list = byClass.get(r.className) ?? []
    list.push({ raceLabel: r.raceLabel, startTime: r.startTime, raceOrder: r.raceOrder })
    byClass.set(r.className, list)
  }

  return Array.from(byClass.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([className, mains]) => {
      mains.sort((a, b) => {
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
        mains: mains.map(({ raceLabel, startTime }) => ({ raceLabel, startTime })),
      }
    })
}

export default function MainsCard({ races }: MainsCardProps) {
  const mainsByClass = useMemo(() => computeMainsByClass(races), [races])

  if (mainsByClass.length === 0) {
    return null
  }

  return (
    <>
      {mainsByClass.map(({ className, mains }) => (
        <div key={className} className={CARD_CLASS}>
          <h3 className={HEADING_CLASS}>{className}</h3>
          <div className={GRID_CLASS}>
            {mains.flatMap((main, idx) => [
              <span key={`${idx}-main`} className={LABEL_CLASS}>
                {mainDisplayLabel(main.raceLabel)}:
              </span>,
              <span key={`${idx}-time`}>{formatTimeUTC(main.startTime)}</span>,
            ])}
          </div>
        </div>
      ))}
    </>
  )
}
