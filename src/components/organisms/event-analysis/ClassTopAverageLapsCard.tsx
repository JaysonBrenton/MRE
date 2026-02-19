/**
 * @fileoverview Top 3 best average laps per class card for Event Analysis Overview
 *
 * @description Displays one card per class showing the top 3 drivers by event-wide
 * average lap time (total time / total laps across all races in that class).
 * Layout: class as card title; each place shows rank badge, driver, prominent
 * average lap time, and "Across N races · M laps" as secondary text.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/ClassTopFastestLapsCard.tsx (structure reference)
 * - src/components/organisms/event-analysis/OverviewTab.tsx (uses this)
 * - docs/design/compact-label-value-card.md
 */

"use client"

import { useMemo } from "react"
import Tooltip from "@/components/molecules/Tooltip"
import { formatLapTime } from "@/lib/date-utils"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

const CARD_CLASS =
  "mb-6 w-fit min-w-[16rem] rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-3"
const TITLE_CLASS =
  "text-base font-medium text-[var(--token-text-primary)]"
const SUBTITLE_CLASS =
  "text-xs text-[var(--token-text-secondary)] mt-0.5"
const HEADER_CLASS =
  "border-b border-[var(--token-border-default)] pb-3 mb-3"
const RANK_BADGE_BASE =
  "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium tabular-nums"
const RANK_1_CLASS = `${RANK_BADGE_BASE} bg-amber-500/15 text-amber-200 border border-amber-500/30`
const RANK_2_CLASS = `${RANK_BADGE_BASE} bg-slate-400/15 text-slate-200 border border-slate-400/30`
const RANK_3_CLASS = `${RANK_BADGE_BASE} bg-amber-700/20 text-amber-300/90 border border-amber-700/40`
const CONTEXT_CLASS =
  "block text-xs text-[var(--token-text-secondary)] truncate max-w-[18rem]"

interface TopAvgEntry {
  driverId: string
  driverName: string
  avgLapSeconds: number
  raceCount: number
  totalLaps: number
  rank: number
}

interface ClassTopAvg {
  className: string
  entries: TopAvgEntry[]
}

function computeTopAverageLapsPerClass(
  races: EventAnalysisData["races"]
): ClassTopAvg[] {
  // Per class, per driver: sum totalTimeSeconds and lapsCompleted across all results
  const byClass = new Map<
    string,
    Map<
      string,
      { driverName: string; totalTimeSeconds: number; totalLaps: number }
    >
  >()

  for (const race of races) {
    for (const result of race.results) {
      if (
        result.totalTimeSeconds == null ||
        result.lapsCompleted == null ||
        result.lapsCompleted <= 0
      ) {
        continue
      }

      let driverMap = byClass.get(race.className)
      if (!driverMap) {
        driverMap = new Map()
        byClass.set(race.className, driverMap)
      }

      const existing = driverMap.get(result.driverId)
      if (!existing) {
        driverMap.set(result.driverId, {
          driverName: result.driverName,
          totalTimeSeconds: result.totalTimeSeconds,
          totalLaps: result.lapsCompleted,
        })
      } else {
        existing.totalTimeSeconds += result.totalTimeSeconds
        existing.totalLaps += result.lapsCompleted
      }
    }
  }

  const result: ClassTopAvg[] = []

  for (const [className, driverMap] of byClass.entries()) {
    const withAvg = Array.from(driverMap.entries())
      .map(([driverId, data]) => ({
        driverId,
        driverName: data.driverName,
        avgLapSeconds: data.totalTimeSeconds / data.totalLaps,
        totalLaps: data.totalLaps,
        raceCount: 0, // we'll count below
      }))
      .filter((e) => e.totalLaps > 0)

    // Count races per driver for context (re-scan)
    for (const e of withAvg) {
      e.raceCount = races.filter(
        (r) =>
          r.className === className &&
          r.results.some((res) => res.driverId === e.driverId)
      ).length
    }

    const sorted = [...withAvg].sort(
      (a, b) => a.avgLapSeconds - b.avgLapSeconds
    )

    // Top 3 distinct average times (with ties)
    const distinctAvgs: number[] = []
    for (const e of sorted) {
      const last = distinctAvgs[distinctAvgs.length - 1]
      if (
        last === undefined ||
        Math.abs(e.avgLapSeconds - last) > 0.001
      ) {
        distinctAvgs.push(e.avgLapSeconds)
        if (distinctAvgs.length >= 3) break
      }
    }
    const topSet = new Set(distinctAvgs)

    let rank = 1
    let prevAvg: number | null = null
    const topEntries: TopAvgEntry[] = []

    for (const e of sorted) {
      if (!topSet.has(e.avgLapSeconds)) continue

      const isNewRank =
        prevAvg === null ||
        Math.abs(e.avgLapSeconds - prevAvg) > 0.001
      if (isNewRank && prevAvg !== null) {
        rank++
      }
      prevAvg = e.avgLapSeconds

      topEntries.push({
        driverId: e.driverId,
        driverName: e.driverName,
        avgLapSeconds: e.avgLapSeconds,
        raceCount: e.raceCount,
        totalLaps: e.totalLaps,
        rank,
      })
    }

    if (topEntries.length > 0) {
      result.push({ className, entries: topEntries })
    }
  }

  result.sort((a, b) => a.className.localeCompare(b.className))
  return result
}

function formatContext(raceCount: number, totalLaps: number): string {
  if (raceCount === 1) {
    return totalLaps === 1 ? "1 race · 1 lap" : `1 race · ${totalLaps} laps`
  }
  return `${raceCount} races · ${totalLaps} laps`
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
      return RANK_BADGE_BASE + " bg-[var(--token-surface-elevated)] border border-[var(--token-border-default)] text-[var(--token-text-secondary)]"
  }
}

export interface ClassTopAverageLapsCardProps {
  races: EventAnalysisData["races"]
}

export default function ClassTopAverageLapsCard({
  races,
}: ClassTopAverageLapsCardProps) {
  const classTopAvg = useMemo(
    () => computeTopAverageLapsPerClass(races),
    [races]
  )

  if (classTopAvg.length === 0) {
    return null
  }

  return (
    <>
      {classTopAvg.map(({ className, entries }) => (
        <div key={className} className={CARD_CLASS}>
          <header className={HEADER_CLASS}>
            <h3 className={TITLE_CLASS}>{className}</h3>
            <p className={SUBTITLE_CLASS}>
              Top 3 best average laps this event
            </p>
          </header>
          <ul
            className="space-y-3 text-sm text-[var(--token-text-primary)] leading-normal"
            aria-label={`Top average laps for ${className} this event`}
          >
            {entries.map((entry, i) => {
              const rankLabel =
                entry.rank === 1 ? "1st" : entry.rank === 2 ? "2nd" : "3rd"
              const context = formatContext(entry.raceCount, entry.totalLaps)
              const contextFull = `Across ${context}`
              return (
                <li
                  key={
                    entry.driverId +
                    "-" +
                    entry.avgLapSeconds.toFixed(3) +
                    "-" +
                    i
                  }
                  className="flex flex-col gap-1"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className={getRankBadgeClass(entry.rank)}>
                      {rankLabel}
                    </span>
                    <span className="font-medium">{entry.driverName}</span>
                    <span className="tabular-nums font-semibold text-[var(--token-text-primary)]">
                      {formatLapTime(entry.avgLapSeconds)}
                    </span>
                  </div>
                  <Tooltip text={contextFull}>
                    <span className={CONTEXT_CLASS}>{contextFull}</span>
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
