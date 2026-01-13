/**
 * @fileoverview User driver links API endpoint (v1)
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Handles GET requests for user driver links (read-only)
 * 
 * @purpose This API route provides read-only access to user-driver links.
 *          Link creation and confirmation happen automatically server-side during
 *          ingestion. This endpoint only provides status visibility.
 * 
 * @relatedFiles
 * - src/core/users/driver-links.ts (core business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { getUserDriverLinks, getUserDriverLinksByStatus } from "@/core/users/driver-links"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { isValidUUID } from "@/lib/uuid-validation"

/**
 * GET /api/v1/users/[userId]/driver-links
 * 
 * Get all driver links for a user (read-only)
 * 
 * Query params:
 * - status (optional): Filter by status (confirmed, suggested, rejected, conflict)
 * 
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     links: DriverLinkStatus[]
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
    
    // Get status filter from query params
    const searchParams = request.nextUrl.searchParams
    const statusFilter = searchParams.get("status") as
      | "confirmed"
      | "suggested"
      | "rejected"
      | "conflict"
      | null
    
    // Get driver links
    const links = statusFilter
      ? await getUserDriverLinksByStatus(userId, statusFilter)
      : await getUserDriverLinks(userId)
    
    return successResponse(
      { links },
      200,
      "Driver links retrieved successfully"
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
