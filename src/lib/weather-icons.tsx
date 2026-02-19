/**
 * @fileoverview Weather condition to Lucide icon mapping
 *
 * @description Maps API condition strings (from Open-Meteo WMO codes) to
 * Lucide React icons for consistent weather display. Used by Event Analysis
 * WeatherCard and can be reused by dashboard WeatherPanel.
 *
 * @relatedFiles
 * - src/core/weather/fetch-weather.ts (wmoWeatherCodeToCondition)
 * - src/components/organisms/event-analysis/WeatherCard.tsx
 */

import type { LucideIcon } from "lucide-react"
import {
  Sun,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudLightning,
} from "lucide-react"

/**
 * Returns the Lucide icon component for the given weather condition string.
 * Condition strings come from the weather API (e.g. "Clear sky", "Partly cloudy").
 * Match order: thunderstorm > snow > rain/drizzle/showers > fog > cloudy > clear > default.
 */
export function getWeatherIcon(condition: string): LucideIcon {
  const lower = condition.toLowerCase()
  if (lower.includes("thunderstorm")) return CloudLightning
  if (lower.includes("snow")) return CloudSnow
  if (lower.includes("rain") || lower.includes("drizzle") || lower.includes("showers")) return CloudRain
  if (lower.includes("fog")) return CloudFog
  if (lower.includes("partly cloudy") || lower.includes("overcast")) return Cloud
  if (lower.includes("clear") || lower.includes("mainly clear")) return Sun
  return Cloud
}

/**
 * Returns a Tailwind text color class for the weather condition icon.
 * Keeps the same condition matching order as getWeatherIcon.
 */
export function getWeatherIconColor(condition: string): string {
  const lower = condition.toLowerCase()
  if (lower.includes("thunderstorm")) return "text-amber-400"
  if (lower.includes("snow")) return "text-cyan-300"
  if (lower.includes("rain") || lower.includes("drizzle") || lower.includes("showers")) return "text-blue-400"
  if (lower.includes("fog")) return "text-slate-500"
  if (lower.includes("partly cloudy") || lower.includes("overcast")) return "text-slate-400"
  if (lower.includes("clear") || lower.includes("mainly clear")) return "text-orange-400"
  return "text-slate-400"
}
