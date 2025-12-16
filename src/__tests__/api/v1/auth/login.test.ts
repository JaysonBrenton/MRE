/**
 * @fileoverview Tests for login API route response format
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Tests for API route response format validation
 * 
 * @purpose Validates that the login API route returns responses in the
 *          standardized format defined in the mobile-safe architecture guidelines.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/v1/auth/login/route"
import { authenticateUser } from "@/core/auth/login"
import { NextRequest } from "next/server"

// Mock the core function
vi.mock("@/core/auth/login")

describe("POST /api/v1/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("response format validation", () => {
    it("should return success response in standardized format", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        driverName: "Test Driver",
        teamName: "Test Team",
        isAdmin: false,
      }

      vi.mocked(authenticateUser).mockResolvedValue({
        success: true,
        user: mockUser,
      })

      const request = new NextRequest("http://localhost:3001/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toHaveProperty("success", true)
      expect(body).toHaveProperty("data")
      expect(body).toHaveProperty("message", "Login successful")
      expect(body.data).toHaveProperty("user")
      expect(body.data.user).toEqual(mockUser)
    })

    it("should return error response in standardized format for invalid credentials", async () => {
      vi.mocked(authenticateUser).mockResolvedValue({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        },
      })

      const request = new NextRequest("http://localhost:3001/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "wrongpassword",
        }),
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body).toHaveProperty("success", false)
      expect(body).toHaveProperty("error")
      expect(body.error).toHaveProperty("code", "INVALID_CREDENTIALS")
      expect(body.error).toHaveProperty("message", "Invalid email or password")
    })

    it("should return error response for invalid JSON", async () => {
      const request = new NextRequest("http://localhost:3001/api/v1/auth/login", {
        method: "POST",
        body: "invalid json",
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toHaveProperty("success", false)
      expect(body).toHaveProperty("error")
      expect(body.error).toHaveProperty("code", "INVALID_REQUEST")
      expect(body.error).toHaveProperty("message", "Invalid JSON in request body")
    })

    it("should return error response for missing fields", async () => {
      const request = new NextRequest("http://localhost:3001/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
        }),
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(400)
      expect(body).toHaveProperty("success", false)
      expect(body).toHaveProperty("error")
      expect(body.error).toHaveProperty("code", "VALIDATION_ERROR")
    })

    it("should return server error response for unexpected errors", async () => {
      vi.mocked(authenticateUser).mockRejectedValue(new Error("Unexpected error"))

      const request = new NextRequest("http://localhost:3001/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body).toHaveProperty("success", false)
      expect(body).toHaveProperty("error")
      expect(body.error).toHaveProperty("code", "INTERNAL_ERROR")
    })
  })
})

