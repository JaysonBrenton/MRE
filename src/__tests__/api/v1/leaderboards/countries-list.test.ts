/**
 * @fileoverview Tests for countries list API route
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/v1/leaderboards/countries/route"

const mockFindMany = vi.fn()

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-123" } })),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    track: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
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

describe("GET /api/v1/leaderboards/countries", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindMany.mockResolvedValue([
      { country: "Australia" },
      { country: "United States" },
      { country: "Australia" },
    ])
  })

  it("should return 401 if not authenticated", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce(null)

    const request = new NextRequest("http://localhost/api/v1/leaderboards/countries")
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe("UNAUTHORIZED")
  })

  it("should return sorted unique list of countries", async () => {
    const request = new NextRequest("http://localhost/api/v1/leaderboards/countries")
    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.countries).toEqual(["Australia", "United States"])
    expect(mockFindMany).toHaveBeenCalled()
  })
})
