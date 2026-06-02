/**
 * @fileoverview Lap-by-lap trend chart – every single lap time for selected drivers
 *
 * @description Line chart with X = global lap index (1, 2, 3, …), Y = lap time.
 * One line per driver; unified crosshair tooltip compares all drivers at the snapped lap index.
 * Supports **bands** vs **divider** session cues, optional dual **position** axis, and
 * **rolling-mean smoothing** (Display menu) for tight dashboard cards.
 *
 * @lastModified 2026-05-22
 *
 * @relatedFiles
 * - src/core/events/get-lap-data.ts (DriverLapTrendSeries, LapTrendPoint)
 * - src/components/organisms/event-analysis/LapTimeTrendCard.tsx (consumer)
 */

"use client"

import {
  useMemo,
  useId,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { Group } from "@visx/group"
import { LinePath } from "@visx/shape"
import { scaleLinear } from "@visx/scale"
import { curveMonotoneX } from "@visx/curve"
import { AxisBottom, AxisLeft, AxisRight } from "@visx/axis"
import { useTooltip, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import { ParentSize } from "@visx/responsive"
import ChartContainer from "./ChartContainer"
import ChartColorPicker from "./ChartColorPicker"
import { formatDateTimeUTC, formatDuration } from "@/lib/format-session-data"
import { useChartColor, useDriverLineColors } from "@/hooks/useChartColors"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import type { DriverLapTrendSeries, LapTrendPoint } from "@/core/events/get-lap-data"
import {
  buildCrosshairTooltipPayload,
  computeSessionDividers,
  computeSessionLayout,
  countPlottableLaps,
  defaultDriverLineColor,
  lapChartXValue,
  sessionBandsFromLayout,
  type ChartXDimension,
  type CrosshairTooltipPayload,
  type SessionLayout,
} from "@/core/events/lap-by-lap-trend-chart-model"
import {
  buildSessionDisplayLabelLookup,
  type SessionLabelInput,
} from "@/lib/format-session-race-display-label"

function formatDeltaSeconds(delta: number): string {
  if (!Number.isFinite(delta)) return "—"
  const sign = delta >= 0 ? "+" : "−"
  return `${sign}${Math.abs(delta).toFixed(3)}s`
}

const DEFAULT_AXIS_COLOR = "var(--token-text-primary)"
const PLOT_MARGIN = { top: 20, bottom: 60, left: 70, rightDefault: 20, rightWithPositionAxis: 54 }
/** Plot-only preview: no axis label gutters in collapsed analysis tiles. */
const COMPACT_PLOT_MARGIN = {
  top: 4,
  bottom: 4,
  left: 4,
  rightDefault: 4,
  rightWithPositionAxis: 4,
}
const SESSION_BAND_DEFAULTS = [
  "var(--token-chart-session-band-1)",
  "var(--token-chart-session-band-2)",
] as const
const borderColor = "var(--token-border-default)"
const DIM_OPACITY = 0.2

const TOOLTIP_CURSOR_OFFSET = 12
const TOOLTIP_VIEWPORT_PADDING = 8

function PortaledChartTooltip({
  open,
  top,
  left,
  maxWidth,
  padding,
  children,
}: {
  open: boolean
  top?: number
  left?: number
  maxWidth: string
  padding: string
  children: ReactNode
}) {
  const tooltipRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || top == null || left == null || typeof window === "undefined") return

    const el = tooltipRef.current
    if (!el) return

    let nextTop = top + TOOLTIP_CURSOR_OFFSET
    let nextLeft = left + TOOLTIP_CURSOR_OFFSET
    const rect = el.getBoundingClientRect()
    const maxLeft = window.innerWidth - TOOLTIP_VIEWPORT_PADDING - rect.width
    const maxTop = window.innerHeight - TOOLTIP_VIEWPORT_PADDING - rect.height
    nextLeft = Math.min(
      Math.max(TOOLTIP_VIEWPORT_PADDING, nextLeft),
      Math.max(TOOLTIP_VIEWPORT_PADDING, maxLeft)
    )
    if (nextTop > maxTop) {
      nextTop = Math.max(TOOLTIP_VIEWPORT_PADDING, top - rect.height - TOOLTIP_CURSOR_OFFSET)
    }
    nextTop = Math.min(
      Math.max(TOOLTIP_VIEWPORT_PADDING, nextTop),
      Math.max(TOOLTIP_VIEWPORT_PADDING, maxTop)
    )

    el.style.top = `${nextTop}px`
    el.style.left = `${nextLeft}px`
  }, [open, top, left, maxWidth, padding, children])

  if (!open || top == null || left == null || typeof document === "undefined") return null

  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        ...defaultStyles,
        position: "fixed",
        pointerEvents: "none",
        top: top + TOOLTIP_CURSOR_OFFSET,
        left: left + TOOLTIP_CURSOR_OFFSET,
        zIndex: 10000,
        backgroundColor: "var(--token-surface-elevated)",
        border: `1px solid ${borderColor}`,
        color: "var(--token-text-primary)",
        padding,
        borderRadius: "8px",
        maxWidth,
      }}
    >
      {children}
    </div>,
    document.body
  )
}

function LapCrosshairTooltipTable({
  payload,
  xAxisLabel,
  xDimension,
  focusedDriverId,
}: {
  payload: CrosshairTooltipPayload
  xAxisLabel: string
  xDimension: ChartXDimension
  focusedDriverId: string | null
}) {
  const { sessionHeading, lapIndex, lapInSessionNumber, columns, sessionMeta } = payload
  // In event-aligned scope the snapped x is a synthetic position; the session lap is the meaningful
  // number and is shared across drivers, so surface that instead of the raw aligned index.
  const headingLapLabel =
    xDimension === "sessionLapNumber"
      ? `${xAxisLabel}: ${lapIndex}`
      : lapInSessionNumber != null
        ? `Session lap ${lapInSessionNumber}`
        : `${xAxisLabel}: ${lapIndex}`
  const columnHeaderClass = (driverId: string) =>
    `border border-[var(--token-border-muted)] px-2 py-1 text-left font-medium text-[var(--token-text-primary)] ${
      focusedDriverId === driverId
        ? "bg-[var(--token-accent-soft-bg)] ring-1 ring-inset ring-[var(--token-accent)]"
        : ""
    }`
  const columnCellClass = (driverId: string) =>
    `border border-[var(--token-border-muted)] px-2 py-1 font-mono tabular-nums text-[var(--token-text-primary)] ${
      focusedDriverId === driverId ? "bg-[var(--token-accent-soft-bg)]/40" : ""
    }`

  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-semibold leading-tight text-[var(--token-text-primary)]">
          {sessionHeading}
        </div>
        <div className="mt-0.5 text-xs text-[var(--token-text-secondary)]">
          {headingLapLabel}
          {columns.some((c) => c.lapTimeSeconds != null) ? (
            <span className="text-[var(--token-text-muted)]"> · all drivers at this lap</span>
          ) : null}
        </div>
      </div>

      {sessionHeading === "Multiple sessions" ? (
        <p className="text-[0.65rem] text-[var(--token-text-muted)]">
          Drivers are in different sessions here.
        </p>
      ) : null}

      {sessionMeta?.raceStartTime ? (
        <div className="text-xs text-[var(--token-text-secondary)]">
          {formatDateTimeUTC(new Date(sessionMeta.raceStartTime))}
          {sessionMeta.sessionDurationSeconds != null
            ? ` · Session length: ${formatDuration(sessionMeta.sessionDurationSeconds)}`
            : null}
        </div>
      ) : sessionMeta?.sessionDurationSeconds != null ? (
        <div className="text-xs text-[var(--token-text-secondary)]">
          Session length: {formatDuration(sessionMeta.sessionDurationSeconds)}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-max table-auto border-collapse text-xs text-[var(--token-text-secondary)]">
          <thead>
            <tr>
              <th className="border border-[var(--token-border-muted)] px-2 py-1 text-left text-[0.65rem] font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                Metric
              </th>
              {columns.map((column) => (
                <th key={column.driverId} className={columnHeaderClass(column.driverId)}>
                  <div className="leading-tight">{column.driverName}</div>
                  {column.className && column.sessionName ? (
                    <div className="mt-0.5 text-[0.65rem] font-normal text-[var(--token-text-muted)]">
                      {column.className}
                      <span> · </span>
                      {column.sessionName}
                    </div>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th className="border border-[var(--token-border-muted)] bg-[var(--token-surface)]/50 px-2 py-1 text-left font-medium text-[var(--token-text-muted)]">
                Lap time
              </th>
              {columns.map((column) => (
                <td
                  key={`lap-time-${column.driverId}`}
                  className={columnCellClass(column.driverId)}
                >
                  {column.lapTimeSeconds != null ? formatLapTime(column.lapTimeSeconds) : "—"}
                </td>
              ))}
            </tr>
            <tr>
              <th className="border border-[var(--token-border-muted)] bg-[var(--token-surface)]/50 px-2 py-1 text-left font-medium text-[var(--token-text-muted)]">
                vs driver&apos;s best
              </th>
              {columns.map((column) => (
                <td key={`vs-best-${column.driverId}`} className={columnCellClass(column.driverId)}>
                  {column.deltaToDriverBestSeconds != null
                    ? formatDeltaSeconds(column.deltaToDriverBestSeconds)
                    : "—"}
                </td>
              ))}
            </tr>
            <tr>
              <th className="border border-[var(--token-border-muted)] bg-[var(--token-surface)]/50 px-2 py-1 text-left font-medium text-[var(--token-text-muted)]">
                vs fastest in view
              </th>
              {columns.map((column) => (
                <td
                  key={`vs-chart-${column.driverId}`}
                  className={columnCellClass(column.driverId)}
                >
                  {column.deltaToChartBestSeconds != null
                    ? column.deltaToChartBestSeconds <= 0.0005
                      ? "—"
                      : formatDeltaSeconds(column.deltaToChartBestSeconds)
                    : "—"}
                </td>
              ))}
            </tr>
            <tr>
              <th className="border border-[var(--token-border-muted)] bg-[var(--token-surface)]/50 px-2 py-1 text-left font-medium text-[var(--token-text-muted)]">
                Position
              </th>
              {columns.map((column) => (
                <td
                  key={`position-${column.driverId}`}
                  className={columnCellClass(column.driverId)}
                >
                  {column.positionOnLap != null ? `P${column.positionOnLap}` : "—"}
                </td>
              ))}
            </tr>
            <tr>
              <th className="border border-[var(--token-border-muted)] bg-[var(--token-surface)]/50 px-2 py-1 text-left font-medium text-[var(--token-text-muted)]">
                Session lap
              </th>
              {columns.map((column) => (
                <td
                  key={`session-lap-${column.driverId}`}
                  className={`${columnCellClass(column.driverId)} font-sans`}
                >
                  {column.lapInSession ??
                    (column.currentLapNumber != null ? column.currentLapNumber : "—")}
                </td>
              ))}
            </tr>
            <tr>
              <th className="border border-[var(--token-border-muted)] bg-[var(--token-surface)]/50 px-2 py-1 text-left font-medium text-[var(--token-text-muted)]">
                Outlier
              </th>
              {columns.map((column) => (
                <td
                  key={`outlier-${column.driverId}`}
                  className={`${columnCellClass(column.driverId)} font-sans`}
                >
                  {column.isOutlierLap ? (
                    <span className="text-amber-400/95">Slow</span>
                  ) : column.lapTimeSeconds != null ? (
                    "—"
                  ) : (
                    "—"
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

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

function EmptyStateChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M4 17.5h16M7 13.5l3-3 2.5 2.5L16.5 9"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="3.5"
        y="4.5"
        width="17"
        height="15"
        rx="3"
        stroke="currentColor"
        strokeWidth={1.2}
        opacity={0.6}
      />
    </svg>
  )
}
/** Alternating band fill — kept low so lap traces stay visually primary over session shading. */
const SESSION_BAND_OPACITIES = [0.26, 0.22] as const
const SESSION_DIVIDER_STROKE = "var(--token-text-secondary)"
const SESSION_DIVIDER_STROKE_WIDTH = 1.5
const SESSION_DIVIDER_OPACITY = 0.75

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

/** Rolling mean with ±1 lap window (partial at edges); ignores non-positive lap times in the window. */
function rollingMeanLapTimes(
  sorted: LapTrendPoint[],
  getX: (lap: LapTrendPoint) => number | null
): Array<{ chartX: number; lapTimeSeconds: number }> {
  const out: Array<{ chartX: number; lapTimeSeconds: number }> = []
  for (let i = 0; i < sorted.length; i += 1) {
    let sum = 0
    let n = 0
    for (let j = Math.max(0, i - 1); j <= Math.min(sorted.length - 1, i + 1); j += 1) {
      const t = sorted[j]?.lapTimeSeconds
      if (typeof t === "number" && t > 0 && Number.isFinite(t)) {
        sum += t
        n += 1
      }
    }
    if (n > 0) {
      const chartX = getX(sorted[i])
      if (chartX != null) {
        out.push({ chartX, lapTimeSeconds: sum / n })
      }
    }
  }
  return out
}

function isPlottableLapTime(value: number): boolean {
  return Number.isFinite(value) && value > 0
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
  /** When true, show loading UI instead of empty state (supports stale-while-revalidate). */
  isLoading?: boolean
  /** Number of drivers expected while loading (shows spinner when data not yet available). */
  pendingDriverCount?: number
  /** Callback when user deselects a driver from the chart */
  onDriverDeselect?: (driverId: string) => void
  /**
   * Session background: alternating fill bands (default) vs light vertical dividers only
   * (Event Level Driver Analysis card — no fill bands).
   */
  sessionVisualization?: "bands" | "dividers"
  /** Adds Display toggles for position-on-lap (secondary Y) and optional smoothing line. */
  enablePositionAxisToggle?: boolean
  enableSmoothingToggle?: boolean
  /** Adds "Closest only" toggle to Display menu (pairs with ChartDriverPicker closest mode). */
  enableClosestOnlyToggle?: boolean
  closestOnly?: boolean
  onClosestOnlyChange?: (enabled: boolean) => void
  /** Optional summary below the chart (e.g. screen-reader-oriented stats). */
  footerSummary?: ReactNode
  /**
   * Full-event races for LiveRC-style plot-area tooltip headings (e.g. Q2 [4/7] - Class (Heat 1 of 4)).
   * When omitted, plot-area tooltip falls back to raw `raceLabel`.
   */
  raceLabelContextRaces?: EventAnalysisData["races"]
  /**
   * When set, **Display** includes "Expanded chart height" and derived chart height ignores `height`.
   * Use for dashboard cards where vertical space toggles compact vs taller preset.
   */
  displayChartHeightPreset?: {
    collapsedHeight: number
    expandedHeight: number
    expanded: boolean
    onExpandedChange: (expanded: boolean) => void
  }
  /** X-axis label (default: event lap index). */
  xAxisLabel?: string
  /** Whether X uses global event lap index or session lap number (single-session views only). */
  xDimension?: ChartXDimension
  /** Overrides default chart group aria-label for scoped views. */
  chartAriaLabel?: string
  /**
   * Mini-preview mode for collapsed analysis tiles: hides the title, header
   * controls, Display menu, footer, and axis labels; uses near-zero margins so
   * only the plot (lines/grid) fills the tile.
   */
  compact?: boolean
}

export default function LapByLapTrendChart({
  drivers,
  height = 480,
  className = "",
  chartInstanceId = "lap-by-lap-trend",
  chartTitle = "Lap-by-lap trend",
  headerControls,
  emptyMessage = "No lap data for selected drivers",
  isLoading = false,
  pendingDriverCount = 0,
  onDriverDeselect,
  sessionVisualization = "bands",
  enablePositionAxisToggle = false,
  enableSmoothingToggle = false,
  enableClosestOnlyToggle = false,
  closestOnly = false,
  onClosestOnlyChange,
  footerSummary,
  raceLabelContextRaces,
  displayChartHeightPreset,
  xAxisLabel = "Event lap index",
  xDimension = "eventLapIndex",
  chartAriaLabel,
  compact = false,
}: LapByLapTrendChartProps) {
  const resolvedHeight =
    displayChartHeightPreset != null
      ? displayChartHeightPreset.expanded
        ? displayChartHeightPreset.expandedHeight
        : displayChartHeightPreset.collapsedHeight
      : height
  const chartDescId = useId()
  const [hoveredDriverId, setHoveredDriverId] = useState<string | null>(null)
  const [showSessionOverlay, setShowSessionOverlay] = useState(sessionVisualization === "bands")
  const [showTrendLine, setShowTrendLine] = useState(true)
  const [showPositionOnLap, setShowPositionOnLap] = useState(false)
  const [showSmoothing, setShowSmoothing] = useState(false)
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

  const driverIdsForColors = useMemo(() => drivers.map((d) => d.driverId), [drivers])
  const resolveDefaultDriverColor = useCallback(
    (driverId: string) => defaultDriverLineColor(driverId, driverIdsForColors),
    [driverIdsForColors]
  )
  const { colorByDriverId, setDriverColor } = useDriverLineColors(
    instanceId,
    driverIdsForColors,
    resolveDefaultDriverColor
  )

  const [driverPickerOpenId, setDriverPickerOpenId] = useState<string | null>(null)
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

  useEffect(() => {
    setShowSessionOverlay(sessionVisualization === "bands")
  }, [sessionVisualization])

  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<CrosshairTooltipPayload>()

  const validLapPoints = useMemo(() => {
    const points: LapTrendPoint[] = []
    drivers.forEach((d) => {
      ;(d.laps as LapTrendPoint[]).forEach((lap) => {
        if (isPlottableLapTime(lap.lapTimeSeconds)) {
          points.push(lap)
        }
      })
    })
    return points
  }, [drivers])

  /**
   * Shared session-aligned x-axis (event scope only). Concatenates sessions chronologically and
   * sizes each by its widest driver, so a given x = one session + one session-lap for all drivers.
   */
  const sessionLayout = useMemo<SessionLayout | undefined>(
    () => (xDimension === "eventLapIndex" ? computeSessionLayout(drivers) : undefined),
    [drivers, xDimension]
  )

  const getLapX = useCallback(
    (lap: LapTrendPoint) => lapChartXValue(lap, xDimension, sessionLayout),
    [xDimension, sessionLayout]
  )

  const [minChartX, maxChartX] = useMemo((): [number, number] => {
    if (validLapPoints.length === 0) return [1, 2]
    let min = Number.POSITIVE_INFINITY
    let max = 0
    validLapPoints.forEach((lap) => {
      const x = getLapX(lap)
      if (x == null) return
      if (x < min) min = x
      if (x > max) max = x
    })
    if (!Number.isFinite(min)) return [1, 2]
    return [Math.max(1, min), Math.max(max, 2)]
  }, [validLapPoints, getLapX])

  const sessionBands = useMemo(
    () => (sessionLayout ? sessionBandsFromLayout(sessionLayout) : []),
    [sessionLayout]
  )

  const raceDisplayLabelById = useMemo(() => {
    if (!raceLabelContextRaces || raceLabelContextRaces.length === 0) {
      return new Map<string, string>()
    }
    const inputs: SessionLabelInput[] = raceLabelContextRaces.map((r) => ({
      id: r.id,
      raceLabel: r.raceLabel,
      className: r.className,
      sectionHeader: r.sectionHeader ?? null,
      startTime: r.startTime,
      raceOrder: r.raceOrder,
    }))
    return buildSessionDisplayLabelLookup(inputs)
  }, [raceLabelContextRaces])

  const sessionDividers = useMemo(() => computeSessionDividers(sessionBands), [sessionBands])

  const showSessionBands = sessionVisualization === "bands" && showSessionOverlay

  /** Per-driver trend line data: slope, intercept, line points. Only for drivers with >= 2 laps. */
  const driverTrendMap = useMemo(() => {
    const map = new Map<
      string,
      { slope: number; intercept: number; data: { x: number; y: number }[] }
    >()
    for (const driver of drivers) {
      const laps = (driver.laps as LapTrendPoint[]).filter((lap) =>
        isPlottableLapTime(lap.lapTimeSeconds)
      )
      if (laps.length < 2) continue
      const sorted = [...laps].sort((a, b) => {
        const ax = getLapX(a) ?? 0
        const bx = getLapX(b) ?? 0
        if (ax !== bx) return ax - bx
        return a.raceId.localeCompare(b.raceId)
      })
      const seen = new Set<number>()
      const points: { x: number; y: number }[] = []
      for (const lap of sorted) {
        const x = getLapX(lap)
        if (x == null || seen.has(x)) continue
        seen.add(x)
        points.push({ x, y: lap.lapTimeSeconds })
      }
      if (points.length < 2) continue
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
  }, [drivers, getLapX])

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
          className="absolute right-0 top-full z-[100] mt-1 min-w-[220px] max-w-[min(100vw-1rem,280px)] rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] shadow-lg"
        >
          <div role="menu" aria-label="Display toggles" className="space-y-1 p-2">
            {sessionVisualization === "bands" && (
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
            )}
            {displayChartHeightPreset != null && (
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={displayChartHeightPreset.expanded}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-[var(--token-text-primary)] transition hover:bg-[var(--token-surface-raised)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-accent)]"
                onClick={() =>
                  displayChartHeightPreset.onExpandedChange(!displayChartHeightPreset.expanded)
                }
              >
                <span>Expanded chart height</span>
                <span
                  className="shrink-0 text-xs tabular-nums text-[var(--token-text-muted)]"
                  aria-hidden
                >
                  {displayChartHeightPreset.expanded ? "On" : "Off"}
                </span>
              </button>
            )}
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
            {enablePositionAxisToggle && (
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={showPositionOnLap}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-[var(--token-text-primary)] transition hover:bg-[var(--token-surface-raised)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-accent)]"
                onClick={() => setShowPositionOnLap((v) => !v)}
              >
                <span>Position on lap</span>
                <span
                  className="shrink-0 text-xs tabular-nums text-[var(--token-text-muted)]"
                  aria-hidden
                >
                  {showPositionOnLap ? "On" : "Off"}
                </span>
              </button>
            )}
            {enableSmoothingToggle && (
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={showSmoothing}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-[var(--token-text-primary)] transition hover:bg-[var(--token-surface-raised)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-accent)]"
                onClick={() => setShowSmoothing((v) => !v)}
              >
                <span>Smoothing (3-lap)</span>
                <span
                  className="shrink-0 text-xs tabular-nums text-[var(--token-text-muted)]"
                  aria-hidden
                >
                  {showSmoothing ? "On" : "Off"}
                </span>
              </button>
            )}
            {enableClosestOnlyToggle && onClosestOnlyChange != null && (
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={closestOnly}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-[var(--token-text-primary)] transition hover:bg-[var(--token-surface-raised)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-accent)]"
                onClick={() => onClosestOnlyChange(!closestOnly)}
              >
                <span>Show Closest Competitors</span>
                <span
                  className="shrink-0 text-xs tabular-nums text-[var(--token-text-muted)]"
                  aria-hidden
                >
                  {closestOnly ? "On" : "Off"}
                </span>
              </button>
            )}
          </div>
          <div
            className="border-t border-[var(--token-border-muted)] px-3 pb-2 pt-2 text-[0.7rem] leading-snug text-[var(--token-text-muted)]"
            role="note"
          >
            <p>{TREND_LINE_DESCRIPTION}</p>
            <p className="mt-1.5">{OUTLIER_LAP_MARKER_DESCRIPTION}</p>
            {enableSmoothingToggle && sessionVisualization === "dividers" && (
              <p className="mt-1.5">
                Smoothing draws a 3-lap rolling average of lap time (same color, dashed).
              </p>
            )}
            <p className="mt-1.5">
              X-axis is each driver&apos;s chronological lap index in scope; the same index does not
              always mean the same session moment when drivers ran different sessions.
            </p>
          </div>
        </div>
      )}
    </div>
  )

  const lapTrendScopeHeader =
    headerControls != null ? (
      <div
        className="inline-flex min-w-0 flex-wrap items-center gap-3 rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/35 px-2 py-1.5"
        aria-label="Lap trend scope"
      >
        {headerControls}
      </div>
    ) : null

  const headerControlsGrouped = (
    <div className="flex flex-wrap items-center gap-3">
      {lapTrendScopeHeader}
      {validLapPoints.length > 0 ? (
        <div
          className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/35 px-2 py-1.5"
          aria-label="Lap trend display"
        >
          {lapTrendDisplayMenu}
        </div>
      ) : null}
    </div>
  )

  // Compact (mini-preview) overrides: drop chrome, tighten margins.
  const effectiveTitle = compact ? undefined : chartTitle
  const effectiveHeaderControls = compact ? undefined : headerControlsGrouped
  const showFooterSummary = !compact && footerSummary != null
  const plotMargin = compact ? COMPACT_PLOT_MARGIN : PLOT_MARGIN
  const chartInteractive = !compact

  const noDriversSelected = drivers.length === 0 && pendingDriverCount === 0
  const noPlottableLaps = !noDriversSelected && validLapPoints.length === 0
  const showLoadingState =
    isLoading && (pendingDriverCount > 0 || drivers.length > 0) && noPlottableLaps

  if (showLoadingState) {
    const loadingHeight = Math.min(resolvedHeight, 260)
    return (
      <>
        <ChartContainer
          title={effectiveTitle}
          description={`${TREND_LINE_DESCRIPTION} ${OUTLIER_LAP_MARKER_DESCRIPTION}`}
          headerControls={effectiveHeaderControls}
          height={loadingHeight}
          className={className}
          aria-label="Lap-by-lap trend chart - loading"
        >
          <div
            className="flex min-h-[200px] w-full flex-col items-center justify-center gap-2 px-5 py-6 text-center"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--token-border-muted)] border-t-[var(--token-accent)]" />
            <p className="text-sm text-[var(--token-text-secondary)]">
              {emptyMessage || "Loading lap data…"}
            </p>
          </div>
        </ChartContainer>
        {showFooterSummary ? (
          <div
            className="mt-2 px-1 text-xs leading-relaxed text-[var(--token-text-secondary)]"
            aria-live="polite"
          >
            {footerSummary}
          </div>
        ) : null}
      </>
    )
  }

  if (noDriversSelected || noPlottableLaps) {
    const emptyStateTitle = noDriversSelected
      ? "No drivers selected"
      : "No lap-level data in this scope"
    const emptyStateDescription = noDriversSelected
      ? "Select at least one driver to draw lap-by-lap trend lines."
      : "This class/session scope has no stored lap times for the selected drivers."
    const emptyStateSecondary = noDriversSelected
      ? "Use the Select Drivers picker to start comparing trends."
      : "Try another class/session scope or include a different driver set."
    const compactEmptyHeight = Math.min(resolvedHeight, 260)

    return (
      <>
        <ChartContainer
          title={effectiveTitle}
          description={`${TREND_LINE_DESCRIPTION} ${OUTLIER_LAP_MARKER_DESCRIPTION}`}
          headerControls={effectiveHeaderControls}
          height={compactEmptyHeight}
          className={className}
          aria-label="Lap-by-lap trend chart - no data"
        >
          <div
            id="event-analysis-lap-trend-empty-state"
            className="relative min-h-[200px] w-full px-5 py-6"
          >
            <div className="pointer-events-none absolute inset-0 rounded-xl">
              <div className="absolute inset-x-6 top-4 bottom-14 rounded-lg border border-[var(--token-border-muted)]/45">
                <div className="absolute left-0 right-0 top-1/4 border-t border-[var(--token-border-muted)]/45 border-dashed" />
                <div className="absolute left-0 right-0 top-2/4 border-t border-[var(--token-border-muted)]/45 border-dashed" />
                <div className="absolute left-0 right-0 top-3/4 border-t border-[var(--token-border-muted)]/45 border-dashed" />
                <div className="absolute bottom-0 left-0 top-0 border-l border-[var(--token-border-muted)]/50" />
              </div>
            </div>
            <div className="relative z-10 mx-auto w-full max-w-[42rem] min-w-[12rem] rounded-xl border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/65 px-4 py-4 text-center shadow-sm backdrop-blur-sm">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]">
                <EmptyStateChartIcon />
              </div>
              <p className="text-sm font-semibold text-[var(--token-text-primary)]">
                {emptyStateTitle}
              </p>
              <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
                {emptyStateDescription}
              </p>
              <p className="mt-2 text-xs text-[var(--token-text-muted)]">
                {emptyMessage}
                {emptyMessage ? " " : ""}
                {emptyStateSecondary}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--token-text-secondary)]">
                <span className="rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface)]/60 px-2.5 py-1">
                  Drivers: select 1+
                </span>
                <span className="rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface)]/60 px-2.5 py-1">
                  Scope: class/session
                </span>
              </div>
            </div>
          </div>
        </ChartContainer>
        {showFooterSummary ? (
          <div
            className="mt-2 px-1 text-xs leading-relaxed text-[var(--token-text-secondary)]"
            aria-live="polite"
          >
            {footerSummary}
          </div>
        ) : null}
      </>
    )
  }

  const allLapTimes = validLapPoints.map((p) => p.lapTimeSeconds)
  const minLap = Math.min(...allLapTimes)
  const maxLap = Math.max(...allLapTimes)
  const padding = (maxLap - minLap) * 0.1 || 1
  const yDomain = [Math.max(0, minLap - padding), maxLap + padding] as [number, number]
  const xDomain = [minChartX, Math.max(maxChartX, minChartX + 1)] as [number, number]
  const showEventSessionOverlays = xDimension === "eventLapIndex"

  return (
    <>
      <ChartContainer
        title={effectiveTitle}
        description={`${TREND_LINE_DESCRIPTION} ${OUTLIER_LAP_MARKER_DESCRIPTION}`}
        headerControls={effectiveHeaderControls}
        height={resolvedHeight}
        className={className}
        aria-label={chartAriaLabel ?? "Lap-by-lap trend chart - every lap time across the event"}
        chartInstanceId={chartInstanceId}
        axisColorPicker={
          compact
            ? false
            : enablePositionAxisToggle && showPositionOnLap
              ? (["x", "y", "yRight"] as const)
              : true
        }
        defaultAxisColors={{
          x: DEFAULT_AXIS_COLOR,
          y: DEFAULT_AXIS_COLOR,
          yRight: DEFAULT_AXIS_COLOR,
        }}
        renderContent={({
          axisColors: { xAxisColor, yAxisColor, yAxisRightColor },
          onAxisColorPickerRequest,
        }) => (
          <>
            <div
              className="relative w-full overflow-hidden rounded-lg"
              style={{ height: `${resolvedHeight}px` }}
            >
              <ParentSize>
                {({ width: parentWidth }) => {
                  const width = parentWidth || 800
                  if (width === 0) return null

                  const mr =
                    enablePositionAxisToggle && showPositionOnLap
                      ? plotMargin.rightWithPositionAxis
                      : plotMargin.rightDefault
                  const ml = plotMargin.left
                  const mt = plotMargin.top
                  const mb = plotMargin.bottom

                  const innerWidth = width - ml - mr
                  const innerHeight = resolvedHeight - mt - mb

                  let maxPosition = 2
                  for (const d of drivers) {
                    for (const lap of d.laps as LapTrendPoint[]) {
                      const p = lap.positionOnLap
                      if (typeof p === "number" && p >= 1 && Number.isFinite(p)) {
                        maxPosition = Math.max(maxPosition, Math.ceil(p))
                      }
                    }
                  }
                  const positionDomain: [number, number] = [1, Math.max(maxPosition, 2)]

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
                  const yScalePosition =
                    enablePositionAxisToggle && showPositionOnLap
                      ? scaleLinear({
                          range: [0, innerHeight],
                          domain: positionDomain,
                        })
                      : null
                  // Positions are discrete integers, so generate whole-number ticks. A linear
                  // scale's default ticks() can emit fractional values (e.g. 1.5, 2.5) on a small
                  // domain, which `P${Math.round(v)}` then collapses into duplicate labels (P1, P1…).
                  const positionTickValues = (() => {
                    if (yScalePosition == null) return undefined
                    const [domainMin, domainMax] = positionDomain
                    const span = domainMax - domainMin
                    const maxTicks = 8
                    const step = Math.max(1, Math.ceil(span / maxTicks))
                    const ticks: number[] = []
                    for (let p = domainMin; p <= domainMax; p += step) {
                      ticks.push(p)
                    }
                    if (ticks[ticks.length - 1] !== domainMax) ticks.push(domainMax)
                    return ticks
                  })()

                  const showCrosshairTooltipAt = (
                    clientX: number,
                    clientY: number,
                    lapIndexValue: number
                  ) => {
                    const payload = buildCrosshairTooltipPayload({
                      drivers,
                      lapIndexValue,
                      minLapIndex: minChartX,
                      maxLapIndex: maxChartX,
                      raceDisplayLabelById,
                      xDimension,
                      sessionLayout,
                      outlierLapKeysByDriverId,
                    })
                    if (!payload) return

                    showTooltip({
                      tooltipLeft: clientX,
                      tooltipTop: clientY,
                      tooltipData: payload,
                    })
                  }

                  const snapChartXFromEvent = (event: React.MouseEvent<SVGElement>) => {
                    const svgEl = (event.target as SVGElement).ownerSVGElement
                    if (!svgEl) return null
                    const coords = localPoint(svgEl, event)
                    if (!coords) return null
                    const innerX = coords.x - ml
                    const raw = xScale.invert(innerX)
                    return Math.max(minChartX, Math.min(maxChartX, Math.round(raw)))
                  }

                  return (
                    <div className="relative w-full" style={{ width, height: resolvedHeight }}>
                      <svg
                        width={width}
                        height={resolvedHeight}
                        aria-labelledby={chartDescId}
                        role="img"
                        style={{ display: "block" }}
                      >
                        <desc id={chartDescId}>
                          {xAxisLabel} on X, lap time on Y
                          {showPositionOnLap && enablePositionAxisToggle
                            ? "; position per lap on right axis."
                            : "."}
                        </desc>
                        <Group left={ml} top={mt}>
                          <Group>
                            <rect
                              x={0}
                              y={0}
                              width={innerWidth}
                              height={innerHeight}
                              fill="transparent"
                              pointerEvents={compact ? "none" : "all"}
                              onMouseMove={
                                compact
                                  ? undefined
                                  : (e) => {
                                      setHoveredDriverId(null)
                                      const snappedX = snapChartXFromEvent(e)
                                      if (snappedX == null) return
                                      showCrosshairTooltipAt(e.clientX, e.clientY, snappedX)
                                    }
                              }
                              onMouseLeave={compact ? undefined : () => hideTooltip()}
                            />
                            {showEventSessionOverlays &&
                              sessionVisualization === "dividers" &&
                              sessionDividers.map((band) => (
                                <line
                                  key={`divider-${band.raceId}`}
                                  x1={xScale(band.startLapIndex - 0.5)}
                                  x2={xScale(band.startLapIndex - 0.5)}
                                  y1={0}
                                  y2={innerHeight}
                                  stroke={SESSION_DIVIDER_STROKE}
                                  strokeWidth={SESSION_DIVIDER_STROKE_WIDTH}
                                  strokeDasharray="5,4"
                                  opacity={SESSION_DIVIDER_OPACITY}
                                  pointerEvents="none"
                                />
                              ))}

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

                            {/* Session bands under lines so lap traces stay hoverable */}
                            {showEventSessionOverlays &&
                              showSessionBands &&
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
                                  />
                                )
                              })}

                            {drivers.map((driver) => {
                              const color =
                                colorByDriverId[driver.driverId] ??
                                defaultDriverLineColor(driver.driverId, driverIdsForColors)
                              const data = (driver.laps as LapTrendPoint[]).filter((lap) =>
                                isPlottableLapTime(lap.lapTimeSeconds)
                              )
                              if (data.length === 0) return null
                              // LinePath connects in array order; require ascending lap index (tie-break race)
                              // so segments never run backward on the x-axis.
                              const lapPointsSorted = (() => {
                                const sorted = [...data].sort((a, b) => {
                                  const ax = getLapX(a) ?? 0
                                  const bx = getLapX(b) ?? 0
                                  if (ax !== bx) return ax - bx
                                  return a.raceId.localeCompare(b.raceId)
                                })
                                const out: LapTrendPoint[] = []
                                const seen = new Set<number>()
                                for (const lap of sorted) {
                                  const x = getLapX(lap)
                                  if (x == null || seen.has(x)) continue
                                  seen.add(x)
                                  out.push(lap)
                                }
                                return out
                              })()
                              if (lapPointsSorted.length === 0) return null
                              const isHighlighted =
                                hoveredDriverId == null || driver.driverId === hoveredDriverId
                              const lineOpacity = isHighlighted ? 1 : DIM_OPACITY

                              return (
                                <Group
                                  key={driver.driverId}
                                  onMouseEnter={
                                    chartInteractive
                                      ? () => setHoveredDriverId(driver.driverId)
                                      : undefined
                                  }
                                  onMouseLeave={
                                    chartInteractive
                                      ? () => {
                                          setHoveredDriverId(null)
                                        }
                                      : undefined
                                  }
                                  style={{ cursor: chartInteractive ? "pointer" : "default" }}
                                >
                                  {/* Invisible wide path for easier line hover + tooltip */}
                                  <LinePath
                                    data={lapPointsSorted}
                                    x={(d) => xScale(getLapX(d)!)}
                                    y={(d) => yScale(d.lapTimeSeconds)}
                                    stroke="transparent"
                                    strokeWidth={16}
                                    curve={curveMonotoneX}
                                    pointerEvents={chartInteractive ? "stroke" : "none"}
                                    onMouseMove={
                                      chartInteractive
                                        ? (event) => {
                                            setHoveredDriverId(driver.driverId)
                                            const snappedX = snapChartXFromEvent(event)
                                            if (snappedX == null) return
                                            showCrosshairTooltipAt(
                                              event.clientX,
                                              event.clientY,
                                              snappedX
                                            )
                                          }
                                        : undefined
                                    }
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
                                    x={(d) => xScale(getLapX(d)!)}
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
                                    return lapPointsSorted.map((lap) => {
                                      const k = `${lap.lapIndex}-${lap.raceId}`
                                      if (!outKeys.has(k)) return null
                                      return (
                                        <circle
                                          key={`outlier-${driver.driverId}-${k}`}
                                          cx={xScale(getLapX(lap)!)}
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
                                  {showSmoothing &&
                                    enableSmoothingToggle &&
                                    lapPointsSorted.length > 1 && (
                                      <LinePath
                                        data={rollingMeanLapTimes(lapPointsSorted, getLapX)}
                                        x={(d) => xScale(d.chartX)}
                                        y={(d) => yScale(d.lapTimeSeconds)}
                                        stroke={color}
                                        strokeWidth={2}
                                        strokeDasharray="6,4"
                                        strokeOpacity={lineOpacity * 0.85}
                                        curve={curveMonotoneX}
                                        pointerEvents="none"
                                      />
                                    )}
                                  {showPositionOnLap &&
                                    enablePositionAxisToggle &&
                                    yScalePosition != null &&
                                    (() => {
                                      const posPts = lapPointsSorted.filter(
                                        (l) =>
                                          typeof l.positionOnLap === "number" &&
                                          l.positionOnLap! >= 1 &&
                                          Number.isFinite(l.positionOnLap!)
                                      )
                                      if (posPts.length === 0) return null
                                      return (
                                        <LinePath
                                          data={posPts}
                                          x={(d) => xScale(getLapX(d)!)}
                                          y={(d) => yScalePosition(d.positionOnLap!)}
                                          stroke={color}
                                          strokeWidth={1.5}
                                          strokeDasharray="2,3"
                                          opacity={lineOpacity * 0.75}
                                          curve={curveMonotoneX}
                                          pointerEvents="none"
                                        />
                                      )
                                    })()}
                                </Group>
                              )
                            })}

                            {!compact ? (
                              <>
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
                                    x={-ml}
                                    y={0}
                                    width={ml}
                                    height={innerHeight}
                                    fill="transparent"
                                    pointerEvents="all"
                                  />
                                </Group>

                                {enablePositionAxisToggle &&
                                  showPositionOnLap &&
                                  yScalePosition != null && (
                                    <Group
                                      style={{ cursor: "pointer" }}
                                      onClick={(e) => onAxisColorPickerRequest("yRight", e)}
                                      aria-label="Position axis - Click to change color"
                                    >
                                      <AxisRight
                                        left={innerWidth}
                                        scale={yScalePosition}
                                        tickValues={positionTickValues}
                                        tickFormat={(v) => `P${Math.round(Number(v))}`}
                                        stroke={yAxisRightColor}
                                        tickStroke={yAxisRightColor}
                                        tickLabelProps={() => ({
                                          fill: yAxisRightColor,
                                          fontSize: 11,
                                          textAnchor: "start",
                                          dx: 8,
                                        })}
                                      />
                                      <rect
                                        x={innerWidth}
                                        y={0}
                                        width={Math.max(mr - 8, 12)}
                                        height={innerHeight}
                                        fill="transparent"
                                        pointerEvents="all"
                                      />
                                    </Group>
                                  )}

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
                                    label={xAxisLabel}
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
                              </>
                            ) : null}
                          </Group>
                        </Group>
                      </svg>
                    </div>
                  )
                }}
              </ParentSize>
            </div>

            {chartInteractive && tooltipOpen && tooltipData && (
              <PortaledChartTooltip
                open
                top={tooltipTop}
                left={tooltipLeft}
                maxWidth="min(44rem, calc(100vw - 1rem))"
                padding="10px 12px"
              >
                <LapCrosshairTooltipTable
                  payload={tooltipData}
                  xAxisLabel={xAxisLabel}
                  xDimension={xDimension}
                  focusedDriverId={hoveredDriverId}
                />
              </PortaledChartTooltip>
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

            {driverPickerOpenId != null &&
              driverPickerPosition != null &&
              drivers.some((d) => d.driverId === driverPickerOpenId) && (
                <ChartColorPicker
                  currentColor={
                    colorByDriverId[driverPickerOpenId] ??
                    defaultDriverLineColor(driverPickerOpenId, driverIdsForColors)
                  }
                  onColorChange={(c) => setDriverColor(driverPickerOpenId, c)}
                  onClose={() => {
                    setDriverPickerOpenId(null)
                    setDriverPickerPosition(null)
                  }}
                  position={driverPickerPosition}
                  label={`${drivers.find((d) => d.driverId === driverPickerOpenId)?.driverName ?? "Driver"} line color`}
                />
              )}

            {!compact ? (
              <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
                {drivers.map((driver) => {
                  const color =
                    colorByDriverId[driver.driverId] ??
                    defaultDriverLineColor(driver.driverId, driverIdsForColors)
                  const isHighlighted =
                    hoveredDriverId == null || driver.driverId === hoveredDriverId
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
                        className="flex items-center gap-2 cursor-pointer rounded px-0 py-0 text-left hover:ring-2 hover:ring-[var(--token-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]"
                        aria-label={`Change line color for ${driver.driverName}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDriverPickerPosition({
                            top: e.clientY + 12,
                            left: e.clientX,
                          })
                          setDriverPickerOpenId(driver.driverId)
                        }}
                      >
                        <div
                          className="w-4 h-4 shrink-0 rounded-full border-2 border-[var(--token-border-default)]"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-[var(--token-text-secondary)]">
                          {driver.driverName}
                          {(() => {
                            const plottableCount = countPlottableLaps(
                              driver.laps as LapTrendPoint[]
                            )
                            return plottableCount > 0 ? (
                              <span className="ml-1 text-[var(--token-text-tertiary)]">
                                ({plottableCount} lap{plottableCount === 1 ? "" : "s"})
                              </span>
                            ) : null
                          })()}
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
                          className="shrink-0 rounded p-0.5 text-[var(--token-text-tertiary)] hover:text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]"
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
            ) : null}
          </>
        )}
      />
      {showFooterSummary ? (
        <div
          className="mt-2 px-1 text-xs leading-relaxed text-[var(--token-text-secondary)]"
          aria-live="polite"
        >
          {footerSummary}
        </div>
      ) : null}
    </>
  )
}
