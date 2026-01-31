/**
 * @fileoverview NextAuth authorize handler (Node.js runtime only)
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Handles NextAuth credential authorization
 *
 * @purpose This file contains the authorize function for NextAuth credentials provider.
 *          It's separated from the main auth config to ensure argon2 (native Node.js module)
 *          is only loaded in Node.js runtime, not Edge Runtime. This file should never
 *          be imported by middleware or Edge Runtime code.
 *
 * @relatedFiles
 * - src/core/auth/login.ts (authentication business logic)
 * - src/lib/auth.ts (NextAuth configuration)
 */

import type { User } from "next-auth"
import { logger } from "@/lib/logger"

/**
 * Authorizes credentials for NextAuth
 * This function only runs in Node.js runtime (during actual login), never in Edge Runtime
 * Uses dynamic import to avoid loading argon2 during static analysis
 */
export async function authorizeCredentials(
  credentials: Record<"email" | "password", string> | undefined
): Promise<User | null> {
  try {
    if (!credentials?.email || !credentials?.password) {
      return null
    }

    // Dynamically import authenticateUser to avoid loading argon2 during static analysis
    // This ensures argon2 is only loaded when this function is actually called (Node.js runtime)
    const { authenticateUser } = await import("./login")

    // Use core authentication function
    const result = await authenticateUser({
      email: credentials.email,
      password: credentials.password,
    })

    if (!result.success) {
      // Log failed authentication attempts for debugging
      logger.debug("Authentication failed", {
        email: credentials.email,
        errorCode: result.error.code,
        errorMessage: result.error.message,
      })
      return null
    }

    // Return user in NextAuth format
    return {
      id: result.user.id,
      email: result.user.email,
      name: result.user.driverName,
      isAdmin: result.user.isAdmin,
    }
  } catch (error) {
    // Log any unexpected errors during authorization
    logger.error("Error in authorizeCredentials", {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : String(error),
      email: credentials?.email,
    })
    // Return null to indicate authentication failure
    // This prevents the error from propagating and breaking NextAuth
    return null
  }
}
