/**
 * @fileoverview Car profile API endpoint (v1) - single profile operations
 *
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 *
 * @description Handles GET (single), PUT (update), and DELETE requests for car profiles
 *
 * @purpose This API route provides access to individual car profiles for authenticated users.
 *          Users can only access their own car profiles.
 *
 * @relatedFiles
 * - src/core/car-profiles/crud.ts (core business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  getCarProfileById,
  updateCarProfileForUser,
  deleteCarProfileForUser,
  type UpdateCarProfileInput,
} from "@/core/car-profiles/crud"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { isValidUUID } from "@/lib/uuid-validation"

/**
 * GET /api/v1/car-profiles/[id]
 *
 * Get a single car profile by ID
 *
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     profile: CarProfile
 *   }
 * }
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = generateRequestId()
  try {
    // Await params (Next.js 15)
    const { id } = await params

    // Validate id format
    if (!isValidUUID(id)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "id must be a valid UUID format",
        { field: "id" },
        400
      )
    }

    // Verify authentication
    const session = await auth()
    if (!session || !session.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    // Get car profile (with ownership check)
    const profile = await getCarProfileById(id, session.user.id)

    if (!profile) {
      return errorResponse("NOT_FOUND", "Car profile not found", undefined, 404)
    }

    return successResponse({ profile }, 200, "Car profile retrieved successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

/**
 * PUT /api/v1/car-profiles/[id]
 *
 * Update an existing car profile
 *
 * Request body:
 * {
 *   name?: string
 *   carType?: string
 *   vehicleType?: string
 *   setupInfo?: object
 * }
 *
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     profile: CarProfile
 *   }
 * }
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = generateRequestId()
  try {
    // Await params (Next.js 15)
    const { id } = await params

    // Validate id format
    if (!isValidUUID(id)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "id must be a valid UUID format",
        { field: "id" },
        400
      )
    }

    // Verify authentication
    const session = await auth()
    if (!session || !session.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    // Parse request body
    const bodyResult = await parseRequestBody<UpdateCarProfileInput>(request)
    if (!bodyResult.success) {
      return bodyResult.response
    }

    // Update car profile (with ownership check)
    const profile = await updateCarProfileForUser(id, session.user.id, bodyResult.data)

    if (!profile) {
      return errorResponse("NOT_FOUND", "Car profile not found", undefined, 404)
    }

    return successResponse({ profile }, 200, "Car profile updated successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

/**
 * DELETE /api/v1/car-profiles/[id]
 *
 * Delete a car profile
 *
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     profile: CarProfile
 *   }
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId()
  try {
    // Await params (Next.js 15)
    const { id } = await params

    // Validate id format
    if (!isValidUUID(id)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "id must be a valid UUID format",
        { field: "id" },
        400
      )
    }

    // Verify authentication
    const session = await auth()
    if (!session || !session.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    // Delete car profile (with ownership check)
    const profile = await deleteCarProfileForUser(id, session.user.id)

    if (!profile) {
      return errorResponse("NOT_FOUND", "Car profile not found", undefined, 404)
    }

    return successResponse({ profile }, 200, "Car profile deleted successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
