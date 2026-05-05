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

function WeatherConditionIcon({ condition, className }: { condition: string; className?: string }) {
  return React.createElement(getWeatherIcon(condition), {
    className,
    "aria-hidden": true,
  })
}

const CARD_SHELL =
  "flex min-h-[16.5rem] h-full w-full min-w-0 flex-col rounded-xl border border-[color-mix(in_oklab,var(--token-border-muted)_72%,transparent)] bg-[color-mix(in_oklab,var(--token-surface-alt)_85%,var(--token-surface))] px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.045)]"

const PRIMARY_GRID_CLASS =
  "grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1.5 text-sm text-[var(--token-text-primary)] [&>span:nth-child(even)]:font-semibold"

const SECONDARY_GRID_CLASS =
  "grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-1 text-xs text-[var(--token-text-secondary)] [&>span:nth-child(even)]:font-medium [&>span:nth-child(even)]:text-[var(--token-text-primary)]"

const LABEL_CLASS = "text-xs font-medium text-[var(--token-text-muted)]"

export interface WeatherCardProps {
  weather: EventWeatherData | null
  weatherLoading: boolean
  weatherError: string | null
  /** Prominent day line for multi-day Event details (e.g. long-form date). */
  headingDate?: string | null
  className?: string
}

export default function WeatherCard({
  weather,
  weatherLoading,
  weatherError,
  headingDate,
  className = "",
}: WeatherCardProps) {
  const rootClass = [CARD_SHELL, className].filter(Boolean).join(" ")

  if (weatherLoading) {
    return (
      <div className={rootClass} aria-busy="true" aria-label="Loading weather">
        {headingDate ? (
          <div className="mb-2 h-4 max-w-[14rem] animate-pulse rounded bg-[var(--token-surface)]" />
        ) : null}
        <div className="mb-2 flex items-center gap-2 border-b border-[var(--token-border-muted)]/70 pb-2">
          <span className="h-5 w-5 shrink-0 animate-pulse rounded bg-[var(--token-surface)]" />
          <span className="h-4 flex-1 animate-pulse rounded bg-[var(--token-surface)]" />
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5">
          {(["Air", "Track", "Precip", "Wind"] as const).map((k) => (
            <React.Fragment key={k}>
              <span className={LABEL_CLASS}>{k}:</span>
              <span className="h-4 animate-pulse rounded bg-[var(--token-surface)]" />
            </React.Fragment>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 border-t border-[var(--token-border-muted)]/60 pt-2">
          <span className={LABEL_CLASS}>Humidity:</span>
          <span className="h-3.5 w-8 animate-pulse rounded bg-[var(--token-surface)]" />
        </div>
      </div>
    )
  }

  if (weatherError) {
    const message = getWeatherErrorMessage(weatherError)
    return (
      <div className={rootClass} role="alert">
        <p className="text-sm text-[var(--token-text-secondary)]">{message}</p>
      </div>
    )
  }

  if (!weather) {
    return null
  }

  const iconColorClass = getWeatherIconColor(weather.condition)
  const summary = weather.dailyTemperatureSummary
  const precipDisplay =
    weather.precipMm != null && weather.precipMm > 0
      ? `${weather.precipMm} mm`
      : `${weather.precip}%`

  return (
    <div className={rootClass}>
      {headingDate ? (
        <p className="mb-2 text-sm font-semibold leading-tight text-[var(--token-text-primary)]">
          {headingDate}
        </p>
      ) : null}

      <div className="mb-2 flex min-w-0 items-start gap-2 border-b border-[var(--token-border-muted)]/70 pb-2">
        <WeatherConditionIcon
          condition={weather.condition}
          className={`mt-0.5 h-5 w-5 shrink-0 ${iconColorClass}`}
        />
        <span className="min-w-0 text-base font-semibold leading-snug text-[var(--token-text-primary)]">
          {weather.condition}
        </span>
      </div>

      <div className={PRIMARY_GRID_CLASS}>
        <span className={LABEL_CLASS}>Air:</span>
        <span>{Math.round(weather.air)}°C</span>
        <span className={LABEL_CLASS}>Track:</span>
        <span>{Math.round(weather.track)}°C</span>
        <span className={LABEL_CLASS}>Precip:</span>
        <span>{precipDisplay}</span>
        <span className={LABEL_CLASS}>Wind:</span>
        <span className="min-w-0 break-words">{weather.wind}</span>
      </div>

      <div className="mt-3 border-t border-[var(--token-border-muted)]/60 pt-2">
        <div className={SECONDARY_GRID_CLASS}>
          <span className={LABEL_CLASS}>Humidity:</span>
          <span>{weather.humidity}%</span>
          {summary ? (
            <>
              <span className={LABEL_CLASS}>Max:</span>
              <span>
                {Math.round(summary.maxTemp)}°C · {formatTimeDisplay(summary.maxTempTime)}
              </span>
              <span className={LABEL_CLASS}>Min:</span>
              <span>
                {Math.round(summary.minTemp)}°C · {formatTimeDisplay(summary.minTempTime)}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {summary && summary.hourly.length >= 2 ? (
        <div className="mt-auto border-t border-[var(--token-border-muted)]/60 pt-2">
          <div className={`${LABEL_CLASS} mb-1`}>Day trend</div>
          <TemperatureSparkline
            hourly={summary.hourly}
            minTemp={summary.minTemp}
            maxTemp={summary.maxTemp}
          />
        </div>
      ) : (
        <div className="mt-auto flex-1" aria-hidden />
      )}
    </div>
  )
}
