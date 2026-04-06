/**
 * @fileoverview Weather repository - all Prisma queries for weather domain
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Contains all database access functions for weather data operations
 *
 * @purpose This file centralizes all Prisma queries related to weather data, following
 *          the mobile-safe architecture requirement that all database access must
 *          exist only in src/core/<domain>/repo.ts files. This ensures business
 *          logic is separated from API routes and can be reused by mobile clients.
 *
 * @relatedFiles
 * - src/lib/prisma.ts (Prisma client)
 * - src/core/weather/get-weather-for-event.ts (uses this repo)
 */

import { prisma } from "@/lib/prisma"
import type { WeatherData, Prisma } from "@prisma/client"
import { utcCalendarDayStart } from "./utc-calendar-day"

export interface DailyTemperatureSummaryCache {
  hourly: Array<{ time: string; temperature: number }>
  minTemp: number
  minTempTime: string
  maxTemp: number
  maxTempTime: string
}

export interface WeatherCacheData {
  /** UTC calendar day this snapshot applies to (use utcCalendarDayStart) */
  weatherDate: Date
  latitude: number
  longitude: number
  timestamp: Date
  airTemperature: number
  humidity: number
  windSpeed: number
  windDirection: number | null
  precipitation: number
  condition: string
  trackTemperature: number
  forecast: Array<{ label: string; detail: string }>
  dailyTemperatureSummary?: DailyTemperatureSummaryCache
  isHistorical: boolean
  expiresAt: Date
}

/**
 * Gets cached weather data for an event day if it exists and is not expired
 *
 * @param eventId - The event ID to get weather data for
 * @param calendarDay - The UTC calendar day (any instant on that day is fine)
 * @returns Cached weather data if valid, null if cache miss or expired
 */
export async function getCachedWeather(
  eventId: string,
  calendarDay: Date
): Promise<WeatherData | null> {
  try {
    const now = new Date()
    const dayStart = utcCalendarDayStart(calendarDay)

    const forDay = await prisma.weatherData.findFirst({
      where: {
        eventId,
        weatherDate: dayStart,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        cachedAt: "desc",
      },
    })

    if (forDay) {
      return forDay
    }

    // Legacy rows (pre–weather_date) or unmigrated nulls
    return await prisma.weatherData.findFirst({
      where: {
        eventId,
        weatherDate: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        cachedAt: "desc",
      },
    })
  } catch (error) {
    // Provide helpful error message if prisma.weatherData is undefined
    if (
      error instanceof TypeError &&
      (error.message.includes("Cannot read properties of undefined") ||
        error.message.includes("Cannot read property"))
    ) {
      throw new Error(
        `Prisma client weatherData model is not available. This usually means the Prisma client needs to be regenerated or the dev server needs to be restarted. Try running: npx prisma generate and restart the dev server. Original error: ${error.message}`
      )
    }
    throw error
  }
}

/**
 * Loads the event start date and returns cached weather for that UTC calendar day (if valid).
 */
export async function getCachedWeatherForEvent(eventId: string): Promise<WeatherData | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { eventDate: true },
  })
  if (!event) {
    return null
  }
  return getCachedWeather(eventId, utcCalendarDayStart(event.eventDate))
}

/**
 * Gets the most recent weather data for an event (optionally for a UTC calendar day), even if expired
 *
 * Used for fallback when API is unavailable
 *
 * @param eventId - The event ID to get weather data for
 * @param calendarDay - If set, prefer a row for that day, then legacy null weatherDate rows
 * @returns Most recent weather data, or null if none exists
 */
export async function getLastWeatherData(
  eventId: string,
  calendarDay?: Date
): Promise<WeatherData | null> {
  try {
    if (calendarDay) {
      const dayStart = utcCalendarDayStart(calendarDay)
      const forDay = await prisma.weatherData.findFirst({
        where: {
          eventId,
          weatherDate: dayStart,
        },
        orderBy: {
          cachedAt: "desc",
        },
      })
      if (forDay) {
        return forDay
      }
      const legacy = await prisma.weatherData.findFirst({
        where: {
          eventId,
          weatherDate: null,
        },
        orderBy: {
          cachedAt: "desc",
        },
      })
      if (legacy) {
        return legacy
      }
    }

    return await prisma.weatherData.findFirst({
      where: {
        eventId,
      },
      orderBy: {
        cachedAt: "desc",
      },
    })
  } catch (error) {
    // Provide helpful error message if prisma.weatherData is undefined
    if (
      error instanceof TypeError &&
      (error.message.includes("Cannot read properties of undefined") ||
        error.message.includes("Cannot read property"))
    ) {
      throw new Error(
        `Prisma client weatherData model is not available. This usually means the Prisma client needs to be regenerated or the dev server needs to be restarted. Try running: npx prisma generate and restart the dev server. Original error: ${error.message}`
      )
    }
    throw error
  }
}

/**
 * Stores weather data in the cache
 *
 * @param eventId - The event ID to cache weather data for
 * @param data - Weather data to cache
 * @returns Created weather data record
 */
export async function cacheWeatherData(
  eventId: string,
  data: WeatherCacheData
): Promise<WeatherData> {
  const weatherDate = utcCalendarDayStart(data.weatherDate)
  const sharedFields = {
    latitude: data.latitude,
    longitude: data.longitude,
    timestamp: data.timestamp,
    airTemperature: data.airTemperature,
    humidity: data.humidity,
    windSpeed: data.windSpeed,
    windDirection: data.windDirection,
    precipitation: data.precipitation,
    condition: data.condition,
    trackTemperature: data.trackTemperature,
    forecast: data.forecast as Prisma.InputJsonValue,
    isHistorical: data.isHistorical,
    expiresAt: data.expiresAt,
  }
  const dailySummaryFields =
    data.dailyTemperatureSummary !== undefined
      ? {
          dailyTemperatureSummary: data.dailyTemperatureSummary as unknown as Prisma.InputJsonValue,
        }
      : {}
  try {
    return await prisma.weatherData.upsert({
      where: {
        eventId_weatherDate: {
          eventId,
          weatherDate,
        },
      },
      create: {
        eventId,
        weatherDate,
        ...sharedFields,
        ...dailySummaryFields,
      },
      update: {
        ...sharedFields,
        ...dailySummaryFields,
      },
    })
  } catch (error) {
    // Provide helpful error message if prisma.weatherData is undefined
    if (
      error instanceof TypeError &&
      (error.message.includes("Cannot read properties of undefined") ||
        error.message.includes("Cannot read property"))
    ) {
      throw new Error(
        `Prisma client weatherData model is not available. This usually means the Prisma client needs to be regenerated or the dev server needs to be restarted. Try running: npx prisma generate and restart the dev server. Original error: ${error.message}`
      )
    }
    throw error
  }
}

/**
 * Cleans up expired weather data entries
 *
 * Useful for maintenance tasks to keep the database clean
 *
 * @param olderThan - Delete entries expired before this date (default: now)
 * @returns Number of deleted records
 */
export async function cleanupExpiredWeatherData(olderThan?: Date): Promise<number> {
  try {
    const cutoffDate = olderThan || new Date()

    const result = await prisma.weatherData.deleteMany({
      where: {
        expiresAt: {
          lt: cutoffDate,
        },
      },
    })

    return result.count
  } catch (error) {
    // Provide helpful error message if prisma.weatherData is undefined
    if (
      error instanceof TypeError &&
      (error.message.includes("Cannot read properties of undefined") ||
        error.message.includes("Cannot read property"))
    ) {
      throw new Error(
        `Prisma client weatherData model is not available. This usually means the Prisma client needs to be regenerated or the dev server needs to be restarted. Try running: npx prisma generate and restart the dev server. Original error: ${error.message}`
      )
    }
    throw error
  }
}
