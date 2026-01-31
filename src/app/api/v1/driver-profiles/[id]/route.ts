/**
 * @fileoverview Driver profile API endpoint (v1) - single profile operations
 *
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 *
 * @description Handles GET (single), PUT (update), and DELETE requests for driver profiles
 *
 * @purpose This API route provides access to individual driver profiles for authenticated users.
 *          Users can only access their own driver profiles.
 *
 * @relatedFiles
 * - src/core/driver-profiles/crud.ts (core business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  getDriverProfileById,
  updateDriverProfileForUser,
  deleteDriverProfileForUser,
  type UpdateDriverProfileInput,
} from "@/core/driver-profiles/crud"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"
import { isValidUUID } from "@/lib/uuid-validation"

/**
 * GET /api/v1/driver-profiles/[id]
 *
 * Get a single driver profile by ID
 *
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     profile: DriverProfile
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

    // Get driver profile (with ownership check)
    const profile = await getDriverProfileById(id, session.user.id)

    if (!profile) {
      return errorResponse("NOT_FOUND", "Driver profile not found", undefined, 404)
    }

    return successResponse({ profile }, 200, "Driver profile retrieved successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

/**
 * PUT /api/v1/driver-profiles/[id]
 *
 * Update an existing driver profile
 *
 * Request body:
 * {
 *   name?: string
 *   displayName?: string
 *   transponderNumber?: string
 *   preferences?: object
 * }
 *
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     profile: DriverProfile
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
    const bodyResult = await parseRequestBody<UpdateDriverProfileInput>(request)
    if (!bodyResult.success) {
      return bodyResult.response
    }

    // Update driver profile (with ownership check)
    const profile = await updateDriverProfileForUser(id, session.user.id, bodyResult.data)

    if (!profile) {
      return errorResponse("NOT_FOUND", "Driver profile not found", undefined, 404)
    }

    return successResponse({ profile }, 200, "Driver profile updated successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

/**
 * DELETE /api/v1/driver-profiles/[id]
 *
 * Delete a driver profile
 *
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     profile: DriverProfile
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

    // Delete driver profile (with ownership check)
    const profile = await deleteDriverProfileForUser(id, session.user.id)

    if (!profile) {
      return errorResponse("NOT_FOUND", "Driver profile not found", undefined, 404)
    }

    return successResponse({ profile }, 200, "Driver profile deleted successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
