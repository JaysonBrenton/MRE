/**
 * @fileoverview Current user info API endpoint
 *
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 *
 * @description Returns basic information about the currently authenticated user
 *
 * @purpose Provides a simple endpoint to get the current user's ID and basic info
 *
 * @relatedFiles
 * - src/lib/auth.ts (authentication)
 */

import { auth } from "@/lib/auth"
import { successResponse, errorResponse } from "@/lib/api-utils"

/**
 * GET /api/v1/users/me
 *
 * Returns current user's basic information
 *
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     userId: string
 *     email: string
 *     name: string
 *   }
 * }
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    return successResponse({
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    })
  } catch {
    return errorResponse("INTERNAL_ERROR", "Failed to fetch user information", undefined, 500)
  }
}
