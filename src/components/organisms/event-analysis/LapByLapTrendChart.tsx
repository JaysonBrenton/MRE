/**
 * @fileoverview Lap-by-lap trend chart – every single lap time for selected drivers
 *
 * @description Line chart with X = global lap index (1, 2, 3, …), Y = lap time.
 * One line per driver; tooltip shows race, lap number, and time.
 *
 * @relatedFiles
 * - src/core/events/get-lap-data.ts (DriverLapTrendSeries, LapTrendPoint)
 * - src/components/organisms/event-analysis/LapTimeTrendCard.tsx (consumer)
 */

"use client"

import { useMemo, useId, useState, useRef, useEffect, type ReactNode } from "react"
import { Group } from "@visx/group"
import { LinePath } from "@visx/shape"
import { scaleLinear } from "@visx/scale"
import { curveMonotoneX } from "@visx/curve"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import { ParentSize } from "@visx/responsive"
import ChartContainer from "./ChartContainer"
import ChartColorPicker from "./ChartColorPicker"
import { formatDateTimeUTC, formatDuration } from "@/lib/format-session-data"
import { useChartColor, useChartColors } from "@/hooks/useChartColors"
import type { DriverLapTrendSeries, LapTrendPoint } from "@/core/events/get-lap-data"

function formatDeltaSeconds(delta: number): string {
  if (!Number.isFinite(delta)) return "—"
  const sign = delta >= 0 ? "+" : "−"
  return `${sign}${Math.abs(delta).toFixed(3)}s`
}

function computeTooltipLapExtras(
  driver: DriverLapTrendSeries,
  nearest: LapTrendPoint,
  allDrivers: DriverLapTrendSeries[],
  outlierKeysForDriver: Set<string>
): {
  deltaToDriverBestSeconds: number
  deltaToChartBestSeconds: number
  isOutlierLap: boolean
} {
  const laps = driver.laps as LapTrendPoint[]
  const times = laps.map((l) => l.lapTimeSeconds).filter((t) => t > 0 && Number.isFinite(t))
  const driverBest = times.length > 0 ? Math.min(...times) : nearest.lapTimeSeconds

  const allTimes = allDrivers.flatMap((d) =>
    (d.laps as LapTrendPoint[])
      .map((l) => l.lapTimeSeconds)
      .filter((t) => t > 0 && Number.isFinite(t))
  )
  const chartBest = allTimes.length > 0 ? Math.min(...allTimes) : nearest.lapTimeSeconds

  const lapKey = `${nearest.lapIndex}-${nearest.raceId}`
  return {
    deltaToDriverBestSeconds: nearest.lapTimeSeconds - driverBest,
    deltaToChartBestSeconds: nearest.lapTimeSeconds - chartBest,
    isOutlierLap: outlierKeysForDriver.has(lapKey),
  }
}

const DEFAULT_AXIS_COLOR = "var(--token-text-primary)"
const defaultMargin = { top: 20, right: 20, bottom: 60, left: 70 }
const driverColors = [
  "var(--token-chart-series-1)",
  "var(--token-chart-series-2)",
  "var(--token-chart-series-3)",
  "var(--token-chart-series-4)",
  "var(--token-chart-series-5)",
  "var(--token-chart-series-6)",
  "var(--token-chart-series-7)",
  "var(--token-chart-series-8)",
  "var(--token-chart-series-9)",
  "var(--token-chart-series-10)",
  "var(--token-chart-series-11)",
  "var(--token-chart-series-12)",
] as const
const SESSION_BAND_DEFAULTS = [
  "var(--token-chart-session-band-1)",
  "var(--token-chart-session-band-2)",
] as const
const borderColor = "var(--token-border-default)"
const DIM_OPACITY = 0.2

/** Shown in chart title tooltip and Display menu — matches `linearRegression` in this file. */
const TREND_LINE_DESCRIPTION =
  "Dashed trend lines use linear regression (least squares) of lap time on global lap index, per driver."

/** Matches `outlierLapKeysForDriver` (median + MAD heuristic). */
const OUTLIER_LAP_MARKER_DESCRIPTION =
  "Amber dots mark unusually slow laps for that driver (robust median rule; at least 6 laps)."

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
/** Alternating band fill — kept low so lap traces stay visually primary over session shading. */
const SESSION_BAND_OPACITIES = [0.26, 0.22] as const

/** Session band: contiguous lap indices with same race (grouped by raceId) */
export interface SessionBand {
  startLapIndex: number
  endLapIndex: number
  raceId: string
  raceLabel: string
}

/** Compute session bands from the first driver's laps (one band per distinct race, grouped by raceId) */
function computeSessionBands(drivers: DriverLapTrendSeries[]): SessionBand[] {
  const firstWithLaps = drivers.find((d) => d.laps.length > 0)
  if (!firstWithLaps) return []

  const bands: SessionBand[] = []
  const laps = firstWithLaps.laps as LapTrendPoint[]

  let i = 0
  while (i < laps.length) {
    const raceId = laps[i].raceId
    const raceLabel = laps[i].raceLabel
    const startLapIndex = laps[i].lapIndex
    while (i + 1 < laps.length && laps[i + 1].raceId === raceId) {
      i += 1
    }
    const endLapIndex = laps[i].lapIndex
    bands.push({ startLapIndex, endLapIndex, raceId, raceLabel })
    i += 1
  }

  return bands
}

function formatLapTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  const wholeSecs = Math.floor(secs)
  const millis = Math.floor((secs - wholeSecs) * 1000)
  return `${minutes}:${wholeSecs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`
}

/** Linear regression: y = slope * x + intercept */
function linearRegression(points: { x: number; y: number }[]): {
  slope: number
  intercept: number
} {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 }
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0
  for (const p of points) {
    sumX += p.x
    sumY += p.y
    sumXY += p.x * p.y
    sumX2 += p.x * p.x
  }
  const denom = n * sumX2 - sumX * sumX
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

/** Format slope for display: "−0.05s per lap" or "+0.03s per lap" */
function formatTrendSlope(slope: number): string {
  const sign = slope >= 0 ? "+" : ""
  return `${sign}${slope.toFixed(3)}s per lap`
}

function medianSorted(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Per-driver lap times only (client-side). Flags unusually slow laps for subtle chart markers.
 * Heuristic: median lap time + robust spread from MAD (median absolute deviation). A lap is an
 * outlier if lap time exceeds median + 3.5 × 1.4826 × scale, where scale = MAD, or 5% of (max−min)
 * when MAD ≈ 0 (many identical laps). Requires ≥6 timed laps per driver. Conservative thresholds.
 */
function outlierLapKeysForDriver(laps: LapTrendPoint[]): Set<string> {
  const set = new Set<string>()
  const times = laps.map((l) => l.lapTimeSeconds).filter((t) => t > 0 && Number.isFinite(t))
  if (times.length < 6) return set

  const med = medianSorted(times)
  if (med == null) return set

  const deviations = times.map((t) => Math.abs(t - med))
  const mad = medianSorted(deviations)
  if (mad == null) return set

  const mn = Math.min(...times)
  const mx = Math.max(...times)
  const spread = mx - mn
  const eps = 1e-6
  const scale = mad > eps ? mad : Math.max(spread * 0.05, eps)
  const threshold = med + 3.5 * 1.4826 * scale

  for (const lap of laps) {
    if (lap.lapTimeSeconds > threshold) {
      set.add(`${lap.lapIndex}-${lap.raceId}`)
    }
  }
  return set
}

/** Trend direction from slope: negative = improving, positive = degrading */
function getTrendDirection(slope: number): "improving" | "degrading" | "flat" {
  const threshold = 0.001
  if (slope < -threshold) return "improving"
  if (slope > threshold) return "degrading"
  return "flat"
}

export interface LapByLapTrendChartProps {
  drivers: DriverLapTrendSeries[]
  height?: number
  className?: string
  chartInstanceId?: string
  /** Chart header title (e.g. "All Classes" or class name). Default "Lap-by-lap trend". */
  chartTitle?: string
  /** Optional controls rendered in chart header (e.g. driver picker, sort). */
  headerControls?: ReactNode
  /** Message when there is no data to display (e.g. loading, error, or no drivers selected). */
  emptyMessage?: string
  /** Callback when user deselects a driver from the chart */
  onDriverDeselect?: (driverId: string) => void
}

export default function LapByLapTrendChart({
  drivers,
  height = 480,
  className = "",
  chartInstanceId = "lap-by-lap-trend",
  chartTitle = "Lap-by-lap trend",
  headerControls,
  emptyMessage = "No lap data for selected drivers",
  onDriverDeselect,
}: LapByLapTrendChartProps) {
  const chartDescId = useId()
  const [hoveredDriverId, setHoveredDriverId] = useState<string | null>(null)
  const [showSessionOverlay, setShowSessionOverlay] = useState(true)
  const [showTrendLine, setShowTrendLine] = useState(true)
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false)
  const displayMenuButtonRef = useRef<HTMLButtonElement>(null)
  const displayMenuPanelRef = useRef<HTMLDivElement>(null)
  const [sessionBandPickerOpen, setSessionBandPickerOpen] = useState<
    "sessionBand1" | "sessionBand2" | null
  >(null)
  const [sessionBandPickerPosition, setSessionBandPickerPosition] = useState<{
    top: number
    left: number
  } | null>(null)

  const instanceId = chartInstanceId || "lap-trend-default"
  const [sessionBand1Color, setSessionBand1Color] = useChartColor(
    instanceId,
    "sessionBand1",
    SESSION_BAND_DEFAULTS[0]
  )
  const [sessionBand2Color, setSessionBand2Color] = useChartColor(
    instanceId,
    "sessionBand2",
    SESSION_BAND_DEFAULTS[1]
  )

  const defaultDriverColors = useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [`driver${i}`, driverColors[i % driverColors.length]])
      ) as Record<string, string>,
    []
  )
  const { colors: driverColorMap, setColor: setDriverColor } = useChartColors(
    instanceId,
    defaultDriverColors
  )

  const [driverPickerOpen, setDriverPickerOpen] = useState<number | null>(null)
  const [driverPickerPosition, setDriverPickerPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  useEffect(() => {
    if (!displayMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (displayMenuButtonRef.current?.contains(t) || displayMenuPanelRef.current?.contains(t)) {
        return
      }
      setDisplayMenuOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [displayMenuOpen])

  useEffect(() => {
    if (!displayMenuOpen) return
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setDisplayMenuOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [displayMenuOpen])

  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<{
      driverName: string
      className: string
      /** Session name (e.g. "A1-Main", "Heat 2/3") - derived from raceLabel */
      sessionName: string
      lapNumber: number
      lapTimeSeconds: number
      /** Lap range in this session (e.g. "Laps 1–11") */
      sessionLapRange?: string
      /** Lap position in session (e.g. "Lap 3 of 11") */
      lapInSession?: string
      /** Global lap index across event */
      overallLapIndex?: number
      /** Driver position at this lap within the session */
      positionOnLap?: number
      /** Session start time (ISO string) when available */
      raceStartTime?: string | null
      /** Session duration in seconds when available */
      sessionDurationSeconds?: number | null
      /** Trend direction: improving (faster), degrading (slower), flat */
      trendDirection?: "improving" | "degrading" | "flat"
      /** Formatted slope string (e.g. "−0.05s per lap") */
      trendSlope?: string
      /** This lap minus that driver's best lap in the chart (seconds). */
      deltaToDriverBestSeconds: number
      /** This lap minus best lap among all drivers shown (seconds). */
      deltaToChartBestSeconds: number
      /** Matches client-side outlier heuristic for this driver. */
      isOutlierLap: boolean
    }>()

  const allLapTimes = useMemo(() => {
    const times: number[] = []
    drivers.forEach((d) => {
      d.laps.forEach((lap) => times.push(lap.lapTimeSeconds))
    })
    return times
  }, [drivers])

  const maxLapIndex = useMemo(() => {
    let max = 0
    drivers.forEach((d) => {
      d.laps.forEach((lap) => {
        if (lap.lapIndex > max) max = lap.lapIndex
      })
    })
    return max
  }, [drivers])

  const sessionBands = useMemo(() => computeSessionBands(drivers), [drivers])

  /** Per-driver trend line data: slope, intercept, line points. Only for drivers with >= 2 laps. */
  const driverTrendMap = useMemo(() => {
    const map = new Map<
      string,
      { slope: number; intercept: number; data: { x: number; y: number }[] }
    >()
    for (const driver of drivers) {
      const laps = driver.laps as LapTrendPoint[]
      if (laps.length < 2) continue
      const sorted = [...laps].sort((a, b) => {
        if (a.lapIndex !== b.lapIndex) return a.lapIndex - b.lapIndex
        return a.raceId.localeCompare(b.raceId)
      })
      const seen = new Set<number>()
      const deduped: LapTrendPoint[] = []
      for (const lap of sorted) {
        if (seen.has(lap.lapIndex)) continue
        seen.add(lap.lapIndex)
        deduped.push(lap)
      }
      if (deduped.length < 2) continue
      const points = deduped.map((lap) => ({ x: lap.lapIndex, y: lap.lapTimeSeconds }))
      const { slope, intercept } = linearRegression(points)
      const minX = Math.min(...points.map((p) => p.x))
      const maxX = Math.max(...points.map((p) => p.x))
      const data = [
        { x: minX, y: slope * minX + intercept },
        { x: maxX, y: slope * maxX + intercept },
      ]
      map.set(driver.driverId, { slope, intercept, data })
    }
    return map
  }, [drivers])

  /** Slow-lap markers (median + MAD heuristic); see `outlierLapKeysForDriver`. */
  const outlierLapKeysByDriverId = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const d of drivers) {
      m.set(d.driverId, outlierLapKeysForDriver(d.laps as LapTrendPoint[]))
    }
    return m
  }, [drivers])

  const lapTrendDisplayMenu = (
    <div className="relative flex shrink-0">
      <button
        ref={displayMenuButtonRef}
        type="button"
        onClick={() => setDisplayMenuOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--token-text-primary)] transition hover:bg-[var(--token-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
        aria-expanded={displayMenuOpen}
        aria-haspopup="menu"
        aria-label="Lap chart display options"
      >
        <span>Display</span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-[var(--token-text-muted)] transition-transform ${displayMenuOpen ? "rotate-180" : ""}`}
        />
      </button>
      {displayMenuOpen && (
        <div
          ref={displayMenuPanelRef}
          role="group"
          aria-label="Lap chart display"
          className="absolute right-0 top-full z-50 mt-1 min-w-[220px] max-w-[min(100vw-1rem,280px)] rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] shadow-lg"
        >
          <div role="menu" aria-label="Display toggles" className="space-y-1 p-2">
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={showSessionOverlay}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-[var(--token-text-primary)] transition hover:bg-[var(--token-surface-raised)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-accent)]"
              onClick={() => setShowSessionOverlay((v) => !v)}
            >
              <span>Session overlay</span>
              <span
                className="shrink-0 text-xs tabular-nums text-[var(--token-text-muted)]"
                aria-hidden
              >
                {showSessionOverlay ? "On" : "Off"}
              </span>
            </button>
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={showTrendLine}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-[var(--token-text-primary)] transition hover:bg-[var(--token-surface-raised)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-accent)]"
              onClick={() => setShowTrendLine((v) => !v)}
            >
              <span>Trend line</span>
              <span
                className="shrink-0 text-xs tabular-nums text-[var(--token-text-muted)]"
                aria-hidden
              >
                {showTrendLine ? "On" : "Off"}
              </span>
            </button>
          </div>
          <div
            className="border-t border-[var(--token-border-muted)] px-3 pb-2 pt-2 text-[0.7rem] leading-snug text-[var(--token-text-muted)]"
            role="note"
          >
            <p>{TREND_LINE_DESCRIPTION}</p>
            <p className="mt-1.5">{OUTLIER_LAP_MARKER_DESCRIPTION}</p>
          </div>
        </div>
      )}
    </div>
  )

  const headerControlsGrouped = (
    <div className="flex flex-wrap items-center gap-3">
      {headerControls != null && (
        <div
          className="inline-flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/35 px-2 py-1.5"
          aria-label="Lap trend scope"
        >
          {headerControls}
        </div>
      )}
      <div
        className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/35 px-2 py-1.5"
        aria-label="Lap trend display"
      >
        {lapTrendDisplayMenu}
      </div>
    </div>
  )

  if (drivers.length === 0 || allLapTimes.length === 0) {
    return (
      <ChartContainer
        title={chartTitle}
        description={`${TREND_LINE_DESCRIPTION} ${OUTLIER_LAP_MARKER_DESCRIPTION}`}
        headerControls={headerControlsGrouped}
        height={height}
        className={className}
        aria-label="Lap-by-lap trend chart - no data"
      >
        <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
          {emptyMessage}
        </div>
      </ChartContainer>
    )
  }

  const minLap = Math.min(...allLapTimes)
  const maxLap = Math.max(...allLapTimes)
  const padding = (maxLap - minLap) * 0.1 || 1
  const yDomain = [Math.max(0, minLap - padding), maxLap + padding] as [number, number]
  const xDomain = [1, Math.max(maxLapIndex, 2)] as [number, number]

  return (
    <ChartContainer
      title={chartTitle}
      description={`${TREND_LINE_DESCRIPTION} ${OUTLIER_LAP_MARKER_DESCRIPTION}`}
      headerControls={headerControlsGrouped}
      height={height}
      className={className}
      aria-label="Lap-by-lap trend chart - every lap time across the event"
      chartInstanceId={chartInstanceId}
      axisColorPicker
      defaultAxisColors={{ x: DEFAULT_AXIS_COLOR, y: DEFAULT_AXIS_COLOR }}
      renderContent={({ axisColors: { xAxisColor, yAxisColor }, onAxisColorPickerRequest }) => (
        <>
          <div className="relative w-full" style={{ height: `${height}px` }}>
            <ParentSize>
              {({ width: parentWidth }) => {
                const width = parentWidth || 800
                if (width === 0) return null

                const innerWidth = width - defaultMargin.left - defaultMargin.right
                const innerHeight = height - defaultMargin.top - defaultMargin.bottom

                const xScale = scaleLinear({
                  range: [0, innerWidth],
                  domain: xDomain,
                  nice: true,
                })
                const yScale = scaleLinear({
                  range: [innerHeight, 0],
                  domain: yDomain,
                  nice: true,
                })

                return (
                  <div className="relative w-full" style={{ width, height }}>
                    <svg
                      width={width}
                      height={height}
                      aria-labelledby={chartDescId}
                      role="img"
                      style={{ display: "block" }}
                    >
                      <desc id={chartDescId}>
                        Line chart of every lap time for selected drivers; X = lap number, Y = lap
                        time.
                      </desc>
                      <Group left={defaultMargin.left} top={defaultMargin.top}>
                        <Group>
                          {yScale.ticks(5).map((tick) => (
                            <line
                              key={tick}
                              x1={0}
                              x2={innerWidth}
                              y1={yScale(tick)}
                              y2={yScale(tick)}
                              stroke={borderColor}
                              strokeWidth={1}
                              strokeDasharray="2,2"
                              opacity={0.3}
                            />
                          ))}

                          {drivers.map((driver, driverIndex) => {
                            const color =
                              driverColorMap[`driver${driverIndex}`] ??
                              driverColors[driverIndex % driverColors.length]
                            const data = driver.laps as LapTrendPoint[]
                            if (data.length === 0) return null
                            // LinePath connects in array order; require ascending lap index (tie-break race)
                            // so segments never run backward on the x-axis.
                            const lapPointsSorted = (() => {
                              const sorted = [...data].sort((a, b) => {
                                if (a.lapIndex !== b.lapIndex) return a.lapIndex - b.lapIndex
                                return a.raceId.localeCompare(b.raceId)
                              })
                              // One point per global lap index (duplicate index → same x, vertical segment)
                              const out: LapTrendPoint[] = []
                              const seen = new Set<number>()
                              for (const lap of sorted) {
                                if (seen.has(lap.lapIndex)) continue
                                seen.add(lap.lapIndex)
                                out.push(lap)
                              }
                              return out
                            })()
                            const isHighlighted =
                              hoveredDriverId == null || driver.driverId === hoveredDriverId
                            const lineOpacity = isHighlighted ? 1 : DIM_OPACITY

                            return (
                              <Group
                                key={driver.driverId}
                                onMouseEnter={() => setHoveredDriverId(driver.driverId)}
                                onMouseLeave={() => {
                                  setHoveredDriverId(null)
                                  hideTooltip()
                                }}
                                style={{ cursor: "pointer" }}
                              >
                                {/* Invisible wide path for easier line hover + tooltip */}
                                <LinePath
                                  data={lapPointsSorted}
                                  x={(d) => xScale(d.lapIndex)}
                                  y={(d) => yScale(d.lapTimeSeconds)}
                                  stroke="transparent"
                                  strokeWidth={16}
                                  curve={curveMonotoneX}
                                  pointerEvents="stroke"
                                  onMouseMove={(event) => {
                                    setHoveredDriverId(driver.driverId)
                                    const svgEl = (event.target as SVGElement).ownerSVGElement
                                    if (!svgEl) return
                                    const coords = localPoint(svgEl, event)
                                    if (!coords) return
                                    const innerX = coords.x - defaultMargin.left
                                    const lapIndexValue = xScale.invert(innerX)
                                    let nearest = lapPointsSorted[0]
                                    let minDist = Math.abs(
                                      lapPointsSorted[0].lapIndex - lapIndexValue
                                    )
                                    for (let i = 1; i < lapPointsSorted.length; i++) {
                                      const d = Math.abs(
                                        lapPointsSorted[i].lapIndex - lapIndexValue
                                      )
                                      if (d < minDist) {
                                        minDist = d
                                        nearest = lapPointsSorted[i]
                                      }
                                    }
                                    const band = sessionBands.find(
                                      (b) => b.raceId === nearest.raceId
                                    )
                                    const totalLapsInSession = band
                                      ? band.endLapIndex - band.startLapIndex + 1
                                      : null
                                    const sessionLapRange = band
                                      ? band.startLapIndex === band.endLapIndex
                                        ? `Lap ${band.startLapIndex}`
                                        : `Laps ${band.startLapIndex}–${band.endLapIndex}`
                                      : undefined
                                    const lapInSession =
                                      totalLapsInSession != null
                                        ? `Session Lap: ${nearest.lapNumber} of ${totalLapsInSession}`
                                        : undefined
                                    const className = nearest.className ?? nearest.raceLabel
                                    const sessionName = nearest.raceLabel.startsWith(className)
                                      ? nearest.raceLabel.slice(className.length).trim()
                                      : nearest.raceLabel
                                    const trend = driverTrendMap.get(driver.driverId)
                                    const trendDirection = trend
                                      ? getTrendDirection(trend.slope)
                                      : undefined
                                    const trendSlope = trend
                                      ? formatTrendSlope(trend.slope)
                                      : undefined
                                    const extras = computeTooltipLapExtras(
                                      driver,
                                      nearest,
                                      drivers,
                                      outlierLapKeysByDriverId.get(driver.driverId) ?? new Set()
                                    )
                                    showTooltip({
                                      tooltipLeft: coords.x,
                                      tooltipTop: coords.y,
                                      tooltipData: {
                                        driverName: driver.driverName,
                                        className,
                                        sessionName: sessionName || nearest.raceLabel,
                                        lapNumber: nearest.lapNumber,
                                        lapTimeSeconds: nearest.lapTimeSeconds,
                                        sessionLapRange,
                                        lapInSession,
                                        overallLapIndex: nearest.lapIndex,
                                        positionOnLap: nearest.positionOnLap,
                                        raceStartTime: nearest.raceStartTime ?? null,
                                        sessionDurationSeconds: nearest.durationSeconds ?? null,
                                        trendDirection,
                                        trendSlope,
                                        ...extras,
                                      },
                                    })
                                  }}
                                />
                                {showTrendLine &&
                                  (() => {
                                    const trend = driverTrendMap.get(driver.driverId)
                                    if (!trend) return null
                                    return (
                                      <LinePath
                                        data={trend.data}
                                        x={(d) => xScale(d.x)}
                                        y={(d) => yScale(d.y)}
                                        stroke="var(--token-text-primary)"
                                        strokeWidth={1.5}
                                        strokeDasharray="4,4"
                                        opacity={lineOpacity * 0.6}
                                        pointerEvents="none"
                                      />
                                    )
                                  })()}
                                <LinePath
                                  data={lapPointsSorted}
                                  x={(d) => xScale(d.lapIndex)}
                                  y={(d) => yScale(d.lapTimeSeconds)}
                                  stroke={color}
                                  strokeWidth={2.5}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  curve={curveMonotoneX}
                                  opacity={lineOpacity}
                                  pointerEvents="none"
                                />
                                {(() => {
                                  const outKeys =
                                    outlierLapKeysByDriverId.get(driver.driverId) ?? new Set()
                                  return data.map((lap) => {
                                    const k = `${lap.lapIndex}-${lap.raceId}`
                                    if (!outKeys.has(k)) return null
                                    return (
                                      <circle
                                        key={`outlier-${driver.driverId}-${k}`}
                                        cx={xScale(lap.lapIndex)}
                                        cy={yScale(lap.lapTimeSeconds)}
                                        r={3.5}
                                        fill="var(--token-status-warning-text)"
                                        stroke="var(--token-surface)"
                                        strokeWidth={1}
                                        opacity={lineOpacity}
                                        pointerEvents="none"
                                        aria-hidden
                                      />
                                    )
                                  })
                                })()}
                              </Group>
                            )
                          })}

                          {/* Session bands: on top so they receive clicks for color picker */}
                          {showSessionOverlay &&
                            sessionBands.map((band, bandIndex) => {
                              const colorIndex = bandIndex % 2
                              const bandColor =
                                colorIndex === 0 ? sessionBand1Color : sessionBand2Color
                              const opacity = SESSION_BAND_OPACITIES[colorIndex]
                              const xLeft = xScale(band.startLapIndex - 0.5)
                              const xRight = xScale(band.endLapIndex + 0.5)
                              const x = Math.max(0, xLeft)
                              const w = Math.max(1, Math.min(innerWidth, xRight) - x)
                              return (
                                <rect
                                  key={`${band.raceId}-${band.startLapIndex}`}
                                  x={x}
                                  y={0}
                                  width={w}
                                  height={innerHeight}
                                  fill={bandColor}
                                  fillOpacity={opacity}
                                  style={{ cursor: "pointer" }}
                                  pointerEvents="all"
                                  aria-label={`Session band ${bandIndex + 1} - Click to change color`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSessionBandPickerPosition({
                                      top: e.clientY + 12,
                                      left: e.clientX,
                                    })
                                    setSessionBandPickerOpen(
                                      colorIndex === 0 ? "sessionBand1" : "sessionBand2"
                                    )
                                  }}
                                  onMouseMove={(e) => {
                                    const svgEl = (e.target as SVGElement).ownerSVGElement
                                    if (!svgEl) return
                                    const coords = localPoint(svgEl, e)
                                    if (!coords) return
                                    const innerX = coords.x - defaultMargin.left
                                    const lapIndexValue = xScale.invert(innerX)
                                    let nearestDriver: (typeof drivers)[0] | null = null
                                    let nearest: LapTrendPoint | null = null
                                    let minDist = Infinity
                                    for (const drv of drivers) {
                                      const data = drv.laps as LapTrendPoint[]
                                      for (const lap of data) {
                                        const d = Math.abs(lap.lapIndex - lapIndexValue)
                                        if (d < minDist) {
                                          minDist = d
                                          nearest = lap
                                          nearestDriver = drv
                                        }
                                      }
                                    }
                                    if (nearest && nearestDriver) {
                                      const band = sessionBands.find(
                                        (b) => b.raceId === nearest!.raceId
                                      )
                                      const totalLapsInSession = band
                                        ? band.endLapIndex - band.startLapIndex + 1
                                        : null
                                      const sessionLapRange = band
                                        ? band.startLapIndex === band.endLapIndex
                                          ? `Lap ${band.startLapIndex}`
                                          : `Laps ${band.startLapIndex}–${band.endLapIndex}`
                                        : undefined
                                      const lapInSession =
                                        totalLapsInSession != null
                                          ? `Session Lap: ${nearest.lapNumber} of ${totalLapsInSession}`
                                          : undefined
                                      const className = nearest.className ?? nearest.raceLabel
                                      const sessionName = nearest.raceLabel.startsWith(className)
                                        ? nearest.raceLabel.slice(className.length).trim()
                                        : nearest.raceLabel
                                      const trend = driverTrendMap.get(nearestDriver.driverId)
                                      const trendDirection = trend
                                        ? getTrendDirection(trend.slope)
                                        : undefined
                                      const trendSlope = trend
                                        ? formatTrendSlope(trend.slope)
                                        : undefined
                                      const extras = computeTooltipLapExtras(
                                        nearestDriver,
                                        nearest,
                                        drivers,
                                        outlierLapKeysByDriverId.get(nearestDriver.driverId) ??
                                          new Set()
                                      )
                                      setHoveredDriverId(nearestDriver.driverId)
                                      showTooltip({
                                        tooltipLeft: coords.x,
                                        tooltipTop: coords.y,
                                        tooltipData: {
                                          driverName: nearestDriver.driverName,
                                          className,
                                          sessionName: sessionName || nearest.raceLabel,
                                          lapNumber: nearest.lapNumber,
                                          lapTimeSeconds: nearest.lapTimeSeconds,
                                          sessionLapRange,
                                          lapInSession,
                                          overallLapIndex: nearest.lapIndex,
                                          positionOnLap: nearest.positionOnLap,
                                          raceStartTime: nearest.raceStartTime ?? null,
                                          sessionDurationSeconds: nearest.durationSeconds ?? null,
                                          trendDirection,
                                          trendSlope,
                                          ...extras,
                                        },
                                      })
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    hideTooltip()
                                    setHoveredDriverId(null)
                                  }}
                                />
                              )
                            })}

                          <Group
                            style={{ cursor: "pointer" }}
                            onClick={(e) => onAxisColorPickerRequest("y", e)}
                            aria-label="Y-axis - Click to change color"
                          >
                            <AxisLeft
                              scale={yScale}
                              tickFormat={(v) => formatLapTime(Number(v))}
                              stroke={yAxisColor}
                              tickStroke={yAxisColor}
                              tickLabelProps={() => ({
                                fill: yAxisColor,
                                fontSize: 12,
                                textAnchor: "end",
                                dx: -8,
                              })}
                            />
                            {/* Hit area in margin only so it doesn't block tooltips on the plot */}
                            <rect
                              x={-defaultMargin.left}
                              y={0}
                              width={defaultMargin.left}
                              height={innerHeight}
                              fill="transparent"
                              pointerEvents="all"
                            />
                          </Group>

                          <Group
                            style={{ cursor: "pointer" }}
                            onClick={(e) => onAxisColorPickerRequest("x", e)}
                            aria-label="X-axis - Click to change color"
                          >
                            <AxisBottom
                              top={innerHeight}
                              scale={xScale}
                              stroke={xAxisColor}
                              tickStroke={xAxisColor}
                              tickLabelProps={() => ({
                                fill: xAxisColor,
                                fontSize: 11,
                                textAnchor: "middle",
                              })}
                              label="Lap number"
                              labelProps={{
                                fill: xAxisColor,
                                fontSize: 12,
                                textAnchor: "middle",
                                dy: 10,
                              }}
                            />
                            <rect
                              x={0}
                              y={innerHeight}
                              width={innerWidth}
                              height={40}
                              fill="transparent"
                              pointerEvents="all"
                            />
                          </Group>
                        </Group>
                      </Group>
                    </svg>
                  </div>
                )
              }}
            </ParentSize>
          </div>

          {tooltipOpen && tooltipData && (
            <TooltipWithBounds
              top={tooltipTop}
              left={tooltipLeft}
              style={{
                ...defaultStyles,
                backgroundColor: "var(--token-surface-elevated)",
                border: `1px solid ${borderColor}`,
                color: "var(--token-text-primary)",
                padding: "10px 14px",
                borderRadius: "8px",
                maxWidth: "min(22rem, calc(100vw - 1rem))",
              }}
            >
              <div className="space-y-2">
                <div>
                  <div className="font-semibold leading-tight text-[var(--token-text-primary)]">
                    {tooltipData.driverName}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--token-text-secondary)]">
                    {tooltipData.className}
                    <span className="text-[var(--token-text-muted)]"> · </span>
                    {tooltipData.sessionName}
                  </div>
                </div>

                <div className="rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface)]/50 px-2.5 py-2">
                  <div className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                    Lap time
                  </div>
                  <div className="font-mono text-lg font-semibold tabular-nums leading-tight text-[var(--token-text-primary)]">
                    {formatLapTime(tooltipData.lapTimeSeconds)}
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs text-[var(--token-text-secondary)]">
                    <span>vs driver best</span>
                    <span className="font-mono tabular-nums text-[var(--token-text-primary)]">
                      {formatDeltaSeconds(tooltipData.deltaToDriverBestSeconds)}
                    </span>
                    <span>vs chart best</span>
                    <span className="font-mono tabular-nums text-[var(--token-text-primary)]">
                      {formatDeltaSeconds(tooltipData.deltaToChartBestSeconds)}
                    </span>
                  </div>
                  {tooltipData.isOutlierLap && (
                    <div className="mt-2 text-[0.65rem] text-amber-400/95">
                      Unusually slow vs this driver median
                    </div>
                  )}
                </div>

                <div className="space-y-0.5 text-xs text-[var(--token-text-secondary)]">
                  {tooltipData.lapInSession && <div>{tooltipData.lapInSession}</div>}
                  {tooltipData.sessionLapRange && (
                    <div className="text-[var(--token-text-muted)]">
                      {tooltipData.sessionLapRange}
                    </div>
                  )}
                  {tooltipData.overallLapIndex != null && (
                    <div>Event lap index: {tooltipData.overallLapIndex}</div>
                  )}
                  {tooltipData.positionOnLap != null && (
                    <div>Position: P{tooltipData.positionOnLap}</div>
                  )}
                </div>

                {tooltipData.raceStartTime && (
                  <div className="text-xs text-[var(--token-text-secondary)]">
                    {formatDateTimeUTC(new Date(tooltipData.raceStartTime))}
                  </div>
                )}
                {tooltipData.sessionDurationSeconds != null && (
                  <div className="text-xs text-[var(--token-text-secondary)]">
                    Session length: {formatDuration(tooltipData.sessionDurationSeconds)}
                  </div>
                )}
                {tooltipData.trendDirection && tooltipData.trendDirection !== "flat" && (
                  <div className="text-xs text-[var(--token-text-secondary)]">
                    Regression trend:{" "}
                    <span
                      className={
                        tooltipData.trendDirection === "improving"
                          ? "text-green-400"
                          : "text-amber-400"
                      }
                    >
                      {tooltipData.trendDirection === "improving" ? "Improving" : "Degrading"}
                    </span>
                    {tooltipData.trendSlope && ` (${tooltipData.trendSlope})`}
                  </div>
                )}
              </div>
            </TooltipWithBounds>
          )}

          {sessionBandPickerOpen != null && sessionBandPickerPosition != null && (
            <ChartColorPicker
              currentColor={
                sessionBandPickerOpen === "sessionBand1" ? sessionBand1Color : sessionBand2Color
              }
              onColorChange={
                sessionBandPickerOpen === "sessionBand1"
                  ? setSessionBand1Color
                  : setSessionBand2Color
              }
              onClose={() => {
                setSessionBandPickerOpen(null)
                setSessionBandPickerPosition(null)
              }}
              position={sessionBandPickerPosition}
              label={
                sessionBandPickerOpen === "sessionBand1"
                  ? "Session band color 1"
                  : "Session band color 2"
              }
            />
          )}

          {driverPickerOpen != null &&
            driverPickerPosition != null &&
            drivers[driverPickerOpen] && (
              <ChartColorPicker
                currentColor={
                  driverColorMap[`driver${driverPickerOpen}`] ??
                  driverColors[driverPickerOpen % driverColors.length]
                }
                onColorChange={(c) =>
                  setDriverColor(
                    `driver${Math.min(driverPickerOpen, 7)}` as keyof typeof defaultDriverColors,
                    c
                  )
                }
                onClose={() => {
                  setDriverPickerOpen(null)
                  setDriverPickerPosition(null)
                }}
                position={driverPickerPosition}
                label={`${drivers[driverPickerOpen].driverName} line color`}
              />
            )}

          <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
            {drivers.map((driver, index) => {
              const color =
                driverColorMap[`driver${index}`] ?? driverColors[index % driverColors.length]
              const isHighlighted = hoveredDriverId == null || driver.driverId === hoveredDriverId
              return (
                <div
                  key={driver.driverId}
                  className="flex items-center gap-2 rounded px-1.5 py-0.5 transition-opacity"
                  style={{ opacity: isHighlighted ? 1 : DIM_OPACITY }}
                  onMouseEnter={() => setHoveredDriverId(driver.driverId)}
                  onMouseLeave={() => setHoveredDriverId(null)}
                >
                  <button
                    type="button"
                    className="flex items-center gap-2 cursor-pointer rounded px-0 py-0 text-left hover:ring-2 hover:ring-[var(--token-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--token-accent)]"
                    aria-label={`Change line color for ${driver.driverName}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setDriverPickerPosition({
                        top: e.clientY + 12,
                        left: e.clientX,
                      })
                      setDriverPickerOpen(index)
                    }}
                  >
                    <div
                      className="w-4 h-4 shrink-0 rounded-full border-2 border-[var(--token-border-default)]"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[var(--token-text-secondary)]">
                      {driver.driverName}
                      {driver.laps.length > 0 && (
                        <span className="ml-1 text-[var(--token-text-tertiary)]">
                          ({driver.laps.length} laps)
                        </span>
                      )}
                      {showTrendLine &&
                        (() => {
                          const trend = driverTrendMap.get(driver.driverId)
                          if (!trend) return null
                          const dir = getTrendDirection(trend.slope)
                          if (dir === "flat") return null
                          return (
                            <span
                              className={`ml-1.5 text-xs ${
                                dir === "improving" ? "text-green-400" : "text-amber-400"
                              }`}
                              title={formatTrendSlope(trend.slope)}
                            >
                              ({dir === "improving" ? "↘ Improving" : "↗ Degrading"})
                            </span>
                          )
                        })()}
                    </span>
                  </button>
                  {onDriverDeselect && (
                    <button
                      type="button"
                      className="shrink-0 rounded p-0.5 text-[var(--token-text-tertiary)] hover:text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--token-accent)]"
                      aria-label={`Remove ${driver.driverName} from chart`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDriverDeselect(driver.driverId)
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    />
  )
}
