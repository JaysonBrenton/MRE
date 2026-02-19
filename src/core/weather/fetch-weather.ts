/**
 * @fileoverview Open-Meteo API integration
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Fetches weather data from Open-Meteo API
 *
 * @purpose Provides functions to fetch current weather, forecasts, and historical weather
 *          data from Open-Meteo. Handles API response parsing and error handling.
 *          Open-Meteo is a free, open-source weather API that requires no API key and
 *          provides historical weather data for the past 80 years.
 *
 * @relatedFiles
 * - docs/architecture/mobile-safe-architecture-guidelines.md (architecture patterns)
 */

import * as https from "https"
import type { IncomingMessage } from "http"

export interface WeatherData {
  condition: string
  windSpeed: number // km/h
  windDirection: number | null // degrees (0-360)
  humidity: number // percentage (0-100)
  airTemperature: number // Celsius
  precipitation: number // percentage (0-100)
  timestamp: Date
}

export interface ForecastEntry {
  label: string
  detail: string
}

export interface HourlyTemperature {
  time: string // ISO string
  temperature: number
}

export interface DailyTemperatureSummary {
  hourly: HourlyTemperature[]
  minTemp: number
  minTempTime: string // ISO string
  maxTemp: number
  maxTempTime: string // ISO string
}

export interface WeatherResponse {
  current: WeatherData
  forecast: ForecastEntry[]
  dailyTemperatureSummary?: DailyTemperatureSummary
}

interface OpenMeteoResponse {
  hourly: {
    time: string[]
    temperature_2m: number[]
    relativehumidity_2m: number[]
    windspeed_10m: number[]
    winddirection_10m: (number | null)[]
    weathercode: number[]
    precipitation_probability: (number | null)[]
  }
}

const OPEN_METEO_ARCHIVE_BASE_URL = "https://archive-api.open-meteo.com/v1/archive"
const OPEN_METEO_FORECAST_BASE_URL = "https://api.open-meteo.com/v1/forecast"

/**
 * Maps WMO weather codes to human-readable condition strings
 * WMO codes: https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
 */
function wmoWeatherCodeToCondition(code: number): string {
  // Clear
  if (code === 0) return "clear sky"
  // Mainly clear
  if (code === 1) return "mainly clear"
  // Partly cloudy
  if (code === 2) return "partly cloudy"
  // Overcast
  if (code === 3) return "overcast"
  // Fog
  if (code === 45 || code === 48) return "fog"
  // Freezing drizzle (check before regular drizzle)
  if (code >= 56 && code <= 57) return "freezing drizzle"
  // Drizzle
  if (code >= 51 && code <= 55) return "drizzle"
  // Rain
  if (code >= 61 && code <= 67) {
    if (code === 61 || code === 63 || code === 65) return "rain"
    return "freezing rain"
  }
  // Snow
  if (code >= 71 && code <= 77) return "snow"
  // Rain showers
  if (code >= 80 && code <= 82) return "rain showers"
  // Snow showers
  if (code >= 85 && code <= 86) return "snow showers"
  // Thunderstorm
  if (code >= 95 && code <= 99) return "thunderstorm"

  // Default fallback
  return "unknown"
}

/**
 * Formats weather condition for display (capitalize first letter, handle special cases)
 */
function formatCondition(condition: string): string {
  // Handle multi-word conditions
  const words = condition.split(" ")
  return words
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1)
      }
      return word
    })
    .join(" ")
}

/**
 * Fetches weather data from Open-Meteo API (historical or forecast)
 *
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @param eventDate - Event date to fetch weather for
 * @returns Promise resolving to weather data and forecast
 * @throws Error if API call fails
 */
export async function fetchWeather(
  latitude: number,
  longitude: number,
  eventDate: Date
): Promise<WeatherResponse> {
  const now = new Date()
  const isHistorical = eventDate < now

  // Format dates for API (YYYY-MM-DD format)
  const eventDateStr = eventDate.toISOString().split("T")[0]
  const eventHour = eventDate.getHours()

  // Determine which endpoint to use
  const baseUrl = isHistorical ? OPEN_METEO_ARCHIVE_BASE_URL : OPEN_METEO_FORECAST_BASE_URL

  try {
    // Build API URL with parameters
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      start_date: eventDateStr,
      end_date: eventDateStr,
      hourly:
        "temperature_2m,relativehumidity_2m,windspeed_10m,winddirection_10m,weathercode,precipitation_probability",
      timezone: "auto", // Automatically detect timezone based on coordinates
    })

    const apiUrl = `${baseUrl}?${params.toString()}`

    // Use Node.js https module with IPv4 preference to avoid IPv6 DNS issues in Docker/Alpine
    // Node.js fetch API doesn't support IPv4/IPv6 preference, so we use https.request directly
    const url = new URL(apiUrl)

    const data: OpenMeteoResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "GET",
        timeout: 15000, // 15 second timeout
        family: 4, // Force IPv4 to avoid IPv6 DNS issues in Docker/Alpine
      }

      const req = https.request(options, (res: IncomingMessage) => {
        let responseData = ""

        res.on("data", (chunk: Buffer) => {
          responseData += chunk.toString()
        })

        res.on("end", () => {
          try {
            if (res.statusCode && res.statusCode !== 200) {
              reject(new Error(`Open-Meteo API returned status ${res.statusCode}`))
              return
            }

            const jsonData: OpenMeteoResponse = JSON.parse(responseData)
            resolve(jsonData)
          } catch (parseError) {
            reject(
              new Error(
                `Failed to parse Open-Meteo response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`
              )
            )
          }
        })
      })

      req.on("error", (error: Error) => {
        reject(error)
      })

      req.on("timeout", () => {
        req.destroy()
        reject(new Error(`Open-Meteo API request timed out - network connectivity issue`))
      })

      req.end()
    })

    // Find the hour that matches the event date/time
    // Open-Meteo returns hourly data, so we need to find the closest hour
    const hourlyTimes = data.hourly.time
    let targetIndex = hourlyTimes.findIndex((timeStr) => {
      const time = new Date(timeStr)
      return time.getHours() === eventHour
    })

    // If exact hour not found, use the first available hour
    if (targetIndex === -1) {
      targetIndex = 0
    }

    // Extract current weather data for the event time
    const currentWeather: WeatherData = {
      condition: formatCondition(
        wmoWeatherCodeToCondition(data.hourly.weathercode[targetIndex] || 0)
      ),
      windSpeed: data.hourly.windspeed_10m[targetIndex] || 0,
      windDirection: data.hourly.winddirection_10m[targetIndex] ?? null,
      humidity: data.hourly.relativehumidity_2m[targetIndex] || 0,
      airTemperature: data.hourly.temperature_2m[targetIndex] || 0,
      precipitation: data.hourly.precipitation_probability[targetIndex] ?? 0,
      timestamp: new Date(hourlyTimes[targetIndex]),
    }

    // Generate forecast entries for +15m, +30m, +45m
    // For historical data, we'll use subsequent hours from the data
    // For forecast data, we can use the next hours
    const forecast: ForecastEntry[] = []

    // Get the next 3 hours after the target index for forecast
    for (let i = 1; i <= 3; i++) {
      const forecastIndex = targetIndex + i

      if (forecastIndex < hourlyTimes.length) {
        const weatherCode = data.hourly.weathercode[forecastIndex] || 0
        const condition = formatCondition(wmoWeatherCodeToCondition(weatherCode))
        const windSpeedKmh = data.hourly.windspeed_10m[forecastIndex] || 0
        const precipProb = data.hourly.precipitation_probability[forecastIndex] ?? 0

        // Determine forecast detail
        let detail = condition
        if (precipProb > 30) {
          detail = precipProb > 70 ? "Heavy rain" : precipProb > 50 ? "Rain" : "Light rain"
        } else if (windSpeedKmh > 15) {
          const windDesc =
            windSpeedKmh < 10
              ? "Light breeze"
              : windSpeedKmh < 20
                ? "Moderate breeze"
                : "Strong breeze"
          detail = windDesc
        }

        forecast.push({
          label: `+${i * 15}m`,
          detail,
        })
      } else {
        // If we don't have enough forecast data, add default entries
        forecast.push({
          label: `+${i * 15}m`,
          detail: "Clouds, stable",
        })
      }
    }

    // Ensure we always have 3 forecast entries
    while (forecast.length < 3) {
      const minutes = (forecast.length + 1) * 15
      forecast.push({
        label: `+${minutes}m`,
        detail: "Clouds, stable",
      })
    }

    // Build hourly temperature series and compute min/max for the day
    const temps = data.hourly.temperature_2m
    const hourly: HourlyTemperature[] = hourlyTimes.map((timeStr, i) => ({
      time: timeStr,
      temperature: temps[i] ?? 0,
    }))
    let minTemp = temps[0] ?? 0
    let minTempIndex = 0
    let maxTemp = temps[0] ?? 0
    let maxTempIndex = 0
    for (let i = 1; i < temps.length; i++) {
      const t = temps[i] ?? 0
      if (t < minTemp) {
        minTemp = t
        minTempIndex = i
      }
      if (t > maxTemp) {
        maxTemp = t
        maxTempIndex = i
      }
    }
    const dailyTemperatureSummary: DailyTemperatureSummary = {
      hourly,
      minTemp,
      minTempTime: hourlyTimes[minTempIndex] ?? hourlyTimes[0],
      maxTemp,
      maxTempTime: hourlyTimes[maxTempIndex] ?? hourlyTimes[0],
    }

    return {
      current: currentWeather,
      forecast,
      dailyTemperatureSummary,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch weather data: ${error.message}`)
    }
    throw new Error("Failed to fetch weather data: Unknown error")
  }
}
