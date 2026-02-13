/**
 * @fileoverview Heat progression chart - shows qualifying → heats → finals structure
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Visualization showing heat progression structure grouped by class
 *
 * @purpose Shows the flow from qualifying through heats to finals for each racing class.
 *
 * @relatedFiles
 * - src/components/event-analysis/ChartContainer.tsx (wrapper)
 * - src/core/events/get-sessions-data.ts (data source)
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
import ChartContainer from "../ChartContainer"
import type { HeatProgressionData } from "@/core/events/get-sessions-data"

const DEFAULT_AXIS_COLOR = "#ffffff"

export interface HeatProgressionChartProps {
  progressionData: HeatProgressionData[]
  height?: number
  className?: string
  chartInstanceId?: string
}

const defaultMargin = { top: 20, right: 20, bottom: 100, left: 80 }
const qualifyingColor = "#4ecdc4"
const heatColor = "var(--token-accent)"
const finalColor = "#ff6b6b"
const textColor = "var(--token-text-primary)"
const textSecondaryColor = "var(--token-text-secondary)"
const borderColor = "var(--token-border-default)"

export default function HeatProgressionChart({
  progressionData,
  height = 500,
  className = "",
  chartInstanceId = "sessions-heat-progression",
}: HeatProgressionChartProps) {
  const chartTitleId = useId()
  const chartDescId = useId()
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<{
      className: string
      stage: string
      sessionCount: number
    }>()

  // Flatten data for grouped bar chart
  const chartData = useMemo(() => {
    const data: Array<{
      className: string
      stage: string
      sessionCount: number
    }> = []

    progressionData.forEach((progression) => {
      progression.stages.forEach((stage) => {
        data.push({
          className: progression.className,
          stage: stage.stage,
          sessionCount: stage.sessions.length,
        })
      })
    })

    return data
  }, [progressionData])

  // Get unique classes and stages
  const classes = useMemo(
    () => Array.from(new Set(chartData.map((d) => d.className))).sort(),
    [chartData]
  )
  const stages = useMemo(
    () => Array.from(new Set(chartData.map((d) => d.stage))).sort(),
    [chartData]
  )

  if (chartData.length === 0) {
    return (
      <ChartContainer
        title="Heat Progression"
        height={height}
        className={className}
        aria-label="Heat progression chart - no data available"
      >
        <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
          No progression data available
        </div>
      </ChartContainer>
    )
  }

  const margin = defaultMargin

  const getStageColor = (stage: string): string => {
    if (stage === "qualifying") return qualifyingColor
    if (stage === "final") return finalColor
    return heatColor
  }

  return (
    <ChartContainer
      title="Heat Progression"
      height={height}
      className={className}
      aria-label="Heat progression chart showing qualifying, heats, and finals"
      chartInstanceId={chartInstanceId}
      axisColorPicker
      defaultAxisColors={{ x: DEFAULT_AXIS_COLOR, y: DEFAULT_AXIS_COLOR }}
      renderContent={({ xAxisColor, yAxisColor }) => (
      <>
      <div className="relative w-full" style={{ height: `${height}px` }}>
        <ParentSize>
          {({ width: parentWidth }) => {
            const width = parentWidth || 800

            if (width === 0) {
              return null
            }

            const innerWidth = width - margin.left - margin.right
            const innerHeight = height - margin.top - margin.bottom

            // X scale (classes)
            const xScale = scaleBand({
              range: [0, innerWidth],
              domain: classes,
              padding: 0.2,
            })

            // Y scale (session count)
            const maxSessions = Math.max(...chartData.map((d) => d.sessionCount))
            const yScale = scaleLinear({
              range: [innerHeight, 0],
              domain: [0, maxSessions * 1.1],
              nice: true,
            })

            // Grouped bar width
            const groupWidth = xScale.bandwidth()
            const barWidth = groupWidth / stages.length

            return (
              <svg
                width={width}
                height={height}
                aria-labelledby={`${chartTitleId} ${chartDescId}`}
                role="img"
              >
                <title id={chartTitleId}>Heat progression</title>
                <desc id={chartDescId}>
                  Grouped bar chart showing number of sessions per stage (qualifying, heats, finals)
                  for each class.
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
                  {classes.map((className) => {
                    const x = xScale(className) || 0
                    return stages.map((stage, stageIndex) => {
                      const dataPoint = chartData.find(
                        (d) => d.className === className && d.stage === stage
                      )
                      const sessionCount = dataPoint?.sessionCount || 0
                      const barX = x + stageIndex * barWidth
                      const barHeight = innerHeight - yScale(sessionCount)
                      const barY = yScale(sessionCount)
                      const color = getStageColor(stage)

                      return (
                        <Bar
                          key={`${className}-${stage}`}
                          x={barX}
                          y={barY}
                          width={barWidth * 0.8}
                          height={barHeight}
                          fill={color}
                          opacity={0.8}
                          onMouseMove={(event) => {
                            const svgElement = (event.target as SVGElement).ownerSVGElement
                            if (!svgElement) return
                            const coords = localPoint(svgElement, event)
                            if (coords) {
                              showTooltip({
                                tooltipLeft: coords.x,
                                tooltipTop: coords.y,
                                tooltipData: {
                                  className,
                                  stage,
                                  sessionCount,
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
                    stroke={yAxisColor}
                    tickStroke={yAxisColor}
                    tickLabelProps={() => ({
                      fill: yAxisColor,
                      fontSize: 12,
                      textAnchor: "end",
                      dx: -8,
                    })}
                    label="Number of Sessions"
                    labelProps={{
                      fill: yAxisColor,
                      fontSize: 12,
                      textAnchor: "middle",
                      dy: -50,
                    }}
                  />

                  {/* X-axis */}
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
                {tooltipData.className}
              </div>
              <div className="text-sm text-[var(--token-text-secondary)]">
                Stage: {tooltipData.stage}
              </div>
              <div className="text-sm text-[var(--token-text-secondary)]">
                Sessions: {tooltipData.sessionCount}
              </div>
            </div>
          </TooltipWithBounds>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" style={{ backgroundColor: qualifyingColor, opacity: 0.8 }} />
          <span className="text-[var(--token-text-secondary)]">Qualifying</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" style={{ backgroundColor: heatColor, opacity: 0.8 }} />
          <span className="text-[var(--token-text-secondary)]">Heats</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4" style={{ backgroundColor: finalColor, opacity: 0.8 }} />
          <span className="text-[var(--token-text-secondary)]">Finals</span>
        </div>
      </div>
      </>
      )}
      />
  )
}
