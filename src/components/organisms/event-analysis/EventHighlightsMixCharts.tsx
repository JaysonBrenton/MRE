/**
 * @fileoverview Event Overview “event mix” — compact summary cards + ranked metric lists
 */

"use client"

import { useMemo, useState } from "react"
import type { SessionMixSegment } from "@/core/events/build-event-highlights"
import { resolveColorToHex } from "@/lib/chart-color-utils"
import { OVERVIEW_INNER_WELL_SURFACE_CLASS } from "@/components/organisms/event-analysis/overview-glass-surface"
import type { MixInsightMetric } from "@/lib/event-mix-analytics"
import {
  dominantLineForSessionSummary,
  driversWord,
  formatPctOneDecimal,
  insightForMetric,
  lapsWord,
  rankSegmentsDesc,
  safePctPart,
  sessionTypeColorVar,
  sessionsWord,
} from "@/lib/event-mix-analytics"

type MixMetric = MixInsightMetric

const METRIC_LABELS: Record<MixMetric, string> = {
  session: "Session mix",
  drivers: "Drivers by class",
  laps: "Laps by class",
}

function metricToggleButtonClass(active: boolean): string {
  return [
    "rounded-lg px-2.5 py-1.5 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--token-surface)]",
    active
      ? "bg-[var(--token-surface-raised)] text-[var(--token-text-primary)] border border-[var(--token-border-default)] shadow-sm"
      : "border border-transparent text-[var(--token-text-secondary)] hover:bg-[var(--token-surface-raised)]/60",
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

  return (
    <div className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(140px,1.2fr)_auto] sm:items-center sm:gap-3">
      <div className="min-w-0 truncate text-sm font-medium text-[var(--token-text-primary)]">
        {displayLabel(segment)}
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-sm bg-[var(--token-surface-raised)]"
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
      <div className="tabular-nums text-sm font-semibold text-[var(--token-text-primary)]">
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

  return (
    <div className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(140px,1.2fr)_auto] sm:items-center sm:gap-3">
      <div
        className={`min-w-0 truncate text-sm ${isTop ? "font-bold text-[var(--token-text-primary)]" : "font-medium text-[var(--token-text-primary)]"}`}
      >
        {displayLabel(segment)}
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-sm bg-[var(--token-surface-raised)]"
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
      <div className="tabular-nums text-sm font-semibold text-[var(--token-text-primary)]">
        {valueLine}
      </div>
    </div>
  )
}

function EventMixSummaryCards({
  sessionMix,
  classMixByDrivers,
  classMixByLaps,
}: {
  sessionMix: SessionMixSegment[]
  classMixByDrivers: SessionMixSegment[]
  classMixByLaps: SessionMixSegment[]
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
    <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
      <article
        className="rounded-xl border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/50 px-3 py-2.5"
        aria-labelledby="event-mix-summary-session-heading"
      >
        <h3
          id="event-mix-summary-session-heading"
          className="text-[11px] font-semibold leading-snug text-[var(--token-text-muted)]"
        >
          Session mix
        </h3>
        {sessionMix.length === 0 || sessionTotal === 0 ? (
          <p className="mt-1 text-sm text-[var(--token-text-secondary)]">No session breakdown.</p>
        ) : (
          <>
            <p className="mt-1 text-sm font-semibold text-[var(--token-text-primary)]">
              {dominantLineForSessionSummary(sessionMix)}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-[var(--token-text-secondary)]">
              {sessionRanked.slice(0, 6).map((seg) => (
                <li key={seg.key} className="flex justify-between gap-2 tabular-nums">
                  <span className="min-w-0 truncate font-medium">{displayLabel(seg)}</span>
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
        className="rounded-xl border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/50 px-3 py-2.5"
        aria-labelledby="event-mix-summary-drivers-heading"
      >
        <h3
          id="event-mix-summary-drivers-heading"
          className="text-[11px] font-semibold leading-snug text-[var(--token-text-muted)]"
        >
          Largest class by drivers
        </h3>
        {classMixByDrivers.length === 0 || driverEntryTotal === 0 ? (
          <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
            No drivers entered data.
          </p>
        ) : (
          (() => {
            const top = driversRanked[0]!
            return (
              <>
                <p className="mt-1 truncate text-base font-bold text-[var(--token-text-primary)]">
                  {displayLabel(top)}
                </p>
                <p className="mt-1 text-xs leading-snug text-[var(--token-text-secondary)]">
                  {driversWord(top.count)} <span className="text-[var(--token-text-muted)]">·</span>{" "}
                  {formatPctOneDecimal(top.pct)} of drivers entered
                </p>
              </>
            )
          })()
        )}
      </article>

      <article
        className="rounded-xl border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/50 px-3 py-2.5"
        aria-labelledby="event-mix-summary-laps-heading"
      >
        <h3
          id="event-mix-summary-laps-heading"
          className="text-[11px] font-semibold leading-snug text-[var(--token-text-muted)]"
        >
          Most active class by laps
        </h3>
        {classMixByLaps.length === 0 || lapTotal === 0 ? (
          <p className="mt-1 text-sm text-[var(--token-text-secondary)]">No lap totals.</p>
        ) : (
          (() => {
            const top = lapsRanked[0]!
            return (
              <>
                <p className="mt-1 truncate text-base font-bold text-[var(--token-text-primary)]">
                  {displayLabel(top)}
                </p>
                <p className="mt-1 text-xs leading-snug text-[var(--token-text-secondary)]">
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
}: {
  sessionMix: SessionMixSegment[]
  classMixByDrivers: SessionMixSegment[]
  classMixByLaps: SessionMixSegment[]
  className?: string
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

  const insight =
    effectiveMetric != null
      ? insightForMetric(effectiveMetric, sessionMix, classMixByDrivers, classMixByLaps)
      : ""

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
      className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-[var(--token-border-muted)] bg-[var(--token-surface)]/30 p-1"
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
      className={`${OVERVIEW_INNER_WELL_SURFACE_CLASS} p-4 ${className}`}
      role="region"
      aria-label="Event mix analytics"
    >
      <EventMixSummaryCards
        sessionMix={sessionMix}
        classMixByDrivers={classMixByDrivers}
        classMixByLaps={classMixByLaps}
      />

      <div className="flex justify-start">{headerControls}</div>

      <p className="mt-3 text-sm leading-snug text-[var(--token-text-secondary)]">{insight}</p>

      <div className="mt-4 max-h-[min(24rem,70vh)] space-y-3 overflow-y-auto pr-1">
        {effectiveMetric === "session" && hasSession ? (
          <>
            <p className="text-[11px] font-medium text-[var(--token-text-muted)]">Session types</p>
            {rankedSession.map((seg) => (
              <MetricRowSession key={seg.key} segment={seg} maxCount={maxSessionCount} />
            ))}
          </>
        ) : null}
        {effectiveMetric === "drivers" && hasDrivers ? (
          <>
            <p className="text-[11px] font-medium text-[var(--token-text-muted)]">
              Drivers entered by class
            </p>
            {rankedDrivers.map((seg, index) => (
              <MetricRowClassRanked
                key={seg.key}
                segment={seg}
                maxCount={maxDriversCount}
                index={index}
                valueUnit="drivers"
              />
            ))}
          </>
        ) : null}
        {effectiveMetric === "laps" && hasLaps ? (
          <>
            <p className="text-[11px] font-medium text-[var(--token-text-muted)]">
              Total laps completed by class
            </p>
            {rankedLaps.map((seg, index) => (
              <MetricRowClassRanked
                key={seg.key}
                segment={seg}
                maxCount={maxLapsCount}
                index={index}
                valueUnit="laps"
              />
            ))}
          </>
        ) : null}
      </div>
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
