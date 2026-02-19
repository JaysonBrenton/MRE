/**
 * @fileoverview Lap time line chart component - displays lap times for all drivers in a race
 *
 * @created 2025-01-28
 * @creator Auto-generated
 * @lastModified 2026-02-01
 *
 * @description Line graph showing lap times across all drivers for a selected race
 *
 * @purpose Provides interactive visualization of lap time progression with
 *          tooltips, legend toggle, color customization, and multi-driver comparison.
 *
 * @relatedFiles
 * - src/components/event-analysis/ChartContainer.tsx (wrapper)
 * - src/components/event-analysis/ChartColorPicker.tsx (per-driver color)
 * - src/components/event-analysis/ComparisonsTab.tsx (parent component)
 */

"use client"

import { useMemo, useId, useState, useRef, useCallback } from "react"
import { Group } from "@visx/group"
import { LinePath, Circle } from "@visx/shape"
import { curveMonotoneX } from "@visx/curve"
import { scaleLinear } from "@visx/scale"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import { ParentSize } from "@visx/responsive"
import ChartContainer from "./ChartContainer"
import ChartColorPicker from "./ChartColorPicker"
import { useChartColors } from "@/hooks/useChartColors"
import { formatLapTime } from "@/lib/date-utils"

export interface LapTimeDataPoint {
  lapNumber: number
  lapTimeSeconds: number
}

export interface DriverLapData {
  driverId: string
  driverName: string
  laps: LapTimeDataPoint[]
}

export interface ReferenceLine {
  value: number
  label?: string
  stroke?: string
}

export interface LapTimeLineChartProps {
  data: DriverLapData[]
  height?: number
  className?: string
  chartInstanceId?: string
  selectedClass?: string | null
  /** Optional horizontal reference lines (e.g. average lap, target time) */
  referenceLines?: ReferenceLine[]
  /** Highlight each driver's best lap with a marker */
  highlightBestLaps?: boolean
}

const defaultMargin = { top: 20, right: 20, bottom: 60, left: 80 }
const textColor = "var(--token-text-primary)"
const _textSecondaryColor = "var(--token-text-secondary)"
const borderColor = "var(--token-border-default)"
const DEFAULT_AXIS_COLOR = "#ffffff"

// Default color palette for drivers (per chart design standards §3.2)
const defaultDriverColors = [
  "#3a8eff", // var(--token-accent) equivalent
  "#4ecdc4", // Teal
  "#ff6b6b", // Red
  "#ffe66d", // Yellow
  "#a8e6cf", // Mint green
  "#ff8b94", // Pink
  "#95a5a6", // Gray
  "#f39c12", // Orange
  "#9b59b6", // Purple
  "#1abc9c", // Turquoise
  "#e74c3c", // Dark Red
  "#3498db", // Light Blue
  "#2ecc71", // Dark Green
  "#f1c40f", // Gold
  "#e67e22", // Dark Orange
]

/**
 * Convert CSS variable or color string to hex color for SVG
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

export type MultiDriverTooltipData = {
  lapNumber: number
  drivers: { driver: DriverLapData; point: LapTimeDataPoint }[]
}

export default function LapTimeLineChart({
  data,
  height = 500,
  className = "",
  chartInstanceId,
  selectedClass,
  referenceLines = [],
  highlightBestLaps = false,
}: LapTimeLineChartProps) {
  const chartDescId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleDrivers, setVisibleDrivers] = useState<Set<string>>(
    () => new Set(data.map((d) => d.driverId))
  )
  const [hoveredDriverId, setHoveredDriverId] = useState<string | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [colorPickerDriverId, setColorPickerDriverId] = useState<string | null>(null)
  const [colorPickerPosition, setColorPickerPosition] = useState<{
    top: number
    left: number
  } | null>(null)

  // Generate default colors for drivers
  const defaultColors = useMemo(() => {
    const colors: Record<string, string> = {}
    data.forEach((driver, index) => {
      colors[driver.driverId] = defaultDriverColors[index % defaultDriverColors.length]
    })
    return colors
  }, [data])

  const instanceId = chartInstanceId || "default-lap-time-line-chart"
  const { colors, setColor } = useChartColors(instanceId, defaultColors)

  // Filter data based on visible drivers
  const visibleData = useMemo(() => {
    return data.filter((d) => visibleDrivers.has(d.driverId))
  }, [data, visibleDrivers])

  // Calculate original (unzoomed) domains
  const originalXDomain = useMemo(() => {
    if (visibleData.length === 0) return [0, 10]

    const allLapNumbers = visibleData.flatMap((d) => d.laps.map((l) => l.lapNumber))
    if (allLapNumbers.length === 0) return [0, 10]

    const min = Math.min(...allLapNumbers)
    const max = Math.max(...allLapNumbers)
    return [Math.max(0, min - 1), max + 1]
  }, [visibleData])

  const originalYDomain = useMemo(() => {
    if (visibleData.length === 0) return [0, 100]

    const allLapTimes = visibleData.flatMap((d) => d.laps.map((l) => l.lapTimeSeconds))
    if (allLapTimes.length === 0) return [0, 100]

    const min = Math.min(...allLapTimes)
    const max = Math.max(...allLapTimes)
    const padding = (max - min) * 0.1

    return [Math.max(0, min - padding), max + padding]
  }, [visibleData])

  // Tooltip (multi-driver: all drivers at the hovered lap)
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<MultiDriverTooltipData>()

  // Toggle driver visibility
  const toggleDriver = useCallback((driverId: string) => {
    setVisibleDrivers((prev) => {
      const next = new Set(prev)
      if (next.has(driverId)) {
        // Don't allow hiding the last visible driver
        if (next.size > 1) {
          next.delete(driverId)
        }
      } else {
        next.add(driverId)
      }
      return next
    })
  }, [])

  // Handle tooltip on hover — snap to nearest lap, show all drivers at that lap
  const handleTooltipHover = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return

      const mousePoint = localPoint(svgRef.current, event)
      if (!mousePoint) return

      const rect = svgRef.current.getBoundingClientRect()
      const innerWidth = rect.width - defaultMargin.left - defaultMargin.right

      const xScale = scaleLinear({
        range: [0, innerWidth],
        domain: originalXDomain,
      })

      const mouseX = mousePoint.x - defaultMargin.left

      // Snap to nearest lap number (invert pixel to domain value)
      const rawLap =
        typeof xScale.invert === "function"
          ? xScale.invert(mouseX)
          : originalXDomain[0] + (mouseX / innerWidth) * (originalXDomain[1] - originalXDomain[0])
      const lapNumber = Math.round(rawLap)
      const clampedLap = Math.max(
        Math.floor(originalXDomain[0]),
        Math.min(Math.ceil(originalXDomain[1]), lapNumber)
      )

      // Collect all visible drivers' lap times at this lap
      const driversAtLap: { driver: DriverLapData; point: LapTimeDataPoint }[] = []
      for (const driver of visibleData) {
        const point = driver.laps.find((l) => l.lapNumber === clampedLap)
        if (point) {
          driversAtLap.push({ driver, point })
        }
      }

      if (driversAtLap.length > 0) {
        // Sort by lap time (fastest first)
        driversAtLap.sort((a, b) => a.point.lapTimeSeconds - b.point.lapTimeSeconds)

        showTooltip({
          tooltipLeft: mousePoint.x,
          tooltipTop: mousePoint.y,
          tooltipData: {
            lapNumber: clampedLap,
            drivers: driversAtLap,
          },
        })
      }
    },
    [visibleData, originalXDomain, showTooltip]
  )

  const handleColorPickerClick = useCallback(
    (driverId: string, event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation()
      const target = event.currentTarget
      const rect = target.getBoundingClientRect()
      setColorPickerPosition({ top: rect.bottom + 8, left: rect.left })
      setColorPickerDriverId(driverId)
      setShowColorPicker(true)
    },
    []
  )

  const handleLineClick = useCallback((driverId: string, event: React.MouseEvent<SVGElement>) => {
    event.stopPropagation()
    setColorPickerPosition({
      top: event.clientY + 8,
      left: event.clientX,
    })
    setColorPickerDriverId(driverId)
    setShowColorPicker(true)
  }, [])

  // Get computed colors for SVG
  const computedColors = useMemo(() => {
    const result: Record<string, string> = {}
    data.forEach((driver) => {
      result[driver.driverId] = getComputedColor(
        colors[driver.driverId] || defaultColors[driver.driverId] || "#3a8eff",
        "#3a8eff"
      )
    })
    return result
  }, [colors, defaultColors, data])

  // Early return for empty data
  if (data.length === 0) {
    return (
      <ChartContainer
        title="Lap Times"
        height={height}
        className={className}
        aria-label="Lap time line chart - no data available"
        selectedClass={selectedClass}
      >
        <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
          No lap data available
        </div>
      </ChartContainer>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <ChartContainer
        title="Lap Times"
        height={height}
        className={className}
        aria-label="Lap time line chart showing lap times for all drivers"
        chartInstanceId={chartInstanceId}
        selectedClass={selectedClass}
        axisColorPicker
        defaultAxisColors={{ x: DEFAULT_AXIS_COLOR, y: DEFAULT_AXIS_COLOR }}
        renderContent={({ axisColors: { xAxisColor, yAxisColor }, onAxisColorPickerRequest }) => (
          <div className="relative w-full" style={{ minHeight: `${height}px` }}>
            <ParentSize>
              {({ width: parentWidth }) => {
                const width = parentWidth || 800

                if (width === 0) {
                  return null
                }

                const innerWidth = width - defaultMargin.left - defaultMargin.right
                const innerHeight = height - defaultMargin.top - defaultMargin.bottom

                // X scale (lap numbers)
                const xScale = scaleLinear({
                  range: [0, innerWidth],
                  domain: originalXDomain,
                  nice: true,
                })

                // Y scale (lap times)
                const yScale = scaleLinear({
                  range: [innerHeight, 0],
                  domain: originalYDomain,
                  nice: true,
                })

                return (
                  <>
                    <svg
                      ref={svgRef}
                      width={width}
                      height={height}
                      aria-labelledby={chartDescId}
                      role="img"
                      overflow="visible"
                      onMouseMove={handleTooltipHover}
                      onMouseLeave={hideTooltip}
                    >
                      <desc id={chartDescId}>
                        Line chart showing lap times for each driver across all laps in the race.
                        {visibleData.length > 0 &&
                          `Showing ${visibleData.length} driver${visibleData.length !== 1 ? "s" : ""}.`}
                      </desc>
                      <Group left={defaultMargin.left} top={defaultMargin.top}>
                        {/* Grid lines (5 ticks per design standards) */}
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

                        {/* Driver lines */}
                        {visibleData.map((driver) => {
                          const color = computedColors[driver.driverId]
                          const validLaps = driver.laps.filter(
                            (lap) =>
                              lap.lapNumber >= originalXDomain[0] &&
                              lap.lapNumber <= originalXDomain[1] &&
                              lap.lapTimeSeconds >= originalYDomain[0] &&
                              lap.lapTimeSeconds <= originalYDomain[1]
                          )

                          if (validLaps.length === 0) return null

                          const isEmphasized =
                            !hoveredDriverId || driver.driverId === hoveredDriverId
                          const strokeWidth = isEmphasized ? (hoveredDriverId ? 3 : 2) : 1.5
                          const strokeOpacity = isEmphasized ? 1 : 0.4

                          const bestLap =
                            highlightBestLaps && validLaps.length > 0
                              ? validLaps.reduce((best, l) =>
                                  l.lapTimeSeconds < best.lapTimeSeconds ? l : best
                                )
                              : null

                          return (
                            <Group
                              key={driver.driverId}
                              onClick={(e) => handleLineClick(driver.driverId, e)}
                              style={{ cursor: "pointer" }}
                              aria-label={`${driver.driverName} - Click to change line color`}
                            >
                              <LinePath
                                data={validLaps}
                                x={(d) => xScale(d.lapNumber)}
                                y={(d) => yScale(d.lapTimeSeconds)}
                                stroke={color}
                                strokeWidth={strokeWidth}
                                curve={curveMonotoneX}
                                strokeOpacity={strokeOpacity}
                                pointerEvents="stroke"
                              />
                              {/* Data points on lines */}
                              {validLaps.map((d) => {
                                const pointRadius = validLaps.length > 30 ? 2 : 3
                                return (
                                  <Circle
                                    key={`${driver.driverId}-${d.lapNumber}`}
                                    cx={xScale(d.lapNumber)}
                                    cy={yScale(d.lapTimeSeconds)}
                                    r={pointRadius}
                                    fill={color}
                                    stroke={color}
                                    strokeWidth={1}
                                  />
                                )
                              })}
                              {/* Best lap marker */}
                              {bestLap && (
                                <Circle
                                  cx={xScale(bestLap.lapNumber)}
                                  cy={yScale(bestLap.lapTimeSeconds)}
                                  r={5}
                                  fill="#1a1a1a"
                                  stroke={color}
                                  strokeWidth={2}
                                />
                              )}
                            </Group>
                          )
                        })}

                        {/* Reference lines */}
                        {referenceLines.map((ref, i) => (
                          <line
                            key={i}
                            x1={0}
                            x2={innerWidth}
                            y1={yScale(ref.value)}
                            y2={yScale(ref.value)}
                            stroke={ref.stroke ?? borderColor}
                            strokeDasharray="6,4"
                            strokeWidth={1}
                            opacity={0.5}
                          />
                        ))}

                        {/* Vertical crosshair at hovered lap */}
                        {tooltipOpen && tooltipData && (
                          <line
                            x1={xScale(tooltipData.lapNumber)}
                            x2={xScale(tooltipData.lapNumber)}
                            y1={0}
                            y2={innerHeight}
                            stroke={borderColor}
                            strokeDasharray="4,4"
                            opacity={0.6}
                          />
                        )}

                        {/* Y-axis - clickable to open color picker */}
                        <Group
                          style={{ cursor: "pointer" }}
                          onClick={(e) => onAxisColorPickerRequest("y", e)}
                          aria-label="Y-axis - Click to change color"
                        >
                          <AxisLeft
                            scale={yScale}
                            tickFormat={(value) => formatLapTime(Number(value))}
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
                            stroke={xAxisColor}
                            tickStroke={xAxisColor}
                            tickLabelProps={() => ({
                              fill: xAxisColor,
                              fontSize: 12,
                              textAnchor: "middle",
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

                    {/* Tooltip (multi-driver at same lap) */}
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
                            Lap {tooltipData.lapNumber}
                          </div>
                          {tooltipData.drivers.map(({ driver, point }) => (
                            <div
                              key={driver.driverId}
                              className="flex items-center justify-between gap-4 text-sm text-[var(--token-text-secondary)]"
                            >
                              <span
                                className="flex items-center gap-1.5"
                                style={{ color: computedColors[driver.driverId] }}
                              >
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: computedColors[driver.driverId] }}
                                />
                                {driver.driverName}
                              </span>
                              <span className="tabular-nums">
                                {formatLapTime(point.lapTimeSeconds)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TooltipWithBounds>
                    )}
                  </>
                )
              }}
            </ParentSize>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
              {data.map((driver) => {
                const isVisible = visibleDrivers.has(driver.driverId)
                const canToggle = isVisible ? visibleDrivers.size > 1 : true

                return (
                  <div
                    key={driver.driverId}
                    className={`flex items-center gap-2 transition-opacity ${!isVisible ? "opacity-40" : ""}`}
                    onMouseEnter={() => setHoveredDriverId(driver.driverId)}
                    onMouseLeave={() => setHoveredDriverId(null)}
                    role="group"
                    aria-label={`${driver.driverName} - ${isVisible ? "Visible" : "Hidden"}`}
                  >
                    <button
                      type="button"
                      onClick={(e) => handleColorPickerClick(driver.driverId, e)}
                      className="w-4 h-4 rounded-sm flex-shrink-0 border-2 border-transparent hover:border-[var(--token-accent)]/50 transition-all cursor-pointer"
                      style={{
                        backgroundColor: computedColors[driver.driverId],
                        borderColor: computedColors[driver.driverId],
                        opacity: isVisible ? 1 : 0.3,
                      }}
                      aria-label={`${driver.driverName} - Change color`}
                      title="Click to change color"
                    />
                    <button
                      type="button"
                      onClick={() => canToggle && toggleDriver(driver.driverId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          if (canToggle) toggleDriver(driver.driverId)
                        }
                      }}
                      disabled={!canToggle}
                      tabIndex={0}
                      className={`flex items-center gap-2 text-left ${
                        canToggle
                          ? "cursor-pointer hover:opacity-80"
                          : "cursor-not-allowed opacity-50"
                      }`}
                      aria-label={`${driver.driverName} - ${isVisible ? "Visible" : "Hidden"}. Click to toggle`}
                      title={`${driver.driverName} - Click to ${isVisible ? "hide" : "show"}`}
                    >
                      <span
                        className={`text-[var(--token-text-secondary)] ${
                          !isVisible ? "line-through opacity-50" : ""
                        }`}
                      >
                        {driver.driverName}
                      </span>
                      {!isVisible && (
                        <span className="text-xs text-[var(--token-text-muted)]">(hidden)</span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      />

      {/* Color picker for driver colors */}
      {showColorPicker && colorPickerPosition && colorPickerDriverId && (
        <ChartColorPicker
          currentColor={
            colors[colorPickerDriverId] || defaultColors[colorPickerDriverId] || "#3a8eff"
          }
          onColorChange={(color) => setColor(colorPickerDriverId, color)}
          onClose={() => {
            setShowColorPicker(false)
            setColorPickerDriverId(null)
            setColorPickerPosition(null)
          }}
          position={colorPickerPosition}
          label={`${data.find((d) => d.driverId === colorPickerDriverId)?.driverName ?? "Driver"} color`}
        />
      )}
    </div>
  )
}
