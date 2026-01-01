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
  getLastWeatherData, 
  cacheWeatherData,
  cleanupExpiredWeatherData 
} from "@/core/weather/repo"
import { prisma } from "@/lib/prisma"

// Mock the Prisma client
vi.mock("@/lib/prisma", () => ({
  prisma: {
    weatherData: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

describe("weather repository", () => {
  const eventId = "event-123"
  const mockWeatherData = {
    id: "weather-1",
    eventId,
    latitude: -35.2809,
    longitude: 149.1300,
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
    it("should return cached weather data when found", async () => {
      vi.mocked(prisma.weatherData.findFirst).mockResolvedValue(mockWeatherData as never)

      const result = await getCachedWeather(eventId)

      expect(result).toEqual(mockWeatherData)
      expect(prisma.weatherData.findFirst).toHaveBeenCalledWith({
        where: {
          eventId,
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

      const result = await getCachedWeather(eventId)

      expect(result).toBeNull()
    })

    it("should provide helpful error message when Prisma client weatherData is undefined", async () => {
      // Simulate undefined weatherData property
      const originalWeatherData = prisma.weatherData
      ;(prisma as any).weatherData = undefined

      try {
        await getCachedWeather(eventId)
        expect.fail("Should have thrown an error")
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain("Prisma client weatherData model is not available")
        expect((error as Error).message).toContain("npx prisma generate")
      } finally {
        // Restore the original value
        ;(prisma as any).weatherData = originalWeatherData
      }
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
  })

  describe("cacheWeatherData", () => {
    const cacheData = {
      latitude: -35.2809,
      longitude: 149.1300,
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
      vi.mocked(prisma.weatherData.create).mockResolvedValue(mockWeatherData as never)

      const result = await cacheWeatherData(eventId, cacheData)

      expect(result).toEqual(mockWeatherData)
      expect(prisma.weatherData.create).toHaveBeenCalledWith({
        data: {
          eventId,
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

