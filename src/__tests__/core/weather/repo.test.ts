/**
 * @fileoverview Tests for weather repository functions
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Tests for weather repository database operations
 *
 * @purpose Validates that repository functions handle Prisma client correctly
 *          and provide helpful error messages when the client is not properly initialized.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  getCachedWeather,
  getCachedWeatherForEvent,
  getLastWeatherData,
  cacheWeatherData,
  cleanupExpiredWeatherData,
} from "@/core/weather/repo"
import { utcCalendarDayStart } from "@/core/weather/utc-calendar-day"
import { prisma } from "@/lib/prisma"

// Mock the Prisma client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    weatherData: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

describe("weather repository", () => {
  const eventId = "event-123"
  const mockWeatherData = {
    id: "weather-1",
    eventId,
    weatherDate: new Date(Date.UTC(2025, 5, 15)),
    latitude: -35.2809,
    longitude: 149.13,
    timestamp: new Date(),
    airTemperature: 24,
    humidity: 62,
    windSpeed: 12,
    windDirection: 180,
    precipitation: 18,
    condition: "Clear sky",
    trackTemperature: 32,
    forecast: [{ label: "+15m", detail: "Clouds" }],
    isHistorical: false,
    cachedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("getCachedWeather", () => {
    const calendarDay = new Date("2025-06-15T12:00:00Z")

    it("should return cached weather data when found for that UTC day", async () => {
      vi.mocked(prisma.weatherData.findFirst).mockResolvedValue(mockWeatherData as never)

      const result = await getCachedWeather(eventId, calendarDay)

      expect(result).toEqual(mockWeatherData)
      expect(prisma.weatherData.findFirst).toHaveBeenCalledWith({
        where: {
          eventId,
          weatherDate: utcCalendarDayStart(calendarDay),
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        orderBy: {
          cachedAt: "desc",
        },
      })
    })

    it("should fall back to legacy rows when no day-specific row exists", async () => {
      vi.mocked(prisma.weatherData.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockWeatherData as never)

      const result = await getCachedWeather(eventId, calendarDay)

      expect(result).toEqual(mockWeatherData)
      expect(prisma.weatherData.findFirst).toHaveBeenCalledTimes(2)
      expect(prisma.weatherData.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          eventId,
          weatherDate: null,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        orderBy: {
          cachedAt: "desc",
        },
      })
    })

    it("should return null when no cached data found", async () => {
      vi.mocked(prisma.weatherData.findFirst).mockResolvedValue(null)

      const result = await getCachedWeather(eventId, calendarDay)

      expect(result).toBeNull()
    })

    it("should provide helpful error message when Prisma client weatherData is undefined", async () => {
      const originalWeatherData = prisma.weatherData
      ;(prisma as Record<string, unknown>).weatherData = undefined

      try {
        await getCachedWeather(eventId, calendarDay)
        expect.fail("Should have thrown an error")
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain(
          "Prisma client weatherData model is not available"
        )
        expect((error as Error).message).toContain("npx prisma generate")
      } finally {
        ;(prisma as Record<string, unknown>).weatherData = originalWeatherData
      }
    })
  })

  describe("getCachedWeatherForEvent", () => {
    it("returns null when event does not exist", async () => {
      vi.mocked(prisma.event.findUnique).mockResolvedValue(null)

      const result = await getCachedWeatherForEvent(eventId)

      expect(result).toBeNull()
      expect(prisma.weatherData.findFirst).not.toHaveBeenCalled()
    })

    it("delegates to getCachedWeather using event start date", async () => {
      const eventDate = new Date("2025-06-15T10:00:00Z")
      vi.mocked(prisma.event.findUnique).mockResolvedValue({ eventDate } as never)
      vi.mocked(prisma.weatherData.findFirst).mockResolvedValue(mockWeatherData as never)

      const result = await getCachedWeatherForEvent(eventId)

      expect(result).toEqual(mockWeatherData)
      expect(prisma.weatherData.findFirst).toHaveBeenCalledWith({
        where: {
          eventId,
          weatherDate: utcCalendarDayStart(eventDate),
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        orderBy: {
          cachedAt: "desc",
        },
      })
    })
  })

  describe("getLastWeatherData", () => {
    it("should return last weather data when found", async () => {
      vi.mocked(prisma.weatherData.findFirst).mockResolvedValue(mockWeatherData as never)

      const result = await getLastWeatherData(eventId)

      expect(result).toEqual(mockWeatherData)
      expect(prisma.weatherData.findFirst).toHaveBeenCalledWith({
        where: {
          eventId,
        },
        orderBy: {
          cachedAt: "desc",
        },
      })
    })

    it("should return null when no data found", async () => {
      vi.mocked(prisma.weatherData.findFirst).mockResolvedValue(null)

      const result = await getLastWeatherData(eventId)

      expect(result).toBeNull()
    })

    it("should prefer day-specific row when calendarDay is passed", async () => {
      vi.mocked(prisma.weatherData.findFirst).mockResolvedValue(mockWeatherData as never)
      const day = new Date("2025-06-15T12:00:00Z")

      const result = await getLastWeatherData(eventId, day)

      expect(result).toEqual(mockWeatherData)
      expect(prisma.weatherData.findFirst).toHaveBeenCalledWith({
        where: {
          eventId,
          weatherDate: utcCalendarDayStart(day),
        },
        orderBy: {
          cachedAt: "desc",
        },
      })
    })
  })

  describe("cacheWeatherData", () => {
    const cacheData = {
      weatherDate: new Date("2025-06-15T12:00:00Z"),
      latitude: -35.2809,
      longitude: 149.13,
      timestamp: new Date(),
      airTemperature: 24,
      humidity: 62,
      windSpeed: 12,
      windDirection: 180,
      precipitation: 18,
      condition: "Clear sky",
      trackTemperature: 32,
      forecast: [{ label: "+15m", detail: "Clouds" }],
      isHistorical: false,
      expiresAt: new Date(Date.now() + 3600000),
    }

    it("should cache weather data successfully", async () => {
      vi.mocked(prisma.weatherData.upsert).mockResolvedValue(mockWeatherData as never)

      const result = await cacheWeatherData(eventId, cacheData)

      expect(result).toEqual(mockWeatherData)
      const day = utcCalendarDayStart(cacheData.weatherDate)
      expect(prisma.weatherData.upsert).toHaveBeenCalledWith({
        where: {
          eventId_weatherDate: {
            eventId,
            weatherDate: day,
          },
        },
        create: {
          eventId,
          weatherDate: day,
          latitude: cacheData.latitude,
          longitude: cacheData.longitude,
          timestamp: cacheData.timestamp,
          airTemperature: cacheData.airTemperature,
          humidity: cacheData.humidity,
          windSpeed: cacheData.windSpeed,
          windDirection: cacheData.windDirection,
          precipitation: cacheData.precipitation,
          condition: cacheData.condition,
          trackTemperature: cacheData.trackTemperature,
          forecast: cacheData.forecast,
          isHistorical: cacheData.isHistorical,
          expiresAt: cacheData.expiresAt,
        },
        update: {
          latitude: cacheData.latitude,
          longitude: cacheData.longitude,
          timestamp: cacheData.timestamp,
          airTemperature: cacheData.airTemperature,
          humidity: cacheData.humidity,
          windSpeed: cacheData.windSpeed,
          windDirection: cacheData.windDirection,
          precipitation: cacheData.precipitation,
          condition: cacheData.condition,
          trackTemperature: cacheData.trackTemperature,
          forecast: cacheData.forecast,
          isHistorical: cacheData.isHistorical,
          expiresAt: cacheData.expiresAt,
        },
      })
    })
  })

  describe("cleanupExpiredWeatherData", () => {
    it("should delete expired weather data", async () => {
      vi.mocked(prisma.weatherData.deleteMany).mockResolvedValue({ count: 5 } as never)

      const result = await cleanupExpiredWeatherData()

      expect(result).toBe(5)
      expect(prisma.weatherData.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      })
    })

    it("should use provided cutoff date", async () => {
      const cutoffDate = new Date("2025-01-01")
      vi.mocked(prisma.weatherData.deleteMany).mockResolvedValue({ count: 3 } as never)

      const result = await cleanupExpiredWeatherData(cutoffDate)

      expect(result).toBe(3)
      expect(prisma.weatherData.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: cutoffDate,
          },
        },
      })
    })
  })
})
