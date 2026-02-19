/**
 * @fileoverview Top 3 most improved drivers per class card for Event Analysis Overview
 *
 * @description Displays one card per class showing the 1st, 2nd, 3rd most improved
 * drivers over the event (first race vs last race: position and lap time improvement).
 * Layout matches ClassTopFastestLapsCard; for practice days uses lap-time-only improvement.
 *
 * @relatedFiles
 * - src/core/events/calculate-driver-improvement.ts (improvement logic reference)
 * - src/components/organisms/event-analysis/ClassTopFastestLapsCard.tsx (structure reference)
 * - src/components/organisms/event-analysis/OverviewTab.tsx (uses this)
 * - docs/design/compact-label-value-card.md
 */

"use client"

import { useMemo } from "react"
import Tooltip from "@/components/molecules/Tooltip"
import {
  formatPositionImprovement,
  formatLapTimeImprovement,
} from "@/lib/date-utils"
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

interface ImprovedEntry {
  driverId: string
  driverName: string
  firstRacePosition: number
  lastRacePosition: number
  positionImprovement: number
  firstRaceFastLap: number | null
  lastRaceFastLap: number | null
  lapTimeImprovement: number | null
  improvementScore: number
  firstRaceLabel: string
  lastRaceLabel: string
  rank: number
}

interface ClassMostImproved {
  className: string
  entries: ImprovedEntry[]
}

function sanitizeLapTime(value: number | null | undefined): number | null {
  if (typeof value !== "number") return null
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

function normalizePositionImprovement(
  positionImprovement: number,
  maxPosition: number
): number {
  if (positionImprovement <= 0) return 0
  const maxPossible = maxPosition - 1
  if (maxPossible <= 0) return 0
  return Math.min(100, Math.max(0, (positionImprovement / maxPossible) * 100))
}

function normalizeLapTimeImprovement(
  lapTimeImprovement: number,
  firstFastLap: number
): number {
  if (lapTimeImprovement <= 0 || firstFastLap <= 0) return 0
  const improvementPercent = (lapTimeImprovement / firstFastLap) * 100
  return Math.min(100, Math.max(0, (improvementPercent / 20) * 100))
}

function computeMostImprovedPerClass(
  races: EventAnalysisData["races"],
  isPracticeDay?: boolean
): ClassMostImproved[] {
  const sortedRaces = [...races].sort((a, b) => {
    const orderA = a.raceOrder ?? 0
    const orderB = b.raceOrder ?? 0
    if (orderA !== orderB) return orderA - orderB
    const timeA = a.startTime?.getTime?.() ?? 0
    const timeB = b.startTime?.getTime?.() ?? 0
    return timeA - timeB
  })

  // driverId -> className -> { raceLabel, raceOrder, startTime, positionFinal, fastLapTime, driverName }[]
  const byClassAndDriver = new Map<
    string,
    Map<
      string,
      Array<{
        raceLabel: string
        raceOrder: number
        startTime: number
        positionFinal: number
        fastLapTime: number | null
        driverName: string
      }>
    >
  >()

  for (const race of sortedRaces) {
    const raceOrder = race.raceOrder ?? 0
    const startTime = race.startTime?.getTime?.() ?? 0
    for (const result of race.results) {
      let classMap = byClassAndDriver.get(result.driverId)
      if (!classMap) {
        classMap = new Map()
        byClassAndDriver.set(result.driverId, classMap)
      }
      let list = classMap.get(race.className)
      if (!list) {
        list = []
        classMap.set(race.className, list)
      }
      const fastLap = sanitizeLapTime(result.fastLapTime)
      list.push({
        raceLabel: race.raceLabel,
        raceOrder,
        startTime,
        positionFinal: result.positionFinal,
        fastLapTime: fastLap,
        driverName: result.driverName,
      })
    }
  }

  const improvementsByClass = new Map<string, ImprovedEntry[]>()

  for (const [driverId, classMap] of byClassAndDriver.entries()) {
    for (const [className, results] of classMap.entries()) {
      if (results.length < 2) continue

      const sorted = [...results].sort((a, b) => {
        if (a.raceOrder !== b.raceOrder) return a.raceOrder - b.raceOrder
        return a.startTime - b.startTime
      })

      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const positionImprovement = first.positionFinal - last.positionFinal

      let lapTimeImprovement: number | null = null
      const validFirst = first.fastLapTime
      const validLast = last.fastLapTime
      if (validFirst != null && validLast != null) {
        lapTimeImprovement = validFirst - validLast
      }

      const hasImprovement =
        positionImprovement > 0 ||
        (lapTimeImprovement != null && lapTimeImprovement > 0)
      if (!hasImprovement) continue

      const maxPosition = Math.max(...sorted.map((r) => r.positionFinal))
      const positionScore = normalizePositionImprovement(
        positionImprovement,
        maxPosition
      )
      let lapTimeScore = 0
      if (lapTimeImprovement != null && validFirst != null) {
        lapTimeScore = normalizeLapTimeImprovement(lapTimeImprovement, validFirst)
      }

      const improvementScore = isPracticeDay
        ? lapTimeScore
        : lapTimeScore > 0
          ? positionScore * 0.5 + lapTimeScore * 0.5
          : positionScore

      const entry: ImprovedEntry = {
        driverId,
        driverName: sorted[0]?.driverName ?? "Unknown",
        firstRacePosition: first.positionFinal,
        lastRacePosition: last.positionFinal,
        positionImprovement,
        firstRaceFastLap: validFirst,
        lastRaceFastLap: validLast,
        lapTimeImprovement,
        improvementScore,
        firstRaceLabel: first.raceLabel,
        lastRaceLabel: last.raceLabel,
        rank: 0,
      }

      if (!improvementsByClass.has(className)) {
        improvementsByClass.set(className, [])
      }
      improvementsByClass.get(className)!.push(entry)
    }
  }

  const result: ClassMostImproved[] = []

  for (const [className, entries] of improvementsByClass.entries()) {
    const sorted = [...entries].sort((a, b) => b.improvementScore - a.improvementScore)
    const top3 = sorted.slice(0, 3).map((e, i) => ({ ...e, rank: i + 1 }))
    result.push({ className, entries: top3 })
  }

  result.sort((a, b) => a.className.localeCompare(b.className))
  return result
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

export interface ClassMostImprovedCardProps {
  races: EventAnalysisData["races"]
  isPracticeDay?: boolean
}

export default function ClassMostImprovedCard({
  races,
  isPracticeDay = false,
}: ClassMostImprovedCardProps) {
  const classMostImproved = useMemo(
    () => computeMostImprovedPerClass(races, isPracticeDay),
    [races, isPracticeDay]
  )

  if (classMostImproved.length === 0) {
    return null
  }

  return (
    <>
      {classMostImproved.map(({ className, entries }) => (
        <div key={className} className={CARD_CLASS}>
          <header className={HEADER_CLASS}>
            <h3 className={TITLE_CLASS}>{className}</h3>
            <p className={SUBTITLE_CLASS}>
              {isPracticeDay
                ? "Top 3 most improved (lap time) this event"
                : "Top 3 most improved this event"}
            </p>
          </header>
          <ul
            className="space-y-3 text-sm text-[var(--token-text-primary)] leading-normal"
            aria-label={`Most improved drivers for ${className} this event`}
          >
            {entries.map((entry, i) => {
              const rankLabel =
                entry.rank === 1 ? "1st" : entry.rank === 2 ? "2nd" : "3rd"
              const positionText = formatPositionImprovement(
                entry.firstRacePosition,
                entry.lastRacePosition
              )
              const lapTimeText =
                entry.lapTimeImprovement != null
                  ? formatLapTimeImprovement(entry.lapTimeImprovement)
                  : null
              const contextLine = [
                `First: ${entry.firstRaceLabel}`,
                `Last: ${entry.lastRaceLabel}`,
              ].join(" · ")
              return (
                <li
                  key={`${entry.driverId}-${className}-${i}`}
                  className="flex flex-col gap-1"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className={getRankBadgeClass(entry.rank)}>
                      {rankLabel}
                    </span>
                    <span className="font-medium">{entry.driverName}</span>
                    <span className="text-[var(--token-text-secondary)]">
                      {positionText}
                      {lapTimeText != null && (
                        <span className="ml-1 tabular-nums">
                          {lapTimeText}
                        </span>
                      )}
                    </span>
                  </div>
                  <Tooltip text={contextLine}>
                    <span className={CONTEXT_CLASS}>{contextLine}</span>
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
