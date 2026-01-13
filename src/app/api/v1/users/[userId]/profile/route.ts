/**
 * @fileoverview User profile API endpoint (v1)
 * 
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 * 
 * @description Handles GET requests for user profile data
 * 
 * @purpose This API route provides comprehensive user profile information including
 *          user data, activity statistics, and driver linking status. This endpoint
 *          is used by the UserProfileModal component to display user information.
 * 
 * @relatedFiles
 * - src/core/users/profile.ts (core business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getUserProfile } from "@/core/users/profile"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { isValidUUID } from "@/lib/uuid-validation"

/**
 * GET /api/v1/users/[userId]/profile
 * 
 * Get comprehensive user profile data
 * 
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     user: { ... },
 *     activityStats: { ... },
 *     driverLinks: [ ... ]
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const requestId = generateRequestId()
  try {
    // Await params (Next.js 15)
    const { userId } = await params
    
    // Validate userId format
    if (!isValidUUID(userId)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "userId must be a valid UUID format",
        { field: "userId" },
        400
      )
    }
    
    // Verify authentication
    const session = await auth()
    if (!session || !session.user) {
      return errorResponse(
        "UNAUTHORIZED",
        "Authentication required",
        undefined,
        401
      )
    }
    
    // Verify userId matches authenticated user
    if (session.user.id !== userId) {
      return errorResponse(
        "FORBIDDEN",
        "Access denied",
        undefined,
        403
      )
    }
    
    // Get user profile
    const profile = await getUserProfile(userId)
    
    return successResponse(
      profile,
      200,
      "User profile retrieved successfully"
    )
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      undefined,
      errorInfo.statusCode
    )
  }
}

