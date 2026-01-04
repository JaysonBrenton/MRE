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
import { fetchWeather } from "./fetch-weather"
import { calculateTrackTemperature } from "./calculate-track-temp"
import { getCachedWeather, getLastWeatherData, cacheWeatherData, type WeatherCacheData } from "./repo"
import { getEventWithTrack } from "@/core/events/repo"
import { resolveGeocodeCandidates } from "./resolve-geocode-candidates"

export interface WeatherForEvent {
  condition: string
  wind: string // e.g., "12 km/h"
  humidity: number
  air: number // temperature in Celsius
  track: number // calculated track temperature
  precip: number // precipitation chance percentage
  forecast: Array<{ label: string; detail: string }>
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
 * @returns Weather data for the event
 * @throws Error if event not found, or if no cache available and API fails
 */
export async function getWeatherForEvent(eventId: string): Promise<WeatherForEvent> {
  // Check for valid cached data
  const cached = await getCachedWeather(eventId)
  if (cached) {
    return formatWeatherResponse(cached)
  }

  // Cache miss or expired - need to fetch fresh data
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
      event.track.latitude !== null && event.track.latitude !== undefined &&
      event.track.longitude !== null && event.track.longitude !== undefined

    if (hasStoredCoordinates) {
      // Use stored coordinates directly - skip geocoding
      geocodeResult = {
        latitude: event.track.latitude,
        longitude: event.track.longitude,
        displayName: event.track.trackName,
      }
    } else {
      // Priority 2: Try stored address as geocoding candidate (if available)
      // Priority 3: Fall back to existing name-based geocoding strategy
      const candidates = resolveGeocodeCandidates(event)
      
      // Prepend stored address to candidates if available
      if (event.track.address) {
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
      isHistorical,
      expiresAt,
    }

    await cacheWeatherData(eventId, cacheData)

    // Format and return the response
    const result: WeatherForEvent = {
      condition: weatherResponse.current.condition,
      wind: formatWindSpeed(weatherResponse.current.windSpeed, weatherResponse.current.windDirection),
      humidity: weatherResponse.current.humidity,
      air: weatherResponse.current.airTemperature,
      track: trackTemperature,
      precip: weatherResponse.current.precipitation,
      forecast: weatherResponse.forecast,
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
  cachedAt: Date
}): WeatherForEvent {
  const forecast = Array.isArray(weatherData.forecast) 
    ? weatherData.forecast as Array<{ label: string; detail: string }>
    : []

  return {
    condition: weatherData.condition,
    wind: formatWindSpeed(weatherData.windSpeed, weatherData.windDirection),
    humidity: weatherData.humidity,
    air: weatherData.airTemperature,
    track: weatherData.trackTemperature,
    precip: weatherData.precipitation,
    forecast,
    cachedAt: weatherData.cachedAt.toISOString(),
    isCached: true,
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
