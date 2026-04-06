/**
 * @fileoverview Event Overview “mix” highlights — single ChartContainer with metric filter
 */

"use client"

import { Fragment, useId, useMemo, useState } from "react"
import { Group } from "@visx/group"
import { GridColumns } from "@visx/grid"
import { scaleBand, scaleLinear } from "@visx/scale"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { ParentSize } from "@visx/responsive"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import ChartContainer from "./ChartContainer"
import type { SessionMixSegment } from "@/core/events/build-event-highlights"
import { resolveColorToHex } from "@/lib/chart-color-utils"

const textColor = "var(--token-text-primary)"
const borderColor = "var(--token-border-default)"
const axisColor = "var(--token-text-secondary)"
const textMutedColor = "var(--token-text-muted)"
const gridStroke = "var(--token-border-muted)"

const SESSION_MARGIN = { top: 16, right: 20, bottom: 44, left: 20 }
const SESSION_BAR_HEIGHT = 44
const SESSION_SVG_HEIGHT = 168

const CLASS_MARGIN = { top: 12, right: 16, bottom: 52, left: 12 }
const ROW_STEP = 26

type MixMetric = "session" | "drivers" | "laps"

function truncateLabel(s: string, max = 24): string {
  const raw = s.trim()
  if (!raw) return "—"
  if (raw.length <= max) return raw
  return `${raw.slice(0, Math.max(0, max - 1))}…`
}

/** Visx `@visx/text` renders empty `<tspan>`s when given `""`, which looks broken — never return empty. */
function formatAxisCount(n: number): string {
  if (!Number.isFinite(n)) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${Math.round(n)}`
}

function SessionMixStackSvg({
  width,
  segments,
  clipId,
  onSegmentHover,
  hideTooltip,
}: {
  width: number
  segments: SessionMixSegment[]
  clipId: string
  onSegmentHover: (seg: SessionMixSegment, event: React.MouseEvent | React.TouchEvent) => void
  hideTooltip: () => void
}) {
  const innerWidth = width - SESSION_MARGIN.left - SESSION_MARGIN.right
  const pctScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, 100],
        range: [0, innerWidth],
      }),
    [innerWidth]
  )

  const barY = 8
  const axisTop = barY + SESSION_BAR_HEIGHT + 12

  const stackedLayout = useMemo(() => {
    return segments.reduce<Array<{ seg: SessionMixSegment; x: number; w: number }>>((rows, seg) => {
      const segW = Math.max((seg.pct / 100) * innerWidth, seg.pct > 0 ? 2 : 0)
      const prev = rows[rows.length - 1]
      const x = prev ? prev.x + prev.w : 0
      rows.push({ seg, x, w: segW })
      return rows
    }, [])
  }, [segments, innerWidth])

  const rects = stackedLayout.map(({ seg, x, w: segW }) => {
    const fill = resolveColorToHex(seg.colorVar, "#5aa2ff")
    return (
      <rect
        key={seg.key}
        x={x}
        y={barY}
        width={segW}
        height={SESSION_BAR_HEIGHT}
        fill={fill}
        style={{ cursor: "default" }}
        onMouseMove={(e) => onSegmentHover(seg, e)}
        onMouseLeave={() => hideTooltip()}
      />
    )
  })

  return (
    <svg width={width} height={SESSION_SVG_HEIGHT} role="presentation">
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={innerWidth} height={SESSION_BAR_HEIGHT} rx={10} ry={10} />
        </clipPath>
      </defs>
      <Group left={SESSION_MARGIN.left} top={SESSION_MARGIN.top}>
        <GridColumns
          top={0}
          left={0}
          scale={pctScale}
          height={axisTop + 22}
          tickValues={[0, 25, 50, 75, 100]}
          stroke={gridStroke}
          strokeWidth={1}
          strokeOpacity={0.45}
          pointerEvents="none"
        />
        <Group clipPath={`url(#${clipId})`}>{rects}</Group>
        <AxisBottom
          top={axisTop}
          scale={pctScale}
          tickValues={[0, 25, 50, 75, 100]}
          tickFormat={(v) => `${v}%`}
          stroke={axisColor}
          strokeWidth={1}
          tickStroke={axisColor}
          tickLength={5}
          tickLabelProps={() => ({
            fill: axisColor,
            fontSize: 11,
            textAnchor: "middle",
            fontFamily: "inherit",
            style: { fontVariantNumeric: "tabular-nums" },
          })}
        />
      </Group>
    </svg>
  )
}

function SessionMixStackBody({
  segments,
  clipId,
  onSegmentHover,
  hideTooltip,
  tooltipOpen,
  tooltipData,
  tooltipLeft,
  tooltipTop,
}: {
  segments: SessionMixSegment[]
  clipId: string
  onSegmentHover: (seg: SessionMixSegment, event: React.MouseEvent | React.TouchEvent) => void
  hideTooltip: () => void
  tooltipOpen: boolean
  tooltipData: SessionMixSegment | undefined
  tooltipLeft: number | undefined
  tooltipTop: number | undefined
}) {
  return (
    <div className="relative w-full" style={{ minHeight: SESSION_SVG_HEIGHT + 100 }}>
      <ParentSize>
        {({ width: parentWidth }) => {
          const width = parentWidth || 800
          if (width === 0) return null
          return (
            <SessionMixStackSvg
              width={width}
              segments={segments}
              clipId={clipId}
              onSegmentHover={onSegmentHover}
              hideTooltip={hideTooltip}
            />
          )
        }}
      </ParentSize>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: "var(--token-surface-elevated)",
            border: `1px solid ${borderColor}`,
            color: textColor,
            padding: "8px 12px",
            borderRadius: "6px",
          }}
        >
          <div className="font-semibold">{tooltipData.label}</div>
          <div className="text-sm text-[var(--token-text-secondary)]">
            {tooltipData.count} session{tooltipData.count === 1 ? "" : "s"} ·{" "}
            {tooltipData.pct.toFixed(1)}%
          </div>
        </TooltipWithBounds>
      )}

      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
        {segments.map((seg) => (
          <li key={seg.key} className="flex min-w-0 items-center gap-2 text-sm">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ background: resolveColorToHex(seg.colorVar, "#5aa2ff") }}
            />
            <span className="min-w-0 truncate font-medium text-[var(--token-text-primary)]">
              {seg.label}
            </span>
            <span className="shrink-0 tabular-nums text-[var(--token-text-muted)]">
              {seg.count} ({seg.pct.toFixed(0)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ClassMixBarsSvg({
  width,
  segments,
  keys,
  maxCount,
  chartBodyHeight,
  labelColumnWidth,
  valueCaption,
  onBarHover,
  hideTooltip,
}: {
  width: number
  segments: SessionMixSegment[]
  keys: string[]
  maxCount: number
  chartBodyHeight: number
  labelColumnWidth: number
  valueCaption: string
  onBarHover: (seg: SessionMixSegment, event: React.MouseEvent | React.TouchEvent) => void
  hideTooltip: () => void
}) {
  const margin = {
    ...CLASS_MARGIN,
    left: 12 + labelColumnWidth,
  }

  const innerWidth = width - margin.left - margin.right
  const innerHeight = chartBodyHeight - margin.top - margin.bottom

  const labelMaxChars = Math.min(52, Math.max(20, Math.floor(labelColumnWidth / 5.5)))

  const yScale = useMemo(
    () =>
      scaleBand<string>({
        domain: keys,
        range: [0, innerHeight],
        padding: 0.12,
      }),
    [keys, innerHeight]
  )

  const xScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, maxCount],
        range: [0, innerWidth],
        nice: true,
      }),
    [innerWidth, maxCount]
  )

  return (
    <Fragment>
      <svg width={width} height={chartBodyHeight} role="presentation">
        <Group left={margin.left} top={margin.top}>
          <GridColumns
            top={0}
            left={0}
            scale={xScale}
            height={innerHeight}
            numTicks={6}
            stroke={gridStroke}
            strokeWidth={1}
            strokeOpacity={0.4}
            pointerEvents="none"
          />
          {segments.map((seg) => {
            const y = yScale(seg.key)
            if (y == null) return null
            const h = yScale.bandwidth()
            const barW = Math.max(xScale(seg.count), seg.count > 0 ? 2 : 0)
            const fill = resolveColorToHex(seg.colorVar, "#5aa2ff")
            return (
              <rect
                key={seg.key}
                x={0}
                y={y}
                width={barW}
                height={h}
                rx={3}
                ry={3}
                fill={fill}
                style={{ cursor: "default" }}
                onMouseMove={(e) => onBarHover(seg, e)}
                onMouseLeave={() => hideTooltip()}
              />
            )
          })}

          <AxisLeft
            left={-labelColumnWidth}
            scale={yScale}
            tickFormat={(k) => {
              const raw = segments.find((s) => s.key === k)?.label ?? `${k}`
              const t = truncateLabel(raw, labelMaxChars)
              return t || "—"
            }}
            stroke={axisColor}
            strokeWidth={1}
            tickStroke={axisColor}
            tickLength={5}
            tickLineProps={{ strokeOpacity: 0.65 }}
            tickLabelProps={() => ({
              fill: textMutedColor,
              fontSize: 12,
              textAnchor: "end",
              dx: -8,
              dy: "0.25em",
              fontFamily: "inherit",
            })}
          />

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            numTicks={6}
            tickFormat={(v) => {
              const s = formatAxisCount(Number(v))
              return s || "—"
            }}
            stroke={axisColor}
            strokeWidth={1}
            tickStroke={axisColor}
            tickLength={5}
            tickLineProps={{ strokeOpacity: 0.65 }}
            tickLabelProps={() => ({
              fill: axisColor,
              fontSize: 11,
              textAnchor: "middle",
              dy: "0.5em",
              fontFamily: "inherit",
              style: { fontVariantNumeric: "tabular-nums" },
            })}
          />
        </Group>
      </svg>
      <p className="mt-1 w-full text-center text-[11px] text-[var(--token-text-muted)]">
        {valueCaption}
      </p>
    </Fragment>
  )
}

function ClassMixHorizontalBarsBody({
  segments,
  valueCaption,
  tooltipOpen,
  tooltipData,
  tooltipLeft,
  tooltipTop,
  onBarHover,
  hideTooltip,
}: {
  segments: SessionMixSegment[]
  valueCaption: string
  tooltipOpen: boolean
  tooltipData: SessionMixSegment | undefined
  tooltipLeft: number | undefined
  tooltipTop: number | undefined
  onBarHover: (seg: SessionMixSegment, event: React.MouseEvent | React.TouchEvent) => void
  hideTooltip: () => void
}) {
  const keys = useMemo(() => segments.map((s) => s.key), [segments])

  const maxCount = useMemo(() => Math.max(...segments.map((s) => s.count), 1), [segments])

  const chartBodyHeight = useMemo(() => {
    const innerBand = Math.max(1, segments.length) * ROW_STEP
    return CLASS_MARGIN.top + innerBand + CLASS_MARGIN.bottom
  }, [segments.length])

  const containerMinHeight = chartBodyHeight + 40

  return (
    <div className="relative w-full" style={{ minHeight: containerMinHeight }}>
      <ParentSize>
        {({ width: parentWidth }) => {
          const width = parentWidth || 800
          if (width === 0) return null
          const labelColumnWidth = Math.min(228, Math.max(128, width * 0.29))
          return (
            <ClassMixBarsSvg
              width={width}
              segments={segments}
              keys={keys}
              maxCount={maxCount}
              chartBodyHeight={chartBodyHeight}
              labelColumnWidth={labelColumnWidth}
              valueCaption={valueCaption}
              onBarHover={onBarHover}
              hideTooltip={hideTooltip}
            />
          )
        }}
      </ParentSize>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: "var(--token-surface-elevated)",
            border: `1px solid ${borderColor}`,
            color: textColor,
            padding: "8px 12px",
            borderRadius: "6px",
          }}
        >
          <div className="font-semibold">{tooltipData.label}</div>
          <div className="text-sm text-[var(--token-text-secondary)]">
            {tooltipData.count.toLocaleString()} {valueCaption.toLowerCase()} ·{" "}
            {tooltipData.pct.toFixed(1)}%
          </div>
        </TooltipWithBounds>
      )}
    </div>
  )
}

const METRIC_LABELS: Record<MixMetric, string> = {
  session: "Session mix",
  drivers: "Classes by drivers",
  laps: "Classes by laps",
}

const METRIC_DESCRIPTIONS: Record<MixMetric, string> = {
  session: "Share of race sessions by session type (Practice, Qualifier, Main, etc.)",
  drivers: "Share of entry list rows by race class",
  laps: "Share of total laps completed in results, grouped by race class",
}

const METRIC_ARIA: Record<MixMetric, string> = {
  session: "Session mix — stacked bar chart of sessions by type",
  drivers: "Horizontal bar chart of entries by class",
  laps: "Horizontal bar chart of laps completed by class",
}

function metricToggleButtonClass(active: boolean): string {
  return `rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
    active
      ? "border border-[var(--token-accent-soft-border)] bg-[var(--token-accent)]/20 text-[var(--token-text-primary)]"
      : "border border-transparent text-[var(--token-text-secondary)] hover:bg-[var(--token-surface-raised)]"
  }`
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
  const clipId = useId()
  const [userMetric, setUserMetric] = useState<MixMetric>("session")

  const hasSession = sessionMix.length > 0
  const hasDrivers = classMixByDrivers.length > 0
  const hasLaps = classMixByLaps.length > 0

  const effectiveMetric: MixMetric | null = useMemo(() => {
    if (userMetric === "session" && hasSession) return "session"
    if (userMetric === "drivers" && hasDrivers) return "drivers"
    if (userMetric === "laps" && hasLaps) return "laps"
    if (hasSession) return "session"
    if (hasDrivers) return "drivers"
    if (hasLaps) return "laps"
    return null
  }, [userMetric, hasSession, hasDrivers, hasLaps])

  const sessionTooltip = useTooltip<SessionMixSegment>()
  const classTooltip = useTooltip<SessionMixSegment>()

  const chartHeight = useMemo(() => {
    if (effectiveMetric === null) return 400
    if (effectiveMetric === "session") {
      return SESSION_SVG_HEIGHT + 120
    }
    const segments = effectiveMetric === "drivers" ? classMixByDrivers : classMixByLaps
    const innerBand = Math.max(1, segments.length) * ROW_STEP
    const chartBodyHeight = CLASS_MARGIN.top + innerBand + CLASS_MARGIN.bottom
    return chartBodyHeight + 80
  }, [effectiveMetric, classMixByDrivers, classMixByLaps])

  const onSessionHover = (seg: SessionMixSegment, event: React.MouseEvent | React.TouchEvent) => {
    const svg = (event.target as SVGElement).ownerSVGElement
    if (!svg) return
    const coords = localPoint(svg, event as React.MouseEvent<SVGElement>)
    if (coords) {
      sessionTooltip.showTooltip({
        tooltipLeft: coords.x,
        tooltipTop: coords.y,
        tooltipData: seg,
      })
    }
  }

  const onClassHover = (seg: SessionMixSegment, event: React.MouseEvent | React.TouchEvent) => {
    const svg = (event.target as SVGElement).ownerSVGElement
    if (!svg) return
    const coords = localPoint(svg, event as React.MouseEvent<SVGElement>)
    if (coords) {
      classTooltip.showTooltip({
        tooltipLeft: coords.x,
        tooltipTop: coords.y,
        tooltipData: seg,
      })
    }
  }

  if (!hasSession && !hasDrivers && !hasLaps) {
    return null
  }

  if (effectiveMetric === null) {
    return null
  }

  const description = METRIC_DESCRIPTIONS[effectiveMetric]
  const ariaLabel = METRIC_ARIA[effectiveMetric]

  const headerControls = (
    <div
      className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/35 p-1"
      role="radiogroup"
      aria-label="Event mix metric"
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

  return (
    <ChartContainer
      title="Event mix"
      description={description}
      height={chartHeight}
      className={`pb-4 ${className}`}
      aria-label={ariaLabel}
      headerControls={headerControls}
    >
      {effectiveMetric === "session" ? (
        <SessionMixStackBody
          segments={sessionMix}
          clipId={clipId}
          onSegmentHover={onSessionHover}
          hideTooltip={sessionTooltip.hideTooltip}
          tooltipOpen={sessionTooltip.tooltipOpen}
          tooltipData={sessionTooltip.tooltipData}
          tooltipLeft={sessionTooltip.tooltipLeft}
          tooltipTop={sessionTooltip.tooltipTop}
        />
      ) : null}
      {effectiveMetric === "drivers" ? (
        <ClassMixHorizontalBarsBody
          segments={classMixByDrivers}
          valueCaption="Entries"
          tooltipOpen={classTooltip.tooltipOpen}
          tooltipData={classTooltip.tooltipData}
          tooltipLeft={classTooltip.tooltipLeft}
          tooltipTop={classTooltip.tooltipTop}
          onBarHover={onClassHover}
          hideTooltip={classTooltip.hideTooltip}
        />
      ) : null}
      {effectiveMetric === "laps" ? (
        <ClassMixHorizontalBarsBody
          segments={classMixByLaps}
          valueCaption="Laps completed"
          tooltipOpen={classTooltip.tooltipOpen}
          tooltipData={classTooltip.tooltipData}
          tooltipLeft={classTooltip.tooltipLeft}
          tooltipTop={classTooltip.tooltipTop}
          onBarHover={onClassHover}
          hideTooltip={classTooltip.hideTooltip}
        />
      ) : null}
    </ChartContainer>
  )
}
