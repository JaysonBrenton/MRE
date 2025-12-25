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

import { useMemo, useId } from "react"
import { Group } from "@visx/group"
import { Bar } from "@visx/shape"
import { scaleBand, scaleLinear } from "@visx/scale"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import { ParentSize } from "@visx/responsive"
import ChartContainer from "./ChartContainer"
import ChartPagination from "./ChartPagination"

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
}

const defaultMargin = { top: 20, right: 20, bottom: 60, left: 80 }
const accentColor = "var(--token-accent)"
const textColor = "var(--token-text-primary)"
const textSecondaryColor = "var(--token-text-secondary)"
const borderColor = "var(--token-border-default)"

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
  selectedDriverIds = [],
  height = 400,
  className = "",
  currentPage = 1,
  driversPerPage = 25,
  onPageChange,
  onDriverToggle,
}: BestLapBarChartProps) {
  const chartTitleId = useId()
  const chartDescId = useId()
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<DriverBestLap>()

  // Filter and validate data
  const validData = useMemo(() => {
    return data.filter((d) => d.bestLapTime > 0 && isFinite(d.bestLapTime))
  }, [data])

  // Filter data if drivers are selected
  const displayData = useMemo(() => {
    let filtered = validData
    if (selectedDriverIds.length > 0) {
      filtered = validData.filter((d) => selectedDriverIds.includes(d.driverId))
    }
    return filtered
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

  if (displayData.length === 0) {
    return (
      <ChartContainer
        title="Best Lap Times"
        height={height}
        className={className}
        aria-label="Best lap times chart - no data available"
      >
        <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
          {validData.length === 0
            ? "No data available"
            : "Select drivers to compare"}
        </div>
      </ChartContainer>
    )
  }

  const margin = defaultMargin

  return (
    <ChartContainer
      title="Best Lap Times"
      height={height}
      className={className}
      aria-label="Best lap times per driver bar chart"
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
                aria-labelledby={`${chartTitleId} ${chartDescId}`}
                role="img"
              >
                <title id={chartTitleId}>Best lap times per driver</title>
                <desc id={chartDescId}>
                  Bar chart showing each driver's best lap time, sorted fastest to slowest.
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
                  {paginatedData.map((d, i) => {
                    const barWidth = xScale.bandwidth()
                    const barHeight = innerHeight - yScale(d.bestLapTime)
                    const x = xScale(d.driverName) || 0
                    const y = yScale(d.bestLapTime)

                    const isSelected =
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
                          fill={isSelected ? accentColor : "var(--token-text-muted)"}
                          opacity={isSelected ? 1 : 0.3}
                          stroke={isSelected && selectedDriverIds.length > 0 ? accentColor : "none"}
                          strokeWidth={isSelected && selectedDriverIds.length > 0 ? 2 : 0}
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
  )
}
