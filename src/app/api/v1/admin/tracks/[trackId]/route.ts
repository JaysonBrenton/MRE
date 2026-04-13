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
import { setTrackFollowStatus, updateTrackStartFinishLine } from "@/core/admin/tracks"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"
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

    const bodyResult = await parseRequestBody<{
      isFollowed?: boolean
      startFinishLineGeoJson?: unknown | null
    }>(request)

    if (!bodyResult.success) {
      return bodyResult.response
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined
    const userAgent = request.headers.get("user-agent") || undefined

    const { isFollowed, startFinishLineGeoJson } = bodyResult.data
    if (isFollowed === undefined && startFinishLineGeoJson === undefined) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Provide isFollowed and/or startFinishLineGeoJson",
        undefined,
        400
      )
    }

    let updatedTrack = null
    if (typeof isFollowed === "boolean") {
      updatedTrack = await setTrackFollowStatus(
        trackId,
        isFollowed,
        authResult.userId,
        ipAddress,
        userAgent
      )
    }
    if (startFinishLineGeoJson !== undefined) {
      updatedTrack = await updateTrackStartFinishLine(
        trackId,
        startFinishLineGeoJson,
        authResult.userId,
        ipAddress,
        userAgent
      )
    }

    if (!updatedTrack) {
      return errorResponse("UNPROCESSABLE_ENTITY", "No updates applied", undefined, 422)
    }

    return successResponse(updatedTrack, 200, "Track updated successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
