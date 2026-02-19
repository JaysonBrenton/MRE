/**
 * @fileoverview Unified performance chart with toggleable metrics and chart types
 *
 * @created 2025-01-28
 * @creator Auto-generated
 * @lastModified 2025-01-28
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

import { useMemo, useId, useState, useRef, useCallback, useEffect } from "react"
import { Group } from "@visx/group"
import { Bar, LinePath } from "@visx/shape"
import { curveMonotoneX } from "@visx/curve"
import { scaleBand, scaleLinear } from "@visx/scale"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import { ParentSize } from "@visx/responsive"
import ChartContainer from "./ChartContainer"
import ChartDriverPicker from "./ChartDriverPicker"
import ChartPagination from "./ChartPagination"
import ChartColorPicker from "./ChartColorPicker"
import Tooltip from "@/components/molecules/Tooltip"
import { useChartColors } from "@/hooks/useChartColors"

export type ChartViewType = "column" | "line"

// Metric types - extensible for future metrics
export type MetricType =
  | "bestLap"
  | "averageLap"
  | "consistency"
  | "averagePosition"
  | "gapToFastest"
  | "podiumFinishes"

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
  /** Available race classes for per-chart class picker. */
  availableClasses?: string[]
  /** Handler for changing the global class filter from the chart header. */
  onClassChange?: (className: string | null) => void
}

/** Metrics that can be used to sort drivers (best to worst). */
export type SortByMetricType =
  | "bestLap"
  | "averageLap"
  | "consistency"
  | "gapToFastest"
  | "averagePosition"
  | "podiumFinishes"

const defaultMargin = { top: 20, right: 20, bottom: 100, left: 80 }

function ChartViewToggle({
  chartView,
  onChartViewChange,
}: {
  chartView: ChartViewType
  onChartViewChange: (view: ChartViewType) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--token-text-secondary)]">Chart type:</span>
      <div className="flex rounded-lg border border-[var(--token-border-default)] p-0.5 bg-[var(--token-surface-elevated)]">
        <button
          type="button"
          onClick={() => onChartViewChange("column")}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            chartView === "column"
              ? "bg-[var(--token-accent)] text-white"
              : "text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:bg-[var(--token-surface)]"
          }`}
          aria-pressed={chartView === "column"}
          aria-label="Show column chart"
        >
          Column
        </button>
        <button
          type="button"
          onClick={() => onChartViewChange("line")}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            chartView === "line"
              ? "bg-[var(--token-accent)] text-white"
              : "text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:bg-[var(--token-surface)]"
          }`}
          aria-pressed={chartView === "line"}
          aria-label="Show line chart"
        >
          Line
        </button>
      </div>
    </div>
  )
}

function SortByDropdown({
  sortBy,
  onSortByChange,
  availableSortMetrics,
}: {
  sortBy: SortByMetricType
  onSortByChange: (metric: SortByMetricType) => void
  availableSortMetrics: Set<SortByMetricType>
}) {
  if (availableSortMetrics.size === 0) return null
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort-by-select" className="text-sm text-[var(--token-text-secondary)]">
        Sort by:
      </label>
      <select
        id="sort-by-select"
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value as SortByMetricType)}
        className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-1.5 text-sm text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-accent)]"
        aria-label="Sort drivers by metric (best to worst)"
      >
        {SORT_BY_OPTIONS.filter((opt) => availableSortMetrics.has(opt.metric)).map((opt) => (
          <option key={opt.metric} value={opt.metric}>
            {metricConfig[opt.metric].label}
          </option>
        ))}
      </select>
    </div>
  )
}

const defaultColors = {
  bestLap: "var(--token-accent)",
  averageLap: "#5aa2ff",
  consistency: "#4ecdc4", // Future metric color
  averagePosition: "#ff6b6b", // Red color for position metric
  gapToFastest: "#ffa500", // Orange color for gap metric
  podiumFinishes: "#9b59b6", // Purple color for podium metric
}
const textColor = "var(--token-text-primary)"
const _textSecondaryColor = "var(--token-text-secondary)"
const borderColor = "var(--token-border-default)"
const DEFAULT_AXIS_COLOR = "#ffffff"

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
  availableClasses,
  onClassChange,
}: UnifiedPerformanceChartProps) {
  const chartDescId = useId()
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

  // Filter data based on visible metrics and validate
  const validData = useMemo(() => {
    return data.filter((d) => {
      // Include driver if at least one visible metric has valid data
      return Array.from(visibleMetrics).some((metric) => {
        const key = metricConfig[metric].key
        const value = d[key]
        if (value === null || value === undefined || !isFinite(value as number)) {
          return false
        }
        // For gapToFastest and podiumFinishes, 0 is a valid value
        if (metric === "gapToFastest" || metric === "podiumFinishes") {
          return (value as number) >= 0
        }
        // For other metrics, require > 0
        return (value as number) > 0
      })
    })
  }, [data, visibleMetrics])

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
    const labelLengths = paginatedData.map((d) => d.driverName)
    const dynamicBottom = calculateBottomMargin(labelLengths, 100)
    return { ...defaultMargin, bottom: dynamicBottom }
  }, [paginatedData])

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
      (m) => m === "bestLap" || m === "averageLap"
    )
    const hasConsistency = Array.from(visibleMetrics).includes("consistency")
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
  // Show "All Classes" when:
  // 1. selectedClass is null (user selected "All Classes" from dropdown)
  // 2. A class is selected AND all drivers in that class are selected AND user clicked "Select All"
  const chartTitle =
    selectedClass === null
      ? "All Classes"
      : selectedClass
        ? allDriversInClassSelected
          ? "All Classes"
          : selectedClass
        : undefined

  const headerControlsContent = (
    <>
      {availableClasses && availableClasses.length > 0 && onClassChange && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--token-text-secondary)]">Choose a Class:</span>
          <select
            value={selectedClass ?? ""}
            onChange={(e) => onClassChange(e.target.value || null)}
            className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-1.5 text-sm text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-accent)]"
            aria-label="Choose a Class"
          >
            <option value="">All Classes</option>
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>
      )}
      {chartDriverOptions && onChartDriverSelectionChange && (
        <ChartDriverPicker
          drivers={chartDriverOptions}
          selectedDriverIds={chartSelectedDriverIds}
          onSelectionChange={onChartDriverSelectionChange}
          label="Select Drivers"
        />
      )}
      {onChartViewChange && (
        <ChartViewToggle chartView={chartView} onChartViewChange={onChartViewChange} />
      )}
      <SortByDropdown
        sortBy={availableSortMetrics.has(sortBy) ? sortBy : effectiveSortBy}
        onSortByChange={setSortBy}
        availableSortMetrics={availableSortMetrics}
      />
    </>
  )

  if (displayData.length === 0) {
    return (
      <div ref={containerRef} className="relative">
        <ChartContainer
          title={chartTitle}
          headerControls={headerControlsContent}
          height={height}
          className={className}
          aria-label="Performance metrics chart - no data available"
        >
          <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
            {validData.length === 0 ? "No data available" : "Select drivers to compare"}
          </div>
        </ChartContainer>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <ChartContainer
        title={chartTitle}
        headerControls={headerControlsContent}
        height={height}
        className={className}
        aria-label="Unified performance metrics chart"
        chartInstanceId={chartInstanceId}
        axisColorPicker
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

                  // X scale (driver names)
                  const xScale = scaleBand({
                    range: [0, innerWidth],
                    domain: paginatedData.map((d) => d.driverName),
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
                        if (metric === "gapToFastest" || metric === "podiumFinishes") {
                          if ((value as number) < 0) return
                        } else if ((value as number) <= 0) return
                        const bandX = xScale(d.driverName) ?? 0
                        const centerX = bandX + xScale.bandwidth() / 2
                        points.push({
                          x: centerX,
                          y: yScale(value as number),
                          driver: d,
                          value: value as number,
                        })
                      })
                      if (points.length > 0) lineSeriesByMetric.push({ metric, points })
                    })
                  }

                  return (
                    <svg
                      width={width}
                      height={height}
                      aria-labelledby={chartDescId}
                      role="img"
                      overflow="visible"
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
                                onMouseLeave={() => hideTooltip()}
                                onClick={(e) => handleBarClickForColorPicker(metric, e)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    handleBarClickForColorPicker(
                                      metric,
                                      e as React.KeyboardEvent<SVGElement>
                                    )
                                  }
                                }}
                                style={{ cursor: "pointer" }}
                                role="button"
                                tabIndex={0}
                                aria-label={`${metricConfig[metric].label} - Click to change color`}
                              >
                                {/* Invisible wide path for easier line hover + tooltip */}
                                <LinePath
                                  data={points}
                                  x={(p) => p.x}
                                  y={(p) => p.y}
                                  stroke="transparent"
                                  strokeWidth={20}
                                  curve={curveMonotoneX}
                                  pointerEvents="stroke"
                                  onMouseMove={(event) => {
                                    const svgElement = (event.target as SVGElement).ownerSVGElement
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
                                  }}
                                />
                                <LinePath
                                  data={points}
                                  x={(p) => p.x}
                                  y={(p) => p.y}
                                  stroke={color}
                                  strokeWidth={2}
                                  curve={curveMonotoneX}
                                  pointerEvents="none"
                                />
                              </Group>
                            )
                          })}

                        {/* Chart elements - Bar chart */}
                        {chartView === "column" &&
                          paginatedData.map((d) => {
                            const x = xScale(d.driverName) || 0
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

                                  // For gapToFastest and podiumFinishes, 0 is a valid value
                                  if (metric === "gapToFastest" || metric === "podiumFinishes") {
                                    if ((value as number) < 0) {
                                      return null
                                    }
                                  } else {
                                    // For other metrics, require > 0
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
                                      onClick={(e) => {
                                        // Click on bar opens color picker for that metric
                                        handleBarClickForColorPicker(metric, e)
                                      }}
                                      onContextMenu={(e) => {
                                        // Right-click toggles driver selection
                                        e.preventDefault()
                                        handleDriverToggle()
                                      }}
                                      onMouseMove={handleMouseMove}
                                      onMouseLeave={() => hideTooltip()}
                                      onTouchStart={(event) => {
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
                                      }}
                                      onTouchEnd={(e) => {
                                        hideTooltip()
                                        // Long press or double tap could open color picker
                                        // Convert touch event to mouse event for handler
                                        const syntheticEvent = {
                                          ...e,
                                          stopPropagation: () => e.stopPropagation(),
                                          currentTarget: e.currentTarget,
                                        } as unknown as React.MouseEvent<SVGElement>
                                        handleBarClickForColorPicker(metric, syntheticEvent)
                                      }}
                                      style={{ cursor: "pointer" }}
                                      aria-label={`${d.driverName}: ${metricConfig[metric].label} ${
                                        metric === "gapToFastest"
                                          ? formatGapToFastest(metricValue)
                                          : metricConfig[metric].isTimeBased
                                            ? formatLapTime(metricValue)
                                            : metric === "averagePosition"
                                              ? formatPosition(metricValue)
                                              : metric === "podiumFinishes"
                                                ? Math.round(metricValue).toString()
                                                : metricValue.toFixed(2)
                                      }. Click to customize color, right-click to toggle driver selection`}
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault()
                                          // Keyboard event is compatible with the handler signature
                                          handleBarClickForColorPicker(
                                            metric,
                                            e as React.KeyboardEvent<SVGElement>
                                          )
                                        }
                                      }}
                                    />
                                  )
                                })}
                              </Group>
                            )
                          })}

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
                          <rect
                            x={0}
                            y={0}
                            width={80}
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
                            tickValues={paginatedData.map((d) => d.driverName)}
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
                      </Group>
                    </svg>
                  )
                }}
              </ParentSize>

              {/* Tooltip */}
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
                    borderRadius: "4px",
                  }}
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-[var(--token-text-primary)]">
                      {tooltipData.driverName}
                    </div>
                    {Array.from(visibleMetrics).map((metric) => {
                      const key = metricConfig[metric].key
                      const value = tooltipData[key]
                      if (value === null || value === undefined) return null
                      let formattedValue: string
                      if (metric === "gapToFastest") {
                        formattedValue = formatGapToFastest(value as number)
                      } else if (metric === "podiumFinishes") {
                        formattedValue = Math.round(value as number).toString()
                      } else if (metric === "averagePosition") {
                        formattedValue = formatPosition(value as number)
                      } else if (metric === "consistency") {
                        formattedValue = `${(value as number).toFixed(1)}%`
                      } else if (metricConfig[metric].isTimeBased) {
                        formattedValue = formatLapTime(value as number)
                      } else {
                        formattedValue = (value as number).toFixed(2)
                      }
                      return (
                        <div key={metric} className="text-sm text-[var(--token-text-secondary)]">
                          {metricConfig[metric].label}: {formattedValue}
                          {metric === "bestLap" && tooltipData.bestLapRaceLabel && (
                            <span className="text-xs text-[var(--token-text-muted)] ml-2">
                              ({tooltipData.bestLapRaceLabel})
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </TooltipWithBounds>
              )}
            </div>

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
