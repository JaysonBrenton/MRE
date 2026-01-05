/**
 * @fileoverview Admin tracks API endpoint (v1)
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Handles GET requests for track management (admin only)
 *
 * @relatedFiles
 * - src/core/admin/tracks.ts (core business logic)
 * - src/lib/admin-auth.ts (admin authorization)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { getTracks } from "@/core/admin/tracks"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * GET /api/v1/admin/tracks
 *
 * Get all tracks with pagination and filtering (admin only)
 *
 * Query params:
 * - source (optional): Filter by source
 * - isFollowed (optional): Filter by follow status
 * - isActive (optional): Filter by active status
 * - page (optional): Page number (default: 1)
 * - pageSize (optional): Page size (default: 50)
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()

  try {
    // Verify admin access
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const searchParams = request.nextUrl.searchParams
    const source = searchParams.get("source") || undefined
    const isFollowedParam = searchParams.get("isFollowed")
    const isFollowed = isFollowedParam ? isFollowedParam === "true" : undefined
    const isActiveParam = searchParams.get("isActive")
    const isActive = isActiveParam ? isActiveParam === "true" : undefined
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1
    const pageSize = searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!) : 50

    const result = await getTracks({
      source,
      isFollowed,
      isActive,
      page,
      pageSize,
    })

    return successResponse(result, 200, "Tracks retrieved successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
