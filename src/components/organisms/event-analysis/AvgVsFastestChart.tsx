/**
 * @fileoverview Average vs fastest lap chart - comparison chart
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Interactive comparison chart showing average lap vs fastest lap
 *
 * @purpose Visualizes driver consistency by comparing average and fastest lap times.
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
import { useChartColors } from "@/hooks/useChartColors"

export interface DriverLapComparison {
  driverId: string
  driverName: string
  fastestLap: number
  averageLap: number
}

export interface AvgVsFastestChartProps {
  data: DriverLapComparison[]
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
const defaultFastestColor = "var(--token-accent)"
const defaultAverageColor = "#5aa2ff"
const textColor = "var(--token-text-primary)"
const textSecondaryColor = "var(--token-text-secondary)"
const borderColor = "var(--token-border-default)"
const DEFAULT_AXIS_COLOR = "#ffffff"

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

export default function AvgVsFastestChart({
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
}: AvgVsFastestChartProps) {
  const chartDescId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [colorPickerSeries, setColorPickerSeries] = useState<"fastest" | "average" | null>(null)
  const [colorPickerPosition, setColorPickerPosition] = useState<{
    top: number
    left: number
  } | null>(null)

  // Use chart colors hook for managing both series colors
  const instanceId = chartInstanceId || "default-avg-vs-fastest"
  const { colors, setColor } = useChartColors(instanceId, {
    fastest: defaultFastestColor,
    average: defaultAverageColor,
  })
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<{
      driverName: string
      fastestLap: number
      averageLap: number
    }>()

  const handleLegendClick = (
    series: "fastest" | "average",
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    // Use fixed positioning, so use getBoundingClientRect directly (viewport-relative)
    setColorPickerPosition({
      top: rect.bottom + 8,
      left: rect.left,
    })
    setColorPickerSeries(series)
    setShowColorPicker(true)
  }

  // Filter data if drivers are selected
  // undefined = show all (initial state), [] = show nothing (cleared), [ids] = show selected
  const displayData = useMemo(() => {
    if (selectedDriverIds === undefined) {
      // Initial state: show all data
      return data
    }
    if (selectedDriverIds.length === 0) {
      // Cleared state: show nothing
      return []
    }
    // Filter to selected drivers only
    return data.filter((d) => selectedDriverIds.includes(d.driverId))
  }, [data, selectedDriverIds])

  // Sort by fastest lap (fastest first)
  const sortedData = useMemo(() => {
    return [...displayData].sort((a, b) => a.fastestLap - b.fastestLap)
  }, [displayData])

  // Calculate pagination
  const totalPages = Math.ceil(sortedData.length / driversPerPage)
  const startIndex = (currentPage - 1) * driversPerPage
  const endIndex = startIndex + driversPerPage
  const paginatedData = sortedData.slice(startIndex, endIndex)

  // Calculate dynamic bottom margin based on label lengths
  // Must be before early return to maintain hook order
  const margin = useMemo(() => {
    if (paginatedData.length === 0) {
      return defaultMargin
    }
    const labelLengths = paginatedData.map((d) => d.driverName)
    const dynamicBottom = calculateBottomMargin(labelLengths, 100)
    return { ...defaultMargin, bottom: dynamicBottom }
  }, [paginatedData])

  if (displayData.length === 0) {
    return (
      <ChartContainer
        title="Average vs Fastest Lap"
        height={height}
        className={className}
        aria-label="Average vs fastest lap comparison chart - no data available"
        selectedClass={selectedClass}
      >
        <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
          No data available
        </div>
      </ChartContainer>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <ChartContainer
        title="Average vs Fastest Lap"
        height={height}
        className={className}
        aria-label="Average vs fastest lap comparison bar chart"
        chartInstanceId={chartInstanceId}
        selectedClass={selectedClass}
        axisColorPicker
        defaultAxisColors={{ x: DEFAULT_AXIS_COLOR, y: DEFAULT_AXIS_COLOR }}
        renderContent={({ xAxisColor, yAxisColor }) => (
        <>
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

              const maxLapTime = Math.max(
                ...paginatedData.flatMap((d) => [d.fastestLap, d.averageLap])
              )
              const minLapTime = Math.min(
                ...paginatedData.flatMap((d) => [d.fastestLap, d.averageLap])
              )
              const padding = (maxLapTime - minLapTime) * 0.1
              const yScale = scaleLinear({
                range: [innerHeight, 0],
                domain: [
                  Math.max(0, minLapTime - padding), // Clamp to 0 to prevent negative values
                  maxLapTime + padding,
                ],
                nice: true,
              })

              const barWidth = xScale.bandwidth() / 2

              return (
                <svg
                  width={width}
                  height={height}
                  aria-labelledby={chartDescId}
                  role="img"
                  overflow="visible"
                >
                  <desc id={chartDescId}>
                    Bar chart comparing each driver&apos;s average lap time against their fastest
                    lap.
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
                      const x = xScale(d.driverName) || 0
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
                          {/* Fastest lap bar */}
                          <Bar
                            x={x}
                            y={yScale(d.fastestLap)}
                            width={barWidth}
                            height={innerHeight - yScale(d.fastestLap)}
                            fill={colors.fastest}
                            opacity={isSelected ? 1 : 0.3}
                            stroke={
                              isSelected &&
                              selectedDriverIds !== undefined &&
                              selectedDriverIds.length > 0
                                ? colors.fastest
                                : "none"
                            }
                            strokeWidth={
                              isSelected &&
                              selectedDriverIds !== undefined &&
                              selectedDriverIds.length > 0
                                ? 1.5
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
                            aria-label={`${d.driverName}: Fastest lap ${formatLapTime(d.fastestLap)}`}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                handleClick()
                              }
                            }}
                          />

                          {/* Average lap bar */}
                          <Bar
                            x={x + barWidth}
                            y={yScale(d.averageLap)}
                            width={barWidth}
                            height={innerHeight - yScale(d.averageLap)}
                            fill={colors.average}
                            opacity={isSelected ? 1 : 0.3}
                            stroke={
                              isSelected &&
                              selectedDriverIds !== undefined &&
                              selectedDriverIds.length > 0
                                ? colors.average
                                : "none"
                            }
                            strokeWidth={
                              isSelected &&
                              selectedDriverIds !== undefined &&
                              selectedDriverIds.length > 0
                                ? 1.5
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
                            aria-label={`${d.driverName}: Average lap ${formatLapTime(d.averageLap)}`}
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
                      stroke={yAxisColor}
                      tickStroke={yAxisColor}
                      tickLabelProps={() => ({
                        fill: yAxisColor,
                        fontSize: 12,
                        textAnchor: "end",
                        dx: -8,
                      })}
                    />

                    {/* X-axis */}
                    <AxisBottom
                      top={innerHeight}
                      scale={xScale}
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
                  Fastest: {formatLapTime(tooltipData.fastestLap)}
                </div>
                <div className="text-sm text-[var(--token-text-secondary)]">
                  Average: {formatLapTime(tooltipData.averageLap)}
                </div>
              </div>
            </TooltipWithBounds>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-sm">
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => handleLegendClick("fastest", e)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                setColorPickerPosition({
                  top: rect.bottom + 8,
                  left: rect.left,
                })
                setColorPickerSeries("fastest")
                setShowColorPicker(true)
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Fastest Lap - Click to customize color"
          >
            <div className="w-4 h-4" style={{ backgroundColor: colors.fastest }} />
            <span className="text-[var(--token-text-secondary)]">Fastest Lap</span>
          </div>
          <div
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => handleLegendClick("average", e)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                const rect = e.currentTarget.getBoundingClientRect()
                setColorPickerPosition({
                  top: rect.bottom + 8,
                  left: rect.left,
                })
                setColorPickerSeries("average")
                setShowColorPicker(true)
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Average Lap - Click to customize color"
          >
            <div className="w-4 h-4" style={{ backgroundColor: colors.average }} />
            <span className="text-[var(--token-text-secondary)]">Average Lap</span>
          </div>
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

      {/* Color Picker */}
      {showColorPicker && colorPickerPosition && colorPickerSeries && (
        <ChartColorPicker
          currentColor={colors[colorPickerSeries]}
          onColorChange={(color) => setColor(colorPickerSeries, color)}
          onClose={() => {
            setShowColorPicker(false)
            setColorPickerSeries(null)
          }}
          position={colorPickerPosition}
          label={`${colorPickerSeries === "fastest" ? "Fastest" : "Average"} Lap Color`}
        />
      )}
    </div>
  )
}
