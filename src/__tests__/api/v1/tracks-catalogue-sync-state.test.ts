/**
 * @fileoverview Tests for GET /api/v1/tracks/catalogue-sync-state
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/v1/tracks/catalogue-sync-state/route"
import { getTrackCatalogueSyncState } from "@/core/tracks/repo"
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
  getClientIp: () => "test",
  getRequestContext: () => ({}),
}))

vi.mock("@/core/tracks/repo", () => ({
  getTrackCatalogueSyncState: vi.fn(),
}))

describe("GET /api/v1/tracks/catalogue-sync-state", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns completedAt ISO string when row exists", async () => {
    const completedAt = new Date("2026-04-06T07:23:38.698Z")
    vi.mocked(getTrackCatalogueSyncState).mockResolvedValue({ completedAt })

    const request = new NextRequest("http://localhost:3001/api/v1/tracks/catalogue-sync-state")
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.completedAt).toBe(completedAt.toISOString())
  })

  it("returns completedAt null when never synced", async () => {
    vi.mocked(getTrackCatalogueSyncState).mockResolvedValue({ completedAt: null })

    const request = new NextRequest("http://localhost:3001/api/v1/tracks/catalogue-sync-state")
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.completedAt).toBeNull()
  })
})
