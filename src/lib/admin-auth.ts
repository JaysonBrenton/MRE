/**
 * @fileoverview Admin authorization helper for server-side admin access control
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Helper functions for verifying admin status server-side
 *
 * @purpose Provides utilities for checking admin authorization in API routes
 *          and server components. All admin checks must be server-side only
 *          to prevent unauthorized access.
 *
 * @relatedFiles
 * - src/lib/auth.ts (NextAuth configuration and auth function)
 * - docs/security/security-overview.md (security documentation)
 */

import { auth } from "@/lib/auth"
import { errorResponse } from "@/lib/api-utils"
import { NextResponse } from "next/server"

/**
 * Result type for admin authorization check
 */
export type AdminAuthResult =
  | { authorized: true; userId: string }
  | { authorized: false; response: NextResponse }

/**
 * Verifies that the current session belongs to an admin user
 *
 * @returns AdminAuthResult with authorization status and user ID or error response
 */
export async function requireAdmin(): Promise<AdminAuthResult> {
  const session = await auth()

  if (!session) {
    return {
      authorized: false,
      response: errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401),
    }
  }

  if (!session.user.isAdmin) {
    return {
      authorized: false,
      response: errorResponse("FORBIDDEN", "Admin access required", undefined, 403),
    }
  }

  return {
    authorized: true,
    userId: session.user.id,
  }
}

/**
 * Gets the current admin user ID if authorized, or null if not
 *
 * @returns User ID if admin, null otherwise
 */
export async function getAdminUserId(): Promise<string | null> {
  const session = await auth()
  if (!session || !session.user.isAdmin) {
    return null
  }
  return session.user.id
}
