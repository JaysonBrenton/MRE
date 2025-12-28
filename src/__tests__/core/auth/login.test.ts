/**
 * @fileoverview Tests for user login authentication logic
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Tests for authentication business logic
 * 
 * @purpose Validates login logic including success cases and invalid credentials handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { authenticateUser } from "@/core/auth/login"
import { findUserByEmail } from "@/core/users/repo"
import argon2 from "argon2"

// Mock dependencies
vi.mock("@/core/users/repo")
vi.mock("argon2")

describe("authenticateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("successful authentication", () => {
    it("should authenticate user with valid credentials", async () => {
      const mockInput = {
        email: "test@example.com",
        password: "password123",
      }

      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        passwordHash: "hashed-password",
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

      vi.mocked(findUserByEmail).mockResolvedValue(mockUser)
      vi.mocked(argon2.verify).mockResolvedValue(true)

      const result = await authenticateUser(mockInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.user).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          driverName: mockUser.driverName,
          teamName: mockUser.teamName,
          isAdmin: mockUser.isAdmin,
        })
        expect(result.user).not.toHaveProperty("passwordHash")
      }
      expect(findUserByEmail).toHaveBeenCalledWith("test@example.com")
      expect(argon2.verify).toHaveBeenCalledWith("hashed-password", "password123")
    })

    it("should normalize email to lowercase", async () => {
      const mockInput = {
        email: "TEST@EXAMPLE.COM",
        password: "password123",
      }

      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        passwordHash: "hashed-password",
        driverName: "Test Driver",
        normalizedName: null,
        teamName: null,
        isAdmin: false,
        isTeamManager: false,
        personaId: null,
        transponderNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(findUserByEmail).mockResolvedValue(mockUser)
      vi.mocked(argon2.verify).mockResolvedValue(true)

      const result = await authenticateUser(mockInput)

      expect(result.success).toBe(true)
      expect(findUserByEmail).toHaveBeenCalledWith("test@example.com")
    })

    it("should handle admin users", async () => {
      const mockInput = {
        email: "admin@example.com",
        password: "password123",
      }

      const mockUser = {
        id: "admin-123",
        email: "admin@example.com",
        passwordHash: "hashed-password",
        driverName: "Admin User",
        normalizedName: null,
        teamName: null,
        isAdmin: true,
        isTeamManager: false,
        personaId: null,
        transponderNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(findUserByEmail).mockResolvedValue(mockUser)
      vi.mocked(argon2.verify).mockResolvedValue(true)

      const result = await authenticateUser(mockInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.user.isAdmin).toBe(true)
      }
    })
  })

  describe("invalid credentials", () => {
    it("should return error when email is missing", async () => {
      const mockInput = {
        email: "",
        password: "password123",
      }

      const result = await authenticateUser(mockInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_INPUT")
        expect(result.error.message).toBe("Email and password are required")
      }
      expect(findUserByEmail).not.toHaveBeenCalled()
      expect(argon2.verify).not.toHaveBeenCalled()
    })

    it("should return error when password is missing", async () => {
      const mockInput = {
        email: "test@example.com",
        password: "",
      }

      const result = await authenticateUser(mockInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_INPUT")
        expect(result.error.message).toBe("Email and password are required")
      }
      expect(findUserByEmail).not.toHaveBeenCalled()
      expect(argon2.verify).not.toHaveBeenCalled()
    })

    it("should return error when user does not exist", async () => {
      const mockInput = {
        email: "nonexistent@example.com",
        password: "password123",
      }

      vi.mocked(findUserByEmail).mockResolvedValue(null)

      const result = await authenticateUser(mockInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_CREDENTIALS")
        expect(result.error.message).toBe("Invalid email or password")
      }
      expect(argon2.verify).not.toHaveBeenCalled()
    })

    it("should return error when password is incorrect", async () => {
      const mockInput = {
        email: "test@example.com",
        password: "wrongpassword",
      }

      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        passwordHash: "hashed-password",
        driverName: "Test Driver",
        normalizedName: null,
        teamName: null,
        isAdmin: false,
        isTeamManager: false,
        personaId: null,
        transponderNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(findUserByEmail).mockResolvedValue(mockUser)
      vi.mocked(argon2.verify).mockResolvedValue(false)

      const result = await authenticateUser(mockInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("INVALID_CREDENTIALS")
        expect(result.error.message).toBe("Invalid email or password")
      }
      expect(argon2.verify).toHaveBeenCalledWith("hashed-password", "wrongpassword")
    })
  })
})

