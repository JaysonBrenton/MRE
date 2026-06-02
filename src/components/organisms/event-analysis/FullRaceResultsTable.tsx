/**
 * @fileoverview Full per-driver race results row (LiveRC-style columns)
 *
 * Used by main-bracket and session modals for a consistent wide results grid.
 */

"use client"

import { Fragment, useCallback, useRef, useState } from "react"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  formatConsistency,
  formatRaceBehind,
  formatLapTime,
  formatLapsSlashTime,
} from "@/lib/format-session-data"
import { typography } from "@/lib/typography"

export type RaceResultRow = EventAnalysisData["races"][number]["results"][number]

const COLUMN_COUNT = 14

export type RaceResultLapDetail = {
  lapNumber: number
  positionOnLap: number
  lapTimeSeconds: number
  lapTimeRaw: string
  paceString: string | null
  elapsedRaceTime: number
}

async function fetchRaceResultLaps(raceResultId: string): Promise<RaceResultLapDetail[]> {
  const res = await fetch(`/api/v1/race-results/${encodeURIComponent(raceResultId)}/laps`)
  if (!res.ok) {
    let message = `Could not load laps (HTTP ${res.status})`
    try {
      const body = await res.json()
      const errMsg = body?.error?.message ?? body?.error?.details ?? body?.message
      if (typeof errMsg === "string" && errMsg.trim().length > 0) {
        message = errMsg
      }
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  const body = (await res.json()) as { success?: boolean; data?: unknown }
  if (!body.success || body.data == null || typeof body.data !== "object") {
    throw new Error("Invalid response when loading laps")
  }
  const data = body.data as {
    laps?: Array<{
      lap_number: number
      position_on_lap: number
      lap_time_seconds: number
      lap_time_raw: string
      pace_string: string | null
      elapsed_race_time: number
    }>
  }
  const laps = data.laps
  if (!Array.isArray(laps)) {
    throw new Error("Invalid response when loading laps")
  }
  return laps.map((lap) => ({
    lapNumber: lap.lap_number,
    positionOnLap: lap.position_on_lap,
    lapTimeSeconds: lap.lap_time_seconds,
    lapTimeRaw: lap.lap_time_raw,
    paceString: lap.pace_string,
    elapsedRaceTime: lap.elapsed_race_time,
  }))
}

function fmtLapSeconds(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—"
  }
  return formatLapTime(value)
}

function fmtQual(n: number | null): string {
  if (n == null || !Number.isFinite(n)) {
    return "—"
  }
  return String(n)
}

export interface FullRaceResultsTableProps {
  rows: RaceResultRow[]
}

export default function FullRaceResultsTable({ rows }: FullRaceResultsTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [lapsByResultId, setLapsByResultId] = useState<Map<string, RaceResultLapDetail[]>>(
    () => new Map()
  )
  const [loadingIds, setLoadingIds] = useState<Set<string>>(() => new Set())
  const [errorsById, setErrorsById] = useState<Map<string, string>>(() => new Map())

  const expandedIdsRef = useRef(expandedIds)
  expandedIdsRef.current = expandedIds

  const lapsCacheRef = useRef<Map<string, RaceResultLapDetail[]>>(new Map())
  const inFlightRef = useRef<Set<string>>(new Set())

  const loadLapsIfNeeded = useCallback(async (raceResultId: string) => {
    if (lapsCacheRef.current.has(raceResultId)) {
      return
    }
    if (inFlightRef.current.has(raceResultId)) {
      return
    }
    inFlightRef.current.add(raceResultId)
    setLoadingIds((prev) => new Set(prev).add(raceResultId))
    setErrorsById((prev) => {
      const next = new Map(prev)
      next.delete(raceResultId)
      return next
    })
    try {
      const laps = await fetchRaceResultLaps(raceResultId)
      lapsCacheRef.current.set(raceResultId, laps)
      setLapsByResultId((prev) => new Map(prev).set(raceResultId, laps))
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load laps"
      setErrorsById((prev) => new Map(prev).set(raceResultId, message))
    } finally {
      inFlightRef.current.delete(raceResultId)
      setLoadingIds((prev) => {
        const next = new Set(prev)
        next.delete(raceResultId)
        return next
      })
    }
  }, [])

  const handleToggle = useCallback(
    (raceResultId: string) => {
      const wasExpanded = expandedIdsRef.current.has(raceResultId)
      setExpandedIds((prev) => {
        const next = new Set(prev)
        if (wasExpanded) {
          next.delete(raceResultId)
        } else {
          next.add(raceResultId)
        }
        return next
      })
      if (!wasExpanded) {
        void loadLapsIfNeeded(raceResultId)
      }
    },
    [loadLapsIfNeeded]
  )

  const retryLoad = useCallback(
    (raceResultId: string) => {
      lapsCacheRef.current.delete(raceResultId)
      setLapsByResultId((prev) => {
        const next = new Map(prev)
        next.delete(raceResultId)
        return next
      })
      setErrorsById((prev) => {
        const next = new Map(prev)
        next.delete(raceResultId)
        return next
      })
      void loadLapsIfNeeded(raceResultId)
    },
    [loadLapsIfNeeded]
  )

  return (
    <div className="min-w-0 w-full overflow-x-auto">
      <StandardTable className="min-w-[1100px]">
        <StandardTableHeader>
          <StandardTableRow className="border-b border-[var(--token-border-default)]">
            <StandardTableCell
              header
              className={`w-10 whitespace-nowrap px-1 py-2 text-left sm:px-2 ${typography.tableHeader}`}
            >
              <span className="sr-only">Expand</span>
            </StandardTableCell>
            <StandardTableCell
              header
              className={`whitespace-nowrap px-2 py-2 text-left sm:px-3 ${typography.tableHeader}`}
            >
              Pos
            </StandardTableCell>
            <StandardTableCell
              header
              className={`whitespace-nowrap px-2 py-2 text-left sm:px-3 ${typography.tableHeader}`}
            >
              Driver
            </StandardTableCell>
            <StandardTableCell
              header
              className={`whitespace-nowrap px-2 py-2 text-left sm:px-3 ${typography.tableHeader}`}
            >
              Qual
            </StandardTableCell>
            <StandardTableCell
              header
              className={`whitespace-nowrap px-2 py-2 text-left sm:px-3 ${typography.tableHeader}`}
            >
              Laps/Time
            </StandardTableCell>
            <StandardTableCell
              header
              className={`whitespace-nowrap px-2 py-2 text-left sm:px-3 ${typography.tableHeader}`}
            >
              Behind
            </StandardTableCell>
            <StandardTableCell
              header
              className={`whitespace-nowrap px-2 py-2 text-left sm:px-3 ${typography.tableHeader}`}
            >
              Fastest Lap
            </StandardTableCell>
            <StandardTableCell
              header
              className={`whitespace-nowrap px-2 py-2 text-left sm:px-3 ${typography.tableHeader}`}
            >
              Avg Lap
            </StandardTableCell>
            <StandardTableCell
              header
              className={`whitespace-nowrap px-2 py-2 text-left sm:px-3 ${typography.tableHeader}`}
            >
              Avg Top 5
            </StandardTableCell>
            <StandardTableCell
              header
              className={`whitespace-nowrap px-2 py-2 text-left sm:px-3 ${typography.tableHeader}`}
            >
              Avg Top 10
            </StandardTableCell>
            <StandardTableCell
              header
              className={`whitespace-nowrap px-2 py-2 text-left sm:px-3 ${typography.tableHeader}`}
            >
              Avg Top 15
            </StandardTableCell>
            <StandardTableCell
              header
              className={`whitespace-nowrap px-2 py-2 text-left sm:px-3 ${typography.tableHeader}`}
            >
              Top 3 Consecutive
            </StandardTableCell>
            <StandardTableCell
              header
              className={`whitespace-nowrap px-2 py-2 text-left sm:px-3 ${typography.tableHeader}`}
            >
              Std. Deviation
            </StandardTableCell>
            <StandardTableCell
              header
              className={`whitespace-nowrap px-2 py-2 text-left sm:px-3 ${typography.tableHeader}`}
            >
              Consistency
            </StandardTableCell>
          </StandardTableRow>
        </StandardTableHeader>
        <tbody>
          {rows.map((r) => {
            const s = r.liveRcStats
            const expanded = expandedIds.has(r.raceResultId)
            const detailId = `mre-lap-detail-${r.raceResultId}`
            const laps = lapsByResultId.get(r.raceResultId) ?? []
            const loading = loadingIds.has(r.raceResultId)
            const err = errorsById.get(r.raceResultId)
            const fastLapNum = r.fastLapLapNumber ?? null

            return (
              <Fragment key={r.raceResultId}>
                <StandardTableRow
                  className="border-b border-[var(--token-border-default)]"
                  onClick={() => handleToggle(r.raceResultId)}
                >
                  <StandardTableCell className="w-10 px-1 py-2 sm:px-2">
                    <button
                      type="button"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--token-text-secondary)] hover:bg-[var(--token-surface-overlay)] hover:text-[var(--token-text-primary)]"
                      aria-expanded={expanded}
                      aria-controls={detailId}
                      aria-label={
                        expanded
                          ? `Hide lap-by-lap detail for ${r.driverName}`
                          : `Show lap-by-lap detail for ${r.driverName}`
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggle(r.raceResultId)
                      }}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                    </button>
                  </StandardTableCell>
                  <StandardTableCell className="px-2 py-2 text-sm tabular-nums text-[var(--token-text-primary)] sm:px-3">
                    {r.positionFinal}
                  </StandardTableCell>
                  <StandardTableCell className="px-2 py-2 text-sm text-[var(--token-text-primary)] sm:px-3">
                    {r.driverName}
                  </StandardTableCell>
                  <StandardTableCell className="px-2 py-2 text-sm tabular-nums text-[var(--token-text-secondary)] sm:px-3">
                    {fmtQual(r.qualifyingPosition)}
                  </StandardTableCell>
                  <StandardTableCell className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-secondary)] sm:px-3">
                    {formatLapsSlashTime(r.lapsCompleted, r.totalTimeSeconds)}
                  </StandardTableCell>
                  <StandardTableCell className="px-2 py-2 text-sm tabular-nums text-[var(--token-text-secondary)] sm:px-3">
                    {formatRaceBehind(r.secondsBehind, r.behindDisplay)}
                  </StandardTableCell>
                  <StandardTableCell className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-secondary)] sm:px-3">
                    {formatLapTime(r.fastLapTime)}
                  </StandardTableCell>
                  <StandardTableCell className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-secondary)] sm:px-3">
                    {formatLapTime(r.avgLapTime)}
                  </StandardTableCell>
                  <StandardTableCell className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-secondary)] sm:px-3">
                    {fmtLapSeconds(s?.avgTop5 ?? null)}
                  </StandardTableCell>
                  <StandardTableCell className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-secondary)] sm:px-3">
                    {fmtLapSeconds(s?.avgTop10 ?? null)}
                  </StandardTableCell>
                  <StandardTableCell className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-secondary)] sm:px-3">
                    {fmtLapSeconds(s?.avgTop15 ?? null)}
                  </StandardTableCell>
                  <StandardTableCell className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-secondary)] sm:px-3">
                    {fmtLapSeconds(s?.top3Consecutive ?? null)}
                  </StandardTableCell>
                  <StandardTableCell className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-secondary)] sm:px-3">
                    {fmtLapSeconds(s?.stdDeviation ?? null)}
                  </StandardTableCell>
                  <StandardTableCell className="whitespace-nowrap px-2 py-2 text-sm tabular-nums text-[var(--token-text-secondary)] sm:px-3">
                    {formatConsistency(r.consistency)}
                  </StandardTableCell>
                </StandardTableRow>
                {expanded ? (
                  <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-base)]">
                    <td
                      colSpan={COLUMN_COUNT}
                      className="px-2 py-3 align-top sm:px-3"
                      id={detailId}
                    >
                      {loading ? (
                        <div className="flex items-center gap-2 text-sm text-[var(--token-text-secondary)]">
                          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                          Loading laps…
                        </div>
                      ) : err ? (
                        <div className="flex flex-col gap-2 text-sm text-[var(--token-text-secondary)]">
                          <span className="text-[var(--token-text-primary)]">{err}</span>
                          <button
                            type="button"
                            className="w-fit text-sm font-medium text-[var(--token-accent)] underline-offset-2 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation()
                              retryLoad(r.raceResultId)
                            }}
                          >
                            Retry
                          </button>
                        </div>
                      ) : (
                        <div className="max-w-full overflow-x-auto">
                          <table className="w-full min-w-[400px] border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-[var(--token-border-default)] text-left text-[var(--token-text-secondary)]">
                                <th className={`px-2 py-2 font-medium ${typography.tableHeader}`}>
                                  Lap
                                </th>
                                <th className={`px-2 py-2 font-medium ${typography.tableHeader}`}>
                                  Lap Time
                                </th>
                                <th className={`px-2 py-2 font-medium ${typography.tableHeader}`}>
                                  Pos
                                </th>
                                <th className={`px-2 py-2 font-medium ${typography.tableHeader}`}>
                                  Elapsed
                                </th>
                                <th className={`px-2 py-2 font-medium ${typography.tableHeader}`}>
                                  Pace
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {laps.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={5}
                                    className="px-2 py-2 text-[var(--token-text-secondary)]"
                                  >
                                    No lap rows stored for this result.
                                  </td>
                                </tr>
                              ) : (
                                laps.map((lap) => {
                                  const isFastLap =
                                    fastLapNum != null && lap.lapNumber === fastLapNum
                                  const rowClass = isFastLap
                                    ? "bg-[var(--token-surface-raised)]"
                                    : ""

                                  return (
                                    <tr
                                      key={lap.lapNumber}
                                      className={`border-b border-[var(--token-border-accent-soft)] ${rowClass}`}
                                    >
                                      <td className="px-2 py-1.5 tabular-nums text-[var(--token-text-primary)]">
                                        {lap.lapNumber}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-1.5 font-mono tabular-nums text-[var(--token-text-primary)]">
                                        {lap.lapTimeRaw || "—"}
                                      </td>
                                      <td className="px-2 py-1.5 tabular-nums text-[var(--token-text-secondary)]">
                                        {lap.positionOnLap}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-[var(--token-text-secondary)]">
                                        {formatLapTime(lap.elapsedRaceTime)}
                                      </td>
                                      <td className="whitespace-nowrap px-2 py-1.5 text-[var(--token-text-secondary)]">
                                        {lap.paceString?.trim() ? lap.paceString : "—"}
                                      </td>
                                    </tr>
                                  )
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </StandardTable>
    </div>
  )
}
