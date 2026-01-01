/**
 * @fileoverview Tests for fetchWeather function
 * 
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 * 
 * @description Unit tests for OpenWeatherMap API integration
 * 
 * @purpose Validates weather API integration with mocked responses for current/forecast/historical.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fetchWeather } from "@/core/weather/fetch-weather"

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("fetchWeather", () => {
  const originalApiKey = process.env.OPENWEATHERMAP_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    // Set API key before each test
    process.env.OPENWEATHERMAP_API_KEY = "test-api-key"
  })

  beforeAll(() => {
    // Ensure API key is set before any tests run
    process.env.OPENWEATHERMAP_API_KEY = "test-api-key"
  })

  afterAll(() => {
    // Restore original API key after all tests
    if (originalApiKey) {
      process.env.OPENWEATHERMAP_API_KEY = originalApiKey
    } else {
      delete process.env.OPENWEATHERMAP_API_KEY
    }
  })

  describe("API key validation", () => {
    it("should throw error if OPENWEATHERMAP_API_KEY is not set", async () => {
      delete process.env.OPENWEATHERMAP_API_KEY

      await expect(fetchWeather(0, 0, new Date())).rejects.toThrow(
        "OPENWEATHERMAP_API_KEY environment variable is not set"
      )
    })
  })

  describe("successful weather fetch", () => {
    it("should fetch current weather and forecast", async () => {
      const mockCurrentResponse = {
        weather: [{ main: "Clear", description: "clear sky" }],
        main: {
          temp: 24.5,
          humidity: 62,
        },
        wind: {
          speed: 3.33, // m/s (equals ~12 km/h)
          deg: 180,
        },
        dt: 1706371200, // Unix timestamp
        pop: 0.18, // 18% precipitation probability
      }

      const mockForecastResponse = {
        list: [
          {
            dt: 1706372100,
            main: { temp: 25, humidity: 60 },
            weather: [{ main: "Clouds", description: "few clouds" }],
            wind: { speed: 3.5, deg: 185 },
            pop: 0.2,
            dt_txt: "2024-01-28 12:15:00",
          },
          {
            dt: 1706373000,
            main: { temp: 26, humidity: 58 },
            weather: [{ main: "Clear", description: "clear sky" }],
            wind: { speed: 4.0, deg: 190 },
            pop: 0.1,
            dt_txt: "2024-01-28 12:30:00",
          },
          {
            dt: 1706373900,
            main: { temp: 27, humidity: 55 },
            weather: [{ main: "Rain", description: "light rain" }],
            wind: { speed: 4.5, deg: 195 },
            pop: 0.5,
            dt_txt: "2024-01-28 12:45:00",
          },
        ],
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCurrentResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockForecastResponse,
        })

      const result = await fetchWeather(-35.2809, 149.1300, new Date())

      expect(result.current).toEqual({
        condition: "clear sky",
        windSpeed: expect.closeTo(11.988, 1), // 3.33 m/s * 3.6 = 11.988 km/h
        windDirection: 180,
        humidity: 62,
        airTemperature: 24.5,
        precipitation: 18, // 0.18 * 100
        timestamp: new Date(1706371200 * 1000),
      })

      expect(result.forecast).toHaveLength(3)
      expect(result.forecast[0].label).toBe("+15m")
      expect(result.forecast[1].label).toBe("+30m")
      expect(result.forecast[2].label).toBe("+45m")
    })

    it("should handle missing wind direction", async () => {
      const mockCurrentResponse = {
        weather: [{ main: "Clear", description: "clear sky" }],
        main: { temp: 20, humidity: 50 },
        wind: { speed: 2.0 }, // No deg field
        dt: 1706371200,
        pop: 0,
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCurrentResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => { list: [] },
        })

      const result = await fetchWeather(0, 0, new Date())

      expect(result.current.windDirection).toBeNull()
    })

    it("should handle missing precipitation probability", async () => {
      const mockCurrentResponse = {
        weather: [{ main: "Clear", description: "clear sky" }],
        main: { temp: 20, humidity: 50 },
        wind: { speed: 2.0 },
        dt: 1706371200,
        // No pop field
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCurrentResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ list: [] }),
        })

      const result = await fetchWeather(0, 0, new Date())

      expect(result.current.precipitation).toBe(0)
    })
  })

  describe("error handling", () => {
    it("should throw error on 401 (invalid API key)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      await expect(fetchWeather(0, 0, new Date())).rejects.toThrow("Invalid OpenWeatherMap API key")
    })

    it("should throw error on other non-200 status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      await expect(fetchWeather(0, 0, new Date())).rejects.toThrow(
        "OpenWeatherMap API returned status 500"
      )
    })

    it("should handle forecast API failure gracefully", async () => {
      const mockCurrentResponse = {
        weather: [{ main: "Clear", description: "clear sky" }],
        main: { temp: 20, humidity: 50 },
        wind: { speed: 2.0 },
        dt: 1706371200,
        pop: 0,
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCurrentResponse,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })

      // Should still return current weather even if forecast fails
      const result = await fetchWeather(0, 0, new Date())

      expect(result.current).toBeDefined()
      expect(result.forecast.length).toBeGreaterThanOrEqual(3) // Default forecast entries
    })

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"))

      await expect(fetchWeather(0, 0, new Date())).rejects.toThrow("Failed to fetch weather data")
    })
  })

  describe("forecast generation", () => {
    it("should generate default forecast entries if forecast API fails", async () => {
      const mockCurrentResponse = {
        weather: [{ main: "Clear", description: "clear sky" }],
        main: { temp: 20, humidity: 50 },
        wind: { speed: 2.0 },
        dt: 1706371200,
        pop: 0,
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCurrentResponse,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })

      const result = await fetchWeather(0, 0, new Date())

      expect(result.forecast).toHaveLength(3)
      expect(result.forecast[0].label).toBe("+15m")
      expect(result.forecast[1].label).toBe("+30m")
      expect(result.forecast[2].label).toBe("+45m")
    })

    it("should handle empty forecast list", async () => {
      const mockCurrentResponse = {
        weather: [{ main: "Clear", description: "clear sky" }],
        main: { temp: 20, humidity: 50 },
        wind: { speed: 2.0 },
        dt: 1706371200,
        pop: 0,
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCurrentResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ list: [] }),
        })

      const result = await fetchWeather(0, 0, new Date())

      expect(result.forecast.length).toBeGreaterThanOrEqual(3)
    })
  })
})

