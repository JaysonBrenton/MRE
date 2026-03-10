/**
 * @fileoverview Practice Day class leaderboard – fastest lap per class with driver and session
 *
 * @description Per-class leaderboard: class name, fastest driver, best lap, session label.
 *              Per practice-day-dashboard-visualization-design §9.3 (Class Reference).
 */

"use client"

import { useMemo } from "react"
import { formatLapTime } from "@/lib/date-utils"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { formatClassName } from "@/lib/format-class-name"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"

export interface PracticeClassLeaderboardProps {
  data: EventAnalysisData
  selectedClass: string | null
}

interface ClassRow {
  className: string
  driverName: string
  driverId: string
  bestLap: number
  raceLabel: string
}

function buildClassLeaderboard(data: EventAnalysisData): ClassRow[] {
  const byClass = new Map<
    string,
    { driverName: string; driverId: string; bestLap: number; raceLabel: string }
  >()
  data.races.forEach((race) => {
    const className = race.className
    race.results.forEach((r) => {
      if (r.fastLapTime == null || r.fastLapTime <= 0) return
      const existing = byClass.get(className)
      if (!existing || r.fastLapTime < existing.bestLap) {
        byClass.set(className, {
          driverName: r.driverName ?? "Unknown",
          driverId: r.driverId,
          bestLap: r.fastLapTime,
          raceLabel: race.raceLabel,
        })
      }
    })
  })
  return Array.from(byClass.entries())
    .map(([className, v]) => ({
      className,
      driverName: v.driverName,
      driverId: v.driverId,
      bestLap: v.bestLap,
      raceLabel: v.raceLabel,
    }))
    .sort((a, b) => a.className.localeCompare(b.className))
}

export default function PracticeClassLeaderboard({
  data,
  selectedClass,
}: PracticeClassLeaderboardProps) {
  const rows = useMemo(() => buildClassLeaderboard(data), [data])
  const filtered = useMemo(() => {
    if (selectedClass === null || selectedClass === "") return rows
    return rows.filter((r) => r.className === selectedClass)
  }, [rows, selectedClass])

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6">
        <h2 className="text-lg font-medium text-[var(--token-text-primary)] mb-4">
          Class leaderboard
        </h2>
        <p className="text-sm text-[var(--token-text-muted)]">No lap data by class.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6">
      <h2 className="text-lg font-medium text-[var(--token-text-primary)] mb-4">
        Class leaderboard
      </h2>
      <p className="text-sm text-[var(--token-text-secondary)] mb-3">
        Fastest lap per class across all sessions.
      </p>
      <div className="rounded-lg border border-[var(--token-border-default)] overflow-hidden bg-[var(--token-surface-elevated)]">
        <StandardTable>
          <StandardTableHeader>
            <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
              <StandardTableCell header>Class</StandardTableCell>
              <StandardTableCell header>Fastest driver</StandardTableCell>
              <StandardTableCell header>Best lap</StandardTableCell>
              <StandardTableCell header>Session</StandardTableCell>
            </tr>
          </StandardTableHeader>
          <tbody>
            {filtered.map((row) => (
              <StandardTableRow key={row.className}>
                <StandardTableCell className="font-medium">
                  {formatClassName(row.className)}
                </StandardTableCell>
                <StandardTableCell>{row.driverName}</StandardTableCell>
                <StandardTableCell>{formatLapTime(row.bestLap)}</StandardTableCell>
                <StandardTableCell>{row.raceLabel}</StandardTableCell>
              </StandardTableRow>
            ))}
          </tbody>
        </StandardTable>
      </div>
    </div>
  )
}
