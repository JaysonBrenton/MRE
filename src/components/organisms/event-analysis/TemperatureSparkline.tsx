/**
 * @fileoverview Mini temperature trend sparkline with color gradient by temperature
 *
 * @description Renders hourly temperatures as a line; stroke color varies from
 * cool (blue) to hot (orange/red) based on temperature. Shows time and temp on hover.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/WeatherCard.tsx
 */

"use client"

import { useId, useState, useRef } from "react"
import { formatTimeDisplay } from "@/lib/date-utils"

const WIDTH = 140
const HEIGHT = 28
const PADDING = 2

/**
 * Map temperature (Celsius) to a hex color for the sparkline gradient.
 * Cool = blue, warm = orange, hot = red.
 */
function tempToColor(temp: number): string {
  if (temp <= 10) return "#0ea5e9" // sky-500
  if (temp <= 20) return "#22c55e" // green-500
  if (temp <= 28) return "#eab308" // yellow-500
  if (temp <= 35) return "#f97316" // orange-500
  return "#ef4444" // red-500
}

export interface TemperatureSparklineProps {
  hourly: Array<{ time: string; temperature: number }>
  minTemp: number
  maxTemp: number
  className?: string
}

export default function TemperatureSparkline({
  hourly,
  minTemp,
  maxTemp,
  className = "",
}: TemperatureSparklineProps) {
  const gradientId = useId().replace(/:/g, "-")
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  )

  if (hourly.length < 2) return null

  const tempRange = maxTemp - minTemp || 1
  const xStep = (WIDTH - PADDING * 2) / (hourly.length - 1)
  const points = hourly.map((h, i) => {
    const x = PADDING + i * xStep
    const y =
      HEIGHT -
      PADDING -
      ((h.temperature - minTemp) / tempRange) * (HEIGHT - PADDING * 2)
    return `${x},${y}`
  })
  const pathD = `M ${points.join(" L ")}`
  const gradientStops = hourly.map((h, i) => {
    const offset = (i / (hourly.length - 1)) * 100
    const color = tempToColor(h.temperature)
    return (
      <stop key={i} offset={`${offset}%`} stopColor={color} />
    )
  })

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const index = Math.round((x - PADDING) / xStep)
    const clamped = Math.max(0, Math.min(index, hourly.length - 1))
    setHoveredIndex(clamped)
    setTooltipPos({ x: e.clientX, y: e.clientY })
  }

  function handleMouseLeave() {
    setHoveredIndex(null)
    setTooltipPos(null)
  }

  return (
    <span className="relative inline-block">
      <svg
        ref={svgRef}
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={`cursor-pointer ${className}`}
        aria-hidden
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {gradientStops}
          </linearGradient>
        </defs>
        <path
          d={pathD}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {hoveredIndex !== null &&
        tooltipPos !== null &&
        hourly[hoveredIndex] && (
          <span
            className="pointer-events-none fixed z-50 whitespace-nowrap rounded px-2 py-1 text-xs shadow-lg"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y - 36,
              transform: "translateX(-50%)",
              backgroundColor: "var(--token-surface-elevated)",
              border: "1px solid var(--token-border-default)",
              color: "var(--token-text-primary)",
            }}
          >
            {formatTimeDisplay(hourly[hoveredIndex].time)} •{" "}
            {Math.round(hourly[hoveredIndex].temperature)}°C
          </span>
        )}
    </span>
  )
}
