/**
 * @fileoverview Tests for event search API route
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Tests for event search API endpoint response format
 *
 * @purpose Validates that the event search API route returns responses in the
 *          standardized format and handles errors correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/v1/events/search/route"
import { searchEvents } from "@/core/events/search-events"
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
vi.mock("@/core/events/search-events")

describe("GET /api/v1/events/search", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("response format validation", () => {
    it("should return success response in standardized format", async () => {
      const mockResult = {
        track: {
          id: "track-123",
          source: "liverc",
          sourceTrackSlug: "test-track",
          trackName: "Test Track",
        },
        events: [
          {
            id: "event-1",
            source: "liverc",
            sourceEventId: "12345",
            eventName: "Test Event",
            eventDate: "2025-01-15T00:00:00Z",
            eventEntries: 50,
            eventDrivers: 45,
            eventUrl: "https://liverc.com/event/12345",
            ingestDepth: "none",
            lastIngestedAt: null,
          },
        ],
      }

      vi.mocked(searchEvents).mockResolvedValue(mockResult)

      const request = new NextRequest(
        "http://localhost:3001/api/v1/events/search?track_id=track-123&start_date=2025-01-01&end_date=2025-01-31"
      )
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toHaveProperty("success", true)
      expect(body).toHaveProperty("data")
      expect(body.data).toHaveProperty("track")
      expect(body.data).toHaveProperty("events")
      expect(body.data.track).toEqual({
        id: mockResult.track.id,
        source: mockResult.track.source,
        source_track_slug: mockResult.track.sourceTrackSlug,
        track_name: mockResult.track.trackName,
      })
      expect(body.data.events).toEqual(mockResult.events)
      expect(body.data.practice_days).toBeUndefined()
    })

    it("should return practice_days and practice range when include_practice_days=true", async () => {
      const mockResult = {
        track: {
          id: "track-123",
          source: "liverc",
          sourceTrackSlug: "test-track",
          trackName: "Test Track",
        },
        events: [
          {
            id: "event-1",
            source: "liverc",
            sourceEventId: "12345",
            eventName: "Test Event",
            eventDate: "2025-01-15T00:00:00Z",
            eventEntries: 50,
            eventDrivers: 45,
            eventUrl: "https://liverc.com/event/12345",
            ingestDepth: "none",
            lastIngestedAt: null,
          },
        ],
        practiceDays: [
          {
            id: "pd-1",
            eventName: "Practice 2025-01-10",
            eventDate: "2025-01-10T00:00:00Z",
            sourceEventId: "test-track-practice-2025-01-10",
            trackId: "track-123",
            ingestDepth: "laps_full",
          },
        ],
        practiceRangeMin: "2025-01-10T00:00:00Z",
        practiceRangeMax: "2025-01-15T00:00:00Z",
      }

      vi.mocked(searchEvents).mockResolvedValue(mockResult)

      const request = new NextRequest(
        "http://localhost:3001/api/v1/events/search?track_id=track-123&include_practice_days=true"
      )
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data.practice_days).toEqual(mockResult.practiceDays)
      expect(body.data.practice_range_min).toBe(mockResult.practiceRangeMin)
      expect(body.data.practice_range_max).toBe(mockResult.practiceRangeMax)
    })
  })

  describe("error handling", () => {
    it("should return validation error in standardized format", async () => {
      const validationError = {
        code: "VALIDATION_ERROR",
        message: "track_id is required",
        field: "track_id",
      }

      vi.mocked(searchEvents).mockRejectedValue(validationError)

      const request = new NextRequest(
        "http://localhost:3001/api/v1/events/search?start_date=2025-01-01&end_date=2025-01-31"
      )
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toHaveProperty("success", false)
      expect(body).toHaveProperty("error")
      expect(body.error).toHaveProperty("code", "VALIDATION_ERROR")
      expect(body.error).toHaveProperty("message", "track_id is required")
    })

    it("should return not found error when track is not found", async () => {
      vi.mocked(searchEvents).mockRejectedValue(new Error("Track not found"))

      const request = new NextRequest(
        "http://localhost:3001/api/v1/events/search?track_id=non-existent&start_date=2025-01-01&end_date=2025-01-31"
      )
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body).toHaveProperty("success", false)
      expect(body).toHaveProperty("error")
      expect(body.error).toHaveProperty("code", "NOT_FOUND")
      expect(body.error).toHaveProperty("message", "Track not found")
    })

    it("should return server error response for unexpected errors", async () => {
      vi.mocked(searchEvents).mockRejectedValue(new Error("Database error"))

      const request = new NextRequest(
        "http://localhost:3001/api/v1/events/search?track_id=track-123&start_date=2025-01-01&end_date=2025-01-31"
      )
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body).toHaveProperty("success", false)
      expect(body).toHaveProperty("error")
      expect(body.error).toHaveProperty("code", "INTERNAL_ERROR")
      expect(body.error).toHaveProperty("message", "Database error")
    })
  })
})
