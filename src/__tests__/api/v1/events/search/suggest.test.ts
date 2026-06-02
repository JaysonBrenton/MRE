/**
 * @fileoverview Tests for the Event Search suggest API route.
 *
 * @description Validates authentication, parameter passing, and standardized
 *              response shape for GET /api/v1/events/search/suggest.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/v1/events/search/suggest/route"
import { suggestEventSearch } from "@/core/events/suggest-event-search"
import { auth } from "@/lib/auth"
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

vi.mock("@/core/events/suggest-event-search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/events/suggest-event-search")>()
  return {
    ...actual,
    suggestEventSearch: vi.fn(),
  }
})

const mockedSuggest = vi.mocked(suggestEventSearch)
const mockedAuth = vi.mocked(auth)

describe("GET /api/v1/events/search/suggest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    mockedAuth.mockResolvedValueOnce(null as never)

    const request = new NextRequest("http://localhost:3001/api/v1/events/search/suggest?q=round")
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error.code).toBe("UNAUTHORIZED")
    expect(mockedSuggest).not.toHaveBeenCalled()
  })

  it("returns grouped suggestions in standardized format", async () => {
    mockedSuggest.mockResolvedValue({
      query: "round",
      tracks: [
        {
          id: "trk-1",
          trackName: "Canberra Off Road",
          sourceTrackSlug: "canberra",
          city: "Canberra",
          state: "ACT",
          country: "Australia",
        },
      ],
      events: [
        {
          id: "evt-1",
          eventName: "Round 5",
          eventDate: "2026-05-30T00:00:00.000Z",
          trackId: "trk-1",
          trackName: "Canberra Off Road",
          ingestDepth: "laps_full",
        },
      ],
    })

    const request = new NextRequest(
      "http://localhost:3001/api/v1/events/search/suggest?q=round&limit=5"
    )
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockedSuggest).toHaveBeenCalledWith("round", 5)
    expect(body.data.tracks).toHaveLength(1)
    expect(body.data.events[0].eventName).toBe("Round 5")
  })

  it("passes undefined limit when not provided", async () => {
    mockedSuggest.mockResolvedValue({ query: "round", tracks: [], events: [] })

    const request = new NextRequest("http://localhost:3001/api/v1/events/search/suggest?q=round")
    await GET(request)

    expect(mockedSuggest).toHaveBeenCalledWith("round", undefined)
  })

  it("defaults the query to empty string when q is absent", async () => {
    mockedSuggest.mockResolvedValue({ query: "", tracks: [], events: [] })

    const request = new NextRequest("http://localhost:3001/api/v1/events/search/suggest")
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(mockedSuggest).toHaveBeenCalledWith("", undefined)
  })
})
