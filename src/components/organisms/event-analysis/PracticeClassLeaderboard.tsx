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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--token-border-default)] text-left text-[var(--token-text-secondary)]">
              <th className="pb-2 pr-4">Class</th>
              <th className="pb-2 pr-4">Fastest driver</th>
              <th className="pb-2 pr-4">Best lap</th>
              <th className="pb-2">Session</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.className}
                className="border-b border-[var(--token-border-default)] last:border-0"
              >
                <td className="py-2 pr-4 font-medium">{row.className}</td>
                <td className="py-2 pr-4">{row.driverName}</td>
                <td className="py-2 pr-4">{formatLapTime(row.bestLap)}</td>
                <td className="py-2">{row.raceLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
