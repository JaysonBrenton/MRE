/**
 * @fileoverview Top 3 fastest laps per class card for Event Analysis Overview
 *
 * @description Displays one card per class showing the top 3 distinct lap times
 * for the entire event. When multiple drivers tie, all are listed.
 * Layout: class as card title; each place shows rank badge, driver, prominent
 * lap time, and session/lap as secondary text.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/ClassStatsCard.tsx (styling reference)
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
const SESSION_CLASS =
  "block text-xs text-[var(--token-text-secondary)] truncate max-w-[18rem]"

interface TopLapEntry {
  driverId: string
  driverName: string
  lapTimeSeconds: number
  session: string
  lapNumber: number | null
  rank: number
}

interface ClassTopLaps {
  className: string
  entries: TopLapEntry[]
}

function computeTopFastestLapsPerClass(
  races: EventAnalysisData["races"]
): ClassTopLaps[] {
  // Per class: collect each driver's BEST lap (lowest fastLapTime across their results)
  const byClass = new Map<
    string,
    Map<
      string,
      {
        driverId: string
        driverName: string
        lapTimeSeconds: number
        session: string
        lapNumber: number | null
      }
    >
  >()

  for (const race of races) {
    for (const result of race.results) {
      if (result.fastLapTime == null || result.fastLapTime <= 0) continue

      let driverMap = byClass.get(race.className)
      if (!driverMap) {
        driverMap = new Map()
        byClass.set(race.className, driverMap)
      }

      const existing = driverMap.get(result.driverId)
      const isBetter =
        !existing || result.fastLapTime < existing.lapTimeSeconds

      if (isBetter) {
        driverMap.set(result.driverId, {
          driverId: result.driverId,
          driverName: result.driverName,
          lapTimeSeconds: result.fastLapTime,
          session: race.raceLabel,
          lapNumber: result.fastLapLapNumber ?? null,
        })
      }
    }
  }

  // For each class: sort by lap time, take top 3 distinct times, list all drivers at each time
  const result: ClassTopLaps[] = []

  for (const [className, driverMap] of byClass.entries()) {
    const entries = Array.from(driverMap.values())
    // Sort by lap time ascending
    const sorted = [...entries].sort(
      (a, b) => a.lapTimeSeconds - b.lapTimeSeconds
    )

    // Collect unique lap times in order, take first 3
    const distinctTimes: number[] = []
    for (const e of sorted) {
      const last = distinctTimes[distinctTimes.length - 1]
      if (last === undefined || Math.abs(e.lapTimeSeconds - last) > 0.001) {
        distinctTimes.push(e.lapTimeSeconds)
        if (distinctTimes.length >= 3) break
      }
    }

    const topTimesSet = new Set(distinctTimes)

    // Build entries: all drivers whose lap time is in top 3, with rank
    const topEntries: TopLapEntry[] = []
    let rank = 1
    let prevTime: number | null = null

    for (const e of sorted) {
      if (!topTimesSet.has(e.lapTimeSeconds)) continue

      const isNewRank =
        prevTime === null || Math.abs(e.lapTimeSeconds - prevTime) > 0.001
      if (isNewRank && prevTime !== null) {
        rank++
      }
      prevTime = e.lapTimeSeconds

      topEntries.push({
        driverId: e.driverId,
        driverName: e.driverName,
        lapTimeSeconds: e.lapTimeSeconds,
        session: e.session,
        lapNumber: e.lapNumber,
        rank,
      })
    }

    if (topEntries.length > 0) {
      result.push({ className, entries: topEntries })
    }
  }

  // Sort classes alphabetically
  result.sort((a, b) => a.className.localeCompare(b.className))

  return result
}

function formatSessionLap(session: string, lapNumber: number | null): string {
  if (lapNumber != null) {
    return `${session}, Lap ${lapNumber}`
  }
  return session
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

export interface ClassTopFastestLapsCardProps {
  races: EventAnalysisData["races"]
}

export default function ClassTopFastestLapsCard({
  races,
}: ClassTopFastestLapsCardProps) {
  const classTopLaps = useMemo(
    () => computeTopFastestLapsPerClass(races),
    [races]
  )

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
          <ul className="space-y-3 text-sm text-[var(--token-text-primary)] leading-normal" aria-label={`Top fastest laps for ${className} this event`}>
            {entries.map((entry, i) => {
              const rankLabel =
                entry.rank === 1 ? "1st" : entry.rank === 2 ? "2nd" : "3rd"
              const sessionLap = formatSessionLap(entry.session, entry.lapNumber)
              return (
                <li
                  key={entry.driverId + "-" + entry.lapTimeSeconds + "-" + i}
                  className="flex flex-col gap-1"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className={getRankBadgeClass(entry.rank)}>
                      {rankLabel}
                    </span>
                    <span className="font-medium">{entry.driverName}</span>
                    <span className="tabular-nums font-semibold text-[var(--token-text-primary)]">
                      {formatLapTime(entry.lapTimeSeconds)}
                    </span>
                  </div>
                  <Tooltip text={sessionLap}>
                    <span className={SESSION_CLASS}>{sessionLap}</span>
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
