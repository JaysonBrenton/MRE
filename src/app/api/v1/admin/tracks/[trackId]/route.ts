/**
 * @fileoverview Admin track management API endpoint (v1)
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Handles PATCH requests for track management (admin only)
 * 
 * @relatedFiles
 * - src/core/admin/tracks.ts (core business logic)
 * - src/lib/admin-auth.ts (admin authorization)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { setTrackFollowStatus } from "@/core/admin/tracks"
import { successResponse, parseRequestBody } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * PATCH /api/v1/admin/tracks/[trackId]
 * 
 * Update track follow status (admin only)
 * 
 * Request body:
 * {
 *   isFollowed: boolean
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  const requestId = generateRequestId()
  
  try {
    // Verify admin access
    const authResult = await requireAdmin()
    if (!authResult.authorized) {
      return authResult.response
    }

    const { trackId } = await params

    const bodyResult = await parseRequestBody<{ isFollowed: boolean }>(request)

    if (!bodyResult.success) {
      return bodyResult.response
    }

    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
    const userAgent = request.headers.get("user-agent") || undefined

    const updatedTrack = await setTrackFollowStatus(
      trackId,
      bodyResult.data.isFollowed,
      authResult.userId,
      ipAddress,
      userAgent
    )

    return successResponse(updatedTrack, 200, "Track updated successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorInfo.response
  }
}
