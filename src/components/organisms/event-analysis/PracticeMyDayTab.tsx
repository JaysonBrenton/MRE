/**
 * @fileoverview Practice Day "My Day" tab – driver-centric overview
 *
 * @description Lap time progression, class comparison, and consistency for the selected driver.
 *              Per practice-day-dashboard-visualization-design §9.1.
 */

"use client"

import { useMemo } from "react"
import { formatLapTime, formatLapTimeImprovement } from "@/lib/date-utils"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import LinkYourDriverPrompt from "./LinkYourDriverPrompt"

export interface PracticeMyDayTabProps {
  data: EventAnalysisData
  selectedDriverId: string | null
}

/** Session with startTime for ordering */
interface DriverSessionRow {
  raceId: string
  raceLabel: string
  startTime: Date | null
  bestLapTime: number | null
  avgLapTime: number | null
  consistency: number | null
  lapsCompleted: number
}

function getDriverSessionsChronological(
  data: EventAnalysisData,
  driverId: string
): DriverSessionRow[] {
  const rows: DriverSessionRow[] = []
  data.races.forEach((race) => {
    const result = race.results.find((r) => r.driverId === driverId)
    if (!result) return
    rows.push({
      raceId: race.id,
      raceLabel: race.raceLabel,
      startTime: race.startTime,
      bestLapTime: result.fastLapTime,
      avgLapTime: result.avgLapTime,
      consistency: result.consistency,
      lapsCompleted: result.lapsCompleted ?? 0,
    })
  })
  rows.sort((a, b) => (a.startTime?.getTime() ?? 0) - (b.startTime?.getTime() ?? 0))
  return rows
}

/** Per-class leaderboard: driver, best lap, session label */
function getClassLeaderboard(
  data: EventAnalysisData,
  className: string
): Array<{ driverId: string; driverName: string; bestLap: number; raceLabel: string }> {
  const list: Array<{ driverId: string; driverName: string; bestLap: number; raceLabel: string }> = []
  data.races.forEach((race) => {
    if (race.className !== className) return
    race.results.forEach((r) => {
      if (r.fastLapTime != null && r.fastLapTime > 0) {
        list.push({
          driverId: r.driverId,
          driverName: r.driverName ?? "Unknown",
          bestLap: r.fastLapTime,
          raceLabel: race.raceLabel,
        })
      }
    })
  })
  list.sort((a, b) => a.bestLap - b.bestLap)
  return list
}

export default function PracticeMyDayTab({ data, selectedDriverId }: PracticeMyDayTabProps) {
  const driverSessions = useMemo(() => {
    if (!selectedDriverId) return []
    return getDriverSessionsChronological(data, selectedDriverId)
  }, [data, selectedDriverId])

  const driverClass = useMemo(() => {
    if (driverSessions.length === 0) return null
    const firstRace = data.races.find((r) => r.id === driverSessions[0].raceId)
    return firstRace?.className ?? null
  }, [data.races, driverSessions])

  const classLeaderboard = useMemo(() => {
    if (!driverClass) return []
    return getClassLeaderboard(data, driverClass)
  }, [data, driverClass])

  const driverPositionInClass = useMemo(() => {
    if (!selectedDriverId || classLeaderboard.length === 0) return null
    const idx = classLeaderboard.findIndex((r) => r.driverId === selectedDriverId)
    return idx >= 0 ? idx + 1 : null
  }, [classLeaderboard, selectedDriverId])

  const fastestInClass = classLeaderboard[0]?.bestLap ?? null
  const driverBestLap = useMemo(() => {
    const laps = driverSessions.map((s) => s.bestLapTime).filter((t): t is number => t != null && t > 0)
    return laps.length > 0 ? Math.min(...laps) : null
  }, [driverSessions])

  const gapToFastest = useMemo(() => {
    if (fastestInClass == null || driverBestLap == null) return null
    return driverBestLap - fastestInClass
  }, [fastestInClass, driverBestLap])

  const firstSessionBest = driverSessions.length > 0 ? driverSessions[0].bestLapTime : null
  const lastSessionBest = driverSessions.length > 0 ? driverSessions[driverSessions.length - 1].bestLapTime : null
  const lapTimeImprovement =
    firstSessionBest != null && lastSessionBest != null && firstSessionBest > 0
      ? firstSessionBest - lastSessionBest
      : null

  const avgConsistency = useMemo(() => {
    const vals = driverSessions.map((s) => s.consistency).filter((c): c is number => c != null && Number.isFinite(c))
    if (vals.length === 0) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }, [driverSessions])

  if (!selectedDriverId) {
    return (
      <div className="space-y-6" role="tabpanel" id="tabpanel-my-day" aria-labelledby="tab-my-day">
        <LinkYourDriverPrompt />
        <div className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6">
          <p className="text-sm text-[var(--token-text-secondary)]">
            Select a driver above to see their lap time progression, class comparison, and consistency.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6" role="tabpanel" id="tabpanel-my-day" aria-labelledby="tab-my-day">
      {/* Lap time progression */}
      <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6">
        <h2 className="text-lg font-medium text-[var(--token-text-primary)] mb-4">
          Lap time progression
        </h2>
        {driverSessions.length === 0 ? (
          <p className="text-sm text-[var(--token-text-muted)]">No session data for this driver.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--token-border-default)] text-left text-[var(--token-text-secondary)]">
                    <th className="pb-2 pr-4">Session</th>
                    <th className="pb-2 pr-4">Best lap</th>
                    <th className="pb-2 pr-4">Avg lap</th>
                    <th className="pb-2">Consistency</th>
                  </tr>
                </thead>
                <tbody>
                  {driverSessions.map((s, i) => (
                    <tr key={s.raceId} className="border-b border-[var(--token-border-default)] last:border-0">
                      <td className="py-2 pr-4">{s.raceLabel || `Session ${i + 1}`}</td>
                      <td className="py-2 pr-4">{formatLapTime(s.bestLapTime)}</td>
                      <td className="py-2 pr-4">{formatLapTime(s.avgLapTime)}</td>
                      <td className="py-2">{s.consistency != null ? `${s.consistency.toFixed(1)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {driverSessions.length >= 2 && (firstSessionBest != null || lastSessionBest != null) && (
              <p className="mt-4 text-sm text-[var(--token-text-secondary)]">
                First session best: {formatLapTime(firstSessionBest)} → Last session best: {formatLapTime(lastSessionBest)}
                {lapTimeImprovement != null && lapTimeImprovement !== 0 && (
                  <span className="ml-2">
                    ({lapTimeImprovement > 0 ? "improved" : "slower"} {formatLapTimeImprovement(lapTimeImprovement)})
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </section>

      {/* Class comparison */}
      <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6">
        <h2 className="text-lg font-medium text-[var(--token-text-primary)] mb-4">
          Class comparison {driverClass ? `– ${driverClass}` : ""}
        </h2>
        {!driverClass ? (
          <p className="text-sm text-[var(--token-text-muted)]">No class for selected driver.</p>
        ) : classLeaderboard.length === 0 ? (
          <p className="text-sm text-[var(--token-text-muted)]">No lap times in this class.</p>
        ) : (
          <>
            <p className="text-sm text-[var(--token-text-secondary)] mb-3">
              Fastest in class: {formatLapTime(fastestInClass)}
              {driverPositionInClass != null && (
                <> · Your position: {driverPositionInClass} of {classLeaderboard.length}</>
              )}
              {gapToFastest != null && gapToFastest > 0 && (
                <> · Gap to fastest: {formatLapTime(gapToFastest)}</>
              )}
            </p>
            <div className="overflow-x-auto max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--token-border-default)] text-left text-[var(--token-text-secondary)]">
                    <th className="pb-2 pr-4">#</th>
                    <th className="pb-2 pr-4">Driver</th>
                    <th className="pb-2 pr-4">Best lap</th>
                    <th className="pb-2">Session</th>
                  </tr>
                </thead>
                <tbody>
                  {classLeaderboard.slice(0, 10).map((row, i) => (
                    <tr
                      key={`class-leaderboard-${i}`}
                      className={`border-b border-[var(--token-border-default)] last:border-0 ${
                        row.driverId === selectedDriverId ? "bg-[var(--token-surface-raised)]" : ""
                      }`}
                    >
                      <td className="py-1 pr-4">{i + 1}</td>
                      <td className="py-1 pr-4">{row.driverName}</td>
                      <td className="py-1 pr-4">{formatLapTime(row.bestLap)}</td>
                      <td className="py-1">{row.raceLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Consistency */}
      <section className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6">
        <h2 className="text-lg font-medium text-[var(--token-text-primary)] mb-4">
          Consistency
        </h2>
        {avgConsistency != null ? (
          <p className="text-sm text-[var(--token-text-secondary)]">
            Average consistency across {driverSessions.length} session{driverSessions.length !== 1 ? "s" : ""}:{" "}
            <strong>{avgConsistency.toFixed(1)}%</strong>
          </p>
        ) : (
          <p className="text-sm text-[var(--token-text-muted)]">No consistency data for this driver.</p>
        )}
      </section>
    </div>
  )
}
