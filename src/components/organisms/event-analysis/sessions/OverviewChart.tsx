/**
 * @fileoverview Overview chart - combined timeline, duration, participants, and driver lap times
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Combined visualization showing timeline, duration bars, participant line, and driver lap times
 *
 * @purpose Provides comprehensive overview of all sessions with multiple metrics on one chart.
 *          Uses multi-axis approach with Visx scales.
 *
 * @relatedFiles
 * - src/components/event-analysis/ChartContainer.tsx (wrapper)
 * - src/core/events/get-sessions-data.ts (data source)
 */

"use client"

import { useMemo, useId } from "react"
import { Group } from "@visx/group"
import { Bar } from "@visx/shape"
import { LinePath } from "@visx/shape"
import { curveLinear } from "@visx/curve"
import { scaleBand, scaleLinear } from "@visx/scale"
import { AxisBottom, AxisLeft, AxisRight } from "@visx/axis"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import { ParentSize } from "@visx/responsive"
import ChartContainer from "../ChartContainer"
import type { SessionData } from "@/core/events/get-sessions-data"
import type { DriverLapTrend } from "@/core/events/get-sessions-data"

export interface OverviewChartProps {
  sessions: SessionData[]
  driverLapTrends?: DriverLapTrend[]
  height?: number
  className?: string
}

const defaultMargin = { top: 20, right: 100, bottom: 100, left: 80 }
const durationColor = "var(--token-accent)"
const participantColor = "#5aa2ff"
const textColor = "var(--token-text-primary)"
const textSecondaryColor = "var(--token-text-secondary)"
const borderColor = "var(--token-border-default)"

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
 * Format duration in seconds to MM:SS format
 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

export default function OverviewChart({
  sessions,
  driverLapTrends = [],
  height = 500,
  className = "",
}: OverviewChartProps) {
  const chartTitleId = useId()
  const chartDescId = useId()
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<{
      session: SessionData
      participantCount: number
      duration: number | null
    }>()

  // Prepare chart data
  const chartData = useMemo(() => {
    return sessions.map((session) => ({
      session,
      participantCount: session.participantCount,
      duration: session.durationSeconds,
    }))
  }, [sessions])

  // Calculate dynamic bottom margin based on label lengths
  const margin = useMemo(() => {
    const labelLengths = chartData.map((d) => d.session.raceLabel)
    const dynamicBottom = calculateBottomMargin(labelLengths, 100)
    return { ...defaultMargin, bottom: dynamicBottom }
  }, [chartData])

  if (chartData.length === 0) {
    return (
      <ChartContainer
        title="Sessions Overview"
        height={height}
        className={className}
        aria-label="Sessions overview chart - no data available"
      >
        <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
          No sessions available
        </div>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer
      title="Sessions Overview"
      height={height}
      className={className}
      aria-label="Sessions overview chart with timeline, duration, and participants"
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

            // X scale (sessions)
            const xScale = scaleBand({
              range: [0, innerWidth],
              domain: chartData.map((d) => d.session.raceLabel),
              padding: 0.2,
            })

            // Y scale for duration (left axis)
            const durations = chartData
              .map((d) => d.duration)
              .filter((d): d is number => d !== null)
            const maxDuration = durations.length > 0 ? Math.max(...durations) : 0
            const yScaleDuration = scaleLinear({
              range: [innerHeight, 0],
              domain: [0, maxDuration * 1.1],
              nice: true,
            })

            // Y scale for participants (right axis)
            const maxParticipants = Math.max(...chartData.map((d) => d.participantCount))
            const yScaleParticipants = scaleLinear({
              range: [innerHeight, 0],
              domain: [0, maxParticipants * 1.1],
              nice: true,
            })

            // Y scale for lap times (if drivers selected)
            let yScaleLapTime: ReturnType<typeof scaleLinear> | null = null
            if (driverLapTrends.length > 0) {
              const lapTimes: number[] = []
              driverLapTrends.forEach((trend) => {
                trend.sessions.forEach((s) => {
                  if (s.bestLapTime !== null) {
                    lapTimes.push(s.bestLapTime)
                  }
                })
              })
              if (lapTimes.length > 0) {
                const minLap = Math.min(...lapTimes)
                const maxLap = Math.max(...lapTimes)
                const padding = (maxLap - minLap) * 0.1
                yScaleLapTime = scaleLinear({
                  range: [innerHeight, 0],
                  domain: [Math.max(0, minLap - padding), maxLap + padding],
                  nice: true,
                })
              }
            }

            return (
              <svg
                width={width}
                height={height}
                aria-labelledby={`${chartTitleId} ${chartDescId}`}
                role="img"
              >
                <title id={chartTitleId}>Sessions overview</title>
                <desc id={chartDescId}>
                  Combined chart showing race duration, participant count, and driver lap times
                  across sessions.
                </desc>
                <Group left={margin.left} top={margin.top}>
                  {/* Grid lines for duration */}
                  {yScaleDuration.ticks(5).map((tick) => (
                    <line
                      key={`duration-${tick}`}
                      x1={0}
                      x2={innerWidth}
                      y1={yScaleDuration(tick)}
                      y2={yScaleDuration(tick)}
                      stroke={borderColor}
                      strokeWidth={1}
                      strokeDasharray="2,2"
                      opacity={0.2}
                    />
                  ))}

                  {/* Duration bars */}
                  {chartData.map((d) => {
                    const x = xScale(d.session.raceLabel) || 0
                    const barWidth = xScale.bandwidth()
                    const duration = d.duration

                    if (duration === null) {
                      return null
                    }

                    const barHeight = innerHeight - yScaleDuration(duration)
                    const y = yScaleDuration(duration)

                    return (
                      <Bar
                        key={`duration-${d.session.id}`}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill={durationColor}
                        opacity={0.6}
                        onMouseMove={(event) => {
                          const svgElement = (event.target as SVGElement).ownerSVGElement
                          if (!svgElement) return
                          const coords = localPoint(svgElement, event)
                          if (coords) {
                            showTooltip({
                              tooltipLeft: coords.x,
                              tooltipTop: coords.y,
                              tooltipData: {
                                session: d.session,
                                participantCount: d.participantCount,
                                duration,
                              },
                            })
                          }
                        }}
                        onMouseLeave={() => hideTooltip()}
                      />
                    )
                  })}

                  {/* Participant count line */}
                  <LinePath
                    data={chartData}
                    x={(d) => (xScale(d.session.raceLabel) || 0) + xScale.bandwidth() / 2}
                    y={(d) => yScaleParticipants(d.participantCount)}
                    stroke={participantColor}
                    strokeWidth={2}
                    strokeDasharray="5,5"
                    curve={curveLinear}
                  />

                  {/* Participant count points */}
                  {chartData.map((d) => {
                    const x = (xScale(d.session.raceLabel) || 0) + xScale.bandwidth() / 2
                    const y = yScaleParticipants(d.participantCount)
                    return (
                      <circle
                        key={`participant-${d.session.id}`}
                        cx={x}
                        cy={y}
                        r={4}
                        fill={participantColor}
                        onMouseMove={(event) => {
                          const svgElement = (event.target as SVGElement).ownerSVGElement
                          if (!svgElement) return
                          const coords = localPoint(svgElement, event)
                          if (coords) {
                            showTooltip({
                              tooltipLeft: coords.x,
                              tooltipTop: coords.y,
                              tooltipData: {
                                session: d.session,
                                participantCount: d.participantCount,
                                duration: d.duration,
                              },
                            })
                          }
                        }}
                        onMouseLeave={() => hideTooltip()}
                      />
                    )
                  })}

                  {/* Driver lap time lines (if drivers selected) */}
                  {driverLapTrends.length > 0 && yScaleLapTime && (
                    <>
                      {driverLapTrends.map((trend, driverIndex) => {
                        const colors = ["#ff6b6b", "#4ecdc4", "#ffe66d", "#a8e6cf", "#ff8b94"]
                        const color = colors[driverIndex % colors.length]

                        // Build line data matching chartData order
                        const lineData = chartData
                          .map((d) => {
                            const sessionData = trend.sessions.find(
                              (s) => s.sessionId === d.session.id
                            )
                            if (sessionData && sessionData.bestLapTime !== null) {
                              return {
                                session: d.session,
                                lapTime: sessionData.bestLapTime,
                              }
                            }
                            return null
                          })
                          .filter((d): d is { session: SessionData; lapTime: number } => d !== null)

                        if (lineData.length === 0) {
                          return null
                        }

                        return (
                          <LinePath
                            key={`lap-trend-${trend.driverId}`}
                            data={lineData}
                            x={(d) => (xScale(d.session.raceLabel) || 0) + xScale.bandwidth() / 2}
                            y={(d) => (yScaleLapTime ? yScaleLapTime(d.lapTime) : 0) as number}
                            stroke={color}
                            strokeWidth={2}
                            curve={curveLinear}
                          />
                        )
                      })}
                    </>
                  )}

                  {/* Left Y-axis (Duration) */}
                  <AxisLeft
                    scale={yScaleDuration}
                    tickFormat={(value) => formatDuration(Number(value))}
                    stroke={borderColor}
                    tickStroke={borderColor}
                    tickLabelProps={() => ({
                      fill: textSecondaryColor,
                      fontSize: 12,
                      textAnchor: "end",
                      dx: -8,
                    })}
                    label="Duration"
                    labelProps={{
                      fill: textSecondaryColor,
                      fontSize: 12,
                      textAnchor: "middle",
                      dy: -50,
                    }}
                  />

                  {/* Right Y-axis (Participants) */}
                  <AxisRight
                    left={innerWidth}
                    scale={yScaleParticipants}
                    stroke={borderColor}
                    tickStroke={borderColor}
                    tickLabelProps={() => ({
                      fill: participantColor,
                      fontSize: 12,
                      textAnchor: "start",
                      dx: 8,
                    })}
                    label="Participants"
                    labelProps={{
                      fill: participantColor,
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
                {tooltipData.session.raceLabel}
              </div>
              <div className="text-sm text-[var(--token-text-secondary)]">
                Class: {tooltipData.session.className}
              </div>
              {tooltipData.duration !== null && (
                <div className="text-sm text-[var(--token-text-secondary)]">
                  Duration: {formatDuration(tooltipData.duration)}
                </div>
              )}
              <div className="text-sm text-[var(--token-text-secondary)]">
                Participants: {tooltipData.participantCount}
              </div>
            </div>
          </TooltipWithBounds>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" style={{ backgroundColor: durationColor, opacity: 0.6 }} />
          <span className="text-[var(--token-text-secondary)]">Duration</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 border-2"
            style={{
              borderColor: participantColor,
              borderStyle: "dashed",
              backgroundColor: "transparent",
            }}
          />
          <span className="text-[var(--token-text-secondary)]">Participants</span>
        </div>
        {driverLapTrends.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[var(--token-text-secondary)]">Driver Lap Times</span>
          </div>
        )}
      </div>
    </ChartContainer>
  )
}
