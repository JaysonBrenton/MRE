/**
 * @fileoverview Driver performance chart - lap time trends across sessions
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Line chart showing lap time trends for selected drivers across sessions
 * 
 * @purpose Visualizes driver performance progression through sessions with best lap and average lap trends.
 * 
 * @relatedFiles
 * - src/components/event-analysis/ChartContainer.tsx (wrapper)
 * - src/core/events/get-sessions-data.ts (data source)
 */

"use client"

import { useMemo, useId } from "react"
import { Group } from "@visx/group"
import { LinePath } from "@visx/shape"
import { scaleBand, scaleLinear } from "@visx/scale"
import { curveLinear } from "@visx/curve"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import { ParentSize } from "@visx/responsive"
import ChartContainer from "../ChartContainer"
import type { DriverLapTrend } from "@/core/events/get-sessions-data"

export interface DriverPerformanceChartProps {
  driverLapTrends: DriverLapTrend[]
  height?: number
  className?: string
}

const defaultMargin = { top: 20, right: 20, bottom: 100, left: 80 }
const driverColors = [
  "var(--token-accent)",
  "#4ecdc4",
  "#ff6b6b",
  "#ffe66d",
  "#a8e6cf",
  "#ff8b94",
]
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

export default function DriverPerformanceChart({
  driverLapTrends,
  height = 500,
  className = "",
}: DriverPerformanceChartProps) {
  const chartTitleId = useId()
  const chartDescId = useId()
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<{
    driverName: string
    raceLabel: string
    bestLapTime: number | null
    avgLapTime: number | null
  }>()

  // Get all unique race labels
  const allRaceLabels = useMemo(() => {
    const labels = new Set<string>()
    driverLapTrends.forEach((trend) => {
      trend.sessions.forEach((s) => {
        labels.add(s.raceLabel)
      })
    })
    return Array.from(labels).sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    )
  }, [driverLapTrends])

  // Calculate Y scale domain from all lap times
  const allLapTimes = useMemo(() => {
    const times: number[] = []
    driverLapTrends.forEach((trend) => {
      trend.sessions.forEach((s) => {
        if (s.bestLapTime !== null) {
          times.push(s.bestLapTime)
        }
        if (s.avgLapTime !== null) {
          times.push(s.avgLapTime)
        }
      })
    })
    return times
  }, [driverLapTrends])

  if (driverLapTrends.length === 0 || allRaceLabels.length === 0) {
    return (
      <ChartContainer
        title="Driver Performance"
        height={height}
        className={className}
        aria-label="Driver performance chart - no data available"
      >
        <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
          Select drivers to view performance trends
        </div>
      </ChartContainer>
    )
  }

  const margin = defaultMargin

  if (allLapTimes.length === 0) {
    return (
      <ChartContainer
        title="Driver Performance"
        height={height}
        className={className}
        aria-label="Driver performance chart - no lap time data"
      >
        <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
          No lap time data available for selected drivers
        </div>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer
      title="Driver Performance"
      height={height}
      className={className}
      aria-label="Driver performance chart showing lap time trends"
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

            // X scale (race labels)
            const xScale = scaleBand({
              range: [0, innerWidth],
              domain: allRaceLabels,
              padding: 0.2,
            })

            // Y scale (lap times)
            const minLap = Math.min(...allLapTimes)
            const maxLap = Math.max(...allLapTimes)
            const padding = (maxLap - minLap) * 0.1
            const yScale = scaleLinear({
              range: [innerHeight, 0],
              domain: [
                Math.max(0, minLap - padding),
                maxLap + padding,
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
                <title id={chartTitleId}>Driver performance trends</title>
                <desc id={chartDescId}>
                  Line chart showing best lap time trends for selected drivers across sessions.
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

                  {/* Driver lines */}
                  {driverLapTrends.map((trend, driverIndex) => {
                    const color = driverColors[driverIndex % driverColors.length]

                    // Prepare data points for best lap times
                    const bestLapData = allRaceLabels
                      .map((label) => {
                        const session = trend.sessions.find(
                          (s) => s.raceLabel === label
                        )
                        return session && session.bestLapTime !== null
                          ? {
                              raceLabel: label,
                              lapTime: session.bestLapTime,
                            }
                          : null
                      })
                      .filter(
                        (
                          d
                        ): d is { raceLabel: string; lapTime: number } =>
                          d !== null
                      )

                    if (bestLapData.length === 0) {
                      return null
                    }

                    return (
                      <LinePath
                        key={`best-${trend.driverId}`}
                        data={bestLapData}
                        x={(d) => (xScale(d.raceLabel) || 0) + xScale.bandwidth() / 2}
                        y={(d) => yScale(d.lapTime)}
                        stroke={color}
                        strokeWidth={2}
                        curve={curveLinear}
                      />
                    )
                  })}

                  {/* Data points */}
                  {driverLapTrends.map((trend, driverIndex) => {
                    const color = driverColors[driverIndex % driverColors.length]

                    return trend.sessions
                      .filter((s) => s.bestLapTime !== null)
                      .map((session) => {
                        const x = (xScale(session.raceLabel) || 0) + xScale.bandwidth() / 2
                        const y = yScale(session.bestLapTime!)

                        return (
                          <circle
                            key={`point-${trend.driverId}-${session.sessionId}`}
                            cx={x}
                            cy={y}
                            r={4}
                            fill={color}
                            onMouseMove={(event) => {
                              const svgElement = (event.target as SVGElement)
                                .ownerSVGElement
                              if (!svgElement) return
                              const coords = localPoint(svgElement, event)
                              if (coords) {
                                showTooltip({
                                  tooltipLeft: coords.x,
                                  tooltipTop: coords.y,
                                  tooltipData: {
                                    driverName: trend.driverName,
                                    raceLabel: session.raceLabel,
                                    bestLapTime: session.bestLapTime,
                                    avgLapTime: session.avgLapTime,
                                  },
                                })
                              }
                            }}
                            onMouseLeave={() => hideTooltip()}
                          />
                        )
                      })
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
                    label="Lap Time"
                    labelProps={{
                      fill: textSecondaryColor,
                      fontSize: 12,
                      textAnchor: "middle",
                      dy: -50,
                    }}
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
                Session: {tooltipData.raceLabel}
              </div>
              {tooltipData.bestLapTime !== null && (
                <div className="text-sm text-[var(--token-text-secondary)]">
                  Best Lap: {formatLapTime(tooltipData.bestLapTime)}
                </div>
              )}
              {tooltipData.avgLapTime !== null && (
                <div className="text-sm text-[var(--token-text-secondary)]">
                  Avg Lap: {formatLapTime(tooltipData.avgLapTime)}
                </div>
              )}
            </div>
          </TooltipWithBounds>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
        {driverLapTrends.map((trend, index) => {
          const color = driverColors[index % driverColors.length]
          return (
            <div key={trend.driverId} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[var(--token-text-secondary)]">
                {trend.driverName}
              </span>
            </div>
          )
        })}
      </div>
    </ChartContainer>
  )
}
