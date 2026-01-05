/**
 * @fileoverview User registration business logic
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Handles user registration workflow including validation,
 *              password hashing, and user creation
 *
 * @purpose This file contains the core business logic for user registration,
 *          following the mobile-safe architecture requirement that business
 *          logic must reside in src/core/<domain>/. This logic can be reused
 *          by API routes, server actions, and future mobile clients.
 *
 * @relatedFiles
 * - src/core/auth/validate-register.ts (validation logic)
 * - src/core/users/repo.ts (database access)
 * - src/lib/api-utils.ts (API response helpers)
 */

import argon2 from "argon2"
import { z } from "zod"
import { validateRegisterInput, type RegisterInput } from "./validate-register"
import { findUserByEmail } from "../users/repo"
import type { User } from "@prisma/client"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { getPersonaByType } from "../personas/repo"
import { normalizeEmail } from "../common/email"
import { normalizeDriverName } from "../users/name-normalizer"

/**
 * Type guard to check if error is a ZodError
 */
function isZodError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError
}

/**
 * Type guard to check if error is a Prisma error with a code property
 */
function isPrismaError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  )
}

/**
 * Result type for registration operation
 */
export type RegisterResult =
  | {
      success: true
      user: Omit<User, "passwordHash">
    }
  | {
      success: false
      error: {
        code: string
        message: string
      }
    }

/**
 * Registers a new user account
 *
 * This function handles the complete registration workflow:
 * 1. Validates input data
 * 2. Checks if user already exists
 * 3. Hashes password
 * 4. Creates user account (explicitly sets isAdmin to false for security)
 *
 * @param input - Registration input data
 * @returns Registration result with user data or error
 *
 * @example
 * ```typescript
 * const result = await registerUser({
 *   email: "user@example.com",
 *   password: "securePassword123",
 *   driverName: "John Doe",
 *   teamName: "Team Alpha"
 * })
 *
 * if (result.success) {
 *   console.log("User created:", result.user)
 * } else {
 *   console.error("Registration failed:", result.error.message)
 * }
 * ```
 */
export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  try {
    // Validate input
    const validatedData = validateRegisterInput(input)

    // Check if user already exists
    const existingUser = await findUserByEmail(validatedData.email)
    if (existingUser) {
      return {
        success: false,
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "Email already registered",
        },
      }
    }

    // Hash password using Argon2id (required by mobile-safe architecture guidelines)
    const passwordHash = await argon2.hash(validatedData.password)

    // Get Driver persona (needed for transaction)
    const driverPersona = await getPersonaByType("driver")
    if (!driverPersona) {
      logger.error("Driver persona not found in database")
      throw new Error("Driver persona not found")
    }

    // Normalize email and driver name (matching createUser logic)
    const normalizedEmail = normalizeEmail(validatedData.email)
    const normalizedName = normalizeDriverName(validatedData.driverName)

    // Create user and assign persona in a transaction to ensure atomicity
    // If persona assignment fails, user creation is rolled back
    const user = await prisma.$transaction(async (tx) => {
      // Create user (explicitly set isAdmin to false to prevent privilege escalation)
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          driverName: validatedData.driverName,
          normalizedName,
          teamName: validatedData.teamName || null,
          isAdmin: false, // Security requirement: admin accounts cannot be created via registration
          transponderNumber: null, // Users can add this later if needed
          personaId: driverPersona.id, // Assign persona in same transaction
        },
        select: {
          id: true,
          email: true,
          driverName: true,
          teamName: true,
          isAdmin: true,
          personaId: true,
          transponderNumber: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      logger.info("User created and Driver persona assigned in transaction", {
        userId: newUser.id,
        personaId: driverPersona.id,
      })

      return newUser
    })

    return {
      success: true,
      user,
    }
  } catch (error: unknown) {
    // Handle validation errors using type guard
    if (isZodError(error)) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message || "Validation failed",
        },
      }
    }

    // Handle database errors using type guard
    if (isPrismaError(error)) {
      // Unique constraint violation (duplicate email)
      if (error.code === "P2002") {
        return {
          success: false,
          error: {
            code: "EMAIL_ALREADY_EXISTS",
            message: "Email already registered",
          },
        }
      }

      // Database connection errors
      if (error.code === "P1001" || error.code === "P1000") {
        logger.error("Database connection error during registration", {
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : String(error),
        })
        return {
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Database connection failed. Please try again later.",
          },
        }
      }

      // Other Prisma errors
      const prismaError = error as { code: string; message?: string }
      logger.error("Prisma error during registration", {
        code: prismaError.code,
        error: prismaError.message || "Unknown Prisma error",
      })
      return {
        success: false,
        error: {
          code: "DATABASE_ERROR",
          message: "Database error occurred. Please try again.",
        },
      }
    }

    // Log unexpected errors with full details
    logger.error("Registration error", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to register user",
      },
    }
  }
}
