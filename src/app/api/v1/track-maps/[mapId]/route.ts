/**
 * @fileoverview Track map API endpoint (v1) - single map operations
 * 
 * @created 2026-01-24
 * @creator Auto-generated
 * @lastModified 2026-01-24
 * 
 * @description Handles GET (single), PUT (update), and DELETE requests for track maps
 * 
 * @purpose This API route provides access to individual track maps for authenticated users.
 *          Users can only access their own maps or public maps.
 * 
 * @relatedFiles
 * - src/core/track-maps/repo.ts (core business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  findTrackMapById,
  updateTrackMap,
  deleteTrackMap,
  generateShareToken,
  type UpdateTrackMapParams,
  type TrackMapData,
} from "@/core/track-maps/repo"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { isValidUUID } from "@/lib/uuid-validation"

/**
 * GET /api/v1/track-maps/[mapId]
 * 
 * Get a single track map by ID
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

    // Get track map (with ownership check)
    const map = await findTrackMapById(mapId, session.user.id)

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

/**
 * PUT /api/v1/track-maps/[mapId]
 * 
 * Update an existing track map
 * 
 * Request body:
 * {
 *   name?: string
 *   description?: string
 *   mapData?: TrackMapData
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
export async function PUT(
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

    // Parse request body
    const bodyResult = await parseRequestBody<UpdateTrackMapParams>(request)
    if (!bodyResult.success) {
      return bodyResult.response
    }

    // Update track map (with ownership check)
    const map = await updateTrackMap(mapId, session.user.id, bodyResult.data)

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
      "Track map updated successfully"
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

/**
 * DELETE /api/v1/track-maps/[mapId]
 * 
 * Delete a track map
 * 
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     map: TrackMap
 *   }
 * }
 */
export async function DELETE(
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

    // Delete track map (with ownership check)
    const map = await deleteTrackMap(mapId, session.user.id)

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
      "Track map deleted successfully"
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
