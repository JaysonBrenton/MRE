/**
 * @fileoverview Tests for tracks API route
 * 
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 * 
 * @description Tests for tracks API endpoint response format
 * 
 * @purpose Validates that the tracks API route returns responses in the
 *          standardized format and handles errors correctly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/v1/tracks/route"
import { getTracks } from "@/core/tracks/get-tracks"
import { NextRequest } from "next/server"

// Mock the core function
vi.mock("@/core/tracks/get-tracks")

describe("GET /api/v1/tracks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("response format validation", () => {
    it("should return success response in standardized format", async () => {
      const mockTracks = [
        {
          id: "track-1",
          source: "liverc",
          sourceTrackSlug: "test-track",
          trackName: "Test Track",
          trackUrl: "https://liverc.com/track/test-track",
          eventsUrl: "https://liverc.com/track/test-track/events",
          livercTrackLastUpdated: "2025-01-01",
          lastSeenAt: new Date(),
          isActive: true,
          isFollowed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(getTracks).mockResolvedValue(mockTracks)

      const request = new NextRequest("http://localhost:3001/api/v1/tracks")
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toHaveProperty("success", true)
      expect(body).toHaveProperty("data")
      expect(body.data).toHaveProperty("tracks")
      expect(body.data.tracks).toEqual(mockTracks)
    })

    it("should handle query parameters correctly", async () => {
      const mockTracks: any[] = []

      vi.mocked(getTracks).mockResolvedValue(mockTracks)

      const request = new NextRequest(
        "http://localhost:3001/api/v1/tracks?followed=true&active=true"
      )
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(getTracks).toHaveBeenCalledWith({
        followed: true,
        active: true,
      })
    })

    it("should default query parameters to true when not specified", async () => {
      const mockTracks: any[] = []

      vi.mocked(getTracks).mockResolvedValue(mockTracks)

      const request = new NextRequest("http://localhost:3001/api/v1/tracks")
      await GET(request)

      expect(getTracks).toHaveBeenCalledWith({
        followed: true,
        active: true,
      })
    })

    it("should handle false query parameters", async () => {
      const mockTracks: any[] = []

      vi.mocked(getTracks).mockResolvedValue(mockTracks)

      const request = new NextRequest(
        "http://localhost:3001/api/v1/tracks?followed=false&active=false"
      )
      await GET(request)

      expect(getTracks).toHaveBeenCalledWith({
        followed: false,
        active: false,
      })
    })
  })

  describe("error handling", () => {
    it("should return server error response for unexpected errors", async () => {
      vi.mocked(getTracks).mockRejectedValue(new Error("Database error"))

      const request = new NextRequest("http://localhost:3001/api/v1/tracks")
      const response = await GET(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body).toHaveProperty("success", false)
      expect(body).toHaveProperty("error")
      expect(body.error).toHaveProperty("code", "INTERNAL_ERROR")
      expect(body.error).toHaveProperty("message", "Failed to fetch tracks")
    })
  })
})
