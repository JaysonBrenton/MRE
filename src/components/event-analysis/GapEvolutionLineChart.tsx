/**
 * @fileoverview Gap evolution line chart - shows gap to leader over race duration
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Interactive line chart displaying gap evolution for top drivers
 * 
 * @purpose Visualizes how time gaps between drivers change over race duration.
 *          Built with Visx and styled with MRE token system.
 * 
 * @relatedFiles
 * - src/components/event-analysis/ChartContainer.tsx (wrapper)
 * - src/core/events/calculate-gap-evolution.ts (data source)
 */

"use client"

import { useMemo } from "react"
import { Group } from "@visx/group"
import { LinePath } from "@visx/shape"
import { curveMonotoneX } from "@visx/curve"
import { scaleLinear } from "@visx/scale"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { GridRows, GridColumns } from "@visx/grid"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import { ParentSize } from "@visx/responsive"
import ChartContainer from "./ChartContainer"
import ChartPagination from "./ChartPagination"

export interface GapDataPoint {
  lapNumber: number
  elapsedRaceTime: number
  gapToLeader: number
}

export interface GapEvolutionSeries {
  driverId: string
  driverName: string
  gaps: GapDataPoint[]
}

export interface GapEvolutionLineChartProps {
  data: GapEvolutionSeries[]
  selectedDriverIds?: string[]
  height?: number
  className?: string
  currentPage?: number
  driversPerPage?: number
  onPageChange?: (page: number) => void
  onDriverToggle?: (driverId: string) => void
}

const defaultMargin = { top: 20, right: 80, bottom: 60, left: 80 }
const accentColors = [
  "var(--token-accent)",
  "#5aa2ff",
  "#7bb5ff",
  "#9cc8ff",
  "#bddbff",
]
const textColor = "var(--token-text-primary)"
const textSecondaryColor = "var(--token-text-secondary)"
const borderColor = "var(--token-border-default)"

/**
 * Format gap time in seconds to SS.mmm format
 */
function formatGapTime(seconds: number): string {
  const wholeSecs = Math.floor(seconds)
  const millis = Math.floor((seconds - wholeSecs) * 1000)
  return `${wholeSecs}.${millis.toString().padStart(3, "0")}s`
}

export default function GapEvolutionLineChart({
  data,
  selectedDriverIds = [],
  height = 400,
  className = "",
  currentPage = 1,
  driversPerPage = 25,
  onPageChange,
  onDriverToggle,
}: GapEvolutionLineChartProps) {
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<{ driverName: string; lapNumber: number; gap: number }>()

  // Filter data if drivers are selected
  const displayData = useMemo(() => {
    if (selectedDriverIds.length === 0) {
      return data.slice(0, 3) // Default to top 3
    }
    return data.filter((d) => selectedDriverIds.includes(d.driverId))
  }, [data, selectedDriverIds])

  // Sort by driver name for consistent pagination
  const sortedData = useMemo(() => {
    return [...displayData].sort((a, b) => a.driverName.localeCompare(b.driverName))
  }, [displayData])

  // Calculate pagination
  const totalPages = Math.ceil(sortedData.length / driversPerPage)
  const startIndex = (currentPage - 1) * driversPerPage
  const endIndex = startIndex + driversPerPage
  const paginatedData = sortedData.slice(startIndex, endIndex)

  if (displayData.length === 0) {
    return (
      <ChartContainer
        title="Gap Evolution"
        height={height}
        className={className}
        aria-label="Gap evolution chart - no data available"
      >
        <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
          No data available
        </div>
      </ChartContainer>
    )
  }

  const margin = defaultMargin

  return (
    <ChartContainer
      title="Gap Evolution (Top Drivers)"
      height={height}
      className={className}
      aria-label="Gap to leader evolution line chart"
    >
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

          // Find max lap number and max gap
          const maxLap = Math.max(
            ...paginatedData.flatMap((series) =>
              series.gaps.map((gap) => gap.lapNumber)
            ),
            1
          )
          const maxGap = Math.max(
            ...paginatedData.flatMap((series) => series.gaps.map((gap) => gap.gapToLeader)),
            0
          )

          // Scales
          const xScale = scaleLinear({
            range: [0, innerWidth],
            domain: [1, maxLap],
            nice: true,
          })

          const yScale = scaleLinear({
            range: [innerHeight, 0],
            domain: [0, maxGap * 1.1],
            nice: true,
          })

          return (
            <svg width={width} height={height}>
              <Group left={margin.left} top={margin.top}>
                {/* Grid */}
                <GridRows
                  scale={yScale}
                  width={innerWidth}
                  stroke={borderColor}
                  strokeDasharray="2,2"
                  opacity={0.3}
                />
                <GridColumns
                  scale={xScale}
                  height={innerHeight}
                  stroke={borderColor}
                  strokeDasharray="2,2"
                  opacity={0.3}
                />

                {/* Lines */}
                {paginatedData.map((series, index) => {
            const color = accentColors[index % accentColors.length]
            const isSelected =
              selectedDriverIds.length === 0 ||
              selectedDriverIds.includes(series.driverId)

            const pathData = series.gaps.map((gap) => ({
              x: xScale(gap.lapNumber),
              y: yScale(gap.gapToLeader),
              lapNumber: gap.lapNumber,
              gap: gap.gapToLeader,
            }))

            const handleClick = () => {
              if (onDriverToggle) {
                onDriverToggle(series.driverId)
              }
            }

            return (
              <LinePath
                key={series.driverId}
                data={pathData}
                x={(d) => d.x}
                y={(d) => d.y}
                stroke={color}
                strokeWidth={isSelected ? 2 : 1.5}
                strokeOpacity={isSelected ? 1 : 0.4}
                curve={curveMonotoneX}
                onClick={handleClick}
                onMouseMove={(event) => {
                  const svgElement = (event.target as SVGElement).ownerSVGElement
                  if (!svgElement) return
                  const coords = localPoint(svgElement, event)
                  if (coords) {
                    // Find closest point
                    const closestPoint = pathData.reduce((prev, curr) => {
                      const prevDist = Math.abs(prev.x - coords.x)
                      const currDist = Math.abs(curr.x - coords.x)
                      return currDist < prevDist ? curr : prev
                    })

                    showTooltip({
                      tooltipLeft: coords.x,
                      tooltipTop: coords.y,
                      tooltipData: {
                        driverName: series.driverName,
                        lapNumber: closestPoint.lapNumber,
                        gap: closestPoint.gap,
                      },
                    })
                  }
                }}
                onMouseLeave={() => hideTooltip()}
                onTouchStart={(event) => {
                  const svgElement = (event.target as SVGElement).ownerSVGElement
                  if (!svgElement) return
                  const coords = localPoint(svgElement, event)
                  if (coords) {
                    const closestPoint = pathData.reduce((prev, curr) => {
                      const prevDist = Math.abs(prev.x - coords.x)
                      const currDist = Math.abs(curr.x - coords.x)
                      return currDist < prevDist ? curr : prev
                    })

                    showTooltip({
                      tooltipLeft: coords.x,
                      tooltipTop: coords.y,
                      tooltipData: {
                        driverName: series.driverName,
                        lapNumber: closestPoint.lapNumber,
                        gap: closestPoint.gap,
                      },
                    })
                  }
                }}
                onTouchEnd={() => {
                  hideTooltip()
                  if (onDriverToggle) {
                    onDriverToggle(series.driverId)
                  }
                }}
                style={{ cursor: "pointer" }}
                aria-label={`${series.driverName}: Gap evolution`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    handleClick()
                  }
                }}
              />
            )
          })}

          {/* Y-axis */}
          <AxisLeft
            scale={yScale}
            tickFormat={(value) => formatGapTime(Number(value))}
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

                {/* Legend */}
                <Group top={-10} left={innerWidth + 20}>
                  {paginatedData.map((series, index) => {
              const color = accentColors[index % accentColors.length]
              const isSelected =
                selectedDriverIds.length === 0 ||
                selectedDriverIds.includes(series.driverId)

              return (
                <Group key={series.driverId} top={index * 20} opacity={isSelected ? 1 : 0.4}>
                  <line
                    x1={0}
                    y1={0}
                    x2={20}
                    y2={0}
                    stroke={color}
                    strokeWidth={isSelected ? 2 : 1.5}
                  />
                  <text
                    x={25}
                    y={4}
                    fill={textColor}
                    fontSize={12}
                    style={{ pointerEvents: "none" }}
                    opacity={isSelected ? 1 : 0.6}
                  >
                    {series.driverName}
                  </text>
                </Group>
                  )
                })}
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
            <div className="text-sm text-[var(--token-text-secondary)]">
              Lap {tooltipData.lapNumber}: {formatGapTime(tooltipData.gap)} gap
            </div>
          </div>
        </TooltipWithBounds>
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
  )
}

