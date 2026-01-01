/**
 * @fileoverview User login authentication logic
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Handles user authentication workflow including credential
 *              validation and password verification
 * 
 * @purpose This file contains the core business logic for user authentication,
 *          following the mobile-safe architecture requirement that business
 *          logic must reside in src/core/<domain>/. This logic can be reused
 *          by NextAuth providers, API routes, and future mobile clients.
 * 
 * @relatedFiles
 * - src/core/users/repo.ts (user database access)
 * - src/lib/auth.ts (NextAuth configuration)
 */

import argon2 from "argon2"
import { findUserByEmail } from "../users/repo"
import { normalizeEmail } from "../common/email"
import { logger } from "@/lib/logger"

/**
 * Login input type
 */
export type LoginInput = {
  email: string
  password: string
}

/**
 * Authenticated user data (without password hash)
 */
export type AuthenticatedUser = {
  id: string
  email: string
  driverName: string
  teamName: string | null
  isAdmin: boolean
}

/**
 * Result type for login operation
 */
export type LoginResult = {
  success: true
  user: AuthenticatedUser
} | {
  success: false
  error: {
    code: string
    message: string
  }
}

/**
 * Authenticates a user with email and password
 * 
 * This function handles the complete authentication workflow:
 * 1. Validates input (email and password provided)
 * 2. Finds user by email
 * 3. Verifies password hash
 * 4. Returns user data if authentication succeeds
 * 
 * @param input - Login credentials (email and password)
 * @returns Authentication result with user data or error
 * 
 * @example
 * ```typescript
 * const result = await authenticateUser({
 *   email: "user@example.com",
 *   password: "userPassword123"
 * })
 * 
 * if (result.success) {
 *   console.log("User authenticated:", result.user)
 * } else {
 *   console.error("Authentication failed:", result.error.message)
 * }
 * ```
 */
export async function authenticateUser(input: LoginInput): Promise<LoginResult> {
  // Validate input
  if (!input.email || !input.password) {
    return {
      success: false,
      error: {
        code: "INVALID_INPUT",
        message: "Email and password are required"
      }
    }
  }

  // Normalize email to lowercase for consistent lookup
  // Emails should be case-insensitive per RFC 5321
  const normalizedEmail = normalizeEmail(input.email)

  // Find user by email
  const user = await findUserByEmail(normalizedEmail)
  if (!user) {
    // Log for debugging (email is already normalized, safe to log)
    logger.debug("User not found during login", {
      normalizedEmail,
      originalEmail: input.email
    })
    // Return generic error to prevent user enumeration
    return {
      success: false,
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password"
      }
    }
  }

  // Verify password using Argon2id (required by mobile-safe architecture guidelines)
  let isPasswordValid = false
  try {
    isPasswordValid = await argon2.verify(user.passwordHash, input.password)
  } catch (error) {
    logger.error("Error verifying password", {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : String(error),
      userId: user.id,
      email: normalizedEmail
    })
    return {
      success: false,
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password"
      }
    }
  }

  if (!isPasswordValid) {
    logger.debug("Password verification failed", {
      userId: user.id,
      email: normalizedEmail
    })
    return {
      success: false,
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password"
      }
    }
  }

  // Return authenticated user (without password hash)
  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      driverName: user.driverName,
      teamName: user.teamName,
      isAdmin: user.isAdmin,
    }
  }
}
