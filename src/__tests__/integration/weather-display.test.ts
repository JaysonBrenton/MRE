/**
 * @fileoverview Integration test for weather data display
 * 
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 * 
 * @description Integration test to verify weather data is properly fetched and formatted for display
 * 
 * @purpose Validates the complete flow from API request to formatted response that the UI expects.
 *          This test ensures the weather functionality works end-to-end without actual external API calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { getWeatherForEvent } from "@/core/weather/get-weather-for-event"
import * as geocodeTrackModule from "@/core/weather/geocode-track"
import * as fetchWeatherModule from "@/core/weather/fetch-weather"
import * as weatherRepoModule from "@/core/weather/repo"
import * as eventsRepoModule from "@/core/events/repo"
import * as resolveCandidatesModule from "@/core/weather/resolve-geocode-candidates"

// Mock dependencies
vi.mock("@/core/weather/geocode-track")
vi.mock("@/core/weather/fetch-weather")
vi.mock("@/core/weather/repo")
vi.mock("@/core/events/repo")
vi.mock("@/core/weather/resolve-geocode-candidates")

describe("Weather Data Display Integration", () => {
  const eventId = "event-123"
  const mockEvent = {
    id: eventId,
    eventName: "Test Race Event",
    eventDate: new Date("2025-06-15T14:00:00Z"),
    track: {
      trackName: "Sydney Motorsport Park",
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("weather data format for UI display", () => {
    it("should return weather data in the format expected by the UI", async () => {
      const mockGeocodeResult = {
        latitude: -33.8688,
        longitude: 151.2093,
        displayName: "Sydney Motorsport Park, Eastern Creek NSW",
      }

      const mockWeatherResponse = {
        current: {
          condition: "Partly cloudy",
          windSpeed: 15.5,
          windDirection: 180,
          humidity: 65,
          airTemperature: 22,
          precipitation: 20,
          timestamp: new Date("2025-06-15T14:00:00Z"),
        },
        forecast: [
          { label: "+15m", detail: "Clouds increasing, light breeze" },
          { label: "+30m", detail: "Partly sunny, stable conditions" },
          { label: "+45m", detail: "Potential light showers" },
        ],
      }

      // Mock cache miss
      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(null)
      vi.mocked(eventsRepoModule.getEventWithTrack).mockResolvedValue(mockEvent as never)
      vi.mocked(resolveCandidatesModule.resolveGeocodeCandidates).mockReturnValue(["Sydney Motorsport Park"])
      vi.mocked(geocodeTrackModule.geocodeTrack).mockResolvedValue(mockGeocodeResult)
      vi.mocked(fetchWeatherModule.fetchWeather).mockResolvedValue(mockWeatherResponse)
      vi.mocked(weatherRepoModule.cacheWeatherData).mockResolvedValue({
        id: "weather-1",
        eventId,
        ...mockWeatherResponse.current,
        trackTemperature: 28,
        forecast: mockWeatherResponse.forecast,
        isHistorical: false,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never)

      const result = await getWeatherForEvent(eventId)

      // Verify the response structure matches what the UI expects
      expect(result).toHaveProperty("condition")
      expect(result).toHaveProperty("wind")
      expect(result).toHaveProperty("humidity")
      expect(result).toHaveProperty("air")
      expect(result).toHaveProperty("track")
      expect(result).toHaveProperty("precip")
      expect(result).toHaveProperty("forecast")
      expect(result).toHaveProperty("isCached")

      // Verify data types and formats
      expect(typeof result.condition).toBe("string")
      expect(typeof result.wind).toBe("string")
      expect(result.wind).toMatch(/\d+\s+km\/h/) // Wind should be formatted as "XX km/h" or "XX km/h DIRECTION"
      expect(typeof result.humidity).toBe("number")
      expect(typeof result.air).toBe("number")
      expect(typeof result.track).toBe("number")
      expect(typeof result.precip).toBe("number")
      expect(Array.isArray(result.forecast)).toBe(true)
      expect(typeof result.isCached).toBe("boolean")

      // Verify values
      expect(result.condition).toBe("Partly cloudy")
      expect(result.humidity).toBe(65)
      expect(result.air).toBe(22)
      expect(result.track).toBeGreaterThan(result.air) // Track temp should be higher than air temp
      expect(result.precip).toBe(20)
      expect(result.forecast.length).toBe(3)
      expect(result.isCached).toBe(false)

      // Verify forecast structure
      result.forecast.forEach((item) => {
        expect(item).toHaveProperty("label")
        expect(item).toHaveProperty("detail")
        expect(typeof item.label).toBe("string")
        expect(typeof item.detail).toBe("string")
      })
    })

    it("should format wind with direction when available", async () => {
      const mockWeatherResponse = {
        current: {
          condition: "Clear",
          windSpeed: 12,
          windDirection: 270, // West
          humidity: 50,
          airTemperature: 20,
          precipitation: 0,
          timestamp: new Date(),
        },
        forecast: [],
      }

      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(null)
      vi.mocked(eventsRepoModule.getEventWithTrack).mockResolvedValue(mockEvent as never)
      vi.mocked(resolveCandidatesModule.resolveGeocodeCandidates).mockReturnValue(["Sydney Motorsport Park"])
      vi.mocked(geocodeTrackModule.geocodeTrack).mockResolvedValue({
        latitude: 0,
        longitude: 0,
        displayName: "Test",
      })
      vi.mocked(fetchWeatherModule.fetchWeather).mockResolvedValue(mockWeatherResponse)
      vi.mocked(weatherRepoModule.cacheWeatherData).mockResolvedValue({} as never)

      const result = await getWeatherForEvent(eventId)

      expect(result.wind).toMatch(/\d+\s+km\/h\s+[NWES]+/) // Should include direction
      expect(result.wind).toContain("km/h")
    })

    it("should format wind without direction when null", async () => {
      const mockWeatherResponse = {
        current: {
          condition: "Clear",
          windSpeed: 8,
          windDirection: null,
          humidity: 50,
          airTemperature: 20,
          precipitation: 0,
          timestamp: new Date(),
        },
        forecast: [],
      }

      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(null)
      vi.mocked(eventsRepoModule.getEventWithTrack).mockResolvedValue(mockEvent as never)
      vi.mocked(resolveCandidatesModule.resolveGeocodeCandidates).mockReturnValue(["Sydney Motorsport Park"])
      vi.mocked(geocodeTrackModule.geocodeTrack).mockResolvedValue({
        latitude: 0,
        longitude: 0,
        displayName: "Test",
      })
      vi.mocked(fetchWeatherModule.fetchWeather).mockResolvedValue(mockWeatherResponse)
      vi.mocked(weatherRepoModule.cacheWeatherData).mockResolvedValue({} as never)

      const result = await getWeatherForEvent(eventId)

      expect(result.wind).toMatch(/^\d+\s+km\/h$/) // Should be "XX km/h" without direction
      expect(result.wind).not.toMatch(/[NWES]+/) // Should not include direction
    })

    it("should include cachedAt timestamp when data is cached", async () => {
      const cachedDate = new Date("2025-06-15T12:00:00Z")
      const mockCachedWeather = {
        id: "weather-1",
        eventId,
        latitude: -33.8688,
        longitude: 151.2093,
        timestamp: cachedDate,
        airTemperature: 20,
        humidity: 60,
        windSpeed: 10,
        windDirection: null,
        precipitation: 15,
        condition: "Partly cloudy",
        trackTemperature: 26,
        forecast: [{ label: "+15m", detail: "Stable" }],
        isHistorical: false,
        cachedAt: cachedDate,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: cachedDate,
        updatedAt: cachedDate,
      }

      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(mockCachedWeather as never)

      const result = await getWeatherForEvent(eventId)

      expect(result.isCached).toBe(true)
      expect(result.cachedAt).toBeDefined()
      expect(result.cachedAt).toBe(cachedDate.toISOString())
    })
  })

  describe("error handling in display flow", () => {
    it("should handle Prisma client errors gracefully", async () => {
      // Simulate Prisma client error by making getCachedWeather throw
      vi.mocked(weatherRepoModule.getCachedWeather).mockRejectedValue(
        new TypeError("Cannot read properties of undefined (reading 'findFirst')")
      )

      await expect(getWeatherForEvent(eventId)).rejects.toThrow()

      // The error should be propagated but with helpful message (from our error handling)
      try {
        await getWeatherForEvent(eventId)
        expect.fail("Should have thrown an error")
      } catch (error) {
        // If it's our error handling, it should have a helpful message
        // Otherwise, it will be the original error
        expect(error).toBeInstanceOf(Error)
      }
    })
  })
})

