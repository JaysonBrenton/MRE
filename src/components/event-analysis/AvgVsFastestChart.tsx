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

import { useMemo } from "react"
import { Group } from "@visx/group"
import { Bar } from "@visx/shape"
import { scaleBand, scaleLinear } from "@visx/scale"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import ChartContainer from "./ChartContainer"

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
}

const defaultMargin = { top: 20, right: 20, bottom: 60, left: 80 }
const fastestColor = "var(--token-accent)"
const averageColor = "#5aa2ff"
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

export default function AvgVsFastestChart({
  data,
  selectedDriverIds = [],
  height = 400,
  className = "",
}: AvgVsFastestChartProps) {
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<{
    driverName: string
    fastestLap: number
    averageLap: number
  }>()

  // Filter data if drivers are selected
  const displayData = useMemo(() => {
    if (selectedDriverIds.length === 0) {
      return data
    }
    return data.filter((d) => selectedDriverIds.includes(d.driverId))
  }, [data, selectedDriverIds])

  if (displayData.length === 0) {
    return (
      <ChartContainer
        title="Average vs Fastest Lap"
        height={height}
        className={className}
        aria-label="Average vs fastest lap comparison chart - no data available"
      >
        <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
          No data available
        </div>
      </ChartContainer>
    )
  }

  // Sort by fastest lap (fastest first)
  const sortedData = [...displayData].sort(
    (a, b) => a.fastestLap - b.fastestLap
  )

  const margin = defaultMargin
  const width = typeof window !== "undefined" ? window.innerWidth - 64 : 800
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  // Scales
  const xScale = scaleBand({
    range: [0, innerWidth],
    domain: sortedData.map((d) => d.driverName),
    padding: 0.3,
  })

  const maxLapTime = Math.max(
    ...sortedData.flatMap((d) => [d.fastestLap, d.averageLap])
  )
  const minLapTime = Math.min(
    ...sortedData.flatMap((d) => [d.fastestLap, d.averageLap])
  )
  const yScale = scaleLinear({
    range: [innerHeight, 0],
    domain: [
      minLapTime - (maxLapTime - minLapTime) * 0.1,
      maxLapTime + (maxLapTime - minLapTime) * 0.1,
    ],
    nice: true,
  })

  const barWidth = xScale.bandwidth() / 2

  return (
    <ChartContainer
      title="Average vs Fastest Lap"
      height={height}
      className={className}
      aria-label="Average vs fastest lap comparison bar chart"
    >
      <svg width={width} height={height}>
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
          {sortedData.map((d) => {
            const x = xScale(d.driverName) || 0
            const isSelected =
              selectedDriverIds.length === 0 ||
              selectedDriverIds.includes(d.driverId)

            if (!isSelected) return null

            return (
              <Group key={d.driverId}>
                {/* Fastest lap bar */}
                <Bar
                  x={x}
                  y={yScale(d.fastestLap)}
                  width={barWidth}
                  height={innerHeight - yScale(d.fastestLap)}
                  fill={fastestColor}
                  opacity={isSelected ? 1 : 0.5}
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
                  onTouchEnd={() => hideTooltip()}
                  style={{ cursor: "pointer" }}
                />

                {/* Average lap bar */}
                <Bar
                  x={x + barWidth}
                  y={yScale(d.averageLap)}
                  width={barWidth}
                  height={innerHeight - yScale(d.averageLap)}
                  fill={averageColor}
                  opacity={isSelected ? 1 : 0.5}
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
                  onTouchEnd={() => hideTooltip()}
                  style={{ cursor: "pointer" }}
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
              fontSize: 12,
              textAnchor: "middle",
              dy: 8,
            })}
          />
        </Group>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4"
            style={{ backgroundColor: fastestColor }}
          />
          <span className="text-[var(--token-text-secondary)]">Fastest Lap</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4"
            style={{ backgroundColor: averageColor }}
          />
          <span className="text-[var(--token-text-secondary)]">Average Lap</span>
        </div>
      </div>

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
    </ChartContainer>
  )
}

