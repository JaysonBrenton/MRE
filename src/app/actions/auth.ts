/**
 * @fileoverview Server actions for authentication
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Server actions for user authentication and logout
 * 
 * @purpose Provides server actions for authentication that can be called from
 *          React Server Components. These actions use NextAuth's signIn/signOut
 *          functions which internally use the core authentication logic.
 * 
 * @relatedFiles
 * - src/lib/auth.ts (NextAuth configuration)
 * - src/core/auth/login.ts (authentication business logic)
 */

"use server"

import { signIn, signOut } from "@/lib/auth"
import { AuthError } from "next-auth"
import { logger } from "@/lib/logger"

/**
 * Type guard to check if error is a NextAuth redirect error
 * NextAuth throws redirect errors with a digest property starting with "NEXT_REDIRECT"
 */
function isNextRedirectError(error: unknown): error is { digest: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  )
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", formData)
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return "Invalid email or password"
        default:
          return "Something went wrong"
      }
    }
    // NextAuth's signIn throws a NEXT_REDIRECT error on success (expected behavior)
    // Use type guard to safely check for redirect errors
    if (isNextRedirectError(error)) {
      // This is a redirect, which means signIn succeeded
      // Return undefined to indicate success
      return undefined
    }
    // For other unexpected errors, log and return a generic message
    logger.error("Unexpected authentication error in server action", {
      error: error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : String(error),
    })
    return "An error occurred. Please try again."
  }
}

export async function logout() {
  await signOut({ redirectTo: "/" })
}

