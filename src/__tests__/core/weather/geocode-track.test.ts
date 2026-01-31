/**
 * @fileoverview Tests for geocodeTrack function
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Unit tests for geocoding service with mocked Nominatim API
 *
 * @purpose Validates geocoding functionality, caching, rate limiting, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { geocodeTrack } from "@/core/weather/geocode-track"

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("geocodeTrack", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear module cache to reset in-memory cache
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("successful geocoding", () => {
    it("should return coordinates for a valid track name", async () => {
      const mockResponse = [
        {
          lat: "-35.2809",
          lon: "149.1300",
          display_name: "Canberra, Australian Capital Territory, Australia",
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await geocodeTrack("Canberra")

      expect(result).toEqual({
        latitude: -35.2809,
        longitude: 149.13,
        displayName: "Canberra, Australian Capital Territory, Australia",
      })
    })

    it("should call Nominatim API with correct parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            lat: "40.7128",
            lon: "-74.0060",
            display_name: "New York",
          },
        ],
      })

      await geocodeTrack("New York")

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain("nominatim.openstreetmap.org/search")
      expect(callUrl).toContain("q=New+York")
      expect(callUrl).toContain("format=json")
      expect(callUrl).toContain("limit=1")
    })

    it("should include User-Agent header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            lat: "51.5074",
            lon: "-0.1278",
            display_name: "London",
          },
        ],
      })

      await geocodeTrack("London")

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const callOptions = mockFetch.mock.calls[0][1]
      expect(callOptions.headers["User-Agent"]).toBeDefined()
      expect(callOptions.headers["User-Agent"]).toContain("My Race Engineer")
    })
  })

  describe("caching", () => {
    it("should cache geocoding results", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [
          {
            lat: "52.5200",
            lon: "13.4050",
            display_name: "Berlin",
          },
        ],
      })

      // First call
      const result1 = await geocodeTrack("Berlin")

      // Second call - should use cache
      const result2 = await geocodeTrack("Berlin")

      expect(result1).toEqual(result2)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only called once due to cache
    })
  })

  describe("rate limiting", () => {
    it("should respect rate limit by waiting between requests", async () => {
      vi.useFakeTimers()

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [
          {
            lat: "48.8566",
            lon: "2.3522",
            display_name: "Paris",
          },
        ],
      })

      // Clear cache by using different track names
      await geocodeTrack("Paris1")

      const startTime = Date.now()
      await geocodeTrack("Paris2")
      const endTime = Date.now()

      // Should have waited at least 1000ms (1 second)
      expect(endTime - startTime).toBeGreaterThanOrEqual(1000)

      vi.useRealTimers()
    }, 5000) // Increase timeout for this test
  })

  describe("error handling", () => {
    it("should throw error when API returns non-200 status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      await expect(geocodeTrack("Invalid")).rejects.toThrow("Geocoding API returned status 500")
    })

    it("should throw error when no results found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await expect(geocodeTrack("NonexistentTrack12345")).rejects.toThrow(
        "No geocoding results found"
      )
    })

    it("should throw error when API call fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      await expect(geocodeTrack("Test")).rejects.toThrow("Geocoding failed")
    })

    it("should throw error when API key is missing (401)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      await expect(geocodeTrack("Test")).rejects.toThrow("Geocoding API returned status 401")
    })
  })

  describe("environment variable override", () => {
    it("should use GEOCODING_SERVICE_URL if set", async () => {
      const originalUrl = process.env.GEOCODING_SERVICE_URL
      process.env.GEOCODING_SERVICE_URL = "https://custom-geocoding-service.com/search"

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            lat: "0",
            lon: "0",
            display_name: "Test",
          },
        ],
      })

      await geocodeTrack("Test")

      const callUrl = mockFetch.mock.calls[0][0]
      expect(callUrl).toContain("custom-geocoding-service.com")

      // Restore original
      if (originalUrl) {
        process.env.GEOCODING_SERVICE_URL = originalUrl
      } else {
        delete process.env.GEOCODING_SERVICE_URL
      }
    })
  })
})
