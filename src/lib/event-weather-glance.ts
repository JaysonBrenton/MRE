/**
 * @fileoverview Derive compact “at a glance” stats from per-day event weather rows.
 * Uses only fields already present on `EventWeatherData` (no fetching or inference).
 */

import type { WeatherDayRow } from "@/hooks/useEventWeather"
import type { EventWeatherData } from "@/types/weather"
import { parseWindSpeedKmhFromDisplay } from "@/lib/weather-utils"

export type WeatherGlanceDayStat = {
  date: string
  detail: string
}

export type EventWeatherGlance = {
  wettest: WeatherGlanceDayStat | null
  warmest: WeatherGlanceDayStat | null
  windiest: WeatherGlanceDayStat | null
  conditionsSummary: string | null
  hasAny: boolean
}

function precipSortKey(w: EventWeatherData): number | null {
  if (w.precipMm != null && !Number.isNaN(w.precipMm)) return w.precipMm
  if (typeof w.precip === "number" && !Number.isNaN(w.precip)) return w.precip
  return null
}

function precipDetail(w: EventWeatherData): string {
  if (w.precipMm != null && w.precipMm > 0) return `${w.precipMm} mm`
  return `${w.precip}%`
}

function maxTempSortKey(w: EventWeatherData): number | null {
  const m = w.dailyTemperatureSummary?.maxTemp
  if (m != null && !Number.isNaN(m)) return m
  return null
}

function pickDayExtreme(
  rows: WeatherDayRow[],
  score: (w: EventWeatherData) => number | null,
  detail: (row: WeatherDayRow) => string
): WeatherGlanceDayStat | null {
  let bestVal = -Infinity
  for (const r of rows) {
    const v = score(r.weather)
    if (v != null && !Number.isNaN(v) && v > bestVal) bestVal = v
  }
  if (bestVal === -Infinity) return null
  const tied = rows.filter((r) => {
    const v = score(r.weather)
    return v != null && !Number.isNaN(v) && v === bestVal
  })
  tied.sort((a, b) => a.date.localeCompare(b.date))
  const row = tied[0]
  if (!row) return null
  return { date: row.date, detail: detail(row) }
}

function buildConditionsSummary(rows: WeatherDayRow[]): string | null {
  const labels = rows
    .map((r) => r.weather.condition?.trim())
    .filter((c): c is string => Boolean(c?.length))
  if (labels.length === 0) return null

  const counts = new Map<string, number>()
  for (const c of labels) {
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const [topLabel, topCount] = sorted[0]!

  if (sorted.length === 1) return topLabel
  if (topCount >= labels.length / 2) return `Mostly ${topLabel}`

  return sorted
    .map(([label]) => label)
    .slice(0, 3)
    .join(" · ")
}

/**
 * Aggregates wettest / warmest / windiest / condition summary for overview UI.
 */
export function computeEventWeatherGlance(weatherByDay: WeatherDayRow[]): EventWeatherGlance {
  if (!weatherByDay.length) {
    return {
      wettest: null,
      warmest: null,
      windiest: null,
      conditionsSummary: null,
      hasAny: false,
    }
  }

  const wettest = pickDayExtreme(weatherByDay, precipSortKey, (row) => precipDetail(row.weather))

  const warmest = pickDayExtreme(weatherByDay, maxTempSortKey, (row) => {
    const m = row.weather.dailyTemperatureSummary?.maxTemp
    return m != null && !Number.isNaN(m) ? `${Math.round(m)}°C max` : ""
  })

  const windiest = pickDayExtreme(
    weatherByDay,
    (w) => parseWindSpeedKmhFromDisplay(w.wind),
    (row) => (row.weather.wind.trim().length > 0 ? row.weather.wind : "")
  )

  const windiestClean = windiest && windiest.detail.length > 0 ? windiest : null
  const warmestClean = warmest && warmest.detail.length > 0 ? warmest : null

  const conditionsSummary = buildConditionsSummary(weatherByDay)

  const hasAny = Boolean(wettest || warmestClean || windiestClean || conditionsSummary)

  return {
    wettest,
    warmest: warmestClean,
    windiest: windiestClean,
    conditionsSummary,
    hasAny,
  }
}
