/**
 * @fileoverview Event Highlights — compact narrative + visuals for Event Overview
 */

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Trophy,
  Activity,
  Users,
  TrendingUp,
  ArrowUpCircle,
  CalendarClock,
  Timer,
  ListOrdered,
  CircleDot,
  Zap,
} from "lucide-react"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { buildEventHighlights, formatClosestFinishGap } from "@/core/events/build-event-highlights"
import { EventHighlightsMixFilteredChart } from "./EventHighlightsMixCharts"
import { formatDateLong, formatTimeDisplay } from "@/lib/date-utils"
import { formatLapTime } from "@/lib/format-session-data"

export interface EventHighlightsSectionProps {
  data: EventAnalysisData
}

function accentCardClass(extra = ""): string {
  return `rounded-xl border border-[var(--token-border-default)] bg-gradient-to-br from-[var(--token-accent)]/[0.08] to-transparent px-3 py-2.5 shadow-sm ${extra}`
}

const eventHighlightsContentId = "event-highlights-section-content"

type ClassWinnerCard = {
  classDisplay: string
  winnerName: string
  raceLabel: string
}

function ClassHighlightsScrollRow({ items }: { items: ClassWinnerCard[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startScroll: number
  } | null>(null)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [dragging, setDragging] = useState(false)

  const updateScrollAffordance = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollWidth, clientWidth } = el
    setHasOverflow(scrollWidth > clientWidth + 2)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    updateScrollAffordance()
    const ro = new ResizeObserver(() => updateScrollAffordance())
    ro.observe(el)

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return
      const dominantHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY)
      if (dominantHorizontal && e.deltaX !== 0) {
        e.preventDefault()
        el.scrollLeft += e.deltaX
        updateScrollAffordance()
        return
      }
      if (!dominantHorizontal && e.deltaY !== 0) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
        updateScrollAffordance()
      }
    }

    el.addEventListener("wheel", onWheel, { passive: false })
    el.addEventListener("scroll", updateScrollAffordance, { passive: true })
    return () => {
      ro.disconnect()
      el.removeEventListener("wheel", onWheel)
      el.removeEventListener("scroll", updateScrollAffordance)
    }
  }, [items.length, updateScrollAffordance])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    if (e.pointerType === "touch") return
    if (e.button !== 0) return
    el.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startScroll: el.scrollLeft,
    }
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    const el = scrollRef.current
    if (!d || !el || e.pointerId !== d.pointerId) return
    const dx = e.clientX - d.startX
    el.scrollLeft = d.startScroll - dx
  }

  const endPointerDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    const el = scrollRef.current
    if (!d || e.pointerId !== d.pointerId) return
    dragRef.current = null
    setDragging(false)
    if (el) {
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }
  }

  return (
    <div>
      <div className="min-w-0 max-w-full overflow-x-hidden">
        <div
          ref={scrollRef}
          className={`scrollbar-none flex flex-nowrap gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1 touch-pan-x ${
            hasOverflow ? "cursor-grab" : ""
          } ${dragging ? "cursor-grabbing select-none" : ""}`}
          style={hasOverflow ? { touchAction: "pan-x" } : undefined}
          role="list"
          aria-label="Session highlight — click and drag to scroll sideways"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointerDrag}
          onPointerCancel={endPointerDrag}
        >
          {items.map((cw, i) => (
            <div
              key={`${cw.classDisplay}-${i}`}
              role="listitem"
              className="min-w-[10.5rem] shrink-0 rounded-xl border border-[var(--token-border-muted)] bg-[var(--token-surface-raised)]/80 px-3 py-2"
            >
              <p className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                {cw.classDisplay}
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--token-text-primary)]">
                {cw.winnerName}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[0.65rem] text-[var(--token-text-muted)]">
                {cw.raceLabel}
              </p>
            </div>
          ))}
        </div>
      </div>
      {hasOverflow ? (
        <p className="mt-1.5 text-[0.65rem] text-[var(--token-text-muted)]">
          Click and drag on the cards to scroll. You can also use the mouse wheel or a horizontal
          trackpad swipe over this row.
        </p>
      ) : null}
    </div>
  )
}

export default function EventHighlightsSection({ data }: EventHighlightsSectionProps) {
  const [isOpen, setIsOpen] = useState(true)

  const model = useMemo(
    () =>
      buildEventHighlights(data, {
        formatTimeDisplay: (d) => formatTimeDisplay(d),
        formatDateLong: (d) => formatDateLong(d),
      }),
    [data]
  )

  if (!model.hasHighlights) {
    return null
  }

  return (
    <div className="min-w-0 w-full max-w-full shrink-0 basis-full border-t border-[var(--token-border-muted)] pt-3">
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left text-xs font-medium text-[var(--token-text-muted)] transition-colors hover:text-[var(--token-text-secondary)]"
        aria-expanded={isOpen}
        aria-controls={eventHighlightsContentId}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>Event highlights</span>
        <span
          className={`shrink-0 transition-transform duration-150 ${isOpen ? "rotate-0" : "-rotate-90"}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {isOpen && (
        <div id={eventHighlightsContentId} className="mt-3 min-w-0 w-full max-w-full space-y-4">
          <EventHighlightsMixFilteredChart
            sessionMix={model.sessionMix}
            classMixByDrivers={model.classMixByDrivers}
            classMixByLaps={model.classMixByLaps}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {model.deepestClass && (
              <div className={accentCardClass()}>
                <div className="mb-1 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--token-chart-series-2)]">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  Deepest class
                </div>
                <p className="text-sm font-semibold text-[var(--token-text-primary)]">
                  {model.deepestClass.displayName}
                </p>
                <p className="mt-0.5 text-xs text-[var(--token-text-secondary)]">
                  {model.deepestClass.entryCount} entries
                </p>
              </div>
            )}

            {model.mostConsistentDriver && (
              <div className={accentCardClass()}>
                <div className="mb-1 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--token-chart-series-3)]">
                  <Activity className="h-3.5 w-3.5" aria-hidden />
                  Most consistent
                </div>
                <p className="font-mono text-lg font-bold tabular-nums text-[var(--token-text-primary)]">
                  {model.mostConsistentDriver.consistency.toFixed(1)}%
                </p>
                <p className="mt-0.5 text-xs text-[var(--token-text-secondary)]">
                  {model.mostConsistentDriver.driverName}
                </p>
                <p className="text-[0.65rem] text-[var(--token-text-muted)]">
                  Event-wide average across {model.mostConsistentDriver.racesParticipated} session
                  {model.mostConsistentDriver.racesParticipated === 1 ? "" : "s"}
                </p>
              </div>
            )}

            {model.fastestAvgLapDriver && (
              <div className={accentCardClass()}>
                <div className="mb-1 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--token-chart-series-8)]">
                  <Timer className="h-3.5 w-3.5" aria-hidden />
                  Fastest average lap
                </div>
                <p className="font-mono text-lg font-bold tabular-nums text-[var(--token-text-primary)]">
                  {formatLapTime(model.fastestAvgLapDriver.avgLapTime)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--token-text-secondary)]">
                  {model.fastestAvgLapDriver.driverName}
                </p>
                <p className="text-[0.65rem] text-[var(--token-text-muted)]">
                  Event-wide average across {model.fastestAvgLapDriver.racesParticipated} session
                  {model.fastestAvgLapDriver.racesParticipated === 1 ? "" : "s"}
                </p>
              </div>
            )}
          </div>

          {model.topLapsCompleted.length > 0 && (
            <div className="min-w-0 w-full max-w-full">
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--token-text-muted)]">
                <ListOrdered
                  className="h-3.5 w-3.5 text-[var(--token-chart-series-9)]"
                  aria-hidden
                />
                Laps completed
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {model.topLapsCompleted.map((row, index) => {
                  const rankLabel = index === 0 ? "1st" : index === 1 ? "2nd" : "3rd"
                  const rankColorClass =
                    index === 0
                      ? "text-[var(--token-chart-series-6)]"
                      : index === 1
                        ? "text-[var(--token-chart-series-5)]"
                        : "text-[var(--token-chart-series-4)]"
                  return (
                    <div
                      key={`${row.driverName}-${row.totalLaps}-${index}`}
                      className={accentCardClass()}
                    >
                      <div
                        className={`mb-1 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide ${rankColorClass}`}
                      >
                        <CircleDot className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {rankLabel}
                      </div>
                      <p className="font-mono text-lg font-bold tabular-nums text-[var(--token-text-primary)]">
                        {row.totalLaps.toLocaleString()}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--token-text-primary)]">
                        {row.driverName}
                      </p>
                      <p className="mt-1 text-[0.65rem] text-[var(--token-text-muted)]">
                        Total laps completed (event)
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {model.topFastLaps.length > 0 && (
            <div className="min-w-0 w-full max-w-full">
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--token-text-muted)]">
                <Zap className="h-3.5 w-3.5 text-[var(--token-chart-series-8)]" aria-hidden />
                Best laps
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {model.topFastLaps.map((row, index) => {
                  const rankLabel = index === 0 ? "1st" : index === 1 ? "2nd" : "3rd"
                  const rankColorClass =
                    index === 0
                      ? "text-[var(--token-chart-series-6)]"
                      : index === 1
                        ? "text-[var(--token-chart-series-5)]"
                        : "text-[var(--token-chart-series-4)]"
                  return (
                    <div key={row.raceResultId} className={accentCardClass()}>
                      <div
                        className={`mb-1 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide ${rankColorClass}`}
                      >
                        <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {rankLabel}
                      </div>
                      <p className="font-mono text-lg font-bold tabular-nums text-[var(--token-text-primary)]">
                        {formatLapTime(row.fastLapTime)}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-[var(--token-text-primary)]">
                        {row.driverName}
                      </p>
                      <p className="mt-1 text-[0.65rem] text-[var(--token-text-muted)]">
                        {row.raceLabel} · {row.classDisplay}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {model.classWinners.length > 0 && (
            <div className="min-w-0 w-full max-w-full">
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--token-text-muted)]">
                <Trophy className="h-3.5 w-3.5 text-[var(--token-chart-series-4)]" aria-hidden />
                Session highlight
              </h4>
              <ClassHighlightsScrollRow items={model.classWinners} />
            </div>
          )}

          {model.topProgression.length > 0 && (
            <div className="min-w-0 w-full max-w-full">
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--token-text-muted)]">
                <ArrowUpCircle
                  className="h-3.5 w-3.5 text-[var(--token-chart-series-6)]"
                  aria-hidden
                />
                Biggest movers
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {model.topProgression.map((p, index) => {
                  const rankLabel = index === 0 ? "1st" : index === 1 ? "2nd" : "3rd"
                  const rankColorClass =
                    index === 0
                      ? "text-[var(--token-chart-series-6)]"
                      : index === 1
                        ? "text-[var(--token-chart-series-5)]"
                        : "text-[var(--token-chart-series-4)]"
                  return (
                    <div
                      key={`${p.driverName}-${p.classDisplay}-${index}`}
                      className={accentCardClass()}
                    >
                      <div
                        className={`mb-1 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-wide ${rankColorClass}`}
                      >
                        <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {rankLabel}
                      </div>
                      <p className="text-sm font-semibold text-[var(--token-text-primary)]">
                        {p.driverName}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--token-text-secondary)]">
                        {p.classDisplay}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-[var(--token-text-muted)]">
                        {p.summary}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {model.closestFinishes.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--token-text-muted)]">
                Closest finishes (by gap on total time)
              </h4>
              <ul className="space-y-2">
                {model.closestFinishes.map((h, idx) => (
                  <li
                    key={`${h.raceLabel}-${idx}`}
                    className="flex flex-col gap-1 rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--token-text-primary)]">
                        {h.p1Name}
                        <span className="text-[var(--token-text-muted)]"> vs </span>
                        {h.p2Name}
                      </p>
                      <p className="truncate text-[0.7rem] text-[var(--token-text-muted)]">
                        {h.classDisplay} · {h.raceLabel}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-md bg-[var(--token-status-warning-bg)] px-2 py-1 text-center">
                      <span className="text-xs font-bold tabular-nums text-[var(--token-status-warning-text)]">
                        {formatClosestFinishGap(h)} gap
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {model.dayTimeline.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--token-text-muted)]">
                <CalendarClock
                  className="h-3.5 w-3.5 text-[var(--token-chart-series-7)]"
                  aria-hidden
                />
                Multi-day timeline
              </h4>
              <ul className="space-y-3 border-l-2 border-[var(--token-border-default)] pl-4">
                {model.dayTimeline.map((row) => (
                  <li key={row.dateLabel} className="relative -ml-px">
                    <span
                      className="absolute -left-[calc(0.25rem+5px)] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--token-surface)] bg-[var(--token-chart-series-7)]"
                      aria-hidden
                    />
                    <p className="text-sm font-medium text-[var(--token-text-primary)]">
                      {row.dateLabel}
                    </p>
                    <p className="text-xs text-[var(--token-text-secondary)]">
                      {row.raceCount} session{row.raceCount === 1 ? "" : "s"} · {row.timeRange}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
