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
import type { UserEventWeatherData, WeatherData, Prisma } from "@prisma/client"
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

/** Row shape used when formatting API responses (shared or per-user cache). */
export type CachedWeatherRow = Pick<
  WeatherData,
  | "condition"
  | "humidity"
  | "airTemperature"
  | "windSpeed"
  | "windDirection"
  | "trackTemperature"
  | "precipitation"
  | "forecast"
  | "dailyTemperatureSummary"
  | "cachedAt"
>

function weatherModelUnavailableError(modelName: string, originalMessage: string): Error {
  return new Error(
    `Prisma client ${modelName} model is not available. This usually means the Prisma client needs to be regenerated or the dev server needs to be restarted. Try running: npx prisma generate and restart the dev server. Original error: ${originalMessage}`
  )
}

function rethrowPrismaModelError(error: unknown, modelName: string): never {
  if (
    error instanceof TypeError &&
    (error.message.includes("Cannot read properties of undefined") ||
      error.message.includes("Cannot read property"))
  ) {
    throw weatherModelUnavailableError(modelName, error.message)
  }
  throw error
}

function userEventWeatherDataModel() {
  const m = prisma.userEventWeatherData
  if (!m) {
    throw weatherModelUnavailableError(
      "userEventWeatherData",
      "userEventWeatherData is undefined on prisma client"
    )
  }
  return m
}

function sharedWeatherPayload(data: WeatherCacheData) {
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
  return { weatherDate, sharedFields, dailySummaryFields }
}

/**
 * Gets cached weather data for an event day if it exists and is not expired.
 * Pass `userId` when weather is for a per-user host track override.
 */
export async function getCachedWeather(
  eventId: string,
  calendarDay: Date,
  userId?: string | null
): Promise<CachedWeatherRow | null> {
  const now = new Date()
  const dayStart = utcCalendarDayStart(calendarDay)

  if (userId) {
    try {
      return await userEventWeatherDataModel().findFirst({
        where: {
          userId,
          eventId,
          weatherDate: dayStart,
          expiresAt: { gt: now },
        },
        orderBy: { cachedAt: "desc" },
      })
    } catch (error) {
      rethrowPrismaModelError(error, "userEventWeatherData")
    }
  }

  try {
    const forDay = await prisma.weatherData.findFirst({
      where: {
        eventId,
        weatherDate: dayStart,
        expiresAt: { gt: now },
      },
      orderBy: { cachedAt: "desc" },
    })

    if (forDay) {
      return forDay
    }

    // Legacy rows (pre–weather_date) or unmigrated nulls
    return await prisma.weatherData.findFirst({
      where: {
        eventId,
        weatherDate: null,
        expiresAt: { gt: now },
      },
      orderBy: { cachedAt: "desc" },
    })
  } catch (error) {
    rethrowPrismaModelError(error, "weatherData")
  }
}

/**
 * Loads the event start date and returns cached weather for that UTC calendar day (if valid).
 */
export async function getCachedWeatherForEvent(
  eventId: string,
  userId?: string | null
): Promise<CachedWeatherRow | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { eventDate: true },
  })
  if (!event) {
    return null
  }
  return getCachedWeather(eventId, utcCalendarDayStart(event.eventDate), userId)
}

/**
 * Gets the most recent weather data for an event (optionally for a UTC calendar day), even if expired.
 * Pass `userId` for per-user host-track weather.
 */
export async function getLastWeatherData(
  eventId: string,
  calendarDay?: Date,
  userId?: string | null
): Promise<CachedWeatherRow | null> {
  if (userId) {
    try {
      if (calendarDay) {
        const dayStart = utcCalendarDayStart(calendarDay)
        return await userEventWeatherDataModel().findFirst({
          where: { userId, eventId, weatherDate: dayStart },
          orderBy: { cachedAt: "desc" },
        })
      }
      return await userEventWeatherDataModel().findFirst({
        where: { userId, eventId },
        orderBy: { cachedAt: "desc" },
      })
    } catch (error) {
      rethrowPrismaModelError(error, "userEventWeatherData")
    }
  }

  try {
    if (calendarDay) {
      const dayStart = utcCalendarDayStart(calendarDay)
      const forDay = await prisma.weatherData.findFirst({
        where: { eventId, weatherDate: dayStart },
        orderBy: { cachedAt: "desc" },
      })
      if (forDay) {
        return forDay
      }
      const legacy = await prisma.weatherData.findFirst({
        where: { eventId, weatherDate: null },
        orderBy: { cachedAt: "desc" },
      })
      if (legacy) {
        return legacy
      }
    }

    return await prisma.weatherData.findFirst({
      where: { eventId },
      orderBy: { cachedAt: "desc" },
    })
  } catch (error) {
    rethrowPrismaModelError(error, "weatherData")
  }
}

/**
 * Stores weather data in the cache (shared event venue or per-user host-track scope).
 */
export async function cacheWeatherData(
  eventId: string,
  data: WeatherCacheData,
  userId?: string | null
): Promise<WeatherData | UserEventWeatherData> {
  const { weatherDate, sharedFields, dailySummaryFields } = sharedWeatherPayload(data)

  if (userId) {
    try {
      return await userEventWeatherDataModel().upsert({
        where: {
          userId_eventId_weatherDate: {
            userId,
            eventId,
            weatherDate,
          },
        },
        create: {
          userId,
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
      rethrowPrismaModelError(error, "userEventWeatherData")
    }
  }

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
    rethrowPrismaModelError(error, "weatherData")
  }
}

/**
 * Removes all per-user cached weather for an event (e.g. when host track changes or is cleared).
 */
export async function deleteUserEventWeatherData(userId: string, eventId: string): Promise<number> {
  try {
    const result = await userEventWeatherDataModel().deleteMany({
      where: { userId, eventId },
    })
    return result.count
  } catch (error) {
    rethrowPrismaModelError(error, "userEventWeatherData")
  }
}

/**
 * Cleans up expired weather data entries (shared and per-user caches).
 */
export async function cleanupExpiredWeatherData(olderThan?: Date): Promise<number> {
  const cutoffDate = olderThan || new Date()

  try {
    const [shared, userScoped] = await Promise.all([
      prisma.weatherData.deleteMany({
        where: { expiresAt: { lt: cutoffDate } },
      }),
      userEventWeatherDataModel().deleteMany({
        where: { expiresAt: { lt: cutoffDate } },
      }),
    ])
    return shared.count + userScoped.count
  } catch (error) {
    rethrowPrismaModelError(error, "weatherData")
  }
}
