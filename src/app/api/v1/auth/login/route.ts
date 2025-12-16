/**
 * @fileoverview User login API endpoint (v1)
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Handles POST requests for user authentication
 * 
 * @purpose This API route processes user login requests. It follows the
 *          mobile-safe architecture pattern: the route only handles HTTP concerns
 *          (request parsing, response formatting) and delegates all business logic
 *          to src/core/auth/login.ts. This ensures the authentication logic can
 *          be reused by mobile clients and follows the API-first architecture.
 * 
 * @relatedFiles
 * - src/core/auth/login.ts (authentication business logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { authenticateUser } from "@/core/auth/login"
import { successResponse, errorResponse, serverErrorResponse, parseRequestBody } from "@/lib/api-utils"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter"

/**
 * POST /api/v1/auth/login
 * 
 * Authenticates a user with email and password
 * 
 * Request body:
 * {
 *   email: string
 *   password: string
 * }
 * 
 * Response (success):
 * {
 *   success: true,
 *   data: { user: {...} },
 *   message: "Login successful"
 * }
 * 
 * Response (error):
 * {
 *   success: false,
 *   error: {
 *     code: string,
 *     message: string
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitResult = checkRateLimit(request, RATE_LIMITS.auth)
    if (!rateLimitResult.allowed) {
      return errorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Too many login attempts. Please try again later.",
        {
          resetTime: rateLimitResult.resetTime,
        },
        429
      )
    }

    // Parse request body
    const bodyResult = await parseRequestBody<{ email?: string; password?: string }>(request)
    if (!bodyResult.success) {
      return bodyResult.response
    }
    const body = bodyResult.data

    // Validate request body structure
    if (!body.email || !body.password) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Email and password are required",
        undefined,
        400
      )
    }

    // Delegate all business logic to core function
    const result = await authenticateUser({
      email: body.email,
      password: body.password,
    })

    if (result.success) {
      return successResponse(
        { user: result.user },
        200,
        "Login successful"
      )
    } else {
      // Map core error codes to HTTP status codes
      const statusCode = result.error.code === "INVALID_CREDENTIALS" ? 401 : 400
      return errorResponse(
        result.error.code,
        result.error.message,
        undefined,
        statusCode
      )
    }
  } catch (error: unknown) {
    // Handle unexpected errors (e.g., database connection errors)
    return serverErrorResponse("Failed to process login request")
  }
}

