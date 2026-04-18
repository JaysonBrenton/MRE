/**
 * @fileoverview LiveRC qual points: full standings table (Event Analysis) or per-class top
 *             qualifier cards with qualifier-session finishes (Event Overview → Highlights).
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  buildTopQualifierOverviewCards,
  type TopQualifierCardModel,
} from "@/core/events/top-qualifier-overview-cards"
import Modal from "@/components/molecules/Modal"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import { DataTableFrame } from "@/components/organisms/event-analysis/DataPanelSurface"
import {
  OVERVIEW_GLASS_SURFACE_CLASS,
  OVERVIEW_GLASS_SURFACE_STYLE,
} from "@/components/organisms/event-analysis/overview-glass-surface"
import { formatClassName } from "@/lib/format-class-name"
import { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/lib/table-pagination"
import { typography } from "@/lib/typography"
import ListPagination from "./ListPagination"

type QualPayload = EventAnalysisData["qualPointsTopQualifiers"]

export type EventOverviewTopQualifiersProps =
  | { qualPoints: QualPayload; variant?: "table" }
  | { qualPoints: QualPayload; variant: "overviewCards"; races: EventAnalysisData["races"] }

export default function EventOverviewTopQualifiers(props: EventOverviewTopQualifiersProps) {
  if (props.variant === "overviewCards") {
    return <EventOverviewTopQualifiersCards qualPoints={props.qualPoints} races={props.races} />
  }
  return <EventOverviewTopQualifiersTable qualPoints={props.qualPoints} />
}

function EventOverviewTopQualifiersCards({
  qualPoints,
  races,
}: {
  qualPoints: QualPayload
  races: EventAnalysisData["races"]
}) {
  const [detailCard, setDetailCard] = useState<TopQualifierCardModel | null>(null)

  const cards = useMemo(() => {
    if (!qualPoints || (qualPoints.standings?.length ?? 0) === 0) return []
    return buildTopQualifierOverviewCards(qualPoints, races)
  }, [qualPoints, races])

  if (!qualPoints || (qualPoints.standings?.length ?? 0) === 0) {
    return (
      <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
        Qual points standings are not available for this event yet. Re-run ingestion after qual
        results are published, or open the event on LiveRC to view qual standings.
      </p>
    )
  }

  if (cards.length === 0) {
    return (
      <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
        Could not resolve top qualifiers per class from the current data.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className={typography.h6}>Top Qualifiers</h3>
      {qualPoints.label ? (
        <p className={`text-xs text-[var(--token-text-tertiary)] ${typography.bodySecondary}`}>
          {qualPoints.label}
        </p>
      ) : null}

      <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const isOpen = detailCard?.className === card.className
          return (
            <li key={card.className}>
              <button
                type="button"
                className={`flex min-h-0 min-w-0 w-full flex-col gap-3 p-4 text-left transition-colors ${OVERVIEW_GLASS_SURFACE_CLASS} cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)]/75`}
                style={OVERVIEW_GLASS_SURFACE_STYLE}
                onClick={() => setDetailCard(card)}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label={`Open qualifying session list for ${card.driverDisplayName} in ${formatClassName(card.className)}`}
              >
                <div className="min-w-0">
                  <p
                    className={`text-xs font-medium uppercase tracking-wide text-[var(--token-text-tertiary)]`}
                  >
                    {formatClassName(card.className)}
                  </p>
                  <p
                    className={`mt-1 truncate text-base font-semibold text-[var(--token-text-primary)]`}
                  >
                    {card.driverDisplayName}
                  </p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      <Modal
        isOpen={detailCard !== null}
        onClose={() => setDetailCard(null)}
        title={detailCard?.driverDisplayName ?? "Top qualifier"}
        subtitle={
          detailCard
            ? `${formatClassName(detailCard.className)} · ${detailCard.points} qual points`
            : undefined
        }
        maxWidth="md"
        resizable={false}
      >
        {detailCard && detailCard.sessions.length === 0 ? (
          <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
            No qualifying-session rows found for this driver in imported race results.
          </p>
        ) : detailCard ? (
          <ul className="flex list-none flex-col gap-2 p-0">
            {detailCard.sessions.map((s) => (
              <li
                key={`${detailCard.className}-${s.raceId}`}
                className="flex min-w-0 items-baseline justify-between gap-3 text-sm"
              >
                <span className="min-w-0 flex-1 break-words text-[var(--token-text-secondary)]">
                  {s.raceLabel}
                </span>
                <span className="shrink-0 tabular-nums font-medium text-[var(--token-text-primary)]">
                  P{s.positionFinal}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Modal>
    </div>
  )
}

function EventOverviewTopQualifiersTable({ qualPoints }: { qualPoints: QualPayload }) {
  const [classFilter, setClassFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)

  const standings = useMemo(() => qualPoints?.standings ?? [], [qualPoints])

  const classOptions = useMemo(() => {
    const seen = new Set<string>()
    const names: string[] = []
    for (const row of standings) {
      const t = row.className.trim()
      if (!t || seen.has(t)) continue
      seen.add(t)
      names.push(t)
    }
    return names.sort((a, b) => a.localeCompare(b))
  }, [standings])

  /** Ignore stale filter when options change (no setState-in-effect). */
  const resolvedClassFilter = classFilter && classOptions.includes(classFilter) ? classFilter : ""

  const filteredRows = useMemo(() => {
    if (!resolvedClassFilter) return standings
    return standings.filter((q) => q.className.trim() === resolvedClassFilter)
  }, [standings, resolvedClassFilter])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage))
  const effectivePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = (effectivePage - 1) * itemsPerPage
  const paginatedRows = filteredRows.slice(startIndex, startIndex + itemsPerPage)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setCurrentPage(1)
    }, 0)
    return () => window.clearTimeout(id)
  }, [resolvedClassFilter, itemsPerPage, filteredRows.length])

  const handleRowsPerPageChange = (next: number) => {
    setItemsPerPage(next)
    setCurrentPage(1)
  }

  if (!qualPoints || standings.length === 0) {
    return (
      <p className={`text-sm text-[var(--token-text-secondary)] ${typography.body}`}>
        Qual points standings are not available for this event yet. Re-run ingestion after qual
        results are published, or open the event on LiveRC to view qual standings.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className={typography.h6}>Top Qualifiers</h3>

      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="top-qualifiers-class-filter"
          className="text-xs font-medium text-[var(--token-text-secondary)]"
        >
          Class
        </label>
        <select
          id="top-qualifiers-class-filter"
          value={resolvedClassFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
          aria-label="Filter qual points standings by class"
        >
          <option value="">All classes</option>
          {classOptions.map((c) => (
            <option key={c} value={c}>
              {formatClassName(c)}
            </option>
          ))}
        </select>
      </div>

      {filteredRows.length === 0 ? (
        <div className="flex min-h-[8rem] items-center justify-center rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)]/40 text-sm text-[var(--token-text-secondary)]">
          No rows match the selected class.
        </div>
      ) : (
        <>
          <DataTableFrame>
            <StandardTable>
              <StandardTableHeader>
                <tr className="border-b border-[var(--token-border-default)] bg-[var(--token-surface-alt)]">
                  <StandardTableCell header className="min-w-[5.5rem] whitespace-nowrap">
                    Position
                  </StandardTableCell>
                  {resolvedClassFilter ? null : <StandardTableCell header>Class</StandardTableCell>}
                  <StandardTableCell header>Driver</StandardTableCell>
                  <StandardTableCell header className="w-24 whitespace-nowrap text-right">
                    Points
                  </StandardTableCell>
                </tr>
              </StandardTableHeader>
              <tbody>
                {paginatedRows.map((row) => (
                  <StandardTableRow key={`${row.className}-${row.position}-${row.driverId}`}>
                    <StandardTableCell className="tabular-nums text-[var(--token-text-secondary)]">
                      {row.position}
                    </StandardTableCell>
                    {resolvedClassFilter ? null : (
                      <StandardTableCell className="text-[var(--token-text-secondary)]">
                        {formatClassName(row.className)}
                      </StandardTableCell>
                    )}
                    <StandardTableCell className="font-medium text-[var(--token-text-primary)]">
                      {row.driverDisplayName}
                    </StandardTableCell>
                    <StandardTableCell className="tabular-nums text-right text-[var(--token-text-secondary)]">
                      {row.points}
                    </StandardTableCell>
                  </StandardTableRow>
                ))}
              </tbody>
            </StandardTable>
          </DataTableFrame>

          <ListPagination
            embedded
            currentPage={effectivePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={filteredRows.length}
            itemLabel="drivers"
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </>
      )}
    </div>
  )
}
