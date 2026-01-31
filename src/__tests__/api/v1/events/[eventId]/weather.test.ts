/**
 * @fileoverview Tests for event weather API route
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Tests for weather API endpoint response format and error handling
 *
 * @purpose Validates that the weather API route returns responses in the
 *          standardized format and handles errors correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/v1/events/[eventId]/weather/route"
import { getWeatherForEvent } from "@/core/weather/get-weather-for-event"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-123" } })),
}))

vi.mock("@/lib/request-context", () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  generateRequestId: () => "test-request-id",
  getRequestContext: () => ({}),
  getClientIp: () => "test",
}))

// Mock the core function
vi.mock("@/core/weather/get-weather-for-event")

describe("GET /api/v1/events/[eventId]/weather", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("authentication", () => {
    it("should return 401 if not authenticated", async () => {
      const { auth } = await import("@/lib/auth")
      vi.mocked(auth).mockResolvedValueOnce(null)

      const request = new NextRequest("http://localhost/api/v1/events/event-123/weather")
      const response = await GET(request, { params: Promise.resolve({ eventId: "event-123" }) })
      const json = await response.json()

      expect(response.status).toBe(401)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe("UNAUTHORIZED")
    })
  })

  describe("response format validation", () => {
    it("should return success response in standardized format", async () => {
      const mockWeatherData = {
        condition: "Clear sky",
        wind: "12 km/h N",
        humidity: 62,
        air: 24,
        track: 32,
        precip: 18,
        forecast: [
          { label: "+15m", detail: "Clouds, stable" },
          { label: "+30m", detail: "Light breeze" },
          { label: "+45m", detail: "Spotty drizzle" },
        ],
        isCached: false,
      }

      vi.mocked(getWeatherForEvent).mockResolvedValueOnce(mockWeatherData)

      const request = new NextRequest("http://localhost/api/v1/events/event-123/weather")
      const response = await GET(request, { params: Promise.resolve({ eventId: "event-123" }) })
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data).toEqual(mockWeatherData)
    })

    it("should include cached data indicator when data is cached", async () => {
      const mockWeatherData = {
        condition: "Partly cloudy",
        wind: "10 km/h",
        humidity: 60,
        air: 22,
        track: 28,
        precip: 15,
        forecast: [],
        cachedAt: "2025-01-27T10:30:00Z",
        isCached: true,
      }

      vi.mocked(getWeatherForEvent).mockResolvedValueOnce(mockWeatherData)

      const request = new NextRequest("http://localhost/api/v1/events/event-123/weather")
      const response = await GET(request, { params: Promise.resolve({ eventId: "event-123" }) })
      const json = await response.json()

      expect(json.data.isCached).toBe(true)
      expect(json.data.cachedAt).toBeDefined()
    })
  })

  describe("error handling", () => {
    it("should return 404 when event not found", async () => {
      vi.mocked(getWeatherForEvent).mockRejectedValueOnce(new Error("Event not found"))

      const request = new NextRequest("http://localhost/api/v1/events/nonexistent/weather")
      const response = await GET(request, { params: Promise.resolve({ eventId: "nonexistent" }) })
      const json = await response.json()

      expect(response.status).toBe(404)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe("NOT_FOUND")
      expect(json.error.message).toContain("not found")
    })

    it("should return 503 when weather service is unavailable", async () => {
      vi.mocked(getWeatherForEvent).mockRejectedValueOnce(
        new Error("Failed to fetch weather data and no cache available")
      )

      const request = new NextRequest("http://localhost/api/v1/events/event-123/weather")
      const response = await GET(request, { params: Promise.resolve({ eventId: "event-123" }) })
      const json = await response.json()

      expect(response.status).toBe(503)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe("SERVICE_UNAVAILABLE")
    })

    it("should return 503 when fetch fails with no cache", async () => {
      vi.mocked(getWeatherForEvent).mockRejectedValueOnce(new Error("Failed to fetch weather data"))

      const request = new NextRequest("http://localhost/api/v1/events/event-123/weather")
      const response = await GET(request, { params: Promise.resolve({ eventId: "event-123" }) })
      const json = await response.json()

      expect(response.status).toBe(503)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe("SERVICE_UNAVAILABLE")
    })

    it("should handle generic errors", async () => {
      vi.mocked(getWeatherForEvent).mockRejectedValueOnce(new Error("Internal server error"))

      const request = new NextRequest("http://localhost/api/v1/events/event-123/weather")
      const response = await GET(request, { params: Promise.resolve({ eventId: "event-123" }) })

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json.success).toBe(false)
    })
  })

  describe("request parameters", () => {
    it("should pass eventId to getWeatherForEvent", async () => {
      vi.mocked(getWeatherForEvent).mockResolvedValueOnce({
        condition: "Clear",
        wind: "10 km/h",
        humidity: 50,
        air: 20,
        track: 25,
        precip: 0,
        forecast: [],
        isCached: false,
      })

      const eventId = "test-event-456"
      const request = new NextRequest(`http://localhost/api/v1/events/${eventId}/weather`)
      await GET(request, { params: Promise.resolve({ eventId }) })

      expect(getWeatherForEvent).toHaveBeenCalledWith(eventId)
    })
  })
})
