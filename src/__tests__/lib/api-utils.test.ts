/**
 * @fileoverview Tests for API response utilities
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Tests for standardized API response format helpers
 *
 * @purpose Validates that API response helpers return the correct format
 *          as defined in the architecture guidelines.
 */

import { describe, it, expect } from "vitest"
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  rateLimitResponse,
} from "@/lib/api-utils"

describe("api-utils", () => {
  describe("successResponse", () => {
    it("should return success response with data", async () => {
      const response = successResponse({ user: { id: "123", email: "test@example.com" } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toEqual({
        success: true,
        data: { user: { id: "123", email: "test@example.com" } },
      })
    })

    it("should include optional message", async () => {
      const response = successResponse({ tracks: [] }, 200, "Tracks retrieved successfully")
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toEqual({
        success: true,
        data: { tracks: [] },
        message: "Tracks retrieved successfully",
      })
    })

    it("should use custom status code", async () => {
      const response = successResponse({ user: { id: "123" } }, 201)
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body.success).toBe(true)
    })
  })

  describe("errorResponse", () => {
    it("should return error response with code and message", async () => {
      const response = errorResponse("VALIDATION_ERROR", "Invalid input")
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
        },
      })
    })

    it("should include optional details", async () => {
      const response = errorResponse("VALIDATION_ERROR", "Invalid input", { field: "email" }, 400)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toEqual({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: { field: "email" },
        },
      })
    })

    it("should use custom status code", async () => {
      const response = errorResponse("NOT_FOUND", "Resource not found", undefined, 404)
      const body = await response.json()

      expect(response.status).toBe(404)
      expect(body.success).toBe(false)
      expect(body.error.code).toBe("NOT_FOUND")
    })
  })

  describe("serverErrorResponse", () => {
    it("should return server error response with default message", async () => {
      const response = serverErrorResponse()
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body).toEqual({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
        },
      })
    })

    it("should use custom message", async () => {
      const response = serverErrorResponse("Database connection failed")
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error.message).toBe("Database connection failed")
    })

    it("should use custom status code", async () => {
      const response = serverErrorResponse("Service unavailable", 503)
      const body = await response.json()

      expect(response.status).toBe(503)
      expect(body.error.code).toBe("INTERNAL_ERROR")
    })
  })

  describe("rateLimitResponse", () => {
    it("should return 429 status with default message", async () => {
      const response = rateLimitResponse(60)
      const body = await response.json()

      expect(response.status).toBe(429)
      expect(body).toEqual({
        success: false,
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many requests. Please try again later.",
          details: {
            retryAfterSeconds: 60,
          },
        },
      })
    })

    it("should include Retry-After header", async () => {
      const response = rateLimitResponse(120)

      expect(response.headers.get("Retry-After")).toBe("120")
    })

    it("should include X-RateLimit-Reset header", async () => {
      const response = rateLimitResponse(60)
      const resetHeader = response.headers.get("X-RateLimit-Reset")

      expect(resetHeader).toBeDefined()
      const resetTime = parseInt(resetHeader!, 10)
      const now = Math.floor(Date.now() / 1000)
      expect(resetTime).toBeGreaterThanOrEqual(now)
      expect(resetTime).toBeLessThanOrEqual(now + 61) // Allow 1 second tolerance
    })

    it("should use custom message", async () => {
      const response = rateLimitResponse(30, "Custom rate limit message")
      const body = await response.json()

      expect(body.error.message).toBe("Custom rate limit message")
    })
  })
})
