/**
 * @fileoverview Driver profiles API endpoint (v1)
 * 
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 * 
 * @description Handles GET (list) and POST (create) requests for driver profiles
 * 
 * @purpose This API route provides access to driver profiles for authenticated users.
 *          Users can only access their own driver profiles.
 * 
 * @relatedFiles
 * - src/core/driver-profiles/crud.ts (core business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  getDriverProfilesByUserId,
  createDriverProfileForUser,
  type CreateDriverProfileInput,
} from "@/core/driver-profiles/crud"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * GET /api/v1/driver-profiles
 * 
 * Get all driver profiles for the authenticated user
 * 
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     profiles: DriverProfile[]
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
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

    // Get driver profiles for the authenticated user
    const profiles = await getDriverProfilesByUserId(session.user.id)

    return successResponse(
      { profiles },
      200,
      "Driver profiles retrieved successfully"
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
 * POST /api/v1/driver-profiles
 * 
 * Create a new driver profile for the authenticated user
 * 
 * Request body:
 * {
 *   name: string
 *   displayName: string
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
export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  try {
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
    const bodyResult = await parseRequestBody<Omit<CreateDriverProfileInput, "userId">>(
      request
    )
    if (!bodyResult.success) {
      return bodyResult.response
    }

    const { name, displayName, transponderNumber, preferences } = bodyResult.data

    // Validate required fields
    if (!name || !displayName) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Name and display name are required",
        { fields: ["name", "displayName"] },
        400
      )
    }

    // Create driver profile
    const profile = await createDriverProfileForUser(session.user.id, {
      name,
      displayName,
      transponderNumber,
      preferences,
    })

    return successResponse(
      { profile },
      201,
      "Driver profile created successfully"
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
