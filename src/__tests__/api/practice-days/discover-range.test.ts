/**
 * @fileoverview Tests for practice day discover-range API route
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"
import { POST } from "@/app/api/v1/practice-days/discover-range/route"
import { NextRequest } from "next/server"
import * as discoverPracticeDays from "@/core/practice-days/discover-practice-days"
import type { PracticeDaySummary } from "@/core/practice-days/types"

vi.mock("@/core/practice-days/discover-practice-days", () => ({
  discoverPracticeDaysRange: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: "test-user" } })),
}))

describe("POST /api/v1/practice-days/discover-range", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 401 if not authenticated", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth as Mock).mockResolvedValueOnce(null)

    const request = new NextRequest("http://localhost/api/v1/practice-days/discover-range", {
      method: "POST",
      body: JSON.stringify({
        track_id: "test-track",
        start_date: "2025-01-01",
        end_date: "2025-12-31",
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe("UNAUTHORIZED")
  })

  it("should return 400 if start_date or end_date missing", async () => {
    const request = new NextRequest("http://localhost/api/v1/practice-days/discover-range", {
      method: "POST",
      body: JSON.stringify({
        track_id: "test-track",
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe("VALIDATION_ERROR")
  })

  it("should return 400 if start_date is after end_date", async () => {
    const request = new NextRequest("http://localhost/api/v1/practice-days/discover-range", {
      method: "POST",
      body: JSON.stringify({
        track_id: "test-track",
        start_date: "2025-12-31",
        end_date: "2025-01-01",
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error.code).toBe("VALIDATION_ERROR")
  })

  it("should successfully discover practice days for range", async () => {
    const mockPracticeDays: PracticeDaySummary[] = [
      {
        date: "2025-06-15",
        trackSlug: "testtrack",
        sessionCount: 4,
        totalLaps: 120,
        totalTrackTimeSeconds: 3600,
        uniqueDrivers: 3,
        uniqueClasses: 2,
        sessions: [
          {
            sessionId: "1",
            driverName: "Driver",
            className: "Stock",
            startTime: "2025-06-15T10:00:00Z",
            durationSeconds: 600,
            lapCount: 30,
            sessionUrl: "https://example.com/s/1",
          },
        ],
      },
    ]

    vi.mocked(discoverPracticeDays.discoverPracticeDaysRange).mockResolvedValueOnce({
      practiceDays: mockPracticeDays,
    })

    const request = new NextRequest("http://localhost/api/v1/practice-days/discover-range", {
      method: "POST",
      body: JSON.stringify({
        track_id: "test-track",
        track_slug: "testtrack",
        start_date: "2025-01-01",
        end_date: "2025-12-31",
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.practice_days).toHaveLength(1)
    expect(data.data.practice_days[0]).toMatchObject({
      date: "2025-06-15",
      trackSlug: "testtrack",
      sessionCount: 4,
      totalLaps: 120,
      totalTrackTimeSeconds: 3600,
      uniqueDrivers: 3,
      uniqueClasses: 2,
    })
    expect(data.data.practice_days[0]).not.toHaveProperty("sessions")
  })
})
