/**
 * @fileoverview Shared type for event weather API response (UI)
 *
 * @description Shape returned by GET /api/v1/events/[eventId]/weather.
 * Used by dashboard DriverCardsAndWeatherGrid and event-analysis WeatherCard.
 *
 * @relatedFiles
 * - src/app/api/v1/events/[eventId]/weather/route.ts
 * - src/core/weather/get-weather-for-event.ts (WeatherForEvent)
 * - src/components/organisms/dashboard/DriverCardsAndWeatherGrid.tsx
 * - src/components/organisms/event-analysis/WeatherCard.tsx
 */

export interface DailyTemperatureSummary {
  hourly: Array<{ time: string; temperature: number }>
  minTemp: number
  minTempTime: string
  maxTemp: number
  maxTempTime: string
}

export interface EventWeatherData {
  condition: string
  wind: string
  humidity: number
  air: number
  track: number
  precip: number
  forecast: Array<{ label: string; detail: string }>
  dailyTemperatureSummary?: DailyTemperatureSummary
  cachedAt?: string
  isCached?: boolean
}
