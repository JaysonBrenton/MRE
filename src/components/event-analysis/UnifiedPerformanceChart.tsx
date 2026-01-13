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

import { useMemo, useId, useState, useRef, useCallback } from "react"
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

// Metric types - extensible for future metrics
export type MetricType = "bestLap" | "averageLap" | "consistency"

export interface DriverPerformanceData {
  driverId: string
  driverName: string
  bestLapTime: number | null
  averageLapTime: number | null
  bestLapRaceLabel?: string | null
  consistency?: number | null // Future metric
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
}

const defaultMargin = { top: 20, right: 20, bottom: 100, left: 80 }
const defaultColors = {
  bestLap: "var(--token-accent)",
  averageLap: "#5aa2ff",
  consistency: "#4ecdc4", // Future metric color
}
const textColor = "var(--token-text-primary)"
const textSecondaryColor = "var(--token-text-secondary)"
const borderColor = "var(--token-border-default)"

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
        return `#${[r, g, b].map(x => x.toString(16).padStart(2, "0")).join("")}`
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
  
  const fontSize = 11
  const avgCharWidth = 6.5
  const rotationRadians = Math.PI / 4
  const padding = 20
  
  const maxLabelLength = Math.max(...labels.map(label => label.length))
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

// Metric configuration
const metricConfig: Record<MetricType, { label: string; key: keyof DriverPerformanceData }> = {
  bestLap: { label: "Best Lap", key: "bestLapTime" },
  averageLap: { label: "Average Lap", key: "averageLapTime" },
  consistency: { label: "Consistency", key: "consistency" },
}

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
      if (driver.consistency !== null && driver.consistency !== undefined && driver.consistency > 0) available.add("consistency")
    })
    return available
  }, [data])

  // Filter data based on visible metrics and validate
  const validData = useMemo(() => {
    return data.filter((d) => {
      // Include driver if at least one visible metric has valid data
      return Array.from(visibleMetrics).some((metric) => {
        const key = metricConfig[metric].key
        const value = d[key]
        return value !== null && value !== undefined && isFinite(value as number) && (value as number) > 0
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

  // Sort by best lap time (fastest first)
  const sortedData = useMemo(() => {
    return [...displayData].sort((a, b) => {
      const aBest = a.bestLapTime ?? Infinity
      const bBest = b.bestLapTime ?? Infinity
      return aBest - bBest
    })
  }, [displayData])

  // Pagination
  const totalPages = Math.ceil(sortedData.length / driversPerPage)
  const startIndex = (currentPage - 1) * driversPerPage
  const endIndex = startIndex + driversPerPage
  const paginatedData = sortedData.slice(startIndex, endIndex)

  // Calculate dynamic bottom margin
  const margin = useMemo(() => {
    const labelLengths = paginatedData.map(d => d.driverName)
    const dynamicBottom = calculateBottomMargin(labelLengths, 100)
    return { ...defaultMargin, bottom: dynamicBottom }
  }, [paginatedData])

  // Tooltip
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<DriverPerformanceData>()

  // Handle bar click to open color picker for the metric
  const handleBarClickForColorPicker = useCallback((metric: MetricType, event: React.MouseEvent<SVGElement> | React.KeyboardEvent<SVGElement>) => {
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
  }, [])

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

  // Calculate Y scale domain based on visible metrics (must be before conditional return)
  const yScaleDomain = useMemo(() => {
    if (paginatedData.length === 0) {
      return [0, 100]
    }
    
    const allValues: number[] = []
    paginatedData.forEach((d) => {
      visibleMetrics.forEach((metric) => {
        const key = metricConfig[metric].key
        const value = d[key]
        if (value !== null && value !== undefined && isFinite(value as number) && (value as number) > 0) {
          allValues.push(value as number)
        }
      })
    })
    
    if (allValues.length === 0) {
      return [0, 100]
    }
    
    const min = Math.min(...allValues)
    const max = Math.max(...allValues)
    const padding = (max - min) * 0.1
    return [Math.max(0, min - padding), max + padding]
  }, [paginatedData, visibleMetrics])

  // Early return for empty data (after all hooks)
  if (displayData.length === 0) {
    return (
      <ChartContainer
        title="Performance Metrics"
        height={height}
        className={className}
        aria-label="Performance metrics chart - no data available"
        selectedClass={selectedClass}
      >
        <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
          {validData.length === 0
            ? "No data available"
            : "Select drivers to compare"}
        </div>
      </ChartContainer>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <ChartContainer
        title="Performance Metrics"
        height={height}
        className={className}
        aria-label="Unified performance metrics chart"
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

              const innerWidth = width - margin.left - margin.right
              const innerHeight = height - margin.top - margin.bottom

              // X scale (driver names)
              const xScale = scaleBand({
                range: [0, innerWidth],
                domain: paginatedData.map((d) => d.driverName),
                padding: 0.3,
              })

              // Y scale (lap times)
              const yScale = scaleLinear({
                range: [innerHeight, 0],
                domain: yScaleDomain,
                nice: true,
              })

              // Calculate bar width
              const visibleCount = visibleMetrics.size
              const barWidth = visibleCount > 0
                ? xScale.bandwidth() / visibleCount
                : xScale.bandwidth()

              return (
                <svg
                  width={width}
                  height={height}
                  aria-labelledby={chartDescId}
                  role="img"
                  overflow="visible"
                >
                  <desc id={chartDescId}>
                    Bar chart showing performance metrics for each driver.
                    Visible metrics: {Array.from(visibleMetrics).map(m => metricConfig[m].label).join(", ")}
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

                    {/* Chart elements - Bar chart */}
                    {paginatedData.map((d) => {
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
                            
                            if (value === null || value === undefined || !isFinite(value as number) || (value as number) <= 0) {
                              return null
                            }

                            const metricValue = value as number
                            const color = computedColors[metric]
                            const metricX = x + (metricIndex * barWidth)

                            return (
                              <Bar
                                key={metric}
                                x={metricX}
                                y={yScale(metricValue)}
                                width={barWidth}
                                height={innerHeight - yScale(metricValue)}
                                fill={color}
                                opacity={isSelected ? 1 : 0.3}
                                stroke={isSelected && selectedDriverIds !== undefined && selectedDriverIds.length > 0 ? color : "none"}
                                strokeWidth={isSelected && selectedDriverIds !== undefined && selectedDriverIds.length > 0 ? 1.5 : 0}
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
                                onTouchEnd={(e) => {
                                  hideTooltip()
                                  // Long press or double tap could open color picker
                                  // Convert touch event to mouse event for handler
                                  const syntheticEvent = {
                                    ...e,
                                    stopPropagation: () => e.stopPropagation(),
                                    currentTarget: e.currentTarget,
                                  } as React.MouseEvent<SVGElement>
                                  handleBarClickForColorPicker(metric, syntheticEvent)
                                }}
                                style={{ cursor: "pointer" }}
                                aria-label={`${d.driverName}: ${metricConfig[metric].label} ${formatLapTime(metricValue)}. Click to customize color, right-click to toggle driver selection`}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    // Keyboard event is compatible with the handler signature
                                    handleBarClickForColorPicker(metric, e as React.KeyboardEvent<SVGElement>)
                                  }
                                }}
                              />
                            )
                          })}
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
                {Array.from(visibleMetrics).map((metric) => {
                  const key = metricConfig[metric].key
                  const value = tooltipData[key]
                  if (value === null || value === undefined) return null
                  return (
                    <div key={metric} className="text-sm text-[var(--token-text-secondary)]">
                      {metricConfig[metric].label}: {formatLapTime(value as number)}
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
            
            return (
              <div
                key={metric}
                className={`flex items-center gap-2 transition-opacity ${
                  canToggle
                    ? "cursor-pointer hover:opacity-80"
                    : "cursor-not-allowed opacity-50"
                } ${
                  !isVisible ? "opacity-40" : ""
                }`}
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
                title={`${metricConfig[metric].label} - Click to ${isVisible ? "hide" : "show"}. Click bars in the chart to customize colors.`}
              >
                <div
                  className={`w-4 h-4 rounded-sm transition-all ${
                    isVisible ? "" : "opacity-30"
                  }`}
                  style={{ 
                    backgroundColor: isVisible ? computedColors[metric] : computedColors[metric],
                    border: `1px solid ${computedColors[metric]}`,
                  }}
                />
                <span className={`text-[var(--token-text-secondary)] ${
                  !isVisible ? "line-through opacity-50" : ""
                }`}>
                  {metricConfig[metric].label}
                </span>
                {!isVisible && (
                  <span className="text-xs text-[var(--token-text-muted)]">(hidden)</span>
                )}
              </div>
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
      </ChartContainer>

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
