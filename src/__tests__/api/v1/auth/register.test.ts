/**
 * @fileoverview Tests for registration API route response format
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Tests for API route response format validation
 * 
 * @purpose Validates that the registration API route returns responses in the
 *          standardized format defined in the mobile-safe architecture guidelines.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/v1/auth/register/route"
import { registerUser } from "@/core/auth/register"
import { NextRequest } from "next/server"

// Mock the core function
vi.mock("@/core/auth/register")

describe("POST /api/v1/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("response format validation", () => {
    it("should return success response in standardized format", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        driverName: "Test Driver",
        normalizedName: null,
        teamName: "Test Team",
        isAdmin: false,
        isTeamManager: false,
        personaId: null,
        transponderNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(registerUser).mockResolvedValue({
        success: true,
        user: mockUser,
      })

      const request = new NextRequest("http://localhost:3001/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
          driverName: "Test Driver",
          teamName: "Test Team",
        }),
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(201)
      expect(body).toHaveProperty("success", true)
      expect(body).toHaveProperty("data")
      expect(body).toHaveProperty("message", "Registration successful")
      expect(body.data).toHaveProperty("user")
      expect(body.data.user).toEqual({
        ...mockUser,
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      })
    })

    it("should return error response in standardized format", async () => {
      vi.mocked(registerUser).mockResolvedValue({
        success: false,
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "Email already registered",
        },
      })

      const request = new NextRequest("http://localhost:3001/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "existing@example.com",
          password: "password123",
          driverName: "Test Driver",
        }),
      })

      const response = await POST(request)
      const body = await response.json()

      expect(response.status).toBe(409)
      expect(body).toHaveProperty("success", false)
      expect(body).toHaveProperty("error")
      expect(body.error).toHaveProperty("code", "EMAIL_ALREADY_EXISTS")
      expect(body.error).toHaveProperty("message", "Email already registered")
    })

    it("should return error response for invalid JSON", async () => {
      const request = new NextRequest("http://localhost:3001/api/v1/auth/register", {
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

    it("should return server error response for unexpected errors", async () => {
      vi.mocked(registerUser).mockRejectedValue(new Error("Unexpected error"))

      const request = new NextRequest("http://localhost:3001/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
          driverName: "Test Driver",
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
