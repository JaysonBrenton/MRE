/**
 * @fileoverview Tests for GET /api/v1/admin/ingestion/settings
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/v1/admin/ingestion/settings/route"

vi.mock("@/lib/admin-auth", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/core/admin/ingestion-settings", () => ({
  listAdminIngestionSettings: vi.fn(),
  patchAdminIngestionSettings: vi.fn(),
}))

vi.mock("@/lib/request-context", () => ({
  generateRequestId: () => "test-request-id",
}))

vi.mock("@/lib/server-error-handler", () => ({
  handleApiError: (error: unknown) => ({
    code: "INTERNAL_ERROR",
    message: error instanceof Error ? error.message : "Unknown error",
    statusCode: 500,
  }),
}))

import { requireAdmin } from "@/lib/admin-auth"
import { listAdminIngestionSettings } from "@/core/admin/ingestion-settings"

describe("GET /api/v1/admin/ingestion/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      authorized: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        }),
        { status: 401 }
      ),
    })

    const request = new NextRequest("http://localhost:3001/api/v1/admin/ingestion/settings")
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it("returns 403 when not admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      authorized: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: { code: "FORBIDDEN", message: "Admin access required" },
        }),
        { status: 403 }
      ),
    })

    const request = new NextRequest("http://localhost:3001/api/v1/admin/ingestion/settings")
    const response = await GET(request)
    expect(response.status).toBe(403)
  })

  it("returns settings for admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      authorized: true,
      userId: "admin-1",
    })
    vi.mocked(listAdminIngestionSettings).mockResolvedValue({
      settings: [
        {
          key: "MRE_SCRAPE_ENABLED",
          label: "LiveRC scraping enabled",
          description: "Kill switch",
          category: "scraping_safety",
          type: "boolean",
          applyMode: "runtime",
          scope: "both",
          writable: true,
          effectiveValue: true,
          source: "default",
          envValue: null,
          dbValue: null,
          defaultValue: true,
          pendingRestart: false,
        },
      ],
      categories: [{ id: "scraping_safety", label: "Scraping and safety" }],
      writable: true,
    })

    const request = new NextRequest("http://localhost:3001/api/v1/admin/ingestion/settings")
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.settings).toHaveLength(1)
  })
})
