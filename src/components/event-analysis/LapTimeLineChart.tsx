/**
 * @fileoverview Lap time line chart component - displays lap times for all drivers in a race
 * 
 * @created 2025-01-28
 * @creator Auto-generated
 * @lastModified 2025-01-28
 * 
 * @description Line graph showing lap times across all drivers for a selected race
 * 
 * @purpose Provides interactive visualization of lap time progression with zoom, pan,
 *          tooltips, and legend toggle capabilities.
 * 
 * @relatedFiles
 * - src/components/event-analysis/ChartContainer.tsx (wrapper)
 * - src/components/event-analysis/ComparisonsTab.tsx (parent component)
 */

"use client"

import { useMemo, useId, useState, useRef, useCallback } from "react"
import { Group } from "@visx/group"
import { LinePath } from "@visx/shape"
import { curveMonotoneX } from "@visx/curve"
import { scaleLinear } from "@visx/scale"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import { ParentSize } from "@visx/responsive"
import ChartContainer from "./ChartContainer"
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

export interface LapTimeLineChartProps {
  data: DriverLapData[]
  height?: number
  className?: string
  chartInstanceId?: string
  selectedClass?: string | null
}

const defaultMargin = { top: 20, right: 20, bottom: 60, left: 80 }
const textColor = "var(--token-text-primary)"
const textSecondaryColor = "var(--token-text-secondary)"
const borderColor = "var(--token-border-default)"

// Default color palette for drivers
const defaultDriverColors = [
  "#3a8eff", // Blue
  "#ff6b6b", // Red
  "#4ecdc4", // Teal
  "#ffe66d", // Yellow
  "#a8e6cf", // Green
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
        return `#${[r, g, b].map(x => x.toString(16).padStart(2, "0")).join("")}`
      }
    }
    
    return fallback
  }
  
  return color
}

/**
 * Find the closest point on a line to a given x coordinate
 */
function findClosestPoint(
  points: LapTimeDataPoint[],
  xScale: (value: number) => number,
  x: number
): LapTimeDataPoint | null {
  if (points.length === 0) return null

  let closest = points[0]
  let minDistance = Math.abs(xScale(points[0].lapNumber) - x)

  for (const point of points) {
    const distance = Math.abs(xScale(point.lapNumber) - x)
    if (distance < minDistance) {
      minDistance = distance
      closest = point
    }
  }

  return closest
}

export default function LapTimeLineChart({
  data,
  height = 500,
  className = "",
  chartInstanceId,
  selectedClass,
}: LapTimeLineChartProps) {
  const chartDescId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [visibleDrivers, setVisibleDrivers] = useState<Set<string>>(
    () => new Set(data.map((d) => d.driverId))
  )
  const [zoomState, setZoomState] = useState<{
    xMin: number | null
    xMax: number | null
    yMin: number | null
    yMax: number | null
  }>({
    xMin: null,
    xMax: null,
    yMin: null,
    yMax: null,
  })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null)

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

  // Calculate domains with zoom applied
  const xDomain = useMemo(() => {
    return zoomState.xMin !== null && zoomState.xMax !== null
      ? [zoomState.xMin, zoomState.xMax]
      : originalXDomain
  }, [zoomState, originalXDomain])

  const yDomain = useMemo(() => {
    return zoomState.yMin !== null && zoomState.yMax !== null
      ? [zoomState.yMin, zoomState.yMax]
      : originalYDomain
  }, [zoomState, originalYDomain])

  // Tooltip
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<{ driver: DriverLapData; point: LapTimeDataPoint }>()

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

  // Reset zoom
  const resetZoom = useCallback(() => {
    setZoomState({
      xMin: null,
      xMax: null,
      yMin: null,
      yMax: null,
    })
  }, [])

  // Handle mouse wheel for zoom
  const handleWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      if (!svgRef.current) return

      event.preventDefault()
      const svg = svgRef.current
      const rect = svg.getBoundingClientRect()
      const point = localPoint(svg, event)
      if (!point) return

      const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9
      const innerWidth = rect.width - defaultMargin.left - defaultMargin.right
      const innerHeight = rect.height - defaultMargin.top - defaultMargin.bottom
      const xPercent = (point.x - defaultMargin.left) / innerWidth
      const yPercent = (point.y - defaultMargin.top) / innerHeight

      // Create temporary scales to convert mouse position to data coordinates
      const tempXScale = scaleLinear({
        range: [0, innerWidth],
        domain: xDomain,
      })
      const tempYScale = scaleLinear({
        range: [innerHeight, 0],
        domain: yDomain,
      })

      // Get the data point under the mouse
      const mouseXData = tempXScale.invert(point.x - defaultMargin.left)
      const mouseYData = tempYScale.invert(point.y - defaultMargin.top)

      setZoomState((prev) => {
        const currentXRange = prev.xMin !== null && prev.xMax !== null
          ? prev.xMax - prev.xMin
          : originalXDomain[1] - originalXDomain[0]
        const currentYRange = prev.yMin !== null && prev.yMax !== null
          ? prev.yMax - prev.yMin
          : originalYDomain[1] - originalYDomain[0]

        const newXRange = currentXRange * zoomFactor
        const newYRange = currentYRange * zoomFactor

        // Zoom towards the mouse position
        const newXMin = mouseXData - newXRange * xPercent
        const newXMax = mouseXData + newXRange * (1 - xPercent)
        const newYMin = mouseYData - newYRange * (1 - yPercent)
        const newYMax = mouseYData + newYRange * yPercent

        // Clamp to data bounds
        const dataXMin = originalXDomain[0]
        const dataXMax = originalXDomain[1]
        const dataYMin = originalYDomain[0]
        const dataYMax = originalYDomain[1]

        return {
          xMin: Math.max(dataXMin, Math.min(newXMin, dataXMax)),
          xMax: Math.min(dataXMax, Math.max(newXMax, dataXMin)),
          yMin: Math.max(dataYMin, Math.min(newYMin, dataYMax)),
          yMax: Math.min(dataYMax, Math.max(newYMax, dataYMin)),
        }
      })
    },
    [xDomain, yDomain, originalXDomain, originalYDomain, visibleData]
  )

  // Handle pan start
  const handleMouseDown = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    if (event.button !== 0) return // Only left mouse button
    const point = localPoint(svgRef.current, event)
    if (point) {
      setIsPanning(true)
      setPanStart(point)
    }
  }, [])

  // Handle pan move
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!isPanning || !panStart || !svgRef.current) return

      const point = localPoint(svgRef.current, event)
      if (!point) return

      const dx = point.x - panStart.x
      const dy = point.y - panStart.y

      const rect = svgRef.current.getBoundingClientRect()
      const innerWidth = rect.width - defaultMargin.left - defaultMargin.right
      const innerHeight = rect.height - defaultMargin.top - defaultMargin.bottom

      const xRange = zoomState.xMin !== null && zoomState.xMax !== null
        ? zoomState.xMax - zoomState.xMin
        : originalXDomain[1] - originalXDomain[0]
      const yRange = zoomState.yMin !== null && zoomState.yMax !== null
        ? zoomState.yMax - zoomState.yMin
        : originalYDomain[1] - originalYDomain[0]

      const xDelta = (dx / innerWidth) * xRange
      const yDelta = (dy / innerHeight) * yRange

      setZoomState((prev) => {
        const currentXMin = prev.xMin !== null ? prev.xMin : originalXDomain[0]
        const currentXMax = prev.xMax !== null ? prev.xMax : originalXDomain[1]
        const currentYMin = prev.yMin !== null ? prev.yMin : originalYDomain[0]
        const currentYMax = prev.yMax !== null ? prev.yMax : originalYDomain[1]

        // Clamp to original domain bounds
        const newXMin = Math.max(originalXDomain[0], currentXMin - xDelta)
        const newXMax = Math.min(originalXDomain[1], currentXMax - xDelta)
        const newYMin = Math.max(originalYDomain[0], currentYMin + yDelta)
        const newYMax = Math.min(originalYDomain[1], currentYMax + yDelta)

        // Ensure min < max
        if (newXMin >= newXMax || newYMin >= newYMax) {
          return prev
        }

        return {
          xMin: newXMin,
          xMax: newXMax,
          yMin: newYMin,
          yMax: newYMax,
        }
      })

      setPanStart(point)
    },
    [isPanning, panStart, zoomState, originalXDomain, originalYDomain]
  )

  // Handle pan end
  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
    setPanStart(null)
  }, [])

  // Handle tooltip on hover
  const handleTooltipHover = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return

      const mousePoint = localPoint(svgRef.current, event)
      if (!mousePoint) return

      const innerWidth = svgRef.current.getBoundingClientRect().width - defaultMargin.left - defaultMargin.right
      const xScale = scaleLinear({
        range: [0, innerWidth],
        domain: xDomain,
      })

      // Find closest point across all visible drivers
      let closestDriver: DriverLapData | null = null
      let closestPoint: LapTimeDataPoint | null = null
      let minDistance = Infinity

      const mouseX = mousePoint.x - defaultMargin.left

      for (const driver of visibleData) {
        const lapPoint = findClosestPoint(driver.laps, xScale, mouseX)
        if (lapPoint) {
          const distance = Math.abs(xScale(lapPoint.lapNumber) - mouseX)
          if (distance < minDistance) {
            minDistance = distance
            closestDriver = driver
            closestPoint = lapPoint
          }
        }
      }

      if (closestDriver && closestPoint) {
        showTooltip({
          tooltipLeft: mousePoint.x,
          tooltipTop: mousePoint.y,
          tooltipData: {
            driver: closestDriver,
            point: closestPoint,
          },
        })
      }
    },
    [visibleData, xDomain, showTooltip]
  )

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
    <ChartContainer
      title="Lap Times"
      height={height}
      className={className}
      aria-label="Lap time line chart showing lap times for all drivers"
      chartInstanceId={chartInstanceId}
      selectedClass={selectedClass}
    >
      <div className="relative w-full" style={{ height: `${height}px` }}>
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
              domain: xDomain,
              nice: true,
            })

            // Y scale (lap times)
            const yScale = scaleLinear({
              range: [innerHeight, 0],
              domain: yDomain,
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
                  onWheel={handleWheel}
                  onMouseDown={handleMouseDown}
                  onMouseMove={(e) => {
                    handleMouseMove(e)
                    handleTooltipHover(e)
                  }}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => {
                    hideTooltip()
                    handleMouseUp()
                  }}
                  style={{ cursor: isPanning ? "grabbing" : "grab" }}
                >
                  <desc id={chartDescId}>
                    Line chart showing lap times for each driver across all laps in the race.
                    {visibleData.length > 0 && `Showing ${visibleData.length} driver${visibleData.length !== 1 ? "s" : ""}.`}
                  </desc>
                  <Group left={defaultMargin.left} top={defaultMargin.top}>
                    {/* Grid lines */}
                    {yScale.ticks(8).map((tick) => (
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
                          lap.lapNumber >= xDomain[0] &&
                          lap.lapNumber <= xDomain[1] &&
                          lap.lapTimeSeconds >= yDomain[0] &&
                          lap.lapTimeSeconds <= yDomain[1]
                      )

                      if (validLaps.length === 0) return null

                      return (
                        <LinePath
                          key={driver.driverId}
                          data={validLaps}
                          x={(d) => xScale(d.lapNumber)}
                          y={(d) => yScale(d.lapTimeSeconds)}
                          stroke={color}
                          strokeWidth={2}
                          curve={curveMonotoneX}
                          strokeOpacity={0.8}
                        />
                      )
                    })}

                    {/* Y-axis */}
                    <AxisLeft
                      scale={yScale}
                      tickFormat={(value) => formatLapTime(Number(value))}
                      stroke={borderColor}
                      tickStroke={borderColor}
                      tickLabelProps={() => ({
                        fill: textSecondaryColor,
                        fontSize: 12,
                        textAnchor: "end",
                        dx: -8,
                      })}
                    />

                    {/* X-axis */}
                    <AxisBottom
                      top={innerHeight}
                      scale={xScale}
                      stroke={borderColor}
                      tickStroke={borderColor}
                      tickLabelProps={() => ({
                        fill: textSecondaryColor,
                        fontSize: 12,
                        textAnchor: "middle",
                        dy: 8,
                      })}
                    />
                  </Group>
                </svg>

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
                        {tooltipData.driver.driverName}
                      </div>
                      <div className="text-sm text-[var(--token-text-secondary)]">
                        Lap {tooltipData.point.lapNumber}
                      </div>
                      <div className="text-sm text-[var(--token-text-secondary)]">
                        {formatLapTime(tooltipData.point.lapTimeSeconds)}
                      </div>
                    </div>
                  </TooltipWithBounds>
                )}

                {/* Zoom reset button */}
                {(zoomState.xMin !== null || zoomState.yMin !== null) && (
                  <button
                    type="button"
                    onClick={resetZoom}
                    className="absolute top-4 right-4 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] hover:bg-[var(--token-surface-raised)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    aria-label="Reset zoom"
                  >
                    Reset Zoom
                  </button>
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
                className={`flex items-center gap-2 transition-opacity ${
                  canToggle
                    ? "cursor-pointer hover:opacity-80"
                    : "cursor-not-allowed opacity-50"
                } ${!isVisible ? "opacity-40" : ""}`}
                onClick={() => {
                  if (canToggle) {
                    toggleDriver(driver.driverId)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    if (canToggle) {
                      toggleDriver(driver.driverId)
                    }
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${driver.driverName} - ${isVisible ? "Visible" : "Hidden"}. Click to toggle visibility`}
                title={`${driver.driverName} - Click to ${isVisible ? "hide" : "show"}`}
              >
                <div
                  className="w-4 h-4 rounded-sm transition-all"
                  style={{
                    backgroundColor: isVisible ? computedColors[driver.driverId] : computedColors[driver.driverId],
                    border: `1px solid ${computedColors[driver.driverId]}`,
                    opacity: isVisible ? 1 : 0.3,
                  }}
                />
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
              </div>
            )
          })}
        </div>
      </div>
    </ChartContainer>
  )
}
