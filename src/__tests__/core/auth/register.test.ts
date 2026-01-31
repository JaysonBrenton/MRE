/**
 * @fileoverview Tests for user registration core logic
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Tests for registration business logic
 *
 * @purpose Validates registration logic including success cases, validation errors,
 *          and duplicate email handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { registerUser } from "@/core/auth/register"
import { findUserByEmail, createUser } from "@/core/users/repo"
import { validateRegisterInput } from "@/core/auth/validate-register"
import argon2 from "argon2"
import { z } from "zod"

// Mock dependencies
vi.mock("@/core/users/repo")
vi.mock("@/core/auth/validate-register")
vi.mock("argon2")

describe("registerUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("successful registration", () => {
    it("should register a new user successfully", async () => {
      const mockInput = {
        email: "test@example.com",
        password: "password123",
        driverName: "Test Driver",
        teamName: "Test Team",
      }

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

      vi.mocked(validateRegisterInput).mockReturnValue(mockInput)
      vi.mocked(findUserByEmail).mockResolvedValue(null)
      vi.mocked(argon2.hash).mockResolvedValue("hashed-password")
      vi.mocked(createUser).mockResolvedValue(mockUser)

      const result = await registerUser(mockInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.user).toEqual(mockUser)
        expect(result.user).not.toHaveProperty("passwordHash")
      }
      expect(validateRegisterInput).toHaveBeenCalledWith(mockInput)
      expect(findUserByEmail).toHaveBeenCalledWith(mockInput.email)
      expect(argon2.hash).toHaveBeenCalledWith(mockInput.password)
      expect(createUser).toHaveBeenCalledWith({
        email: mockInput.email,
        passwordHash: "hashed-password",
        driverName: mockInput.driverName,
        teamName: mockInput.teamName,
        isAdmin: false,
        transponderNumber: null,
      })
    })

    it("should register user without teamName", async () => {
      const mockInput = {
        email: "test@example.com",
        password: "password123",
        driverName: "Test Driver",
      }

      const mockUser = {
        id: "user-123",
        email: "test@example.com",
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

      vi.mocked(validateRegisterInput).mockReturnValue(mockInput)
      vi.mocked(findUserByEmail).mockResolvedValue(null)
      vi.mocked(argon2.hash).mockResolvedValue("hashed-password")
      vi.mocked(createUser).mockResolvedValue(mockUser)

      const result = await registerUser(mockInput)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.user.teamName).toBeNull()
      }
    })
  })

  describe("validation errors", () => {
    it("should return validation error for invalid input", async () => {
      const mockInput = {
        email: "invalid-email",
        password: "short",
        driverName: "",
      }

      const zodError = new z.ZodError([
        { code: "custom", message: "Invalid email address", path: ["email"] },
      ])

      vi.mocked(validateRegisterInput).mockImplementation(() => {
        throw zodError
      })

      const result = await registerUser(mockInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("VALIDATION_ERROR")
        expect(result.error.message).toBe("Invalid email address")
      }
      expect(findUserByEmail).not.toHaveBeenCalled()
      expect(createUser).not.toHaveBeenCalled()
    })
  })

  describe("duplicate email", () => {
    it("should return error when email already exists", async () => {
      const mockInput = {
        email: "existing@example.com",
        password: "password123",
        driverName: "Test Driver",
      }

      const existingUser = {
        id: "existing-user",
        email: "existing@example.com",
        passwordHash: "existing-hash",
        driverName: "Existing User",
        normalizedName: null,
        teamName: null,
        isAdmin: false,
        isTeamManager: false,
        personaId: null,
        transponderNumber: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(validateRegisterInput).mockReturnValue(mockInput)
      vi.mocked(findUserByEmail).mockResolvedValue(existingUser)

      const result = await registerUser(mockInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("EMAIL_ALREADY_EXISTS")
        expect(result.error.message).toBe("Email already registered")
      }
      expect(argon2.hash).not.toHaveBeenCalled()
      expect(createUser).not.toHaveBeenCalled()
    })

    it("should return error for Prisma unique constraint violation", async () => {
      const mockInput = {
        email: "test@example.com",
        password: "password123",
        driverName: "Test Driver",
      }

      vi.mocked(validateRegisterInput).mockReturnValue(mockInput)
      vi.mocked(findUserByEmail).mockResolvedValue(null)
      vi.mocked(argon2.hash).mockResolvedValue("hashed-password")
      vi.mocked(createUser).mockRejectedValue({ code: "P2002" })

      const result = await registerUser(mockInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("EMAIL_ALREADY_EXISTS")
        expect(result.error.message).toBe("Email already registered")
      }
    })
  })

  describe("database errors", () => {
    it("should handle database connection errors", async () => {
      const mockInput = {
        email: "test@example.com",
        password: "password123",
        driverName: "Test Driver",
      }

      vi.mocked(validateRegisterInput).mockReturnValue(mockInput)
      vi.mocked(findUserByEmail).mockResolvedValue(null)
      vi.mocked(argon2.hash).mockResolvedValue("hashed-password")
      vi.mocked(createUser).mockRejectedValue({ code: "P1001" })

      const result = await registerUser(mockInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("DATABASE_ERROR")
        expect(result.error.message).toContain("Database connection failed")
      }
    })

    it("should handle other Prisma errors", async () => {
      const mockInput = {
        email: "test@example.com",
        password: "password123",
        driverName: "Test Driver",
      }

      vi.mocked(validateRegisterInput).mockReturnValue(mockInput)
      vi.mocked(findUserByEmail).mockResolvedValue(null)
      vi.mocked(argon2.hash).mockResolvedValue("hashed-password")
      vi.mocked(createUser).mockRejectedValue({ code: "P2003" })

      const result = await registerUser(mockInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("DATABASE_ERROR")
        expect(result.error.message).toBe("Database error occurred. Please try again.")
      }
    })
  })

  describe("internal errors", () => {
    it("should handle unexpected errors", async () => {
      const mockInput = {
        email: "test@example.com",
        password: "password123",
        driverName: "Test Driver",
      }

      vi.mocked(validateRegisterInput).mockReturnValue(mockInput)
      vi.mocked(findUserByEmail).mockRejectedValue(new Error("Unexpected error"))

      const result = await registerUser(mockInput)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("INTERNAL_ERROR")
        expect(result.error.message).toBe("Failed to register user")
      }
    })
  })
})
