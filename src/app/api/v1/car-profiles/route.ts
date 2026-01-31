/**
 * @fileoverview Car profiles API endpoint (v1)
 *
 * @created 2025-01-28
 * @creator System
 * @lastModified 2025-01-28
 *
 * @description Handles GET (list) and POST (create) requests for car profiles
 *
 * @purpose This API route provides access to car profiles for authenticated users.
 *          Users can only access their own car profiles.
 *
 * @relatedFiles
 * - src/core/car-profiles/crud.ts (core business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import {
  getCarProfilesByUserId,
  createCarProfileForUser,
  type CreateCarProfileInput,
} from "@/core/car-profiles/crud"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"
import { handleApiError } from "@/lib/server-error-handler"
import { generateRequestId } from "@/lib/request-context"

/**
 * GET /api/v1/car-profiles
 *
 * Get all car profiles for the authenticated user
 *
 * Response (success):
 * {
 *   success: true,
 *   data: {
 *     profiles: CarProfile[]
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

    // Get car profiles for the authenticated user
    const profiles = await getCarProfilesByUserId(session.user.id)

    return successResponse({ profiles }, 200, "Car profiles retrieved successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}

/**
 * POST /api/v1/car-profiles
 *
 * Create a new car profile for the authenticated user
 *
 * Request body:
 * {
 *   name: string
 *   carType: string
 *   vehicleType: string
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
export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    // Verify authentication
    const session = await auth()
    if (!session || !session.user) {
      return errorResponse("UNAUTHORIZED", "Authentication required", undefined, 401)
    }

    // Parse request body
    const bodyResult = await parseRequestBody<Omit<CreateCarProfileInput, "userId">>(request)
    if (!bodyResult.success) {
      return bodyResult.response
    }

    const { name, carType, vehicleType, setupInfo } = bodyResult.data

    // Validate required fields
    if (!name || !carType || !vehicleType) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Name, car type, and vehicle type are required",
        { fields: ["name", "carType", "vehicleType"] },
        400
      )
    }

    // Create car profile
    const profile = await createCarProfileForUser(session.user.id, {
      name,
      carType,
      vehicleType,
      setupInfo,
    })

    return successResponse({ profile }, 201, "Car profile created successfully")
  } catch (error: unknown) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
