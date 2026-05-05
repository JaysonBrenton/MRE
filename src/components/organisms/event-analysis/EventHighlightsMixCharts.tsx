/**
 * @fileoverview Event Overview “event mix” — compact summary cards + ranked metric lists
 */

"use client"

import { useMemo, useState } from "react"
import type { SessionMixSegment } from "@/core/events/build-event-highlights"
import { resolveColorToHex } from "@/lib/chart-color-utils"
import {
  EVENT_DETAILS_NESTED_SURFACE_CLASS,
  OVERVIEW_INNER_WELL_SURFACE_CLASS,
} from "@/components/organisms/event-analysis/overview-glass-surface"
import { typography } from "@/lib/typography"
import type { MixInsightMetric } from "@/lib/event-mix-analytics"
import {
  dominantLineForSessionSummary,
  driversWord,
  formatPctOneDecimal,
  lapsWord,
  rankSegmentsDesc,
  safePctPart,
  sessionTypeColorVar,
  sessionsWord,
} from "@/lib/event-mix-analytics"

type MixMetric = MixInsightMetric

const MIX_SUMMARY_CARD_BASE = "flex h-full min-h-0 min-w-0 flex-col rounded-xl p-3 sm:p-3.5"

const MIX_SUMMARY_CARD_SURFACE_DEFAULT =
  "border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/50"

function mixSummaryCardClass(layeredSurfaces: boolean): string {
  return [
    MIX_SUMMARY_CARD_BASE,
    layeredSurfaces ? EVENT_DETAILS_NESTED_SURFACE_CLASS : MIX_SUMMARY_CARD_SURFACE_DEFAULT,
  ].join(" ")
}

const MIX_CHART_PANEL_BASE_LAYOUT = "mt-5 flex min-w-0 flex-col p-3 sm:p-4"

const MIX_CHART_PANEL_STANDALONE =
  "mt-5 flex min-w-0 flex-col rounded-xl border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/45 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:p-4"

function mixChartPanelClass(layeredSurfaces: boolean): string {
  return layeredSurfaces
    ? `${EVENT_DETAILS_NESTED_SURFACE_CLASS} ${MIX_CHART_PANEL_BASE_LAYOUT}`
    : MIX_CHART_PANEL_STANDALONE
}

const MIX_SUMMARY_META_LINE_CLASS =
  "mt-1 text-xs leading-snug tabular-nums text-[var(--token-text-secondary)]"

const METRIC_LABELS: Record<MixMetric, string> = {
  session: "Session mix",
  drivers: "Drivers by class",
  laps: "Laps by class",
}

/** Framing copy for the chart panel only — avoids repeating the summary cards / top table row. */
const MIX_CHART_CAPTION: Record<MixMetric, string> = {
  session:
    "Each row is a session type. Bar length is relative to the busiest type in this list; values show count and share of all event sessions.",
  drivers:
    "Each row is a class. Bar length is relative to the largest class below; values are driver entries and share of all drivers entered.",
  laps: "Each row is a class. Bar length is relative to the class with the most laps; values are lap totals and share of all laps completed.",
}

/** Label · bar · value; fixed-ish label width and right-aligned figures for scanability. */
const MIX_BAR_ROW_GRID =
  "grid min-w-0 grid-cols-1 items-center gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,15rem)_minmax(5rem,1fr)_auto]"

const MIX_CHART_COLUMN_HEADERS =
  "mb-2 hidden min-w-0 gap-x-3 text-[11px] font-medium leading-tight text-[var(--token-text-muted)] sm:grid sm:grid-cols-[minmax(0,15rem)_minmax(5rem,1fr)_auto]"

function metricToggleButtonClass(active: boolean): string {
  return [
    "rounded-lg px-2.5 py-1.5 text-xs transition-[colors,border-color] outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)]",
    active
      ? "border border-[var(--token-border-default)] bg-[var(--token-surface-raised)] text-[var(--token-text-primary)] shadow-sm"
      : "border border-transparent text-[var(--token-text-secondary)] hover:border-[color-mix(in_oklab,var(--token-border-muted)_52%,transparent)] hover:bg-[var(--token-surface-raised)]/60",
  ].join(" ")
}

function displayLabel(seg: SessionMixSegment): string {
  const raw = seg.label?.trim() || seg.key?.trim()
  return raw || "—"
}

function MetricRowSession({ segment, maxCount }: { segment: SessionMixSegment; maxCount: number }) {
  const fillVar = sessionTypeColorVar(segment.key)
  const fill = resolveColorToHex(fillVar, "#8ab4ff")
  const widthPct = maxCount <= 0 ? 0 : safePctPart(segment.count, maxCount)
  const label = displayLabel(segment)

  return (
    <div className={MIX_BAR_ROW_GRID}>
      <div
        className="min-w-0 truncate text-sm font-medium text-[var(--token-text-primary)]"
        title={label}
      >
        {label}
      </div>
      <div
        className="h-2 min-w-0 w-full overflow-hidden rounded-sm bg-[var(--token-surface-raised)]"
        role="presentation"
      >
        <div
          className="h-full rounded-sm transition-[width]"
          style={{
            width: `${Math.min(100, widthPct)}%`,
            minWidth: segment.count > 0 ? "4px" : 0,
            backgroundColor: fill,
          }}
        />
      </div>
      <div className="shrink-0 whitespace-nowrap text-right tabular-nums text-sm font-semibold text-[var(--token-text-primary)] sm:pl-2">
        {sessionsWord(segment.count)}, {formatPctOneDecimal(segment.pct)}
      </div>
    </div>
  )
}

function MetricRowClassRanked({
  segment,
  maxCount,
  index,
  valueUnit,
}: {
  segment: SessionMixSegment
  maxCount: number
  index: number
  valueUnit: "drivers" | "laps"
}) {
  const isTop = index === 0
  const widthPct = maxCount <= 0 ? 0 : safePctPart(segment.count, maxCount)
  const valueLine =
    valueUnit === "drivers"
      ? `${driversWord(segment.count)}, ${formatPctOneDecimal(segment.pct)}`
      : `${lapsWord(segment.count)}, ${formatPctOneDecimal(segment.pct)}`
  const label = displayLabel(segment)

  return (
    <div className={MIX_BAR_ROW_GRID}>
      <div
        className={`min-w-0 truncate text-sm ${isTop ? "font-bold text-[var(--token-text-primary)]" : "font-medium text-[var(--token-text-primary)]"}`}
        title={label}
      >
        {label}
      </div>
      <div
        className="h-2 min-w-0 w-full overflow-hidden rounded-sm bg-[var(--token-surface-raised)]"
        role="presentation"
      >
        <div
          className="h-full rounded-sm bg-[var(--token-accent)]"
          style={{
            width: `${Math.min(100, widthPct)}%`,
            minWidth: segment.count > 0 ? "4px" : 0,
            opacity: isTop ? 1 : 0.42,
          }}
        />
      </div>
      <div className="shrink-0 whitespace-nowrap text-right tabular-nums text-sm font-semibold text-[var(--token-text-primary)] sm:pl-2">
        {valueLine}
      </div>
    </div>
  )
}

function EventMixSummaryCards({
  sessionMix,
  classMixByDrivers,
  classMixByLaps,
  layeredSurfaces = false,
}: {
  sessionMix: SessionMixSegment[]
  classMixByDrivers: SessionMixSegment[]
  classMixByLaps: SessionMixSegment[]
  layeredSurfaces?: boolean
}) {
  const sessionRanked = useMemo(() => rankSegmentsDesc(sessionMix), [sessionMix])
  const driversRanked = useMemo(() => rankSegmentsDesc(classMixByDrivers), [classMixByDrivers])
  const lapsRanked = useMemo(() => rankSegmentsDesc(classMixByLaps), [classMixByLaps])

  const sessionTotal = useMemo(
    () => sessionMix.reduce((s, x) => s + (Number.isFinite(x.count) ? x.count : 0), 0),
    [sessionMix]
  )
  const driverEntryTotal = useMemo(
    () => classMixByDrivers.reduce((s, x) => s + (Number.isFinite(x.count) ? x.count : 0), 0),
    [classMixByDrivers]
  )
  const lapTotal = useMemo(
    () => classMixByLaps.reduce((s, x) => s + (Number.isFinite(x.count) ? x.count : 0), 0),
    [classMixByLaps]
  )

  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article
        className={mixSummaryCardClass(layeredSurfaces)}
        aria-labelledby="event-mix-summary-session-heading"
      >
        <p id="event-mix-summary-session-heading" className={typography.overviewEyebrow}>
          Session mix
        </p>
        {sessionMix.length === 0 || sessionTotal === 0 ? (
          <p className="mt-2 text-sm text-[var(--token-text-secondary)]">No session breakdown.</p>
        ) : (
          <>
            <p className={`mt-2 min-w-0 ${typography.overviewCardDriverName}`}>
              {dominantLineForSessionSummary(sessionMix)}
            </p>
            <p className={MIX_SUMMARY_META_LINE_CLASS}>
              {sessionsWord(sessionRanked[0]!.count)}{" "}
              <span className="text-[var(--token-text-muted)]">·</span>{" "}
              {formatPctOneDecimal(sessionRanked[0]!.pct)} of event sessions
            </p>
            <ul
              className="mt-3 flex-1 space-y-1 border-t border-[var(--token-border-muted)]/60 pt-3 text-xs text-[var(--token-text-secondary)]"
              aria-label="Session type breakdown"
            >
              {sessionRanked.slice(0, 6).map((seg) => (
                <li key={seg.key} className="flex justify-between gap-2 tabular-nums">
                  <span className="min-w-0 truncate font-medium text-[var(--token-text-primary)]">
                    {displayLabel(seg)}
                  </span>
                  <span className="shrink-0">
                    {sessionsWord(seg.count)} · {formatPctOneDecimal(seg.pct)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </article>

      <article
        className={mixSummaryCardClass(layeredSurfaces)}
        aria-labelledby="event-mix-summary-drivers-heading"
      >
        <p id="event-mix-summary-drivers-heading" className={typography.overviewEyebrow}>
          Largest class by drivers
        </p>
        {classMixByDrivers.length === 0 || driverEntryTotal === 0 ? (
          <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
            No drivers entered data.
          </p>
        ) : (
          (() => {
            const top = driversRanked[0]!
            return (
              <>
                <p className={`mt-2 min-w-0 truncate ${typography.overviewCardDriverName}`}>
                  {displayLabel(top)}
                </p>
                <p className={MIX_SUMMARY_META_LINE_CLASS}>
                  {driversWord(top.count)} <span className="text-[var(--token-text-muted)]">·</span>{" "}
                  {formatPctOneDecimal(top.pct)} of drivers entered
                </p>
              </>
            )
          })()
        )}
      </article>

      <article
        className={mixSummaryCardClass(layeredSurfaces)}
        aria-labelledby="event-mix-summary-laps-heading"
      >
        <p id="event-mix-summary-laps-heading" className={typography.overviewEyebrow}>
          Most active class by laps
        </p>
        {classMixByLaps.length === 0 || lapTotal === 0 ? (
          <p className="mt-2 text-sm text-[var(--token-text-secondary)]">No lap totals.</p>
        ) : (
          (() => {
            const top = lapsRanked[0]!
            return (
              <>
                <p className={`mt-2 min-w-0 truncate ${typography.overviewCardDriverName}`}>
                  {displayLabel(top)}
                </p>
                <p className={MIX_SUMMARY_META_LINE_CLASS}>
                  {lapsWord(top.count)} <span className="text-[var(--token-text-muted)]">·</span>{" "}
                  {formatPctOneDecimal(top.pct)} of total laps completed
                </p>
              </>
            )
          })()
        )}
      </article>
    </div>
  )
}

export function EventHighlightsMixFilteredChart({
  sessionMix,
  classMixByDrivers,
  classMixByLaps,
  className = "",
  embeddedInEventDetails = false,
}: {
  sessionMix: SessionMixSegment[]
  classMixByDrivers: SessionMixSegment[]
  classMixByLaps: SessionMixSegment[]
  className?: string
  /** When true, omits the outer well (parent Event details tab panel already provides a floor). */
  embeddedInEventDetails?: boolean
}) {
  const hasSession = sessionMix.length > 0
  const hasDrivers = classMixByDrivers.length > 0
  const hasLaps = classMixByLaps.length > 0

  const [userMetric, setUserMetric] = useState<MixMetric>("session")

  const effectiveMetric: MixMetric | null = useMemo(() => {
    if (userMetric === "session" && hasSession) return "session"
    if (userMetric === "drivers" && hasDrivers) return "drivers"
    if (userMetric === "laps" && hasLaps) return "laps"
    if (hasSession) return "session"
    if (hasDrivers) return "drivers"
    if (hasLaps) return "laps"
    return null
  }, [userMetric, hasSession, hasDrivers, hasLaps])

  const rankedSession = useMemo(() => rankSegmentsDesc(sessionMix), [sessionMix])
  const rankedDrivers = useMemo(() => rankSegmentsDesc(classMixByDrivers), [classMixByDrivers])
  const rankedLaps = useMemo(() => rankSegmentsDesc(classMixByLaps), [classMixByLaps])

  const maxSessionCount = useMemo(
    () => (rankedSession.length === 0 ? 0 : Math.max(...rankedSession.map((s) => s.count))),
    [rankedSession]
  )
  const maxDriversCount = useMemo(
    () => (rankedDrivers.length === 0 ? 0 : Math.max(...rankedDrivers.map((s) => s.count))),
    [rankedDrivers]
  )
  const maxLapsCount = useMemo(
    () => (rankedLaps.length === 0 ? 0 : Math.max(...rankedLaps.map((s) => s.count))),
    [rankedLaps]
  )

  const headerControls = effectiveMetric !== null && (hasSession || hasDrivers || hasLaps) && (
    <div
      className="inline-flex w-full min-w-0 shrink-0 flex-wrap items-center gap-1 rounded-lg border border-[color-mix(in_oklab,var(--token-border-muted)_85%,transparent)] bg-[var(--token-surface)]/50 p-1 sm:w-auto"
      role="radiogroup"
      aria-label="Event mix breakdown"
    >
      {hasSession ? (
        <button
          type="button"
          role="radio"
          aria-checked={effectiveMetric === "session"}
          className={metricToggleButtonClass(effectiveMetric === "session")}
          onClick={() => setUserMetric("session")}
        >
          {METRIC_LABELS.session}
        </button>
      ) : null}
      {hasDrivers ? (
        <button
          type="button"
          role="radio"
          aria-checked={effectiveMetric === "drivers"}
          className={metricToggleButtonClass(effectiveMetric === "drivers")}
          onClick={() => setUserMetric("drivers")}
        >
          {METRIC_LABELS.drivers}
        </button>
      ) : null}
      {hasLaps ? (
        <button
          type="button"
          role="radio"
          aria-checked={effectiveMetric === "laps"}
          className={metricToggleButtonClass(effectiveMetric === "laps")}
          onClick={() => setUserMetric("laps")}
        >
          {METRIC_LABELS.laps}
        </button>
      ) : null}
    </div>
  )

  if (!hasSession && !hasDrivers && !hasLaps) {
    return null
  }

  if (effectiveMetric === null) {
    return null
  }

  return (
    <div
      className={[
        embeddedInEventDetails
          ? "flex min-w-0 w-full flex-col gap-5"
          : `${OVERVIEW_INNER_WELL_SURFACE_CLASS} p-4`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="region"
      aria-label="Event mix analytics"
    >
      <EventMixSummaryCards
        sessionMix={sessionMix}
        classMixByDrivers={classMixByDrivers}
        classMixByLaps={classMixByLaps}
        layeredSurfaces={embeddedInEventDetails}
      />

      <section
        className={mixChartPanelClass(embeddedInEventDetails)}
        aria-label="Event mix breakdown chart"
      >
        <div className="flex min-w-0 flex-col gap-3 border-b border-[var(--token-border-muted)]/70 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          {headerControls}
        </div>

        <p className="mt-3 text-sm leading-snug text-[var(--token-text-secondary)]">
          {MIX_CHART_CAPTION[effectiveMetric]}
        </p>

        <div className="mt-4 min-h-0 max-h-[min(24rem,70vh)] overflow-y-auto overflow-x-hidden pr-1">
          {effectiveMetric === "session" && hasSession ? (
            <>
              <div className={MIX_CHART_COLUMN_HEADERS}>
                <span>Type</span>
                <span className="min-w-0">Share</span>
                <span className="text-right">Sessions · %</span>
              </div>
              <div className="flex min-w-0 flex-col gap-2.5" role="list">
                {rankedSession.map((seg) => (
                  <div key={seg.key} role="listitem">
                    <MetricRowSession segment={seg} maxCount={maxSessionCount} />
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {effectiveMetric === "drivers" && hasDrivers ? (
            <>
              <div className={MIX_CHART_COLUMN_HEADERS}>
                <span>Class</span>
                <span className="min-w-0">Share</span>
                <span className="text-right">Drivers · %</span>
              </div>
              <div className="flex min-w-0 flex-col gap-2.5" role="list">
                {rankedDrivers.map((seg, index) => (
                  <div key={seg.key} role="listitem">
                    <MetricRowClassRanked
                      segment={seg}
                      maxCount={maxDriversCount}
                      index={index}
                      valueUnit="drivers"
                    />
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {effectiveMetric === "laps" && hasLaps ? (
            <>
              <div className={MIX_CHART_COLUMN_HEADERS}>
                <span>Class</span>
                <span className="min-w-0">Share</span>
                <span className="text-right">Laps · %</span>
              </div>
              <div className="flex min-w-0 flex-col gap-2.5" role="list">
                {rankedLaps.map((seg, index) => (
                  <div key={seg.key} role="listitem">
                    <MetricRowClassRanked
                      segment={seg}
                      maxCount={maxLapsCount}
                      index={index}
                      valueUnit="laps"
                    />
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  )
}

/**
 * Legacy export — session breakdown as ranked rows (semantic bar colours).
 */
export function SessionMixStackChart({ segments }: { segments: SessionMixSegment[] }) {
  if (segments.length === 0) return null
  const ranked = rankSegmentsDesc(segments)
  const maxCount = ranked.length === 0 ? 0 : Math.max(...ranked.map((s) => s.count))
  return (
    <div className="space-y-3" role="list">
      {ranked.map((seg) => (
        <div key={seg.key} role="listitem">
          <MetricRowSession segment={seg} maxCount={maxCount} />
        </div>
      ))}
    </div>
  )
}

/**
 * Legacy export — ranked class rows with neutral/top emphasis styling.
 */
export function ClassMixHorizontalBarChart({
  segments,
  valueCaption: _valueCaption,
}: {
  segments: SessionMixSegment[]
  valueCaption: string
}) {
  if (segments.length === 0) return null
  const ranked = rankSegmentsDesc(segments)
  const maxCount = ranked.length === 0 ? 0 : Math.max(...ranked.map((s) => s.count))
  const unit = _valueCaption.toLowerCase().includes("lap") ? "laps" : "drivers"

  return (
    <div className="space-y-3" role="list">
      {ranked.map((seg, index) => (
        <div key={seg.key} role="listitem">
          <MetricRowClassRanked segment={seg} maxCount={maxCount} index={index} valueUnit={unit} />
        </div>
      ))}
    </div>
  )
}
