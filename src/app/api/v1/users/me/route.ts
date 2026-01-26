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

    console.log("[GET /api/v1/users/me] Session check:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userIdType: typeof session?.user?.id,
      userIdLength: session?.user?.id?.length,
      email: session?.user?.email,
      name: session?.user?.name,
      isAdmin: session?.user?.isAdmin,
    })

    if (!session || !session.user) {
      console.log("[GET /api/v1/users/me] No session or user, returning 401")
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const responseData = {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      isAdmin: session.user.isAdmin || false,
    }

    console.log("[GET /api/v1/users/me] Returning response:", {
      userId: responseData.userId,
      userIdType: typeof responseData.userId,
      userIdLength: responseData.userId?.length,
      hasUserId: !!responseData.userId,
    })

    return successResponse(responseData)
  } catch (error) {
    console.error("[GET /api/v1/users/me] Error:", error)
    return errorResponse("INTERNAL_ERROR", "Failed to fetch user information", undefined, 500)
  }
}
