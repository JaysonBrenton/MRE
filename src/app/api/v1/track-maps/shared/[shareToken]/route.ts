/**
 * @fileoverview Shared track map API endpoint (v1)
 * 
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 * 
 * @description Handles GET requests to retrieve track maps by share token
 * 
 * @purpose This API route allows access to track maps via share tokens without authentication.
 * 
 * @relatedFiles
 * - src/core/track-maps/repo.ts (core business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { findTrackMapByShareToken } from "@/core/track-maps/repo"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * GET /api/v1/track-maps/shared/[shareToken]
 * 
 * Get a track map by share token (no authentication required)
 * 
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     map: TrackMapWithRelations
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const requestId = generateRequestId()
  try {
    // Await params (Next.js 15)
    const { shareToken } = await params

    if (!shareToken || shareToken.length === 0) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Share token is required",
        { field: "shareToken" },
        400
      )
    }

    // Get track map by share token (no authentication required)
    const map = await findTrackMapByShareToken(shareToken)

    if (!map) {
      return errorResponse(
        "NOT_FOUND",
        "Track map not found",
        undefined,
        404
      )
    }

    return successResponse(
      { map },
      200,
      "Track map retrieved successfully"
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
