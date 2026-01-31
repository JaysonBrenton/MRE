/**
 * @fileoverview Track maps API endpoint (v1)
 *
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 *
 * @description Handles GET (list) and POST (create) requests for track maps
 *
 * @purpose This API route provides access to track maps for authenticated users.
 *          Users can list their own maps and create new ones.
 *
 * @relatedFiles
 * - src/core/track-maps/repo.ts (core business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  findTrackMapsByUserId,
  findPublicTrackMaps,
  createTrackMap,
  type CreateTrackMapParams,
  type TrackMapData,
} from "@/core/track-maps/repo"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * GET /api/v1/track-maps
 *
 * Get all track maps for the authenticated user, optionally filtered by track
 *
 * Query parameters:
 * - trackId?: string - Filter by track ID
 * - public?: boolean - If true, return public maps instead of user's maps
 *
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     maps: TrackMapWithRelations[]
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    // Verify authentication
    const session = await auth()
    if (!session || !session.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    const { searchParams } = new URL(request.url)
    const trackId = searchParams.get("trackId") || undefined
    const publicOnly = searchParams.get("public") === "true"

    let maps
    if (publicOnly) {
      // Get public maps (for importing)
      maps = await findPublicTrackMaps(trackId)
    } else {
      // Get user's maps
      maps = await findTrackMapsByUserId(session.user.id, trackId)
    }

    return successResponse({ maps }, 200, "Track maps retrieved successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

/**
 * POST /api/v1/track-maps
 *
 * Create a new track map for the authenticated user
 *
 * Request body:
 * {
 *   trackId: string
 *   name: string
 *   description?: string
 *   mapData: TrackMapData
 *   isPublic?: boolean
 * }
 *
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     map: TrackMapWithRelations
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    // Verify authentication
    const session = await auth()
    if (!session || !session.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    // Parse request body
    const bodyResult = await parseRequestBody<Omit<CreateTrackMapParams, "userId">>(request)
    if (!bodyResult.success) {
      return bodyResult.response
    }

    const { trackId, name, description, mapData, isPublic } = bodyResult.data

    // Validate required fields
    if (!trackId || !name || !mapData) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Track ID, name, and map data are required",
        { fields: ["trackId", "name", "mapData"] },
        400
      )
    }

    // Create track map
    const map = await createTrackMap({
      userId: session.user.id,
      trackId,
      name,
      description,
      mapData: mapData as TrackMapData,
      isPublic,
    })

    return successResponse({ map }, 201, "Track map created successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
