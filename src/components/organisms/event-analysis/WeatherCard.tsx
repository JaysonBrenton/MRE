/**
 * @fileoverview Compact weather card for Event Analysis Overview
 *
 * @description Displays event weather in the same compact label-value card
 * style as EventStats. Uses existing weather API and condition-to-icon mapping.
 *
 * @relatedFiles
 * - src/components/organisms/event-analysis/EventStats.tsx (styling reference)
 * - src/components/organisms/event-analysis/OverviewTab.tsx (uses this)
 * - docs/design/event-analysis-weather-card-design.md
 * - docs/design/compact-label-value-card.md
 */

"use client"

import React from "react"
import type { EventWeatherData } from "@/types/weather"
import { getWeatherIcon, getWeatherIconColor } from "@/lib/weather-icons"
import { getWeatherErrorMessage } from "@/lib/weather-utils"
import { formatTimeDisplay } from "@/lib/date-utils"
import TemperatureSparkline from "./TemperatureSparkline"

// Stable component for weather condition icon - uses createElement to avoid "component during render" lint
function WeatherConditionIcon({ condition, className }: { condition: string; className?: string }) {
  return React.createElement(getWeatherIcon(condition), {
    className,
    "aria-hidden": true,
  })
}

const CARD_CLASS =
  "mb-6 w-fit rounded-xl border border-[color-mix(in_oklab,var(--token-border-muted)_72%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-alt)_85%,var(--token-surface))] px-3 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.045)]"
const GRID_CLASS =
  "grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm text-[var(--token-text-primary)] [&>span:nth-child(even)]:font-medium"
const LABEL_CLASS = "text-xs font-medium text-[var(--token-text-muted)]"

export interface WeatherCardProps {
  weather: EventWeatherData | null
  weatherLoading: boolean
  weatherError: string | null
}

export default function WeatherCard({ weather, weatherLoading, weatherError }: WeatherCardProps) {
  if (weatherLoading) {
    return (
      <div className={CARD_CLASS}>
        <div className={GRID_CLASS}>
          <span className={LABEL_CLASS}>Condition:</span>
          <span className="animate-pulse bg-[var(--token-surface)] rounded h-4 w-24" />
          <span className={LABEL_CLASS}>Air:</span>
          <span className="animate-pulse bg-[var(--token-surface)] rounded h-4 w-10" />
          <span className={LABEL_CLASS}>Track:</span>
          <span className="animate-pulse bg-[var(--token-surface)] rounded h-4 w-10" />
          <span className={LABEL_CLASS}>Wind:</span>
          <span className="animate-pulse bg-[var(--token-surface)] rounded h-4 w-16" />
          <span className={LABEL_CLASS}>Humidity:</span>
          <span className="animate-pulse bg-[var(--token-surface)] rounded h-4 w-8" />
          <span className={LABEL_CLASS}>Precip:</span>
          <span className="animate-pulse bg-[var(--token-surface)] rounded h-4 w-8" />
        </div>
      </div>
    )
  }

  if (weatherError) {
    const message = getWeatherErrorMessage(weatherError)
    return (
      <div className={CARD_CLASS}>
        <p className="text-sm text-[var(--token-text-secondary)]">{message}</p>
      </div>
    )
  }

  if (!weather) {
    return null
  }

  const iconColorClass = getWeatherIconColor(weather.condition)
  const summary = weather.dailyTemperatureSummary

  return (
    <div className={CARD_CLASS}>
      <div className={GRID_CLASS}>
        <span className={LABEL_CLASS}>Condition:</span>
        <span className="flex items-center gap-1.5">
          <WeatherConditionIcon
            condition={weather.condition}
            className={`h-4 w-4 shrink-0 ${iconColorClass}`}
          />
          {weather.condition}
        </span>
        <span className={LABEL_CLASS}>Air:</span>
        <span>{Math.round(weather.air)}°C</span>
        {summary && (
          <>
            <span className={LABEL_CLASS}>Max:</span>
            <span>
              {Math.round(summary.maxTemp)}°C at {formatTimeDisplay(summary.maxTempTime)}
            </span>
            <span className={LABEL_CLASS}>Min:</span>
            <span>
              {Math.round(summary.minTemp)}°C at {formatTimeDisplay(summary.minTempTime)}
            </span>
          </>
        )}
        <span className={LABEL_CLASS}>Track:</span>
        <span>{Math.round(weather.track)}°C</span>
        <span className={LABEL_CLASS}>Wind:</span>
        <span>{weather.wind}</span>
        <span className={LABEL_CLASS}>Humidity:</span>
        <span>{weather.humidity}%</span>
        <span className={LABEL_CLASS}>Precip:</span>
        <span>
          {weather.precipMm != null && weather.precipMm > 0
            ? `${weather.precipMm} mm`
            : `${weather.precip}%`}
        </span>
        {summary && summary.hourly.length >= 2 && (
          <>
            <span className={LABEL_CLASS}>Day:</span>
            <span>
              <TemperatureSparkline
                hourly={summary.hourly}
                minTemp={summary.minTemp}
                maxTemp={summary.maxTemp}
              />
            </span>
          </>
        )}
      </div>
    </div>
  )
}
