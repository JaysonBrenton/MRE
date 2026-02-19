/**
 * @fileoverview Lap-by-lap trend chart – every single lap time for selected drivers
 *
 * @description Line chart with X = global lap index (1, 2, 3, …), Y = lap time.
 * One line per driver; tooltip shows race, lap number, and time.
 *
 * @relatedFiles
 * - src/core/events/get-lap-data.ts (DriverLapTrendSeries, LapTrendPoint)
 * - src/components/organisms/event-analysis/LapTimeTrendCard.tsx (consumer)
 */

"use client"

import { useMemo, useId, useState, type ReactNode } from "react"
import { Group } from "@visx/group"
import { LinePath } from "@visx/shape"
import { scaleLinear } from "@visx/scale"
import { curveMonotoneX } from "@visx/curve"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { useTooltip, TooltipWithBounds, defaultStyles } from "@visx/tooltip"
import { localPoint } from "@visx/event"
import { ParentSize } from "@visx/responsive"
import ChartContainer from "./ChartContainer"
import ChartColorPicker from "./ChartColorPicker"
import { formatTimeUTC } from "@/lib/format-session-data"
import { useChartColor, useChartColors } from "@/hooks/useChartColors"
import type { DriverLapTrendSeries, LapTrendPoint } from "@/core/events/get-lap-data"

const DEFAULT_AXIS_COLOR = "#ffffff"
const defaultMargin = { top: 20, right: 20, bottom: 60, left: 70 }
const driverColors = [
  "#3a8eff",
  "#4ecdc4",
  "#ff6b6b",
  "#ffe66d",
  "#a8e6cf",
  "#ff8b94",
  "#95e1d3",
  "#f38181",
  "#aa96da",
  "#fcbad3",
  "#a8d8ea",
  "#ff9a3c",
]
const borderColor = "var(--token-border-default)"
const DIM_OPACITY = 0.2
const _SESSION_BAND_OPACITY = 0.3
const SESSION_BAND_DEFAULT_HEX = ["#6366f1", "#fbbf24"] as const
const SESSION_BAND_OPACITIES = [0.52, 0.48] as const

/** Session band: contiguous lap indices with same race (grouped by raceId) */
export interface SessionBand {
  startLapIndex: number
  endLapIndex: number
  raceId: string
  raceLabel: string
}

/** Compute session bands from the first driver's laps (one band per distinct race, grouped by raceId) */
function computeSessionBands(drivers: DriverLapTrendSeries[]): SessionBand[] {
  const firstWithLaps = drivers.find((d) => d.laps.length > 0)
  if (!firstWithLaps) return []

  const bands: SessionBand[] = []
  const laps = firstWithLaps.laps as LapTrendPoint[]

  let i = 0
  while (i < laps.length) {
    const raceId = laps[i].raceId
    const raceLabel = laps[i].raceLabel
    const startLapIndex = laps[i].lapIndex
    while (i + 1 < laps.length && laps[i + 1].raceId === raceId) {
      i += 1
    }
    const endLapIndex = laps[i].lapIndex
    bands.push({ startLapIndex, endLapIndex, raceId, raceLabel })
    i += 1
  }

  return bands
}

/** Convert hex (#rrggbb or #rgb) to rgba with opacity */
function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace("#", "")
  let r: number, g: number, b: number
  if (h.length === 6) {
    r = parseInt(h.slice(0, 2), 16)
    g = parseInt(h.slice(2, 4), 16)
    b = parseInt(h.slice(4, 6), 16)
  } else if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16)
    g = parseInt(h[1] + h[1], 16)
    b = parseInt(h[2] + h[2], 16)
  } else {
    return `rgba(99, 102, 241, ${opacity})`
  }
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

function formatLapTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  const wholeSecs = Math.floor(secs)
  const millis = Math.floor((secs - wholeSecs) * 1000)
  return `${minutes}:${wholeSecs.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`
}

export interface LapByLapTrendChartProps {
  drivers: DriverLapTrendSeries[]
  height?: number
  className?: string
  chartInstanceId?: string
  /** Chart header title (e.g. "All Classes" or class name). Default "Lap-by-lap trend". */
  chartTitle?: string
  /** Optional controls rendered in chart header (e.g. driver picker, sort). */
  headerControls?: ReactNode
  /** Message when there is no data to display (e.g. loading, error, or no drivers selected). */
  emptyMessage?: string
}

export default function LapByLapTrendChart({
  drivers,
  height = 480,
  className = "",
  chartInstanceId = "lap-by-lap-trend",
  chartTitle = "Lap-by-lap trend",
  headerControls,
  emptyMessage = "No lap data for selected drivers",
  onDriverDeselect,
}: LapByLapTrendChartProps) {
  const chartDescId = useId()
  const [hoveredDriverId, setHoveredDriverId] = useState<string | null>(null)
  const [showSessionOverlay, setShowSessionOverlay] = useState(true)
  const [sessionBandPickerOpen, setSessionBandPickerOpen] = useState<
    "sessionBand1" | "sessionBand2" | null
  >(null)
  const [sessionBandPickerPosition, setSessionBandPickerPosition] = useState<{
    top: number
    left: number
  } | null>(null)

  const instanceId = chartInstanceId || "lap-trend-default"
  const [sessionBand1Color, setSessionBand1Color] = useChartColor(
    instanceId,
    "sessionBand1",
    SESSION_BAND_DEFAULT_HEX[0]
  )
  const [sessionBand2Color, setSessionBand2Color] = useChartColor(
    instanceId,
    "sessionBand2",
    SESSION_BAND_DEFAULT_HEX[1]
  )

  const defaultDriverColors = useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [`driver${i}`, driverColors[i % driverColors.length]])
      ) as Record<string, string>,
    []
  )
  const { colors: driverColorMap, setColor: setDriverColor } = useChartColors(
    instanceId,
    defaultDriverColors
  )

  const [driverPickerOpen, setDriverPickerOpen] = useState<number | null>(null)
  const [driverPickerPosition, setDriverPickerPosition] = useState<{
    top: number
    left: number
  } | null>(null)
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } =
    useTooltip<{
      driverName: string
      className: string
      /** Session name (e.g. "A1-Main", "Heat 2/3") - derived from raceLabel */
      sessionName: string
      lapNumber: number
      lapTimeSeconds: number
      /** Lap range in this session (e.g. "Laps 1–11") */
      sessionLapRange?: string
      /** Lap position in session (e.g. "Lap 3 of 11") */
      lapInSession?: string
      /** Global lap index across event */
      overallLapIndex?: number
      /** Session start time (ISO string) when available */
      raceStartTime?: string | null
    }>()

  const allLapTimes = useMemo(() => {
    const times: number[] = []
    drivers.forEach((d) => {
      d.laps.forEach((lap) => times.push(lap.lapTimeSeconds))
    })
    return times
  }, [drivers])

  const maxLapIndex = useMemo(() => {
    let max = 0
    drivers.forEach((d) => {
      d.laps.forEach((lap) => {
        if (lap.lapIndex > max) max = lap.lapIndex
      })
    })
    return max
  }, [drivers])

  const sessionBands = useMemo(() => computeSessionBands(drivers), [drivers])

  if (drivers.length === 0 || allLapTimes.length === 0) {
    return (
      <ChartContainer
        title={chartTitle}
        headerControls={headerControls}
        height={height}
        className={className}
        aria-label="Lap-by-lap trend chart - no data"
      >
        <div className="flex items-center justify-center h-full text-[var(--token-text-secondary)]">
          {emptyMessage}
        </div>
      </ChartContainer>
    )
  }

  const minLap = Math.min(...allLapTimes)
  const maxLap = Math.max(...allLapTimes)
  const padding = (maxLap - minLap) * 0.1 || 1
  const yDomain = [Math.max(0, minLap - padding), maxLap + padding] as [number, number]
  const xDomain = [1, Math.max(maxLapIndex, 2)] as [number, number]

  const overlayToggleButton =
    sessionBands.length > 0 ? (
      <button
        type="button"
        onClick={() => setShowSessionOverlay((v) => !v)}
        aria-pressed={showSessionOverlay}
        className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-1.5 text-sm text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--token-accent)] aria-pressed:bg-[var(--token-accent)]/20"
        aria-label={showSessionOverlay ? "Hide session overlay" : "Show session overlay"}
      >
        {showSessionOverlay ? "Hide session overlay" : "Show session overlay"}
      </button>
    ) : null

  return (
    <ChartContainer
      title={chartTitle}
      headerControls={
        <>
          {headerControls}
          {overlayToggleButton}
        </>
      }
      height={height}
      className={className}
      aria-label="Lap-by-lap trend chart - every lap time across the event"
      chartInstanceId={chartInstanceId}
      axisColorPicker
      defaultAxisColors={{ x: DEFAULT_AXIS_COLOR, y: DEFAULT_AXIS_COLOR }}
      renderContent={({ axisColors: { xAxisColor, yAxisColor }, onAxisColorPickerRequest }) => (
        <>
          <div className="relative w-full" style={{ height: `${height}px` }}>
            <ParentSize>
              {({ width: parentWidth }) => {
                const width = parentWidth || 800
                if (width === 0) return null

                const innerWidth = width - defaultMargin.left - defaultMargin.right
                const innerHeight = height - defaultMargin.top - defaultMargin.bottom

                const xScale = scaleLinear({
                  range: [0, innerWidth],
                  domain: xDomain,
                  nice: true,
                })
                const yScale = scaleLinear({
                  range: [innerHeight, 0],
                  domain: yDomain,
                  nice: true,
                })

                return (
                  <div className="relative w-full" style={{ width, height }}>
                    <svg
                      width={width}
                      height={height}
                      aria-labelledby={chartDescId}
                      role="img"
                      style={{ display: "block" }}
                    >
                      <desc id={chartDescId}>
                        Line chart of every lap time for selected drivers; X = lap number, Y = lap
                        time.
                      </desc>
                      <Group left={defaultMargin.left} top={defaultMargin.top}>
                        <Group>
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

                          {drivers.map((driver, driverIndex) => {
                            const color =
                              driverColorMap[`driver${driverIndex}`] ??
                              driverColors[driverIndex % driverColors.length]
                            const data = driver.laps as LapTrendPoint[]
                            if (data.length === 0) return null
                            const isHighlighted =
                              hoveredDriverId == null || driver.driverId === hoveredDriverId
                            const lineOpacity = isHighlighted ? 1 : DIM_OPACITY

                            return (
                              <Group
                                key={driver.driverId}
                                onMouseEnter={() => setHoveredDriverId(driver.driverId)}
                                onMouseLeave={() => {
                                  setHoveredDriverId(null)
                                  hideTooltip()
                                }}
                                style={{ cursor: "pointer" }}
                              >
                                {/* Invisible wide path for easier line hover + tooltip */}
                                <LinePath
                                  data={data}
                                  x={(d) => xScale(d.lapIndex)}
                                  y={(d) => yScale(d.lapTimeSeconds)}
                                  stroke="transparent"
                                  strokeWidth={16}
                                  curve={curveMonotoneX}
                                  pointerEvents="stroke"
                                  onMouseMove={(event) => {
                                    setHoveredDriverId(driver.driverId)
                                    const svgEl = (event.target as SVGElement).ownerSVGElement
                                    if (!svgEl) return
                                    const coords = localPoint(svgEl, event)
                                    if (!coords) return
                                    const innerX = coords.x - defaultMargin.left
                                    const lapIndexValue = xScale.invert(innerX)
                                    let nearest = data[0]
                                    let minDist = Math.abs(data[0].lapIndex - lapIndexValue)
                                    for (let i = 1; i < data.length; i++) {
                                      const d = Math.abs(data[i].lapIndex - lapIndexValue)
                                      if (d < minDist) {
                                        minDist = d
                                        nearest = data[i]
                                      }
                                    }
                                    const band = sessionBands.find(
                                      (b) => b.raceId === nearest.raceId
                                    )
                                    const totalLapsInSession = band
                                      ? band.endLapIndex - band.startLapIndex + 1
                                      : null
                                    const sessionLapRange = band
                                      ? band.startLapIndex === band.endLapIndex
                                        ? `Lap ${band.startLapIndex}`
                                        : `Laps ${band.startLapIndex}–${band.endLapIndex}`
                                      : undefined
                                    const lapInSession =
                                      totalLapsInSession != null
                                        ? `Lap ${nearest.lapNumber} of ${totalLapsInSession}`
                                        : undefined
                                    const className = nearest.className ?? nearest.raceLabel
                                    const sessionName = nearest.raceLabel.startsWith(className)
                                      ? nearest.raceLabel.slice(className.length).trim()
                                      : nearest.raceLabel
                                    showTooltip({
                                      tooltipLeft: coords.x,
                                      tooltipTop: coords.y,
                                      tooltipData: {
                                        driverName: driver.driverName,
                                        className,
                                        sessionName: sessionName || nearest.raceLabel,
                                        lapNumber: nearest.lapNumber,
                                        lapTimeSeconds: nearest.lapTimeSeconds,
                                        sessionLapRange,
                                        lapInSession,
                                        overallLapIndex: nearest.lapIndex,
                                        raceStartTime: nearest.raceStartTime ?? null,
                                      },
                                    })
                                  }}
                                />
                                <LinePath
                                  data={data}
                                  x={(d) => xScale(d.lapIndex)}
                                  y={(d) => yScale(d.lapTimeSeconds)}
                                  stroke={color}
                                  strokeWidth={2}
                                  curve={curveMonotoneX}
                                  opacity={lineOpacity}
                                  pointerEvents="none"
                                />
                              </Group>
                            )
                          })}

                          {/* Session bands: on top so they receive clicks for color picker */}
                          {showSessionOverlay &&
                            sessionBands.map((band, bandIndex) => {
                              const colorIndex = bandIndex % 2
                              const hexColor =
                                colorIndex === 0 ? sessionBand1Color : sessionBand2Color
                              const opacity = SESSION_BAND_OPACITIES[colorIndex]
                              const xLeft = xScale(band.startLapIndex - 0.5)
                              const xRight = xScale(band.endLapIndex + 0.5)
                              const x = Math.max(0, xLeft)
                              const w = Math.max(1, Math.min(innerWidth, xRight) - x)
                              const fill = hexToRgba(hexColor, opacity)
                              return (
                                <rect
                                  key={`${band.raceId}-${band.startLapIndex}`}
                                  x={x}
                                  y={0}
                                  width={w}
                                  height={innerHeight}
                                  fill={fill}
                                  style={{ cursor: "pointer" }}
                                  pointerEvents="all"
                                  aria-label={`Session band ${bandIndex + 1} - Click to change color`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSessionBandPickerPosition({
                                      top: e.clientY + 12,
                                      left: e.clientX,
                                    })
                                    setSessionBandPickerOpen(
                                      colorIndex === 0 ? "sessionBand1" : "sessionBand2"
                                    )
                                  }}
                                  onMouseMove={(e) => {
                                    const svgEl = (e.target as SVGElement).ownerSVGElement
                                    if (!svgEl) return
                                    const coords = localPoint(svgEl, e)
                                    if (!coords) return
                                    const innerX = coords.x - defaultMargin.left
                                    const lapIndexValue = xScale.invert(innerX)
                                    let nearestDriver: (typeof drivers)[0] | null = null
                                    let nearest: LapTrendPoint | null = null
                                    let minDist = Infinity
                                    for (const drv of drivers) {
                                      const data = drv.laps as LapTrendPoint[]
                                      for (const lap of data) {
                                        const d = Math.abs(lap.lapIndex - lapIndexValue)
                                        if (d < minDist) {
                                          minDist = d
                                          nearest = lap
                                          nearestDriver = drv
                                        }
                                      }
                                    }
                                    if (nearest && nearestDriver) {
                                      const band = sessionBands.find(
                                        (b) => b.raceId === nearest!.raceId
                                      )
                                      const totalLapsInSession = band
                                        ? band.endLapIndex - band.startLapIndex + 1
                                        : null
                                      const sessionLapRange = band
                                        ? band.startLapIndex === band.endLapIndex
                                          ? `Lap ${band.startLapIndex}`
                                          : `Laps ${band.startLapIndex}–${band.endLapIndex}`
                                        : undefined
                                      const lapInSession =
                                        totalLapsInSession != null
                                          ? `Lap ${nearest.lapNumber} of ${totalLapsInSession}`
                                          : undefined
                                      const className = nearest.className ?? nearest.raceLabel
                                      const sessionName = nearest.raceLabel.startsWith(className)
                                        ? nearest.raceLabel.slice(className.length).trim()
                                        : nearest.raceLabel
                                      setHoveredDriverId(nearestDriver.driverId)
                                      showTooltip({
                                        tooltipLeft: coords.x,
                                        tooltipTop: coords.y,
                                        tooltipData: {
                                          driverName: nearestDriver.driverName,
                                          className,
                                          sessionName: sessionName || nearest.raceLabel,
                                          lapNumber: nearest.lapNumber,
                                          lapTimeSeconds: nearest.lapTimeSeconds,
                                          sessionLapRange,
                                          lapInSession,
                                          overallLapIndex: nearest.lapIndex,
                                          raceStartTime: nearest.raceStartTime ?? null,
                                        },
                                      })
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    hideTooltip()
                                    setHoveredDriverId(null)
                                  }}
                                />
                              )
                            })}

                          <Group
                            style={{ cursor: "pointer" }}
                            onClick={(e) => onAxisColorPickerRequest("y", e)}
                            aria-label="Y-axis - Click to change color"
                          >
                            <AxisLeft
                              scale={yScale}
                              tickFormat={(v) => formatLapTime(Number(v))}
                              stroke={yAxisColor}
                              tickStroke={yAxisColor}
                              tickLabelProps={() => ({
                                fill: yAxisColor,
                                fontSize: 12,
                                textAnchor: "end",
                                dx: -8,
                              })}
                            />
                            {/* Hit area in margin only so it doesn't block tooltips on the plot */}
                            <rect
                              x={-defaultMargin.left}
                              y={0}
                              width={defaultMargin.left}
                              height={innerHeight}
                              fill="transparent"
                              pointerEvents="all"
                            />
                          </Group>

                          <Group
                            style={{ cursor: "pointer" }}
                            onClick={(e) => onAxisColorPickerRequest("x", e)}
                            aria-label="X-axis - Click to change color"
                          >
                            <AxisBottom
                              top={innerHeight}
                              scale={xScale}
                              stroke={xAxisColor}
                              tickStroke={xAxisColor}
                              tickLabelProps={() => ({
                                fill: xAxisColor,
                                fontSize: 11,
                                textAnchor: "middle",
                              })}
                              label="Lap number"
                              labelProps={{
                                fill: xAxisColor,
                                fontSize: 12,
                                textAnchor: "middle",
                                dy: 10,
                              }}
                            />
                            <rect
                              x={0}
                              y={innerHeight}
                              width={innerWidth}
                              height={40}
                              fill="transparent"
                              pointerEvents="all"
                            />
                          </Group>
                        </Group>
                      </Group>
                    </svg>
                  </div>
                )
              }}
            </ParentSize>
          </div>

          {tooltipOpen && tooltipData && (
            <TooltipWithBounds
              top={tooltipTop}
              left={tooltipLeft}
              style={{
                ...defaultStyles,
                backgroundColor: "var(--token-surface-elevated)",
                border: `1px solid ${borderColor}`,
                color: "var(--token-text-primary)",
                padding: "8px 12px",
                borderRadius: "4px",
              }}
            >
              <div className="space-y-1">
                <div className="font-semibold text-[var(--token-text-primary)]">
                  {tooltipData.driverName}
                </div>
                <div className="text-sm text-[var(--token-text-secondary)]">
                  Class: {tooltipData.className}
                </div>
                <div className="text-sm text-[var(--token-text-secondary)]">
                  Session: {tooltipData.sessionName}
                </div>
                {(tooltipData.lapInSession ||
                  tooltipData.sessionLapRange ||
                  tooltipData.overallLapIndex != null) && (
                  <div className="text-sm text-[var(--token-text-tertiary)]">
                    {[
                      tooltipData.lapInSession,
                      tooltipData.sessionLapRange && `Chart: ${tooltipData.sessionLapRange}`,
                      tooltipData.overallLapIndex != null &&
                        `Overall lap ${tooltipData.overallLapIndex}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
                {tooltipData.raceStartTime && (
                  <div className="text-sm text-[var(--token-text-secondary)]">
                    Start Time: {formatTimeUTC(new Date(tooltipData.raceStartTime))}
                  </div>
                )}
                <div className="text-sm text-[var(--token-text-secondary)]">
                  Lap Time: {formatLapTime(tooltipData.lapTimeSeconds)}
                </div>
              </div>
            </TooltipWithBounds>
          )}

          {sessionBandPickerOpen != null && sessionBandPickerPosition != null && (
            <ChartColorPicker
              currentColor={
                sessionBandPickerOpen === "sessionBand1" ? sessionBand1Color : sessionBand2Color
              }
              onColorChange={
                sessionBandPickerOpen === "sessionBand1"
                  ? setSessionBand1Color
                  : setSessionBand2Color
              }
              onClose={() => {
                setSessionBandPickerOpen(null)
                setSessionBandPickerPosition(null)
              }}
              position={sessionBandPickerPosition}
              label={
                sessionBandPickerOpen === "sessionBand1"
                  ? "Session band color 1"
                  : "Session band color 2"
              }
            />
          )}

          {driverPickerOpen != null &&
            driverPickerPosition != null &&
            drivers[driverPickerOpen] && (
              <ChartColorPicker
                currentColor={
                  driverColorMap[`driver${driverPickerOpen}`] ??
                  driverColors[driverPickerOpen % driverColors.length]
                }
                onColorChange={(c) =>
                  setDriverColor(
                    `driver${Math.min(driverPickerOpen, 7)}` as keyof typeof defaultDriverColors,
                    c
                  )
                }
                onClose={() => {
                  setDriverPickerOpen(null)
                  setDriverPickerPosition(null)
                }}
                position={driverPickerPosition}
                label={`${drivers[driverPickerOpen].driverName} line color`}
              />
            )}

          <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
            {drivers.map((driver, index) => {
              const color =
                driverColorMap[`driver${index}`] ?? driverColors[index % driverColors.length]
              const isHighlighted = hoveredDriverId == null || driver.driverId === hoveredDriverId
              return (
                <div
                  key={driver.driverId}
                  className="flex items-center gap-2 rounded px-1.5 py-0.5 transition-opacity"
                  style={{ opacity: isHighlighted ? 1 : DIM_OPACITY }}
                  onMouseEnter={() => setHoveredDriverId(driver.driverId)}
                  onMouseLeave={() => setHoveredDriverId(null)}
                >
                  <button
                    type="button"
                    className="flex items-center gap-2 cursor-pointer rounded px-0 py-0 text-left hover:ring-2 hover:ring-[var(--token-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--token-accent)]"
                    aria-label={`Change line color for ${driver.driverName}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setDriverPickerPosition({
                        top: e.clientY + 12,
                        left: e.clientX,
                      })
                      setDriverPickerOpen(index)
                    }}
                  >
                    <div
                      className="w-4 h-4 shrink-0 rounded-full border-2 border-[var(--token-border-default)]"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[var(--token-text-secondary)]">
                      {driver.driverName}
                      {driver.laps.length > 0 && (
                        <span className="ml-1 text-[var(--token-text-tertiary)]">
                          ({driver.laps.length} laps)
                        </span>
                      )}
                    </span>
                  </button>
                  {onDriverDeselect && (
                    <button
                      type="button"
                      className="shrink-0 rounded p-0.5 text-[var(--token-text-tertiary)] hover:text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--token-accent)]"
                      aria-label={`Remove ${driver.driverName} from chart`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDriverDeselect(driver.driverId)
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    />
  )
}
