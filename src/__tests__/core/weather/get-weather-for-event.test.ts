/**
 * @fileoverview Tests for getWeatherForEvent function
 * 
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 * 
 * @description Integration tests for weather data retrieval
 * 
 * @purpose Validates complete flow: cache hit/miss, API calls, error handling, TTL logic,
 *          historical vs current detection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { getWeatherForEvent } from "@/core/weather/get-weather-for-event"
import * as geocodeTrackModule from "@/core/weather/geocode-track"
import * as fetchWeatherModule from "@/core/weather/fetch-weather"
import * as weatherRepoModule from "@/core/weather/repo"
import * as resolveCandidatesModule from "@/core/weather/resolve-geocode-candidates"
import * as eventsRepoModule from "@/core/events/repo"

// Mock dependencies
vi.mock("@/core/weather/geocode-track")
vi.mock("@/core/weather/fetch-weather")
vi.mock("@/core/weather/repo")
vi.mock("@/core/weather/resolve-geocode-candidates")
vi.mock("@/core/events/repo")

describe("getWeatherForEvent", () => {
  const eventId = "event-123"
  const mockEvent = {
    id: eventId,
    eventName: "Test Event",
    eventDate: new Date("2025-06-15T12:00:00Z"),
    track: {
      trackName: "Test Track",
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("cache hit scenarios", () => {
    it("should return cached weather data if valid cache exists", async () => {
      const mockCachedWeather = {
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
        forecast: [
          { label: "+15m", detail: "Clouds, stable" },
          { label: "+30m", detail: "Light breeze" },
          { label: "+45m", detail: "Spotty drizzle" },
        ],
        isHistorical: false,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(mockCachedWeather as never)

      const result = await getWeatherForEvent(eventId)

      expect(result.isCached).toBe(true)
      expect(result.cachedAt).toBeDefined()
      expect(result.condition).toBe("Clear sky")
      expect(result.air).toBe(24)
      expect(result.track).toBe(32)
      
      // Should not call geocoding or API
      expect(geocodeTrackModule.geocodeTrack).not.toHaveBeenCalled()
      expect(fetchWeatherModule.fetchWeather).not.toHaveBeenCalled()
    })
  })

  describe("cache miss scenarios", () => {
    it("should fetch fresh weather data on cache miss", async () => {
      const mockGeocodeResult = {
        latitude: -35.2809,
        longitude: 149.1300,
        displayName: "Test Track, Location",
      }

      const mockWeatherResponse = {
        current: {
          condition: "Clear sky",
          windSpeed: 12,
          windDirection: 180,
          humidity: 62,
          airTemperature: 24,
          precipitation: 18,
          timestamp: new Date(),
        },
        forecast: [
          { label: "+15m", detail: "Clouds, stable" },
          { label: "+30m", detail: "Light breeze" },
          { label: "+45m", detail: "Spotty drizzle" },
        ],
      }

      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(null)
      vi.mocked(eventsRepoModule.getEventWithTrack).mockResolvedValue(mockEvent as never)
      vi.mocked(resolveCandidatesModule.resolveGeocodeCandidates).mockReturnValue(["Test Track"])
      vi.mocked(geocodeTrackModule.geocodeTrack).mockResolvedValue(mockGeocodeResult)
      vi.mocked(fetchWeatherModule.fetchWeather).mockResolvedValue(mockWeatherResponse)
      vi.mocked(weatherRepoModule.cacheWeatherData).mockResolvedValue({} as never)

      const result = await getWeatherForEvent(eventId)

      expect(result.isCached).toBe(false)
      expect(result.condition).toBe("Clear sky")
      expect(result.air).toBe(24)
      
      // Should have called geocoding and API
      expect(resolveCandidatesModule.resolveGeocodeCandidates).toHaveBeenCalledWith(mockEvent)
      expect(geocodeTrackModule.geocodeTrack).toHaveBeenCalledWith("Test Track")
      expect(fetchWeatherModule.fetchWeather).toHaveBeenCalled()
      expect(weatherRepoModule.cacheWeatherData).toHaveBeenCalled()
    })

    it("should use correct TTL for current/forecast events", async () => {
      const futureEvent = {
        ...mockEvent,
        eventDate: new Date(Date.now() + 86400000), // Tomorrow
      }

      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(null)
      vi.mocked(eventsRepoModule.getEventWithTrack).mockResolvedValue(futureEvent as never)
      vi.mocked(resolveCandidatesModule.resolveGeocodeCandidates).mockReturnValue(["Test Track"])
      vi.mocked(geocodeTrackModule.geocodeTrack).mockResolvedValue({
        latitude: 0,
        longitude: 0,
        displayName: "Test",
      })
      vi.mocked(fetchWeatherModule.fetchWeather).mockResolvedValue({
        current: {
          condition: "Clear",
          windSpeed: 10,
          windDirection: null,
          humidity: 50,
          airTemperature: 20,
          precipitation: 0,
          timestamp: new Date(),
        },
        forecast: [],
      })
      vi.mocked(weatherRepoModule.cacheWeatherData).mockResolvedValue({} as never)

      await getWeatherForEvent(eventId)

      expect(weatherRepoModule.cacheWeatherData).toHaveBeenCalled()
      const cacheCall = vi.mocked(weatherRepoModule.cacheWeatherData).mock.calls[0]
      const cacheData = cacheCall[1]
      expect(cacheData.isHistorical).toBe(false)
      // TTL should be 1 hour for current/forecast
      expect(cacheData.expiresAt.getTime()).toBeGreaterThan(Date.now() + 3590000) // ~1 hour
      expect(cacheData.expiresAt.getTime()).toBeLessThan(Date.now() + 3610000)
    })

    it("should use longer TTL for historical events", async () => {
      const pastEvent = {
        ...mockEvent,
        eventDate: new Date(Date.now() - 86400000), // Yesterday
      }

      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(null)
      vi.mocked(eventsRepoModule.getEventWithTrack).mockResolvedValue(pastEvent as never)
      vi.mocked(resolveCandidatesModule.resolveGeocodeCandidates).mockReturnValue(["Test Track"])
      vi.mocked(geocodeTrackModule.geocodeTrack).mockResolvedValue({
        latitude: 0,
        longitude: 0,
        displayName: "Test",
      })
      vi.mocked(fetchWeatherModule.fetchWeather).mockResolvedValue({
        current: {
          condition: "Clear",
          windSpeed: 10,
          windDirection: null,
          humidity: 50,
          airTemperature: 20,
          precipitation: 0,
          timestamp: new Date(),
        },
        forecast: [],
      })
      vi.mocked(weatherRepoModule.cacheWeatherData).mockResolvedValue({} as never)

      await getWeatherForEvent(eventId)

      const cacheCall = vi.mocked(weatherRepoModule.cacheWeatherData).mock.calls[0]
      const cacheData = cacheCall[1]
      expect(cacheData.isHistorical).toBe(true)
      // TTL should be 7 days for historical
      expect(cacheData.expiresAt.getTime()).toBeGreaterThan(Date.now() + 7 * 24 * 60 * 60 * 1000 - 60000)
    })
  })

  describe("error handling", () => {
    it("should return last cached data if API fails", async () => {
      const mockLastCached = {
        id: "weather-1",
        eventId,
        latitude: -35.2809,
        longitude: 149.1300,
        timestamp: new Date(Date.now() - 7200000), // 2 hours ago (expired)
        airTemperature: 22,
        humidity: 60,
        windSpeed: 10,
        windDirection: null,
        precipitation: 15,
        condition: "Partly cloudy",
        trackTemperature: 28,
        forecast: [],
        isHistorical: false,
        cachedAt: new Date(Date.now() - 7200000),
        expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(null)
      vi.mocked(eventsRepoModule.getEventWithTrack).mockResolvedValue(mockEvent as never)
      vi.mocked(resolveCandidatesModule.resolveGeocodeCandidates).mockReturnValue(["Test Track"])
      vi.mocked(geocodeTrackModule.geocodeTrack).mockRejectedValue(new Error("Geocoding failed"))
      vi.mocked(weatherRepoModule.getLastWeatherData).mockResolvedValue(mockLastCached as never)

      const result = await getWeatherForEvent(eventId)

      expect(result.isCached).toBe(true)
      expect(result.condition).toBe("Partly cloudy")
      expect(result.air).toBe(22)
    })

    it("should throw error if event not found", async () => {
      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(null)
      vi.mocked(eventsRepoModule.getEventWithTrack).mockResolvedValue(null)
      vi.mocked(weatherRepoModule.getLastWeatherData).mockResolvedValue(null)

      await expect(getWeatherForEvent(eventId)).rejects.toThrow("Event not found")
    })

    it("should throw error if API fails and no cache available", async () => {
      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(null)
      vi.mocked(eventsRepoModule.getEventWithTrack).mockResolvedValue(mockEvent as never)
      vi.mocked(resolveCandidatesModule.resolveGeocodeCandidates).mockReturnValue(["Test Track"])
      vi.mocked(geocodeTrackModule.geocodeTrack).mockRejectedValue(new Error("Geocoding failed"))
      vi.mocked(weatherRepoModule.getLastWeatherData).mockResolvedValue(null)

      await expect(getWeatherForEvent(eventId)).rejects.toThrow()
    })

    it("should try multiple candidates when first fails with no results", async () => {
      const seriesEvent = {
        id: eventId,
        eventName: "ABC Rnd 4 Jakarta Indonesia w/ Scotty Ernst",
        eventDate: new Date("2025-06-15T12:00:00Z"),
        track: {
          trackName: "Asian Buggy Championship",
        },
      }

      const mockGeocodeResult = {
        latitude: -6.2088,
        longitude: 106.8456,
        displayName: "Jakarta, Indonesia",
      }

      const mockWeatherResponse = {
        current: {
          condition: "Clear sky",
          windSpeed: 10,
          windDirection: 180,
          humidity: 70,
          airTemperature: 28,
          precipitation: 5,
          timestamp: new Date(),
        },
        forecast: [],
      }

      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(null)
      vi.mocked(eventsRepoModule.getEventWithTrack).mockResolvedValue(seriesEvent as never)
      vi.mocked(resolveCandidatesModule.resolveGeocodeCandidates).mockReturnValue([
        "Jakarta Indonesia",
        "Jakarta",
        "Asian Buggy Championship",
      ])
      
      // First call fails with "no results", second succeeds
      vi.mocked(geocodeTrackModule.geocodeTrack)
        .mockRejectedValueOnce(new Error("No geocoding results found for track: Asian Buggy Championship"))
        .mockResolvedValueOnce(mockGeocodeResult)
      
      vi.mocked(fetchWeatherModule.fetchWeather).mockResolvedValue(mockWeatherResponse)
      vi.mocked(weatherRepoModule.cacheWeatherData).mockResolvedValue({} as never)

      const result = await getWeatherForEvent(eventId)

      expect(result.isCached).toBe(false)
      expect(result.condition).toBe("Clear sky")
      
      // Should have tried both candidates
      expect(geocodeTrackModule.geocodeTrack).toHaveBeenCalledTimes(2)
      expect(geocodeTrackModule.geocodeTrack).toHaveBeenNthCalledWith(1, "Jakarta Indonesia")
      expect(geocodeTrackModule.geocodeTrack).toHaveBeenNthCalledWith(2, "Jakarta")
      expect(fetchWeatherModule.fetchWeather).toHaveBeenCalled()
    })

    it("should fail fast on HTTP errors (429/5xx)", async () => {
      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(null)
      vi.mocked(eventsRepoModule.getEventWithTrack).mockResolvedValue(mockEvent as never)
      vi.mocked(resolveCandidatesModule.resolveGeocodeCandidates).mockReturnValue(["Test Track", "Test Event"])
      vi.mocked(geocodeTrackModule.geocodeTrack).mockRejectedValue(
        new Error("Geocoding API returned status 429")
      )
      vi.mocked(weatherRepoModule.getLastWeatherData).mockResolvedValue(null)

      await expect(getWeatherForEvent(eventId)).rejects.toThrow("Geocoding API returned status 429")
      
      // Should only try once and fail fast
      expect(geocodeTrackModule.geocodeTrack).toHaveBeenCalledTimes(1)
    })

    it("should throw comprehensive error when all candidates fail", async () => {
      vi.mocked(weatherRepoModule.getCachedWeather).mockResolvedValue(null)
      vi.mocked(eventsRepoModule.getEventWithTrack).mockResolvedValue(mockEvent as never)
      vi.mocked(resolveCandidatesModule.resolveGeocodeCandidates).mockReturnValue([
        "Test Track",
        "Test Event",
      ])
      vi.mocked(geocodeTrackModule.geocodeTrack).mockRejectedValue(
        new Error("No geocoding results found for track: Test Track")
      )
      vi.mocked(weatherRepoModule.getLastWeatherData).mockResolvedValue(null)

      try {
        await getWeatherForEvent(eventId)
        expect.fail("Should have thrown an error")
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        if (error instanceof Error) {
          expect(error.message).toContain("Test Event")
          expect(error.message).toContain("Test Track")
          expect(error.message).toContain("Attempted candidates")
        }
      }
    })
  })
})

