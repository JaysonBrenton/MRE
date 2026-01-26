/**
 * @fileoverview Track map share token API endpoint (v1)
 * 
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 * 
 * @description Handles POST requests to generate share tokens for track maps
 * 
 * @purpose This API route allows users to generate shareable links for their track maps.
 * 
 * @relatedFiles
 * - src/core/track-maps/repo.ts (core business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { generateShareToken } from "@/core/track-maps/repo"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { isValidUUID } from "@/lib/uuid-validation"

/**
 * POST /api/v1/track-maps/[mapId]/share
 * 
 * Generate a share token for a track map
 * 
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     map: TrackMapWithRelations
 *     shareUrl: string
 *   }
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mapId: string }> }
) {
  const requestId = generateRequestId()
  try {
    // Await params (Next.js 15)
    const { mapId } = await params

    // Validate id format
    if (!isValidUUID(mapId)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "mapId must be a valid UUID format",
        { field: "mapId" },
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

    // Generate share token (with ownership check)
    const map = await generateShareToken(mapId, session.user.id)

    if (!map) {
      return errorResponse(
        "NOT_FOUND",
        "Track map not found",
        undefined,
        404
      )
    }

    // Build share URL
    const baseUrl = process.env.APP_URL || "http://localhost:3001"
    const shareUrl = `${baseUrl}/dashboard/my-club/track-maps/shared/${map.shareToken}`

    return successResponse(
      { map, shareUrl },
      200,
      "Share token generated successfully"
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
