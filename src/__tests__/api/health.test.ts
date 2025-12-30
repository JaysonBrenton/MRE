/**
 * @fileoverview Tests for health check API endpoint
 * 
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 * 
 * @description Tests for health endpoint response format
 * 
 * @purpose Validates that the health endpoint returns responses in the
 *          standardized format defined in the architecture guidelines.
 */

import { describe, it, expect } from "vitest"
import { GET } from "@/app/api/health/route"

describe("GET /api/health", () => {
  describe("response format validation", () => {
    it("should return success response in standardized format", async () => {
      const response = await GET()
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toHaveProperty("success", true)
      expect(body).toHaveProperty("data")
      expect(body).toHaveProperty("message", "Service is healthy")
      expect(body.data).toHaveProperty("status", "healthy")
      expect(body.data).toHaveProperty("timestamp")
    })

    it("should include timestamp in response", async () => {
      const response = await GET()
      const body = await response.json()

      expect(body.data.timestamp).toBeDefined()
      expect(typeof body.data.timestamp).toBe("string")
      // Verify it's a valid ISO date string
      expect(() => new Date(body.data.timestamp)).not.toThrow()
    })
  })
})
