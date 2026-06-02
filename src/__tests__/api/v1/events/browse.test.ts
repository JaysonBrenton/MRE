/**
 * @fileoverview Tests for event browse API route
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/v1/events/browse/route"
import { browseEvents } from "@/core/events/browse-events"
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

vi.mock("@/core/events/browse-events")

describe("GET /api/v1/events/browse", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns paginated events in standardized format", async () => {
    vi.mocked(browseEvents).mockResolvedValue({
      events: [
        {
          id: "event-1",
          source: "liverc",
          sourceEventId: "12345",
          eventName: "Test Event",
          eventDate: "2025-01-15T00:00:00.000Z",
          eventEntries: 50,
          eventDrivers: 45,
          eventUrl: "https://liverc.com/event/12345",
          ingestDepth: "laps_full",
          lastIngestedAt: null,
          trackId: "track-1",
          trackName: "Test Track",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    })

    const request = new NextRequest(
      "http://localhost:3001/api/v1/events/browse?start_date=2025-01-01&end_date=2025-01-31&page=1&page_size=50"
    )
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.events).toHaveLength(1)
    expect(body.data.total).toBe(1)
    expect(body.data.page).toBe(1)
    expect(body.data.page_size).toBe(50)
  })

  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@/lib/auth")
    vi.mocked(auth).mockResolvedValueOnce(null)

    const request = new NextRequest("http://localhost:3001/api/v1/events/browse")
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.success).toBe(false)
  })
})
