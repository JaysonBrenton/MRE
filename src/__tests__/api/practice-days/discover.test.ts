/**
 * @fileoverview Tests for practice day discovery API route
 * 
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/v1/practice-days/discover/route"
import { NextRequest } from "next/server"
import * as discoverPracticeDays from "@/core/practice-days/discover-practice-days"

// Mock the core function
vi.mock("@/core/practice-days/discover-practice-days", () => ({
  discoverPracticeDays: vi.fn(),
}))

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: "test-user" } })),
}))

describe("POST /api/v1/practice-days/discover", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 401 if not authenticated", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce(null)

    const request = new NextRequest("http://localhost/api/v1/practice-days/discover", {
      method: "POST",
      body: JSON.stringify({
        track_id: "test-track",
        start_date: "2025-01-01",
        end_date: "2025-01-31",
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe("UNAUTHORIZED")
  })

  it("should return 400 if required fields are missing", async () => {
    const request = new NextRequest("http://localhost/api/v1/practice-days/discover", {
      method: "POST",
      body: JSON.stringify({
        track_id: "test-track",
        // Missing start_date and end_date
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe("VALIDATION_ERROR")
  })

  it("should successfully discover practice days", async () => {
    const mockPracticeDays = [
      {
        date: "2025-01-15",
        trackSlug: "testtrack",
        sessionCount: 10,
        totalLaps: 500,
        totalTrackTimeSeconds: 3600,
        uniqueDrivers: 5,
        uniqueClasses: 2,
        sessions: [],
      },
    ]

    vi.mocked(discoverPracticeDays.discoverPracticeDays).mockResolvedValueOnce({
      practiceDays: mockPracticeDays,
    })

    const request = new NextRequest("http://localhost/api/v1/practice-days/discover", {
      method: "POST",
      body: JSON.stringify({
        track_id: "test-track",
        start_date: "2025-01-01",
        end_date: "2025-01-31",
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.practiceDays).toEqual(mockPracticeDays)
  })
})
