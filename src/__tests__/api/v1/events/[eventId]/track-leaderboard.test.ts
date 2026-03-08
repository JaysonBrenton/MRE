/**
 * @fileoverview Tests for event track leaderboard API route
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/v1/events/[eventId]/track-leaderboard/route"
import { getTrackLeaderboard } from "@/core/tracks/get-track-leaderboard"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-123" } })),
}))

vi.mock("@/lib/request-context", () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
  generateRequestId: () => "test-request-id",
  getRequestContext: () => ({}),
  getClientIp: () => "test",
}))

const mockFindUnique = vi.fn()
vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}))

vi.mock("@/core/tracks/get-track-leaderboard")

describe("GET /api/v1/events/[eventId]/track-leaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindUnique.mockResolvedValue({
      trackId: "track-123",
    })
    vi.mocked(getTrackLeaderboard).mockResolvedValue({
      trackName: "Test Track",
      drivers: [],
      classes: [],
    })
  })

  it("should return 401 if not authenticated", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce(null)

    const request = new NextRequest("http://localhost/api/v1/events/event-123/track-leaderboard")
    const response = await GET(request, {
      params: Promise.resolve({ eventId: "event-123" }),
    })
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe("UNAUTHORIZED")
  })

  it("should return 404 when event not found", async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    const request = new NextRequest("http://localhost/api/v1/events/nonexistent/track-leaderboard")
    const response = await GET(request, {
      params: Promise.resolve({ eventId: "nonexistent" }),
    })
    const json = await response.json()

    expect(response.status).toBe(404)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe("NOT_FOUND")
    expect(json.error.message).toBe("Event not found")
  })

  it("should return success with leaderboard data", async () => {
    const mockData = {
      trackName: "Test Track",
      drivers: [
        {
          driverId: "d1",
          driverName: "Driver 1",
          className: "Class A",
          points: 25,
          wins: 1,
          podiums: 0,
        },
      ],
      classes: ["Class A"],
    }
    vi.mocked(getTrackLeaderboard).mockResolvedValueOnce(mockData)

    const request = new NextRequest("http://localhost/api/v1/events/event-123/track-leaderboard")
    const response = await GET(request, {
      params: Promise.resolve({ eventId: "event-123" }),
    })
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual(mockData)
    expect(getTrackLeaderboard).toHaveBeenCalledWith(
      "track-123",
      expect.objectContaining({ className: null })
    )
  })
})
