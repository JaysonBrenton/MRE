/**
 * @fileoverview Tests for practice day search API route
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/v1/practice-days/search/route"
import { NextRequest } from "next/server"
import * as searchPracticeDays from "@/core/practice-days/search-practice-days"

// Mock the core function
vi.mock("@/core/practice-days/search-practice-days", () => ({
  searchPracticeDays: vi.fn(),
}))

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: "test-user" } })),
}))

describe("GET /api/v1/practice-days/search", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 401 if not authenticated", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce(null)

    const request = new NextRequest(
      "http://localhost/api/v1/practice-days/search?track_id=test-track"
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe("UNAUTHORIZED")
  })

  it("should return 400 if track_id is missing", async () => {
    const request = new NextRequest("http://localhost/api/v1/practice-days/search")

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe("VALIDATION_ERROR")
  })

  it("should successfully search practice days", async () => {
    const mockPracticeDays = [
      {
        id: "event-1",
        eventName: "Practice Day - 2025-01-15",
        eventDate: "2025-01-15T00:00:00Z",
        sourceEventId: "testtrack-practice-2025-01-15",
        trackId: "track-1",
        ingestDepth: "laps_full",
      },
    ]

    vi.mocked(searchPracticeDays.searchPracticeDays).mockResolvedValueOnce({
      practiceDays: mockPracticeDays,
    })

    const request = new NextRequest(
      "http://localhost/api/v1/practice-days/search?track_id=track-1&start_date=2025-01-01&end_date=2025-01-31"
    )

    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.practiceDays).toEqual(mockPracticeDays)
  })
})
