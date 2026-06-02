/**
 * @fileoverview Unified performance chart with toggleable metrics and chart types
 *
 * @created 2025-01-28
 * @creator Auto-generated
 * @lastModified 2026-04-05
 *
 * @description Unified chart component that combines best lap and average lap
 *              metrics with clickable legend toggles and bar/line chart type selection.
 *              Extensible for future metrics like consistency.
 *
 * @purpose Provides a single, flexible chart interface for all performance metrics.
 *          Users can toggle metrics on/off via clickable legend and switch between
 *          bar and line chart visualizations.
 *
 * @relatedFiles
 * - src/components/event-analysis/ChartContainer.tsx (wrapper)
 * - src/components/event-analysis/BestLapBarChart.tsx (previous implementation)
 * - src/components/event-analysis/AvgVsFastestChart.tsx (previous implementation)
 */

"use client"

import { useMemo, useId, useState, useRef, useCallback, useEffect, type ReactNode } from "react"
import { Group } from "@visx/group"
import { Bar, LinePath } from "@visx/shape"
import { curveMonotoneX } from "@visx/curve"
import { scaleBand, scaleLinear } from "@visx/scale"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import { ParentSize } from "@visx/responsive"
import { ChevronDown, ChevronRight } from "lucide-react"
import ChartContainer from "./ChartContainer"
import ChartDriverPicker from "./ChartDriverPicker"
import ChartPagination from "./ChartPagination"
import ChartColorPicker from "./ChartColorPicker"
import Tooltip from "@/components/molecules/Tooltip"
import { useChartColors } from "@/hooks/useChartColors"
import { typography } from "@/lib/typography"

export type ChartViewType = "column" | "line"

// Metric types - extensible for future metrics
export type MetricType =
  | "bestLap"
  | "averageLap"
  | "consistency"
  | "averagePosition"
  | "gapToFastest"
  | "podiumFinishes"
  /** LiveRC session stats (ingested only; session-scoped chart) */
  | "avgTop5"
  | "avgTop10"
  | "avgTop15"
  | "top2Consecutive"
  | "top3Consecutive"
  | "stdDeviation"

export interface DriverPerformanceData {
  driverId: string
  driverName: string
  bestLapTime: number | null
  averageLapTime: number | null
  bestLapRaceLabel?: string | null
  consistency?: number | null // Future metric
  averagePosition?: number | null
  gapToFastest?: number | null // Time difference in seconds from fastest lap in class
  podiumFinishes?: number | null // Count of finishes in positions 1, 2, or 3
  /** LiveRC `raw_fields_json` — only populated for single-session scope */
  avgTop5?: number | null
  avgTop10?: number | null
  avgTop15?: number | null
  top2Consecutive?: number | null
  top3Consecutive?: number | null
  stdDeviation?: number | null
}

export interface ChartDriverOption {
  driverId: string
  driverName: string
}

export interface UnifiedPerformanceChartProps {
  data: DriverPerformanceData[]
  selectedDriverIds?: string[]
  height?: number
  className?: string
  currentPage?: number
  driversPerPage?: number
  onPageChange?: (page: number) => void
  onDriverToggle?: (driverId: string) => void
  chartInstanceId?: string
  selectedClass?: string | null
  allDriversInClassSelected?: boolean
  /** Chart view: column (bars) or line (same data as lines). Default 'column'. */
  chartView?: ChartViewType
  onChartViewChange?: (view: ChartViewType) => void
  /** Per-chart driver picker: options and current raw selection (optional) */
  chartDriverOptions?: ChartDriverOption[]
  chartSelectedDriverIds?: string[]
  onChartDriverSelectionChange?: (driverIds: string[]) => void
  /** Optional nearest-driver map used by ChartDriverPicker "Closest Only". */
  chartDriverClosestIdsByAnchor?: Record<string, string[]>
  /** Show ChartDriverPicker "Closest Only" toggle. */
  chartDriverClosestOnlyEnabled?: boolean
  /** Available race classes for per-chart class picker. */
  availableClasses?: string[]
  /** Handler for chart-only class scope; does not change global Actions unless you wire it. */
  onClassChange?: (className: string | null) => void
  /** First `<option value="">` text for class scope dropdown (default: All Classes). */
  classScopeSelectPlaceholderLabel?: string
  /** Rendered in the chart header scope row after the class control when it is shown (e.g. session picker). */
  headerAfterClassSelect?: ReactNode
  /**
   * When set, replaces the default header title (class name / "All Classes"). Use `""` to hide the
   * title when scope is already obvious (e.g. Session Analysis class chips).
   */
  chartTitleOverride?: string | null
  /** Disable per-chart driver picker (e.g. until session scope is chosen in Session Analysis). */
  chartDriverPickerDisabled?: boolean
  chartDriverPickerDisabledTooltip?: string
  /**
   * Mini-preview mode for collapsed analysis tiles: hides the title, scope/driver
   * controls, Display menu, legend, and axis labels; uses near-zero margins so
   * only the plot fills the tile.
   */
  compact?: boolean
}

/** Metrics that can be used to sort drivers (best to worst). */
export type SortByMetricType = MetricType

const defaultMargin = { top: 20, right: 20, bottom: 100, left: 80 }
/** Plot-only preview: no axis label gutters in collapsed analysis tiles. */
const COMPACT_MARGIN = { top: 4, right: 4, bottom: 4, left: 4 }

/** Row control style — aligns with LapByLapTrendChart Display menu */
const PERFORMANCE_DISPLAY_MENU_ROW_CLASS =
  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-[var(--token-text-primary)] transition hover:bg-[var(--token-surface-raised)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-accent)]"

const defaultColors = {
  bestLap: "var(--token-accent)",
  averageLap: "#5aa2ff",
  consistency: "#4ecdc4", // Future metric color
  averagePosition: "#ff6b6b", // Red color for position metric
  gapToFastest: "#ffa500", // Orange color for gap metric
  podiumFinishes: "#9b59b6", // Purple color for podium metric
  avgTop5: "#00c896",
  avgTop10: "#00a8d8",
  avgTop15: "#7b68ee",
  top2Consecutive: "#e67e22",
  top3Consecutive: "#e74c3c",
  stdDeviation: "#95a5a6",
}
const _textSecondaryColor = "var(--token-text-secondary)"
const borderColor = "var(--token-border-default)"
const DEFAULT_AXIS_COLOR = "#ffffff"

function EmptyStateBarChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
      <rect x="4" y="12" width="3.5" height="7" rx="1" fill="currentColor" opacity={0.65} />
      <rect x="10.25" y="9" width="3.5" height="10" rx="1" fill="currentColor" opacity={0.8} />
      <rect x="16.5" y="6" width="3.5" height="13" rx="1" fill="currentColor" />
      <path
        d="M3.5 19.5h17"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        opacity={0.5}
      />
    </svg>
  )
}

/**
 * Convert CSS variable or color string to hex color for SVG
 * SVG fill attributes don't support CSS variables, so we need to compute the actual color
 */
function getComputedColor(color: string, fallback: string = "#3a8eff"): string {
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
    return color
  }

  if (color.startsWith("var(")) {
    if (typeof window === "undefined") {
      return fallback
    }

    const match = color.match(/var\(([^)]+)\)/)
    if (!match) {
      return fallback
    }

    const varName = match[1].trim()
    const computedValue = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim()

    if (!computedValue) {
      return fallback
    }

    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(computedValue)) {
      return computedValue
    }

    if (computedValue.startsWith("rgb")) {
      const rgbMatch = computedValue.match(/\d+/g)
      if (rgbMatch && rgbMatch.length >= 3) {
        const r = parseInt(rgbMatch[0], 10)
        const g = parseInt(rgbMatch[1], 10)
        const b = parseInt(rgbMatch[2], 10)
        return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`
      }
    }

    return fallback
  }

  return color
}

/**
 * Calculate bottom margin needed for rotated labels
 * Estimates space needed for -45 degree rotated text labels
 */
function calculateBottomMargin(labels: string[], minMargin = 100): number {
  if (labels.length === 0) return minMargin

  const _fontSize = 11
  const avgCharWidth = 6.5
  const rotationRadians = Math.PI / 4
  const padding = 20

  const maxLabelLength = Math.max(...labels.map((label) => label.length))
  const estimatedTextWidth = maxLabelLength * avgCharWidth
  const verticalExtension = estimatedTextWidth * Math.sin(rotationRadians)
  const calculatedMargin = Math.ceil(verticalExtension + padding)

  return Math.max(calculatedMargin, minMargin)
}

/**
 * Format lap time in seconds to MM:SS.mmm format
 */
function formatLapTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  const wholeSecs = Math.floor(secs)
  const millis = Math.floor((secs - wholeSecs) * 1000)
  return `${minutes}:${wholeSecs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`
}

/**
 * Format position as a number with appropriate suffix (1st, 2nd, 3rd, etc.)
 * Always rounds to the nearest whole number since positions are discrete values
 */
function formatPosition(position: number): string {
  // Round to nearest whole number (positions are discrete, not continuous)
  const wholePosition = Math.round(position)
  const lastDigit = wholePosition % 10
  const lastTwoDigits = wholePosition % 100

  let suffix = "th"
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    suffix = "th"
  } else if (lastDigit === 1) {
    suffix = "st"
  } else if (lastDigit === 2) {
    suffix = "nd"
  } else if (lastDigit === 3) {
    suffix = "rd"
  }

  return `${wholePosition}${suffix}`
}

/**
 * Format gap to fastest as a time difference (e.g., "+0:05.234" or "-0:00.123")
 * Positive values indicate slower than fastest, negative values are not expected but handled
 */
function formatGapToFastest(gapSeconds: number): string {
  const sign = gapSeconds >= 0 ? "+" : "-"
  const absGap = Math.abs(gapSeconds)
  const minutes = Math.floor(absGap / 60)
  const secs = absGap % 60
  const wholeSecs = Math.floor(secs)
  const millis = Math.floor((secs - wholeSecs) * 1000)
  return `${sign}${minutes}:${wholeSecs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`
}

// Metric configuration
const metricConfig: Record<
  MetricType,
  {
    label: string
    key: keyof DriverPerformanceData
    isTimeBased?: boolean
    tooltipDescription: string
  }
> = {
  bestLap: {
    label: "Best Lap",
    key: "bestLapTime",
    isTimeBased: true,
    tooltipDescription: "Fastest single lap time across all races in this class.",
  },
  averageLap: {
    label: "Average Lap",
    key: "averageLapTime",
    isTimeBased: true,
    tooltipDescription:
      "Typical race pace. For each race we take the driver's average lap time, then average those across all their races in this class.",
  },
  consistency: {
    label: "Average Consistency",
    key: "consistency",
    isTimeBased: false,
    tooltipDescription:
      "Average of this driver's consistency scores across all races in this class. Each race score (0–100%) reflects lap-to-lap uniformity: higher means more consistent lap times.",
  },
  averagePosition: {
    label: "Avg Position",
    key: "averagePosition",
    isTimeBased: false,
    tooltipDescription: "Average finishing position across all races in this class.",
  },
  gapToFastest: {
    label: "Gap to Fastest",
    key: "gapToFastest",
    isTimeBased: true,
    tooltipDescription:
      "How much slower this driver's best lap is than the fastest lap in this class. Uses each driver's single best lap time; the class benchmark is the quickest of those. Lower is better—zero means tied for fastest.",
  },
  podiumFinishes: {
    label: "Podium Finishes",
    key: "podiumFinishes",
    isTimeBased: false,
    tooltipDescription:
      "Count of races in this class where this driver finished 1st, 2nd, or 3rd. Summed across all races in the class. Higher is better.",
  },
  avgTop5: {
    label: "Avg Top 5",
    key: "avgTop5",
    isTimeBased: true,
    tooltipDescription:
      "LiveRC average of the five fastest laps in this session (seconds). Lower is better.",
  },
  avgTop10: {
    label: "Avg Top 10",
    key: "avgTop10",
    isTimeBased: true,
    tooltipDescription:
      "LiveRC average of the ten fastest laps in this session (seconds). Lower is better.",
  },
  avgTop15: {
    label: "Avg Top 15",
    key: "avgTop15",
    isTimeBased: true,
    tooltipDescription:
      "LiveRC average of the fifteen fastest laps in this session (seconds). Lower is better.",
  },
  top2Consecutive: {
    label: "Top 2 Consecutive",
    key: "top2Consecutive",
    isTimeBased: true,
    tooltipDescription:
      "LiveRC best consecutive two-lap total time in this session (seconds). Lower is better.",
  },
  top3Consecutive: {
    label: "Top 3 Consecutive",
    key: "top3Consecutive",
    isTimeBased: true,
    tooltipDescription:
      "LiveRC best consecutive three-lap total time in this session (seconds). Lower is better.",
  },
  stdDeviation: {
    label: "Std. Deviation",
    key: "stdDeviation",
    isTimeBased: false,
    tooltipDescription:
      "LiveRC lap time standard deviation for this session (seconds). Lower usually means more consistent laps.",
  },
}

/** Chart title tooltip — matches ChartContainer `description` pattern used by LapByLapTrendChart. */
const UNIFIED_CHART_TITLE_DESCRIPTION =
  "Compare drivers on best lap, average lap, gap to fastest, consistency, finishing position, podium counts, and LiveRC session stats (Avg Top 5/10/15, consecutive laps, std. dev.) when available. Toggle metrics in the legend; open Display for line vs column charts and Order Chart for the sort metric. Click a series to change its color."

/** Stable order for hover tooltip rows (not Set iteration order). */
const TOOLTIP_METRIC_ORDER: MetricType[] = [
  "bestLap",
  "averageLap",
  "consistency",
  "averagePosition",
  "gapToFastest",
  "podiumFinishes",
  "avgTop5",
  "avgTop10",
  "avgTop15",
  "top2Consecutive",
  "top3Consecutive",
  "stdDeviation",
]

/** Same validity rules as `availableMetrics` aggregation — per driver row. */
function driverHasAnyPlottableMetric(d: DriverPerformanceData): boolean {
  if (d.bestLapTime !== null && d.bestLapTime > 0) return true
  if (d.averageLapTime !== null && d.averageLapTime > 0) return true
  if (d.consistency !== null && d.consistency !== undefined && d.consistency > 0) return true
  if (d.averagePosition !== null && d.averagePosition !== undefined && d.averagePosition > 0) {
    return true
  }
  if (d.gapToFastest !== null && d.gapToFastest !== undefined && isFinite(d.gapToFastest)) {
    return true
  }
  if (d.podiumFinishes !== null && d.podiumFinishes !== undefined && d.podiumFinishes >= 0) {
    return true
  }
  if (d.avgTop5 !== null && d.avgTop5 !== undefined && d.avgTop5 > 0) return true
  if (d.avgTop10 !== null && d.avgTop10 !== undefined && d.avgTop10 > 0) return true
  if (d.avgTop15 !== null && d.avgTop15 !== undefined && d.avgTop15 > 0) return true
  if (d.top2Consecutive !== null && d.top2Consecutive !== undefined && d.top2Consecutive > 0) {
    return true
  }
  if (d.top3Consecutive !== null && d.top3Consecutive !== undefined && d.top3Consecutive > 0) {
    return true
  }
  if (
    d.stdDeviation !== null &&
    d.stdDeviation !== undefined &&
    isFinite(d.stdDeviation) &&
    d.stdDeviation >= 0
  ) {
    return true
  }
  return false
}

function formatUnifiedTooltipMetricValue(metric: MetricType, value: number): string {
  if (metric === "gapToFastest") {
    return formatGapToFastest(value)
  }
  if (metric === "podiumFinishes") {
    return Math.round(value).toString()
  }
  if (metric === "averagePosition") {
    return formatPosition(value)
  }
  if (metric === "consistency") {
    return `${value.toFixed(1)}%`
  }
  if (metric === "stdDeviation") {
    return value.toFixed(2)
  }
  if (metricConfig[metric].isTimeBased) {
    return formatLapTime(value)
  }
  return value.toFixed(2)
}

function unifiedTooltipMetricCaption(metric: MetricType, d: DriverPerformanceData): string | null {
  if (metric === "bestLap" && d.bestLapRaceLabel) {
    return d.bestLapRaceLabel
  }
  if (metric === "gapToFastest") {
    return "vs fastest lap in class"
  }
  if (metric === "averageLap") {
    return "average of per-race averages"
  }
  if (
    metric === "avgTop5" ||
    metric === "avgTop10" ||
    metric === "avgTop15" ||
    metric === "top2Consecutive" ||
    metric === "top3Consecutive" ||
    metric === "stdDeviation"
  ) {
    return "LiveRC (this session)"
  }
  return null
}

/** Order and direction for sort-by options (display order; lower-is-better = ascending). */
const SORT_BY_OPTIONS: ReadonlyArray<{
  metric: SortByMetricType
  ascending: boolean
}> = [
  { metric: "bestLap", ascending: true },
  { metric: "averageLap", ascending: true },
  { metric: "consistency", ascending: false },
  { metric: "gapToFastest", ascending: true },
  { metric: "averagePosition", ascending: true },
  { metric: "podiumFinishes", ascending: false },
  { metric: "avgTop5", ascending: true },
  { metric: "avgTop10", ascending: true },
  { metric: "avgTop15", ascending: true },
  { metric: "top2Consecutive", ascending: true },
  { metric: "top3Consecutive", ascending: true },
  { metric: "stdDeviation", ascending: true },
]

export default function UnifiedPerformanceChart({
  data,
  selectedDriverIds,
  height = 400,
  className = "",
  currentPage = 1,
  driversPerPage = 25,
  onPageChange,
  onDriverToggle,
  chartInstanceId,
  selectedClass,
  allDriversInClassSelected,
  chartView = "column",
  onChartViewChange,
  chartDriverOptions,
  chartSelectedDriverIds = [],
  onChartDriverSelectionChange,
  chartDriverClosestIdsByAnchor,
  chartDriverClosestOnlyEnabled = false,
  availableClasses,
  onClassChange,
  classScopeSelectPlaceholderLabel = "All Classes",
  headerAfterClassSelect,
  chartTitleOverride,
  chartDriverPickerDisabled = false,
  chartDriverPickerDisabledTooltip,
  compact = false,
}: UnifiedPerformanceChartProps) {
  const chartDescId = useId()
  const orderChartSubmenuId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [colorPickerMetric, setColorPickerMetric] = useState<MetricType | null>(null)
  const [colorPickerPosition, setColorPickerPosition] = useState<{
    top: number
    left: number
  } | null>(null)

  // Visible metrics state - start with bestLap and averageLap enabled
  const [visibleMetrics, setVisibleMetrics] = useState<Set<MetricType>>(
    new Set(["bestLap", "averageLap"])
  )

  // Sort by metric (best to worst); default bestLap preserves previous behavior
  const [sortBy, setSortBy] = useState<SortByMetricType>("bestLap")
  const [performanceDisplayMenuOpen, setPerformanceDisplayMenuOpen] = useState(false)
  const [performanceOrderChartSubmenuOpen, setPerformanceOrderChartSubmenuOpen] = useState(false)
  const performanceDisplayMenuButtonRef = useRef<HTMLButtonElement>(null)
  const performanceDisplayMenuPanelRef = useRef<HTMLDivElement>(null)

  // Use chart colors hook
  const instanceId = chartInstanceId || "default-unified-performance"
  const { colors, setColor } = useChartColors(instanceId, defaultColors)

  // Toggle metric visibility
  const toggleMetric = useCallback((metric: MetricType) => {
    setVisibleMetrics((prev) => {
      const next = new Set(prev)
      if (next.has(metric)) {
        // Don't allow hiding the last visible metric
        if (next.size > 1) {
          next.delete(metric)
        }
      } else {
        next.add(metric)
      }
      return next
    })
  }, [])

  // Get available metrics based on data
  const availableMetrics = useMemo(() => {
    const available = new Set<MetricType>()
    data.forEach((driver) => {
      if (driver.bestLapTime !== null && driver.bestLapTime > 0) available.add("bestLap")
      if (driver.averageLapTime !== null && driver.averageLapTime > 0) available.add("averageLap")
      if (driver.consistency !== null && driver.consistency !== undefined && driver.consistency > 0)
        available.add("consistency")
      if (
        driver.averagePosition !== null &&
        driver.averagePosition !== undefined &&
        driver.averagePosition > 0
      )
        available.add("averagePosition")
      if (
        driver.gapToFastest !== null &&
        driver.gapToFastest !== undefined &&
        isFinite(driver.gapToFastest)
      )
        available.add("gapToFastest")
      if (
        driver.podiumFinishes !== null &&
        driver.podiumFinishes !== undefined &&
        driver.podiumFinishes >= 0
      )
        available.add("podiumFinishes")
      if (driver.avgTop5 !== null && driver.avgTop5 !== undefined && driver.avgTop5 > 0)
        available.add("avgTop5")
      if (driver.avgTop10 !== null && driver.avgTop10 !== undefined && driver.avgTop10 > 0)
        available.add("avgTop10")
      if (driver.avgTop15 !== null && driver.avgTop15 !== undefined && driver.avgTop15 > 0)
        available.add("avgTop15")
      if (
        driver.top2Consecutive !== null &&
        driver.top2Consecutive !== undefined &&
        driver.top2Consecutive > 0
      )
        available.add("top2Consecutive")
      if (
        driver.top3Consecutive !== null &&
        driver.top3Consecutive !== undefined &&
        driver.top3Consecutive > 0
      )
        available.add("top3Consecutive")
      if (
        driver.stdDeviation !== null &&
        driver.stdDeviation !== undefined &&
        isFinite(driver.stdDeviation) &&
        driver.stdDeviation >= 0
      )
        available.add("stdDeviation")
    })
    return available
  }, [data])

  // Sort-by options: only metrics that have data (and are sortable)
  const availableSortMetrics = useMemo(() => {
    const set = new Set<SortByMetricType>()
    SORT_BY_OPTIONS.forEach(({ metric }) => {
      if (availableMetrics.has(metric)) set.add(metric)
    })
    return set
  }, [availableMetrics])

  // Effective sort: use selected if available, else bestLap, else first available
  const effectiveSortBy = useMemo((): SortByMetricType => {
    if (availableSortMetrics.has(sortBy)) return sortBy
    if (availableSortMetrics.has("bestLap")) return "bestLap"
    const first = SORT_BY_OPTIONS.find((opt) => availableSortMetrics.has(opt.metric))
    return first?.metric ?? "bestLap"
  }, [sortBy, availableSortMetrics])

  // Reset sortBy when selected metric is no longer available
  useEffect(() => {
    if (!availableSortMetrics.has(sortBy)) {
      queueMicrotask(() => setSortBy(effectiveSortBy))
    }
  }, [sortBy, availableSortMetrics, effectiveSortBy])

  useEffect(() => {
    if (!performanceDisplayMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        performanceDisplayMenuButtonRef.current?.contains(t) ||
        performanceDisplayMenuPanelRef.current?.contains(t)
      ) {
        return
      }
      setPerformanceDisplayMenuOpen(false)
      setPerformanceOrderChartSubmenuOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [performanceDisplayMenuOpen])

  useEffect(() => {
    if (!performanceDisplayMenuOpen) return
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setPerformanceDisplayMenuOpen(false)
        setPerformanceOrderChartSubmenuOpen(false)
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [performanceDisplayMenuOpen])

  // Include any driver who has at least one plottable metric (not only the legend-visible set).
  // Otherwise drivers with e.g. podium/position but missing LiveRC best/avg lap vanish from the
  // chart while still appearing in the header driver picker (scoped mains / Session filter).
  const validData = useMemo(() => {
    return data.filter((d) => driverHasAnyPlottableMetric(d))
  }, [data])

  // Filter by selected drivers
  const displayData = useMemo(() => {
    if (selectedDriverIds === undefined) {
      return validData
    }
    if (selectedDriverIds.length === 0) {
      return []
    }
    return validData.filter((d) => selectedDriverIds.includes(d.driverId))
  }, [validData, selectedDriverIds])

  // Sort by selected metric (best to worst): ascending for time/gap/position, descending for podium
  const sortedData = useMemo(() => {
    const config = SORT_BY_OPTIONS.find((opt) => opt.metric === effectiveSortBy)
    const key = metricConfig[effectiveSortBy].key
    const ascending = config?.ascending ?? true
    return [...displayData].sort((a, b) => {
      const aVal = a[key]
      const bVal = b[key]
      const aNum =
        aVal === null || aVal === undefined || !isFinite(aVal as number)
          ? ascending
            ? Infinity
            : -Infinity
          : (aVal as number)
      const bNum =
        bVal === null || bVal === undefined || !isFinite(bVal as number)
          ? ascending
            ? Infinity
            : -Infinity
          : (bVal as number)
      return ascending ? aNum - bNum : bNum - aNum
    })
  }, [displayData, effectiveSortBy])

  // Pagination
  const totalPages = Math.ceil(sortedData.length / driversPerPage)
  const startIndex = (currentPage - 1) * driversPerPage
  const endIndex = startIndex + driversPerPage
  const paginatedData = sortedData.slice(startIndex, endIndex)

  // Calculate dynamic bottom margin
  const margin = useMemo(() => {
    if (compact) {
      return COMPACT_MARGIN
    }
    const labelLengths = paginatedData.map((d) => d.driverName)
    const dynamicBottom = calculateBottomMargin(labelLengths, 100)
    return { ...defaultMargin, bottom: dynamicBottom }
  }, [paginatedData, compact])

  const chartInteractive = !compact

  // Tooltip
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<DriverPerformanceData>()

  // Handle bar click to open color picker for the metric
  const handleBarClickForColorPicker = useCallback(
    (metric: MetricType, event: React.MouseEvent<SVGElement> | React.KeyboardEvent<SVGElement>) => {
      event.stopPropagation()
      const target = event.currentTarget as SVGElement
      const rect = target.getBoundingClientRect()
      // Use screen coordinates for fixed positioning (ChartColorPicker uses position: fixed)
      setColorPickerPosition({
        top: rect.bottom + 8,
        left: rect.left,
      })
      setColorPickerMetric(metric)
      setShowColorPicker(true)
    },
    []
  )

  // Get computed colors for SVG
  const computedColors = useMemo(() => {
    const result: Record<MetricType, string> = {} as Record<MetricType, string>
    Object.keys(metricConfig).forEach((metric) => {
      result[metric as MetricType] = getComputedColor(
        colors[metric as MetricType] || defaultColors[metric as MetricType],
        "#3a8eff"
      )
    })
    return result
  }, [colors])

  // Determine if Y-axis should be formatted as time, gap, position, count, or percentage
  const yAxisFormatType = useMemo(() => {
    const hasGapToFastest = Array.from(visibleMetrics).includes("gapToFastest")
    const hasOtherTimeMetrics = Array.from(visibleMetrics).some(
      (m) =>
        m === "bestLap" ||
        m === "averageLap" ||
        m === "avgTop5" ||
        m === "avgTop10" ||
        m === "avgTop15" ||
        m === "top2Consecutive" ||
        m === "top3Consecutive"
    )
    const hasConsistency = Array.from(visibleMetrics).includes("consistency")
    const hasStdDeviation = Array.from(visibleMetrics).includes("stdDeviation")
    const visiblePositionMetrics = Array.from(visibleMetrics).filter(
      (metric) => metric === "averagePosition"
    )
    const visibleCountMetrics = Array.from(visibleMetrics).filter(
      (metric) => metric === "podiumFinishes"
    )

    // If gapToFastest is visible and no other time metrics, use gap formatting
    // Otherwise, if gapToFastest is visible with other time metrics, still use gap (scale will be mixed)
    if (hasGapToFastest && !hasOtherTimeMetrics) return "gap"
    if (hasGapToFastest && hasOtherTimeMetrics) return "gap" // Mixed scale, but format as gap
    if (hasOtherTimeMetrics) return "time"
    if (
      hasStdDeviation &&
      !hasConsistency &&
      visiblePositionMetrics.length === 0 &&
      visibleCountMetrics.length === 0
    )
      return "decimal"
    if (hasConsistency) return "percentage"
    if (visiblePositionMetrics.length > 0) return "position"
    if (visibleCountMetrics.length > 0) return "count"
    return "time" // Default fallback
  }, [visibleMetrics])

  // Calculate Y scale domain based on visible metrics (must be before conditional return)
  const yScaleDomain = useMemo(() => {
    if (paginatedData.length === 0) {
      return [0, 100]
    }

    const allValues: number[] = []
    const hasGapToFastest = Array.from(visibleMetrics).includes("gapToFastest")

    paginatedData.forEach((d) => {
      visibleMetrics.forEach((metric) => {
        const key = metricConfig[metric].key
        const value = d[key]
        if (value === null || value === undefined || !isFinite(value as number)) {
          return
        }
        // For gapToFastest and podiumFinishes, 0 is valid
        if (metric === "gapToFastest" || metric === "podiumFinishes") {
          if ((value as number) >= 0) {
            allValues.push(value as number)
          }
        } else if (metric === "stdDeviation") {
          if ((value as number) >= 0) {
            allValues.push(value as number)
          }
        } else {
          // For other metrics, require > 0
          if ((value as number) > 0) {
            allValues.push(value as number)
          }
        }
      })
    })

    if (allValues.length === 0) {
      return [0, 100]
    }

    const min = Math.min(...allValues)
    const max = Math.max(...allValues)
    const padding = (max - min) * 0.1
    // For gapToFastest, allow negative values (though they shouldn't occur)
    const minDomain = hasGapToFastest ? min - padding : Math.max(0, min - padding)
    return [minDomain, max + padding]
  }, [paginatedData, visibleMetrics])

  // Early return for empty data in column view (after all hooks)
  // Default header title / tooltip scope: "All Classes" when unscoped or select-all; else class name.
  const dataScopeLabel =
    selectedClass === null
      ? "All Classes"
      : selectedClass
        ? allDriversInClassSelected
          ? "All Classes"
          : selectedClass
        : undefined

  const chartTitle =
    chartTitleOverride !== undefined ? (chartTitleOverride ?? "") : (dataScopeLabel ?? "")

  const hasScopeCluster =
    (availableClasses && availableClasses.length > 0 && onClassChange) ||
    (chartDriverOptions && onChartDriverSelectionChange) ||
    Boolean(headerAfterClassSelect)

  const resolvedOrderChartSortMetric = availableSortMetrics.has(sortBy) ? sortBy : effectiveSortBy

  const effectiveChartTitle = compact ? "" : chartTitle

  const headerControlsContent = (
    <div className="flex flex-wrap items-center gap-3">
      {hasScopeCluster && (
        <div
          className="inline-flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/35 px-2 py-1.5 sm:gap-3"
          aria-label="Chart data scope"
        >
          {availableClasses && availableClasses.length > 0 && onClassChange && (
            <div className="flex items-center gap-2">
              <select
                value={selectedClass ?? ""}
                onChange={(e) => onClassChange(e.target.value || null)}
                className="h-9 rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-1 text-sm text-[var(--token-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-accent)]"
                aria-label="Choose a Class"
              >
                <option value="">{classScopeSelectPlaceholderLabel}</option>
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
          )}
          {headerAfterClassSelect}
          {chartDriverOptions && onChartDriverSelectionChange && (
            <ChartDriverPicker
              drivers={chartDriverOptions}
              selectedDriverIds={chartSelectedDriverIds}
              onSelectionChange={onChartDriverSelectionChange}
              label="Select Drivers"
              disabled={chartDriverPickerDisabled}
              disabledTooltip={chartDriverPickerDisabledTooltip}
              closestDriverIdsByAnchor={chartDriverClosestIdsByAnchor}
              showClosestOnlyToggle={chartDriverClosestOnlyEnabled}
              closestCount={3}
            />
          )}
        </div>
      )}
      {(onChartViewChange || availableSortMetrics.size > 0) && (
        <div
          className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/35 px-2 py-1.5"
          aria-label="Chart display"
        >
          <div className="relative flex shrink-0">
            <button
              ref={performanceDisplayMenuButtonRef}
              type="button"
              onClick={() => {
                setPerformanceDisplayMenuOpen((wasOpen) => {
                  const next = !wasOpen
                  if (!next) queueMicrotask(() => setPerformanceOrderChartSubmenuOpen(false))
                  return next
                })
              }}
              className="flex items-center gap-2 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--token-text-primary)] transition hover:bg-[var(--token-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
              aria-expanded={performanceDisplayMenuOpen}
              aria-haspopup="menu"
              aria-label="Driver performance chart display options"
            >
              <span>Display</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[var(--token-text-muted)] transition-transform ${performanceDisplayMenuOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {performanceDisplayMenuOpen && (
              <div
                ref={performanceDisplayMenuPanelRef}
                role="group"
                aria-label="Driver performance chart display"
                className="absolute right-0 top-full z-50 mt-1 min-w-[220px] max-w-[min(100vw-1rem,280px)] overflow-visible rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] shadow-lg"
              >
                <div role="menu" aria-label="Display toggles" className="relative space-y-1 p-2">
                  {onChartViewChange ? (
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={chartView === "line"}
                      className={PERFORMANCE_DISPLAY_MENU_ROW_CLASS}
                      onClick={() => onChartViewChange(chartView === "line" ? "column" : "line")}
                    >
                      <span>Line chart</span>
                      <span
                        className="shrink-0 text-xs tabular-nums text-[var(--token-text-muted)]"
                        aria-hidden
                      >
                        {chartView === "line" ? "On" : "Off"}
                      </span>
                    </button>
                  ) : null}
                  {availableSortMetrics.size > 0 ? (
                    <div className="relative">
                      <button
                        type="button"
                        role="menuitem"
                        aria-haspopup="menu"
                        aria-expanded={performanceOrderChartSubmenuOpen}
                        aria-controls={orderChartSubmenuId}
                        className={PERFORMANCE_DISPLAY_MENU_ROW_CLASS}
                        onClick={() => setPerformanceOrderChartSubmenuOpen((prev) => !prev)}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">
                          <span className="shrink-0 text-sm text-[var(--token-text-primary)]">
                            Order Chart
                          </span>
                          <span className="min-w-0 truncate text-xs tabular-nums text-[var(--token-text-muted)]">
                            {metricConfig[resolvedOrderChartSortMetric].label}
                          </span>
                        </span>
                        <ChevronRight
                          aria-hidden
                          className={`h-4 w-4 shrink-0 text-[var(--token-text-muted)] transition-transform ${performanceOrderChartSubmenuOpen ? "rotate-90" : ""}`}
                        />
                      </button>
                      {performanceOrderChartSubmenuOpen && (
                        <div
                          id={orderChartSubmenuId}
                          role="menu"
                          aria-label="Order chart metric"
                          className="absolute left-full top-0 z-[60] ml-1 min-w-[220px] max-h-[min(70vh,24rem)] max-w-[min(100vw-1rem,280px)] space-y-1 overflow-y-auto rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-2 shadow-lg"
                        >
                          {SORT_BY_OPTIONS.filter((opt) =>
                            availableSortMetrics.has(opt.metric)
                          ).map((opt) => {
                            const active = opt.metric === resolvedOrderChartSortMetric
                            return (
                              <button
                                key={opt.metric}
                                type="button"
                                role="menuitemradio"
                                aria-checked={active}
                                className={PERFORMANCE_DISPLAY_MENU_ROW_CLASS}
                                onClick={() => {
                                  setSortBy(opt.metric)
                                  setPerformanceOrderChartSubmenuOpen(false)
                                }}
                              >
                                <span className="min-w-0 truncate">
                                  {metricConfig[opt.metric].label}
                                </span>
                                <span
                                  className="shrink-0 text-xs tabular-nums text-[var(--token-text-muted)]"
                                  aria-hidden
                                >
                                  {active ? "On" : "Off"}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div
                  className="border-t border-[var(--token-border-muted)] px-3 pb-2 pt-2 text-[0.7rem] leading-snug text-[var(--token-text-muted)]"
                  role="note"
                >
                  <p>{UNIFIED_CHART_TITLE_DESCRIPTION}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  if (displayData.length === 0) {
    const noDriversSelected = selectedDriverIds !== undefined && selectedDriverIds.length === 0
    const noScopedData = validData.length === 0
    const emptyStateTitle = noDriversSelected
      ? "No drivers selected"
      : noScopedData
        ? "No performance data in this scope"
        : "No comparable data in current filters"
    const emptyStateDescription = noDriversSelected
      ? "Select at least one driver to compare chart metrics."
      : noScopedData
        ? "The selected class/session does not contain chartable performance metrics."
        : "The current scope is valid, but no selected drivers have chartable values."
    const emptyStateHint = noDriversSelected
      ? "Use Select Drivers to choose who appears in this graph."
      : "Try adjusting class/session scope or selecting a different driver set."
    const compactEmptyHeight = Math.min(height, 250)

    return (
      <div ref={containerRef} className="relative">
        <ChartContainer
          title={effectiveChartTitle}
          description={UNIFIED_CHART_TITLE_DESCRIPTION}
          headerControls={compact ? undefined : headerControlsContent}
          height={compactEmptyHeight}
          className={className}
          aria-label="Driver performance chart - no data for the current scope"
        >
          <div
            id="event-analysis-performance-empty-state"
            className="relative min-h-[190px] w-full px-5 py-6"
          >
            <div className="pointer-events-none absolute inset-0 rounded-xl">
              <div className="absolute inset-x-6 top-4 bottom-12 rounded-lg border border-[var(--token-border-muted)]/45">
                <div className="absolute bottom-0 left-0 top-0 border-l border-[var(--token-border-muted)]/50" />
                <div className="absolute bottom-0 left-0 right-0 border-t border-[var(--token-border-muted)]/50" />
                <div className="absolute bottom-0 left-[20%] h-[25%] w-4 rounded-t bg-[var(--token-border-muted)]/40" />
                <div className="absolute bottom-0 left-[45%] h-[40%] w-4 rounded-t bg-[var(--token-border-muted)]/45" />
                <div className="absolute bottom-0 left-[70%] h-[58%] w-4 rounded-t bg-[var(--token-border-muted)]/50" />
              </div>
            </div>
            <div className="relative z-10 mx-auto w-full max-w-[42rem] min-w-[12rem] rounded-xl border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]/65 px-4 py-4 text-center shadow-sm backdrop-blur-sm">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--token-accent-soft-bg)] text-[var(--token-accent)]">
                <EmptyStateBarChartIcon />
              </div>
              <p className="text-sm font-semibold text-[var(--token-text-primary)]">
                {emptyStateTitle}
              </p>
              <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
                {emptyStateDescription}
              </p>
              <p className="mt-2 text-xs text-[var(--token-text-muted)]">{emptyStateHint}</p>
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
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <ChartContainer
        title={effectiveChartTitle}
        description={UNIFIED_CHART_TITLE_DESCRIPTION}
        headerControls={compact ? undefined : headerControlsContent}
        height={height}
        className={className}
        aria-label="Driver performance chart - best lap, average lap, gap, LiveRC session stats when available, and related metrics by driver"
        chartInstanceId={chartInstanceId}
        axisColorPicker={compact ? false : true}
        defaultAxisColors={{ x: DEFAULT_AXIS_COLOR, y: DEFAULT_AXIS_COLOR }}
        renderContent={({ axisColors: { xAxisColor, yAxisColor }, onAxisColorPickerRequest }) => (
          <>
            <div className="relative w-full" style={{ height: `${height}px` }}>
              <ParentSize>
                {({ width: parentWidth }) => {
                  const width = parentWidth || 800

                  if (width === 0) {
                    return null
                  }

                  const innerWidth = width - margin.left - margin.right
                  const innerHeight = height - margin.top - margin.bottom

                  // Band domain must be unique per column; duplicate display names share one band
                  // with d3.scaleBand (indexOf), causing vertical segments at the same x.
                  const driverLabelById = new Map(
                    paginatedData.map((d) => [d.driverId, d.driverName] as const)
                  )

                  // X scale (one band per driver id; axis labels still show driverName)
                  const xScale = scaleBand({
                    range: [0, innerWidth],
                    domain: paginatedData.map((d) => d.driverId),
                    padding: 0.3,
                  })

                  // Y scale (metric values)
                  const yScale = scaleLinear({
                    range: [innerHeight, 0],
                    domain: yScaleDomain,
                    nice: true,
                  })

                  // Calculate bar width (column view only)
                  const visibleCount = visibleMetrics.size
                  const barWidth =
                    visibleCount > 0 ? xScale.bandwidth() / visibleCount : xScale.bandwidth()

                  // Line view: one series per visible metric (same data as column)
                  const lineSeriesByMetric: Array<{
                    metric: MetricType
                    points: Array<{
                      x: number
                      y: number
                      driver: DriverPerformanceData
                      value: number
                    }>
                  }> = []
                  if (chartView === "line") {
                    Array.from(visibleMetrics).forEach((metric) => {
                      const key = metricConfig[metric].key
                      const points: Array<{
                        x: number
                        y: number
                        driver: DriverPerformanceData
                        value: number
                      }> = []
                      paginatedData.forEach((d) => {
                        const value = d[key]
                        if (value === null || value === undefined || !isFinite(value as number))
                          return
                        if (
                          metric === "gapToFastest" ||
                          metric === "podiumFinishes" ||
                          metric === "stdDeviation"
                        ) {
                          if ((value as number) < 0) return
                        } else if ((value as number) <= 0) return
                        const bandX = xScale(d.driverId) ?? 0
                        const centerX = bandX + xScale.bandwidth() / 2
                        points.push({
                          x: centerX,
                          y: yScale(value as number),
                          driver: d,
                          value: value as number,
                        })
                      })
                      if (points.length > 0) {
                        points.sort((a, b) =>
                          a.x !== b.x
                            ? a.x - b.x
                            : a.driver.driverId.localeCompare(b.driver.driverId)
                        )
                        lineSeriesByMetric.push({ metric, points })
                      }
                    })
                  }

                  return (
                    <div className="relative w-full" style={{ width, height }}>
                      <svg
                        width={width}
                        height={height}
                        aria-labelledby={chartDescId}
                        role="img"
                        overflow={compact ? "hidden" : "visible"}
                      >
                        <desc id={chartDescId}>
                          {chartView === "line"
                            ? "Line chart showing performance metrics for each driver. Visible metrics: "
                            : "Bar chart showing performance metrics for each driver. Visible metrics: "}
                          {Array.from(visibleMetrics)
                            .map((m) => metricConfig[m].label)
                            .join(", ")}
                        </desc>
                        <Group left={margin.left} top={margin.top}>
                          {/* Grid lines */}
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

                          {/* Chart elements - Line view (same data as column). focus:outline-none prevents browser default focus rectangle. */}
                          {chartView === "line" &&
                            lineSeriesByMetric.map(({ metric, points }) => {
                              const color = computedColors[metric]
                              return (
                                <Group
                                  key={metric}
                                  className="focus:outline-none"
                                  onMouseLeave={chartInteractive ? () => hideTooltip() : undefined}
                                  onClick={
                                    chartInteractive
                                      ? (e) => handleBarClickForColorPicker(metric, e)
                                      : undefined
                                  }
                                  onKeyDown={
                                    chartInteractive
                                      ? (e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault()
                                            handleBarClickForColorPicker(
                                              metric,
                                              e as React.KeyboardEvent<SVGElement>
                                            )
                                          }
                                        }
                                      : undefined
                                  }
                                  style={{ cursor: chartInteractive ? "pointer" : "default" }}
                                  role={chartInteractive ? "button" : undefined}
                                  tabIndex={chartInteractive ? 0 : undefined}
                                  aria-label={
                                    chartInteractive
                                      ? `${metricConfig[metric].label} - Click to change color`
                                      : undefined
                                  }
                                >
                                  {/* Invisible wide path for easier line hover + tooltip */}
                                  <LinePath
                                    data={points}
                                    x={(p) => p.x}
                                    y={(p) => p.y}
                                    stroke="transparent"
                                    strokeWidth={20}
                                    curve={curveMonotoneX}
                                    pointerEvents={chartInteractive ? "stroke" : "none"}
                                    onMouseMove={
                                      chartInteractive
                                        ? (event) => {
                                            const svgElement = (event.target as SVGElement)
                                              .ownerSVGElement
                                            if (!svgElement || points.length === 0) return
                                            const coords = localPoint(svgElement, event)
                                            if (!coords) return
                                            const innerX = coords.x - margin.left
                                            let nearest = points[0]
                                            let minDist = Math.abs(points[0].x - innerX)
                                            for (let i = 1; i < points.length; i++) {
                                              const dist = Math.abs(points[i].x - innerX)
                                              if (dist < minDist) {
                                                minDist = dist
                                                nearest = points[i]
                                              }
                                            }
                                            showTooltip({
                                              tooltipLeft: coords.x,
                                              tooltipTop: coords.y,
                                              tooltipData: nearest.driver,
                                            })
                                          }
                                        : undefined
                                    }
                                  />
                                  <LinePath
                                    data={points}
                                    x={(p) => p.x}
                                    y={(p) => p.y}
                                    stroke={color}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    curve={curveMonotoneX}
                                    pointerEvents="none"
                                  />
                                </Group>
                              )
                            })}

                          {/* Chart elements - Bar chart */}
                          {chartView === "column" &&
                            paginatedData.map((d) => {
                              const x = xScale(d.driverId) || 0
                              const isSelected =
                                selectedDriverIds === undefined ||
                                selectedDriverIds.length === 0 ||
                                selectedDriverIds.includes(d.driverId)

                              const handleDriverToggle = () => {
                                if (onDriverToggle) {
                                  onDriverToggle(d.driverId)
                                }
                              }

                              const handleMouseMove = (event: React.MouseEvent<SVGElement>) => {
                                const svgElement = (event.target as SVGElement).ownerSVGElement
                                if (!svgElement) return
                                const coords = localPoint(svgElement, event)
                                if (coords) {
                                  showTooltip({
                                    tooltipLeft: coords.x,
                                    tooltipTop: coords.y,
                                    tooltipData: d,
                                  })
                                }
                              }

                              return (
                                <Group key={d.driverId}>
                                  {Array.from(visibleMetrics).map((metric, metricIndex) => {
                                    const key = metricConfig[metric].key
                                    const value = d[key]

                                    if (
                                      value === null ||
                                      value === undefined ||
                                      !isFinite(value as number)
                                    ) {
                                      return null
                                    }

                                    // gap, podium, std dev: 0 valid; other metrics: need > 0
                                    if (
                                      metric === "gapToFastest" ||
                                      metric === "podiumFinishes" ||
                                      metric === "stdDeviation"
                                    ) {
                                      if ((value as number) < 0) {
                                        return null
                                      }
                                    } else {
                                      if ((value as number) <= 0) {
                                        return null
                                      }
                                    }

                                    const metricValue = value as number
                                    const color = computedColors[metric]
                                    const metricX = x + metricIndex * barWidth

                                    return (
                                      <Bar
                                        key={metric}
                                        className="focus:outline-none"
                                        x={metricX}
                                        y={yScale(metricValue)}
                                        width={barWidth}
                                        height={innerHeight - yScale(metricValue)}
                                        fill={color}
                                        opacity={isSelected ? 1 : 0.3}
                                        stroke={
                                          isSelected &&
                                          selectedDriverIds !== undefined &&
                                          selectedDriverIds.length > 0
                                            ? color
                                            : "none"
                                        }
                                        strokeWidth={
                                          isSelected &&
                                          selectedDriverIds !== undefined &&
                                          selectedDriverIds.length > 0
                                            ? 1.5
                                            : 0
                                        }
                                        onClick={
                                          chartInteractive
                                            ? (e) => handleBarClickForColorPicker(metric, e)
                                            : undefined
                                        }
                                        onContextMenu={
                                          chartInteractive
                                            ? (e) => {
                                                e.preventDefault()
                                                handleDriverToggle()
                                              }
                                            : undefined
                                        }
                                        onMouseMove={chartInteractive ? handleMouseMove : undefined}
                                        onMouseLeave={
                                          chartInteractive ? () => hideTooltip() : undefined
                                        }
                                        onTouchStart={
                                          chartInteractive
                                            ? (event) => {
                                                const svgElement = (event.target as SVGElement)
                                                  .ownerSVGElement
                                                if (!svgElement) return
                                                const coords = localPoint(svgElement, event)
                                                if (coords) {
                                                  showTooltip({
                                                    tooltipLeft: coords.x,
                                                    tooltipTop: coords.y,
                                                    tooltipData: d,
                                                  })
                                                }
                                              }
                                            : undefined
                                        }
                                        onTouchEnd={
                                          chartInteractive
                                            ? (e) => {
                                                hideTooltip()
                                                const syntheticEvent = {
                                                  ...e,
                                                  stopPropagation: () => e.stopPropagation(),
                                                  currentTarget: e.currentTarget,
                                                } as unknown as React.MouseEvent<SVGElement>
                                                handleBarClickForColorPicker(metric, syntheticEvent)
                                              }
                                            : undefined
                                        }
                                        style={{ cursor: chartInteractive ? "pointer" : "default" }}
                                        aria-label={
                                          chartInteractive
                                            ? `${d.driverName}: ${metricConfig[metric].label} ${
                                                metric === "gapToFastest"
                                                  ? formatGapToFastest(metricValue)
                                                  : metricConfig[metric].isTimeBased
                                                    ? formatLapTime(metricValue)
                                                    : metric === "averagePosition"
                                                      ? formatPosition(metricValue)
                                                      : metric === "podiumFinishes"
                                                        ? Math.round(metricValue).toString()
                                                        : metricValue.toFixed(2)
                                              }. Click to customize color, right-click to toggle driver selection`
                                            : undefined
                                        }
                                        role={chartInteractive ? "button" : undefined}
                                        tabIndex={chartInteractive ? 0 : undefined}
                                        onKeyDown={
                                          chartInteractive
                                            ? (e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                  e.preventDefault()
                                                  handleBarClickForColorPicker(
                                                    metric,
                                                    e as React.KeyboardEvent<SVGElement>
                                                  )
                                                }
                                              }
                                            : undefined
                                        }
                                      />
                                    )
                                  })}
                                </Group>
                              )
                            })}

                          {!compact ? (
                            <>
                              {/* Y-axis - clickable to open color picker */}
                              <Group
                                style={{ cursor: "pointer" }}
                                onClick={(e) => onAxisColorPickerRequest("y", e)}
                                aria-label="Y-axis - Click to change color"
                              >
                                <AxisLeft
                                  scale={yScale}
                                  tickFormat={(value) => {
                                    if (yAxisFormatType === "gap") {
                                      return formatGapToFastest(Number(value))
                                    }
                                    if (yAxisFormatType === "position") {
                                      return formatPosition(Number(value))
                                    }
                                    if (yAxisFormatType === "count") {
                                      return Math.round(Number(value)).toString()
                                    }
                                    if (yAxisFormatType === "percentage") {
                                      return `${Number(value).toFixed(1)}%`
                                    }
                                    if (yAxisFormatType === "decimal") {
                                      return Number(value).toFixed(2)
                                    }
                                    return formatLapTime(Number(value))
                                  }}
                                  stroke={yAxisColor}
                                  tickStroke={yAxisColor}
                                  tickLabelProps={() => ({
                                    fill: yAxisColor,
                                    fontSize: 12,
                                    textAnchor: "end",
                                    dx: -8,
                                  })}
                                />
                                {/* Hit target only in the left margin — a rect at x=0 with fixed width sat on top of the first driver column and stole bar hover/tooltips. */}
                                <rect
                                  x={-margin.left}
                                  y={0}
                                  width={margin.left}
                                  height={innerHeight}
                                  fill="transparent"
                                  pointerEvents="all"
                                />
                              </Group>

                              {/* X-axis - clickable to open color picker */}
                              <Group
                                style={{ cursor: "pointer" }}
                                onClick={(e) => onAxisColorPickerRequest("x", e)}
                                aria-label="X-axis - Click to change color"
                              >
                                <AxisBottom
                                  top={innerHeight}
                                  scale={xScale}
                                  tickValues={paginatedData.map((d) => d.driverId)}
                                  tickFormat={(id) => driverLabelById.get(String(id)) ?? String(id)}
                                  stroke={xAxisColor}
                                  tickStroke={xAxisColor}
                                  tickLabelProps={() => ({
                                    fill: xAxisColor,
                                    fontSize: 11,
                                    textAnchor: "end",
                                    angle: -45,
                                    dx: -5,
                                    dy: 8,
                                  })}
                                />
                                <rect
                                  x={0}
                                  y={innerHeight}
                                  width={innerWidth}
                                  height={60}
                                  fill="transparent"
                                  pointerEvents="all"
                                />
                              </Group>
                            </>
                          ) : null}
                        </Group>
                      </svg>
                    </div>
                  )
                }}
              </ParentSize>
            </div>

            {/* Tooltip — layout aligned with LapByLapTrendChart (sectioned, token styling) */}
            {chartInteractive && tooltipOpen && tooltipData && (
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
                      {dataScopeLabel ?? "All Classes"}
                      <span className="text-[var(--token-text-muted)]"> · </span>
                      {chartView === "line" ? "Line chart" : "Column chart"}
                      <span className="text-[var(--token-text-muted)]"> · </span>
                      Sort: {metricConfig[effectiveSortBy].label}
                    </div>
                  </div>

                  <div className="rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface)]/50 px-2.5 py-2">
                    <div className="space-y-4">
                      {TOOLTIP_METRIC_ORDER.filter((metric) => visibleMetrics.has(metric)).map(
                        (metric) => {
                          const key = metricConfig[metric].key
                          const value = tooltipData[key]
                          if (value === null || value === undefined || !isFinite(value as number)) {
                            return null
                          }
                          if (
                            metric !== "gapToFastest" &&
                            metric !== "podiumFinishes" &&
                            metric !== "stdDeviation"
                          ) {
                            if ((value as number) <= 0) return null
                          } else if ((value as number) < 0) {
                            return null
                          }
                          const formattedValue = formatUnifiedTooltipMetricValue(
                            metric,
                            value as number
                          )
                          const caption = unifiedTooltipMetricCaption(metric, tooltipData)
                          const isMonoPrimary =
                            metricConfig[metric].isTimeBased || metric === "gapToFastest"
                          return (
                            <div key={metric}>
                              <div className="text-[0.65rem] font-medium uppercase tracking-wide text-[var(--token-text-muted)]">
                                {metricConfig[metric].label}
                              </div>
                              <div
                                className={`tabular-nums leading-tight ${
                                  isMonoPrimary ? `font-mono ${typography.h4}` : typography.h5
                                }`}
                              >
                                {formattedValue}
                              </div>
                              {caption && (
                                <div className="mt-0.5 text-xs text-[var(--token-text-muted)]">
                                  {caption}
                                </div>
                              )}
                            </div>
                          )
                        }
                      )}
                    </div>
                  </div>
                </div>
              </TooltipWithBounds>
            )}

            {!compact ? (
              <>
                {/* Clickable Legend */}
                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
                  {Array.from(availableMetrics).map((metric) => {
                    const isVisible = visibleMetrics.has(metric)
                    const canToggle = isVisible ? visibleMetrics.size > 1 : true
                    const legendTooltipText = metricConfig[metric].tooltipDescription

                    return (
                      <Tooltip key={metric} text={legendTooltipText} position="top">
                        <div
                          className={`flex items-center gap-2 transition-opacity ${
                            canToggle
                              ? "cursor-pointer hover:opacity-80"
                              : "cursor-not-allowed opacity-50"
                          } ${!isVisible ? "opacity-40" : ""}`}
                          onClick={() => {
                            if (canToggle) {
                              toggleMetric(metric)
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              if (canToggle) {
                                toggleMetric(metric)
                              }
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`${metricConfig[metric].label} - ${isVisible ? "Visible" : "Hidden"}. Click to toggle visibility`}
                        >
                          <div
                            className={`w-4 h-4 rounded-sm transition-all ${isVisible ? "" : "opacity-30"}`}
                            style={{
                              backgroundColor: isVisible
                                ? computedColors[metric]
                                : computedColors[metric],
                              border: `1px solid ${computedColors[metric]}`,
                            }}
                          />
                          <span
                            className={`text-[var(--token-text-secondary)] ${
                              !isVisible ? "line-through opacity-50" : ""
                            }`}
                          >
                            {metricConfig[metric].label}
                          </span>
                          {!isVisible && (
                            <span className="text-xs text-[var(--token-text-muted)]">(hidden)</span>
                          )}
                        </div>
                      </Tooltip>
                    )
                  })}
                </div>

                {/* Pagination */}
                {onPageChange && totalPages > 1 && (
                  <ChartPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                    itemsPerPage={driversPerPage}
                    totalItems={sortedData.length}
                    itemLabel="drivers"
                  />
                )}
              </>
            ) : null}
          </>
        )}
      />

      {/* Color Picker - positioned absolutely within container */}
      {showColorPicker && colorPickerPosition && colorPickerMetric && (
        <ChartColorPicker
          currentColor={colors[colorPickerMetric] || defaultColors[colorPickerMetric]}
          onColorChange={(color) => setColor(colorPickerMetric, color)}
          onClose={() => {
            setShowColorPicker(false)
            setColorPickerMetric(null)
          }}
          position={colorPickerPosition}
          label={`${metricConfig[colorPickerMetric].label} Color`}
        />
      )}
    </div>
  )
}
