/**
 * @fileoverview Best lap bar chart - shows best lap time per driver
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Interactive bar chart displaying best lap time for each driver
 *
 * @purpose Visualizes driver performance comparison using best lap times.
 *          Built with Visx and styled with MRE token system.
 *
 * @relatedFiles
 * - src/components/event-analysis/ChartContainer.tsx (wrapper)
 * - src/core/events/get-event-analysis-data.ts (data source)
 */

"use client"

import { useMemo, useId, useState, useRef } from "react"
import { Group } from "@visx/group"
import { Bar } from "@visx/shape"
import { scaleBand, scaleLinear } from "@visx/scale"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import { ParentSize } from "@visx/responsive"
import ChartContainer from "./ChartContainer"
import ChartPagination from "./ChartPagination"
import ChartColorPicker from "./ChartColorPicker"
import { useChartColor } from "@/hooks/useChartColors"

export interface DriverBestLap {
  driverId: string
  driverName: string
  bestLapTime: number
}

export interface BestLapBarChartProps {
  data: DriverBestLap[]
  selectedDriverIds?: string[]
  height?: number
  className?: string
  currentPage?: number
  driversPerPage?: number
  onPageChange?: (page: number) => void
  onDriverToggle?: (driverId: string) => void
  chartInstanceId?: string
  selectedClass?: string | null
}

const defaultMargin = { top: 20, right: 20, bottom: 100, left: 80 }
const defaultAccentColor = "var(--token-accent)"
const textColor = "var(--token-text-primary)"
const textSecondaryColor = "var(--token-text-secondary)"
const borderColor = "var(--token-border-default)"

/**
 * Convert CSS variable or color string to hex color for SVG
 * SVG fill attributes don't support CSS variables, so we need to compute the actual color
 */
function getComputedColor(color: string, fallback: string = "#3a8eff"): string {
  // If it's already a hex color, return it
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
    return color
  }

  // If it's a CSS variable, compute it
  if (color.startsWith("var(")) {
    if (typeof window === "undefined") {
      return fallback
    }

    // Extract the variable name
    const match = color.match(/var\(([^)]+)\)/)
    if (!match) {
      return fallback
    }

    const varName = match[1].trim()

    // Get computed value from document
    const computedValue = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim()

    if (!computedValue) {
      return fallback
    }

    // If it's already a hex color, return it
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(computedValue)) {
      return computedValue
    }

    // If it's rgb/rgba, convert to hex
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

  const fontSize = 11 // Match the fontSize in tickLabelProps
  const avgCharWidth = 6.5 // Approximate width per character for 11px font
  const rotationRadians = Math.PI / 4 // 45 degrees
  const padding = 20 // Extra padding for safety

  // Find the longest label
  const maxLabelLength = Math.max(...labels.map((label) => label.length))

  // Estimate text width
  const estimatedTextWidth = maxLabelLength * avgCharWidth

  // Calculate vertical extension for -45 degree rotation
  // When rotated -45°, the text extends diagonally down and to the right
  // The vertical component is width * sin(45°)
  const verticalExtension = estimatedTextWidth * Math.sin(rotationRadians)

  // Add padding and ensure minimum margin
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

export default function BestLapBarChart({
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
}: BestLapBarChartProps) {
  const chartDescId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [colorPickerPosition, setColorPickerPosition] = useState<{
    top: number
    left: number
  } | null>(null)

  // Use chart color hook if chartInstanceId is provided
  const instanceId = chartInstanceId || "default-best-lap"
  const [barColor, setBarColor] = useChartColor(instanceId, "primary", defaultAccentColor)

  // Convert CSS variable to computed hex color for SVG
  // SVG fill attributes don't support CSS variables
  const computedBarColor = useMemo(() => {
    return getComputedColor(barColor, "#3a8eff")
  }, [barColor])

  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<DriverBestLap>()

  const handleTitleClick = () => {
    if (containerRef.current) {
      // Position color picker below the title (first h3 element in container)
      const titleElement = containerRef.current.querySelector("h3")
      if (titleElement) {
        const rect = titleElement.getBoundingClientRect()
        // Use fixed positioning, so use getBoundingClientRect directly (viewport-relative)
        setColorPickerPosition({
          top: rect.bottom + 8,
          left: rect.left,
        })
        setShowColorPicker(true)
      }
    }
  }

  const handleLegendClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    // Use fixed positioning, so use getBoundingClientRect directly (viewport-relative)
    setColorPickerPosition({
      top: rect.bottom + 8,
      left: rect.left,
    })
    setShowColorPicker(true)
  }

  // Filter and validate data
  const validData = useMemo(() => {
    return data.filter((d) => d.bestLapTime > 0 && isFinite(d.bestLapTime))
  }, [data])

  // Filter data if drivers are selected
  // undefined = show all (initial state), [] = show nothing (cleared), [ids] = show selected
  const displayData = useMemo(() => {
    if (selectedDriverIds === undefined) {
      // Initial state: show all data
      return validData
    }
    if (selectedDriverIds.length === 0) {
      // Cleared state: show nothing
      return []
    }
    // Filter to selected drivers only
    return validData.filter((d) => selectedDriverIds.includes(d.driverId))
  }, [validData, selectedDriverIds])

  // Sort by best lap time (fastest first)
  const sortedData = useMemo(() => {
    return [...displayData].sort((a, b) => a.bestLapTime - b.bestLapTime)
  }, [displayData])

  // Calculate pagination
  const totalPages = Math.ceil(sortedData.length / driversPerPage)
  const startIndex = (currentPage - 1) * driversPerPage
  const endIndex = startIndex + driversPerPage
  const paginatedData = sortedData.slice(startIndex, endIndex)

  // Calculate dynamic bottom margin based on label lengths
  const margin = useMemo(() => {
    const labelLengths = paginatedData.map((d) => d.driverName)
    const dynamicBottom = calculateBottomMargin(labelLengths, 100)
    return { ...defaultMargin, bottom: dynamicBottom }
  }, [paginatedData])

  if (displayData.length === 0) {
    return (
      <ChartContainer
        title="Best Lap Times"
        height={height}
        className={className}
        aria-label="Best lap times chart - no data available"
        selectedClass={selectedClass}
      >
        <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
          {validData.length === 0 ? "No data available" : "Select drivers to compare"}
        </div>
      </ChartContainer>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <ChartContainer
        title="Best Lap Times"
        height={height}
        className={className}
        aria-label="Best lap times per driver bar chart"
        chartInstanceId={chartInstanceId}
        onTitleClick={handleTitleClick}
        selectedClass={selectedClass}
      >
        <div className="relative w-full" style={{ height: `${height}px` }}>
          <ParentSize>
            {({ width: parentWidth }) => {
              // Use parentWidth if available, otherwise fallback to 800 for SSR
              // ParentSize will return 0 or undefined during SSR, which is fine
              const width = parentWidth || 800

              // Don't render chart if width is 0 (during initial SSR)
              if (width === 0) {
                return null
              }

              const innerWidth = width - margin.left - margin.right
              const innerHeight = height - margin.top - margin.bottom

              // Scales
              const xScale = scaleBand({
                range: [0, innerWidth],
                domain: paginatedData.map((d) => d.driverName),
                padding: 0.3,
              })

              const maxLapTime = Math.max(...paginatedData.map((d) => d.bestLapTime))
              const minLapTime = Math.min(...paginatedData.map((d) => d.bestLapTime))
              const padding = (maxLapTime - minLapTime) * 0.1
              const yScale = scaleLinear({
                range: [innerHeight, 0],
                domain: [
                  Math.max(0, minLapTime - padding), // Clamp to 0 to prevent negative values
                  maxLapTime + padding,
                ],
                nice: true,
              })

              return (
                <svg
                  width={width}
                  height={height}
                  aria-labelledby={chartDescId}
                  role="img"
                  overflow="visible"
                >
                  <desc id={chartDescId}>
                    Bar chart showing each driver&apos;s best lap time, sorted fastest to slowest.
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

                    {/* Bars */}
                    {paginatedData.map((d) => {
                      const barWidth = xScale.bandwidth()
                      const barHeight = innerHeight - yScale(d.bestLapTime)
                      const x = xScale(d.driverName) || 0
                      const y = yScale(d.bestLapTime)

                      const isSelected =
                        selectedDriverIds === undefined ||
                        selectedDriverIds.length === 0 ||
                        selectedDriverIds.includes(d.driverId)

                      const handleClick = () => {
                        if (onDriverToggle) {
                          onDriverToggle(d.driverId)
                        }
                      }

                      return (
                        <Group key={d.driverId}>
                          <Bar
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill={
                              isSelected
                                ? computedBarColor
                                : getComputedColor("var(--token-text-muted)", "#666666")
                            }
                            opacity={isSelected ? 1 : 0.3}
                            stroke={
                              isSelected &&
                              selectedDriverIds !== undefined &&
                              selectedDriverIds.length > 0
                                ? computedBarColor
                                : "none"
                            }
                            strokeWidth={
                              isSelected &&
                              selectedDriverIds !== undefined &&
                              selectedDriverIds.length > 0
                                ? 2
                                : 0
                            }
                            onClick={handleClick}
                            onMouseMove={(event) => {
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
                            }}
                            onMouseLeave={() => hideTooltip()}
                            onTouchStart={(event) => {
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
                            }}
                            onTouchEnd={() => {
                              hideTooltip()
                              if (onDriverToggle) {
                                onDriverToggle(d.driverId)
                              }
                            }}
                            style={{ cursor: "pointer" }}
                            aria-label={`${d.driverName}: ${formatLapTime(d.bestLapTime)}`}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                handleClick()
                              }
                            }}
                          />
                        </Group>
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
                        fontSize: 11,
                        textAnchor: "end",
                        angle: -45,
                        dx: -5,
                        dy: 8,
                      })}
                    />
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
                <div className="text-sm text-[var(--token-text-secondary)]">
                  Best Lap: {formatLapTime(tooltipData.bestLapTime)}
                </div>
              </div>
            </TooltipWithBounds>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-sm">
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleLegendClick}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                setColorPickerPosition({
                  top: rect.bottom + 8,
                  left: rect.left,
                })
                setShowColorPicker(true)
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Best Lap - Click to customize color"
          >
            <div className="w-4 h-4" style={{ backgroundColor: computedBarColor }} />
            <span className="text-[var(--token-text-secondary)]">Best Lap</span>
          </div>
        </div>

        {/* Color Picker */}
        {showColorPicker && colorPickerPosition && (
          <ChartColorPicker
            currentColor={barColor}
            onColorChange={setBarColor}
            onClose={() => setShowColorPicker(false)}
            position={colorPickerPosition}
            label="Chart Color"
          />
        )}

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
      </ChartContainer>
    </div>
  )
}
