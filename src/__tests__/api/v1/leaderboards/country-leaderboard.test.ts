/**
 * @fileoverview Tests for country leaderboard API route
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/v1/leaderboards/country/route"
import { getCountryLeaderboard } from "@/core/leaderboards/get-country-leaderboard"

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

vi.mock("@/core/leaderboards/get-country-leaderboard")

describe("GET /api/v1/leaderboards/country", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCountryLeaderboard).mockResolvedValue({
      countryQuery: "Australia",
      year: 2026,
      rows: [],
      totalCount: 0,
      classes: [],
    })
  })

  it("should return 401 if not authenticated", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce(null)

    const request = new NextRequest("http://localhost/api/v1/leaderboards/country?country=AU")
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe("UNAUTHORIZED")
  })

  it("should return 400 when country is missing", async () => {
    const request = new NextRequest("http://localhost/api/v1/leaderboards/country")
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })

  it("should return success with leaderboard data", async () => {
    const mockData = {
      countryQuery: "Australia",
      year: 2026,
      rows: [
        {
          driverId: "d1",
          driverName: "Driver 1",
          className: "1/8 Nitro Buggy",
          points: 25,
          wins: 1,
          podiums: 0,
          eventsCount: 1,
        },
      ],
      totalCount: 1,
      classes: ["1/8 Nitro Buggy"],
    }
    vi.mocked(getCountryLeaderboard).mockResolvedValueOnce(mockData)

    const request = new NextRequest(
      "http://localhost/api/v1/leaderboards/country?country=Australia&year=2026&class_name=1%2F8%20Nitro%20Buggy"
    )
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toEqual({
      country: "Australia",
      year: 2026,
      total: 1,
      rows: mockData.rows,
      classes: ["1/8 Nitro Buggy"],
    })
    expect(getCountryLeaderboard).toHaveBeenCalledWith(
      expect.objectContaining({
        countryQuery: "Australia",
        year: 2026,
        className: "1/8 Nitro Buggy",
      })
    )
  })
})
