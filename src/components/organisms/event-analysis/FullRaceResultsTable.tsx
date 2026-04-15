/**
 * @fileoverview Full per-driver race results row (LiveRC-style columns)
 *
 * Used by main-bracket and session modals for a consistent wide results grid.
 */

"use client"

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
  return (
    <div className="min-w-0 w-full overflow-x-auto">
      <StandardTable className="min-w-[1100px]">
        <StandardTableHeader>
          <StandardTableRow className="border-b border-[var(--token-border-default)]">
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
            return (
              <StandardTableRow key={r.raceResultId}>
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
            )
          })}
        </tbody>
      </StandardTable>
    </div>
  )
}
