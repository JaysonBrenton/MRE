/**
 * @fileoverview Chart container component - base wrapper for all charts with MRE theming
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Base wrapper component for all Visx charts with MRE token-based theming
 *
 * @purpose Provides consistent theming, responsive sizing, and accessibility for all charts.
 *          Applies MRE dark theme tokens to Visx charts.
 *
 * @relatedFiles
 * - src/components/event-analysis/BestLapBarChart.tsx (uses this)
 * - src/components/event-analysis/AvgVsFastestChart.tsx (uses this)
 * - docs/design/mre-dark-theme-guidelines.md (token system)
 */

"use client"

import { ReactNode, useState, useCallback } from "react"
import ChartColorPicker from "./ChartColorPicker"
import { useChartColor } from "@/hooks/useChartColors"

const DEFAULT_AXIS_COLOR = "#ffffff"

/** Resolve CSS variable to hex for display in color picker; returns input if already hex. */
function resolveAxisColorForPicker(color: string): string {
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) return color
  if (typeof window === "undefined" || !color.startsWith("var(")) return color
  const match = color.match(/var\(([^)]+)\)/)
  if (!match) return DEFAULT_AXIS_COLOR
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(match[1].trim())
    .trim()
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(resolved)) return resolved
  if (resolved.startsWith("rgb")) {
    const [r, g, b] = resolved.match(/\d+/g)?.map(Number) ?? []
    if (r != null && g != null && b != null) {
      return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`
    }
  }
  return DEFAULT_AXIS_COLOR
}

export type AxisColorKey = "x" | "y" | "yRight"

export interface ChartContainerProps {
  children: ReactNode
  title?: string
  /** Optional class for the title element; when set, overrides default title styling (e.g. to match label style) */
  titleClassName?: string
  description?: string
  height?: number
  className?: string
  "aria-label"?: string
  chartInstanceId?: string
  onTitleClick?: () => void
  selectedClass?: string | null
  /** Enable axis color pickers for X and/or Y axes. true = [x, y], or pass specific keys (e.g. ['x','y','yRight'] for OverviewChart). */
  axisColorPicker?: boolean | AxisColorKey[]
  /** Default colors for axis pickers when no custom color is stored. Used for swatch display and picker default. */
  defaultAxisColors?: { x?: string; y?: string; yRight?: string }
  /** When provided with axisColorPicker, chart content receives current axis colors so picker changes update the chart. */
  renderContent?: (axisColors: AxisColors) => ReactNode
  /** Optional controls (e.g. chart type toggle, sort dropdown) rendered in the header row between title and axis pickers. */
  headerControls?: ReactNode
}

export interface AxisColors {
  xAxisColor: string
  yAxisColor: string
  yAxisRightColor: string
}

function axisKeyToSeriesName(key: AxisColorKey): "xAxis" | "yAxis" | "yAxisRight" {
  return key === "x" ? "xAxis" : key === "y" ? "yAxis" : "yAxisRight"
}

function axisKeyLabel(key: AxisColorKey): string {
  return key === "x" ? "X-axis" : key === "y" ? "Y-axis" : "Y-axis (right)"
}

/**
 * Chart container with MRE theming and responsive sizing
 */
export default function ChartContainer({
  children,
  title,
  titleClassName,
  description,
  height = 400,
  className = "",
  "aria-label": ariaLabel,
  chartInstanceId,
  onTitleClick,
  selectedClass,
  axisColorPicker,
  defaultAxisColors = {},
  renderContent,
  headerControls,
}: ChartContainerProps) {
  const axisKeys: AxisColorKey[] =
    axisColorPicker === true
      ? ["x", "y"]
      : Array.isArray(axisColorPicker)
        ? axisColorPicker
        : []

  const showAxisPickers = axisKeys.length > 0 && Boolean(chartInstanceId)

  const [axisPickerOpen, setAxisPickerOpen] = useState<AxisColorKey | null>(null)
  const [axisPickerPosition, setAxisPickerPosition] = useState<{ top: number; left: number } | null>(
    null
  )

  const [xAxisColor, setXAxisColor] = useChartColor(
    chartInstanceId ?? "",
    "xAxis",
    defaultAxisColors.x ?? DEFAULT_AXIS_COLOR
  )
  const [yAxisColor, setYAxisColor] = useChartColor(
    chartInstanceId ?? "",
    "yAxis",
    defaultAxisColors.y ?? DEFAULT_AXIS_COLOR
  )
  const [yAxisRightColor, setYAxisRightColor] = useChartColor(
    chartInstanceId ?? "",
    "yAxisRight",
    defaultAxisColors.yRight ?? DEFAULT_AXIS_COLOR
  )

  const axisColorByKey: Record<AxisColorKey, string> = {
    x: xAxisColor,
    y: yAxisColor,
    yRight: yAxisRightColor,
  }
  const setAxisColorByKey: Record<
    AxisColorKey,
    (color: string) => void
  > = {
    x: setXAxisColor,
    y: setYAxisColor,
    yRight: setYAxisRightColor,
  }

  const handleAxisPickerClick = useCallback((key: AxisColorKey, event: React.MouseEvent) => {
    event.stopPropagation()
    const target = event.currentTarget
    const rect = target.getBoundingClientRect()
    setAxisPickerPosition({ top: rect.bottom + 8, left: rect.left })
    setAxisPickerOpen(key)
  }, [])

  const handleAxisColorChange = useCallback(
    (key: AxisColorKey) => (color: string) => {
      setAxisColorByKey[key](color)
    },
    []
  )

  return (
    <div
      className={`w-full relative ${className}`}
      style={{
        minHeight: `${height}px`,
        backgroundColor: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        borderRadius: "16px",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow), var(--glass-shadow-inset)",
        padding: "20px",
        overflow: "hidden",
      }}
      role="img"
      aria-label={ariaLabel || title || "Chart"}
    >
      {/* Subtle gradient overlay for extra glass depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0) 100%)",
          borderRadius: "16px",
        }}
      />
      {/* Subtle top highlight for glass edge effect */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)",
          borderRadius: "16px 16px 0 0",
        }}
      />
      {/* Content wrapper */}
      <div className="relative z-10">
        {(title || headerControls || showAxisPickers) && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex flex-wrap items-center gap-4 min-w-0 flex-1">
              {title && (
                <h3
                className={
                  titleClassName ??
                  `text-lg font-semibold text-[var(--token-text-primary)] ${
                    onTitleClick
                      ? "cursor-pointer hover:text-[var(--token-accent)] transition-colors"
                      : ""
                  }`
                }
                onClick={onTitleClick}
                onKeyDown={(e) => {
                  if (onTitleClick && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault()
                    onTitleClick()
                  }
                }}
                tabIndex={onTitleClick ? 0 : undefined}
                role={onTitleClick ? "button" : undefined}
                aria-label={
                  onTitleClick
                    ? `${title}${selectedClass ? ` - ${selectedClass}` : ""} - Click to customize color`
                    : undefined
                }
              >
                {title}
                {selectedClass ? ` - ${selectedClass}` : ""}
              </h3>
              )}
              {headerControls}
            </div>
            {showAxisPickers && (
              <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label="Axis colors">
                {axisKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={(e) => handleAxisPickerClick(key, e)}
                    className="flex items-center gap-1 px-2 py-1 rounded border border-[var(--token-border-default)] bg-[var(--token-surface)] hover:bg-[var(--token-surface-elevated)] transition-colors text-xs text-[var(--token-text-secondary)]"
                    title={`${axisKeyLabel(key)} color`}
                    aria-label={`Set ${axisKeyLabel(key).toLowerCase()} color`}
                  >
                    <span
                      className="w-4 h-4 rounded border border-[var(--token-border-default)] flex-shrink-0"
                      style={{ backgroundColor: axisColorByKey[key] }}
                    />
                    <span>{key === "yRight" ? "Y₂" : key.toUpperCase()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {description && (
          <p className="text-sm text-[var(--token-text-secondary)] mb-4">{description}</p>
        )}
        <div
          className="w-full"
          style={{
            minHeight: `${height}px`,
            color: "var(--token-text-primary)",
          }}
        >
          {renderContent
            ? renderContent({
                xAxisColor: axisColorByKey.x,
                yAxisColor: axisColorByKey.y,
                yAxisRightColor: axisColorByKey.yRight,
              })
            : children}
        </div>
      </div>
      {axisPickerOpen != null && showAxisPickers && chartInstanceId && (
        <ChartColorPicker
          currentColor={resolveAxisColorForPicker(axisColorByKey[axisPickerOpen])}
          onColorChange={handleAxisColorChange(axisPickerOpen)}
          onClose={() => {
            setAxisPickerOpen(null)
            setAxisPickerPosition(null)
          }}
          position={axisPickerPosition ?? undefined}
          label={axisKeyLabel(axisPickerOpen)}
        />
      )}
    </div>
  )
}
