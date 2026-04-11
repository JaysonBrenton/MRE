/**
 * @fileoverview Top 3 fastest laps per class card for Event Analysis Overview
 *
 * @description Displays one card per class showing the top 3 distinct lap times
 * for the entire event. When multiple drivers tie, all are listed.
 * Layout: class as card title; each place shows rank badge, driver, prominent
 * lap time, and session/lap as secondary text.
 *
 * @relatedFiles
 * - src/core/events/event-top-fastest-laps-per-class.ts (shared computation)
 * - src/components/organisms/event-analysis/EventStats.tsx (styling reference)
 * - src/components/organisms/event-analysis/OverviewTab.tsx (uses this)
 * - docs/design/compact-label-value-card.md
 */

"use client"

import { useMemo } from "react"
import Tooltip from "@/components/molecules/Tooltip"
import { formatLapTime } from "@/lib/date-utils"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { computeTopFastestLapsPerClass } from "@/core/events/event-top-fastest-laps-per-class"

const CARD_CLASS =
  "mb-6 w-fit min-w-[16rem] rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-3"
const TITLE_CLASS = "text-base font-medium text-[var(--token-text-primary)]"
const SUBTITLE_CLASS = "text-xs text-[var(--token-text-secondary)] mt-0.5"
const HEADER_CLASS = "border-b border-[var(--token-border-default)] pb-3 mb-3"
const RANK_BADGE_BASE =
  "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium tabular-nums"
const RANK_1_CLASS = `${RANK_BADGE_BASE} bg-amber-500/15 text-amber-200 border border-amber-500/30`
const RANK_2_CLASS = `${RANK_BADGE_BASE} bg-slate-400/15 text-slate-200 border border-slate-400/30`
const RANK_3_CLASS = `${RANK_BADGE_BASE} bg-amber-700/20 text-amber-300/90 border border-amber-700/40`
const SESSION_CLASS = "block text-xs text-[var(--token-text-secondary)] truncate max-w-[18rem]"

function formatRaceLap(raceLabel: string, lapNumber: number | null): string {
  if (lapNumber != null) {
    return `${raceLabel}, Lap ${lapNumber}`
  }
  return raceLabel
}

function getRankBadgeClass(rank: number): string {
  switch (rank) {
    case 1:
      return RANK_1_CLASS
    case 2:
      return RANK_2_CLASS
    case 3:
      return RANK_3_CLASS
    default:
      return (
        RANK_BADGE_BASE +
        " bg-[var(--token-surface-elevated)] border border-[var(--token-border-default)] text-[var(--token-text-secondary)]"
      )
  }
}

export interface ClassTopFastestLapsCardProps {
  races: EventAnalysisData["races"]
}

export default function ClassTopFastestLapsCard({ races }: ClassTopFastestLapsCardProps) {
  const classTopLaps = useMemo(() => computeTopFastestLapsPerClass(races), [races])

  if (classTopLaps.length === 0) {
    return null
  }

  return (
    <>
      {classTopLaps.map(({ className, entries }) => (
        <div key={className} className={CARD_CLASS}>
          <header className={HEADER_CLASS}>
            <h3 className={TITLE_CLASS}>{className}</h3>
            <p className={SUBTITLE_CLASS}>Top 3 fastest laps this event</p>
          </header>
          <ul
            className="space-y-3 text-sm text-[var(--token-text-primary)] leading-normal"
            aria-label={`Top fastest laps for ${className} this event`}
          >
            {entries.map((entry, i) => {
              const rankLabel = entry.rank === 1 ? "1st" : entry.rank === 2 ? "2nd" : "3rd"
              const raceLap = formatRaceLap(entry.raceLabel, entry.lapNumber)
              return (
                <li
                  key={entry.driverId + "-" + entry.lapTimeSeconds + "-" + i}
                  className="flex flex-col gap-1"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className={getRankBadgeClass(entry.rank)}>{rankLabel}</span>
                    <span className="font-medium">{entry.driverName}</span>
                    <span className="tabular-nums font-semibold text-[var(--token-text-primary)]">
                      {formatLapTime(entry.lapTimeSeconds)}
                    </span>
                  </div>
                  <Tooltip text={raceLap}>
                    <span className={SESSION_CLASS}>{raceLap}</span>
                  </Tooltip>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </>
  )
}
