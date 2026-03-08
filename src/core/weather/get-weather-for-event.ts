/**
 * @fileoverview Get weather data for an event
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Main business logic for retrieving weather data for an event
 *
 * @purpose Orchestrates geocoding, API calls, caching, and error handling to provide
 *          weather data for events. Handles cache hits/misses, TTL management, and
 *          fallback to cached data when APIs are unavailable.
 *
 * @relatedFiles
 * - src/core/weather/repo.ts (database access)
 * - src/core/weather/geocode-track.ts (geocoding)
 * - src/core/weather/resolve-geocode-candidates.ts (candidate generation for geocoding)
 * - src/core/weather/fetch-weather.ts (Open-Meteo API)
 * - src/core/weather/calculate-track-temp.ts (track temperature calculation)
 */

import { geocodeTrack } from "./geocode-track"
import { fetchWeather, type DailyTemperatureSummary } from "./fetch-weather"
import { calculateTrackTemperature } from "./calculate-track-temp"
import {
  getCachedWeather,
  getLastWeatherData,
  cacheWeatherData,
  type WeatherCacheData,
} from "./repo"
import { getEventWithTrack } from "@/core/events/repo"
import { resolveGeocodeCandidates } from "./resolve-geocode-candidates"

export interface WeatherForEvent {
  condition: string
  wind: string // e.g., "12 km/h"
  humidity: number
  air: number // temperature in Celsius
  track: number // calculated track temperature
  precip: number // precipitation chance percentage
  /** Precipitation amount in mm - actual rainfall; prefer for display when > 0 */
  precipMm?: number
  forecast: Array<{ label: string; detail: string }>
  dailyTemperatureSummary?: DailyTemperatureSummary
  cachedAt?: string // ISO timestamp if showing cached data
  isCached: boolean
}

// TTL constants
const CURRENT_WEATHER_TTL_HOURS = 1 // 1 hour for current/forecast
const HISTORICAL_WEATHER_TTL_HOURS = 24 * 7 // 7 days for historical (since it won't change)

/**
 * Gets weather data for an event
 *
 * This function:
 * 1. Checks for valid cached data (not expired)
 * 2. If cache miss or expired:
 *    - Gets event and track information
 *    - Generates geocoding candidates (track name + location hints from event name)
 *    - Tries geocoding candidates in order until one succeeds
 *    - Fetches weather from Open-Meteo API (historical or forecast)
 *    - Calculates track temperature
 *    - Caches the data with appropriate TTL
 * 3. Returns weather data (from cache or fresh)
 *
 * If API calls fail, attempts to return last cached data (even if expired).
 *
 * @param eventId - The event ID to get weather for
 * @param options - Optional: skipCache to force a fresh fetch (e.g. to get daily temperature summary)
 * @returns Weather data for the event
 * @throws Error if event not found, or if no cache available and API fails
 */
export async function getWeatherForEvent(
  eventId: string,
  options?: { skipCache?: boolean }
): Promise<WeatherForEvent> {
  // Check for valid cached data unless skipCache requested
  if (!options?.skipCache) {
    const cached = await getCachedWeather(eventId)
    if (cached) {
      return formatWeatherResponse(cached)
    }
  }

  // Cache miss, expired, or skipCache - fetch fresh data
  try {
    // Get event with track information
    const event = await getEventWithTrack(eventId)

    if (!event) {
      throw new Error(`Event not found: ${eventId}`)
    }

    if (!event.track) {
      throw new Error(`Event track not found for event: ${eventId}`)
    }

    // Priority 1: Use stored coordinates if available (from dashboard extraction)
    let geocodeResult = null
    let lastError: Error | null = null
    const attemptedCandidates: string[] = []

    const hasStoredCoordinates =
      event.track.latitude !== null &&
      event.track.latitude !== undefined &&
      event.track.longitude !== null &&
      event.track.longitude !== undefined

    if (hasStoredCoordinates) {
      // Use stored coordinates directly - skip geocoding
      // TypeScript: We've already verified these are not null above
      const storedLat = event.track.latitude as number
      const storedLng = event.track.longitude as number
      geocodeResult = {
        latitude: storedLat,
        longitude: storedLng,
        displayName: event.track.trackName,
      }
    } else {
      // Priority 2: Try stored address as geocoding candidate (if available)
      // Priority 3: Fall back to existing name-based geocoding strategy
      const candidates = resolveGeocodeCandidates(event)

      // Prepend stored address unless we have Canberra as primary (known Canberra event;
      // address may say Brisbane but event was at Canberra)
      if (event.track.address && candidates[0] !== "Canberra Airport, Australia") {
        candidates.unshift(event.track.address)
      }

      for (const candidate of candidates) {
        attemptedCandidates.push(candidate)
        try {
          geocodeResult = await geocodeTrack(candidate)
          break // Success, exit loop
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))

          // Check if this is a "no results" error - continue to next candidate
          if (lastError.message.includes("No geocoding results found")) {
            continue
          }

          // For HTTP errors (429, 5xx) or other non-retryable errors, fail fast
          // because the next candidate will likely hit the same rate limit/outage
          if (lastError.message.includes("Geocoding API returned status")) {
            throw lastError
          }

          // For other errors, continue to next candidate
          continue
        }
      }

      // If all candidates failed, throw a comprehensive error
      if (!geocodeResult) {
        const errorMessage = lastError?.message || "Unknown geocoding error"
        const priorityInfo = event.track.address
          ? " (tried stored address, then name-based geocoding)"
          : " (used name-based geocoding)"
        throw new Error(
          `Failed to geocode location for event "${event.eventName}" (track: "${event.track.trackName}")${priorityInfo}. ` +
            `Attempted candidates: ${attemptedCandidates.join(", ")}. ` +
            `Last error: ${errorMessage}`
        )
      }
    }

    // Fetch weather from API
    const weatherResponse = await fetchWeather(
      geocodeResult.latitude,
      geocodeResult.longitude,
      event.eventDate
    )

    // Calculate track temperature
    const hourOfDay = event.eventDate.getHours()
    const trackTemperature = calculateTrackTemperature(
      weatherResponse.current.airTemperature,
      hourOfDay
    )

    // Determine TTL based on whether this is historical
    const now = new Date()
    const isHistorical = event.eventDate < now
    const ttlHours = isHistorical ? HISTORICAL_WEATHER_TTL_HOURS : CURRENT_WEATHER_TTL_HOURS
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000)

    // Cache the data
    const cacheData: WeatherCacheData = {
      latitude: geocodeResult.latitude,
      longitude: geocodeResult.longitude,
      timestamp: weatherResponse.current.timestamp,
      airTemperature: weatherResponse.current.airTemperature,
      humidity: weatherResponse.current.humidity,
      windSpeed: weatherResponse.current.windSpeed,
      windDirection: weatherResponse.current.windDirection,
      precipitation: weatherResponse.current.precipitation,
      condition: weatherResponse.current.condition,
      trackTemperature,
      forecast: weatherResponse.forecast,
      dailyTemperatureSummary: weatherResponse.dailyTemperatureSummary,
      isHistorical,
      expiresAt,
    }

    await cacheWeatherData(eventId, cacheData)

    // Format and return the response
    const result: WeatherForEvent = {
      condition: weatherResponse.current.condition,
      wind: formatWindSpeed(
        weatherResponse.current.windSpeed,
        weatherResponse.current.windDirection
      ),
      humidity: weatherResponse.current.humidity,
      air: weatherResponse.current.airTemperature,
      track: trackTemperature,
      precip: weatherResponse.current.precipitation,
      precipMm: weatherResponse.current.precipitationMm,
      forecast: weatherResponse.forecast,
      dailyTemperatureSummary: weatherResponse.dailyTemperatureSummary,
      isCached: false,
    }

    return result
  } catch (error) {
    // If API calls fail, try to return last cached data (even if expired)
    const lastCached = await getLastWeatherData(eventId)
    if (lastCached) {
      return formatWeatherResponse(lastCached)
    }

    // No cache available and API failed
    if (error instanceof Error) {
      throw error
    }
    throw new Error("Failed to fetch weather data and no cache available")
  }
}

/**
 * Formats cached weather data into the response format
 */
function formatWeatherResponse(weatherData: {
  condition: string
  humidity: number
  airTemperature: number
  windSpeed: number
  windDirection: number | null
  trackTemperature: number
  precipitation: number
  forecast: unknown
  dailyTemperatureSummary?: unknown
  cachedAt: Date
}): WeatherForEvent {
  const forecast = Array.isArray(weatherData.forecast)
    ? (weatherData.forecast as Array<{ label: string; detail: string }>)
    : []

  const dailyTemperatureSummary = parseDailyTemperatureSummary(weatherData.dailyTemperatureSummary)

  return {
    condition: weatherData.condition,
    wind: formatWindSpeed(weatherData.windSpeed, weatherData.windDirection),
    humidity: weatherData.humidity,
    air: weatherData.airTemperature,
    track: weatherData.trackTemperature,
    precip: weatherData.precipitation,
    forecast,
    dailyTemperatureSummary,
    cachedAt: weatherData.cachedAt.toISOString(),
    isCached: true,
  }
}

function parseDailyTemperatureSummary(value: unknown): DailyTemperatureSummary | undefined {
  if (!value || typeof value !== "object") return undefined
  const o = value as Record<string, unknown>
  if (typeof o.minTemp !== "number" || typeof o.maxTemp !== "number" || !Array.isArray(o.hourly)) {
    return undefined
  }
  return {
    hourly: o.hourly as Array<{ time: string; temperature: number }>,
    minTemp: o.minTemp,
    minTempTime: String(o.minTempTime ?? ""),
    maxTemp: o.maxTemp,
    maxTempTime: String(o.maxTempTime ?? ""),
  }
}

/**
 * Formats wind speed and direction into a human-readable string
 */
function formatWindSpeed(speedKmh: number, direction: number | null): string {
  const speedRounded = Math.round(speedKmh)
  if (direction !== null) {
    // Convert degrees to cardinal direction (simplified)
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    const index = Math.round(direction / 45) % 8
    return `${speedRounded} km/h ${directions[index]}`
  }
  return `${speedRounded} km/h`
}

export interface WeatherForEventDay {
  date: string // YYYY-MM-DD
  weather: WeatherForEvent
}

/**
 * Gets weather data for each day of a multi-day event
 *
 * @param eventId - The event ID to get weather for
 * @returns Array of { date, weather } for each day from eventDate to eventDateEnd (inclusive)
 * @throws Error if event not found, or if geocoding/API fails
 */
export async function getWeatherForEventDays(eventId: string): Promise<WeatherForEventDay[]> {
  const event = await getEventWithTrack(eventId)

  if (!event) {
    throw new Error(`Event not found: ${eventId}`)
  }

  if (!event.track) {
    throw new Error(`Event track not found for event: ${eventId}`)
  }

  // Build list of dates to fetch (eventDate through eventDateEnd, or single day)
  const startDate = new Date(event.eventDate)
  startDate.setUTCHours(12, 0, 0, 0)
  const endDate = event.eventDateEnd ? new Date(event.eventDateEnd) : new Date(event.eventDate)
  endDate.setUTCHours(12, 0, 0, 0)

  const dates: Date[] = []
  const curr = new Date(startDate)
  while (curr <= endDate) {
    dates.push(new Date(curr))
    curr.setUTCDate(curr.getUTCDate() + 1)
  }

  // Geocode once
  let geocodeResult: { latitude: number; longitude: number; displayName: string } | null = null

  const hasStoredCoordinates =
    event.track.latitude !== null &&
    event.track.latitude !== undefined &&
    event.track.longitude !== null &&
    event.track.longitude !== undefined

  if (hasStoredCoordinates) {
    geocodeResult = {
      latitude: event.track.latitude as number,
      longitude: event.track.longitude as number,
      displayName: event.track.trackName,
    }
  } else {
    const candidates = resolveGeocodeCandidates(event)
    if (event.track.address && candidates[0] !== "Canberra Airport, Australia") {
      candidates.unshift(event.track.address)
    }
    for (const candidate of candidates) {
      try {
        geocodeResult = await geocodeTrack(candidate)
        break
      } catch (error) {
        const lastError = error instanceof Error ? error : new Error(String(error))
        if (!lastError.message.includes("No geocoding results found")) {
          throw lastError
        }
      }
    }
    if (!geocodeResult) {
      throw new Error(
        `Failed to geocode location for event "${event.eventName}" (track: "${event.track.trackName}")`
      )
    }
  }

  const results: WeatherForEventDay[] = []

  for (const date of dates) {
    const weatherResponse = await fetchWeather(
      geocodeResult.latitude,
      geocodeResult.longitude,
      date
    )

    const hourOfDay = date.getHours()
    const trackTemperature = calculateTrackTemperature(
      weatherResponse.current.airTemperature,
      hourOfDay
    )

    const dateStr = date.toISOString().split("T")[0]

    results.push({
      date: dateStr,
      weather: {
        condition: weatherResponse.current.condition,
        wind: formatWindSpeed(
          weatherResponse.current.windSpeed,
          weatherResponse.current.windDirection
        ),
        humidity: weatherResponse.current.humidity,
        air: weatherResponse.current.airTemperature,
        track: trackTemperature,
        precip: weatherResponse.current.precipitation,
        precipMm: weatherResponse.current.precipitationMm,
        forecast: weatherResponse.forecast,
        dailyTemperatureSummary: weatherResponse.dailyTemperatureSummary,
        isCached: false,
      },
    })
  }

  return results
}
