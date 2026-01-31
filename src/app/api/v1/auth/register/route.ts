/**
 * @fileoverview User registration API endpoint (v1)
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Handles POST requests for new user registration
 *
 * @purpose This API route processes user registration requests. It follows the
 *          mobile-safe architecture pattern: the route only handles HTTP concerns
 *          (request parsing, response formatting) and delegates all business logic
 *          to src/core/auth/register.ts. This ensures the registration logic can
 *          be reused by mobile clients and follows the API-first architecture.
 *
 * @relatedFiles
 * - src/core/auth/register.ts (registration business logic)
 * - src/core/auth/validate-register.ts (validation logic)
 * - src/lib/api-utils.ts (response helpers)
 */

import { NextRequest } from "next/server"
import { registerUser } from "@/core/auth/register"
import { successResponse, errorResponse, parseRequestBody } from "@/lib/api-utils"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter"
import {
  createRequestLogger,
  generateRequestId,
  getClientIp,
  getRequestContext,
} from "@/lib/request-context"
import { logRateLimitHit } from "@/lib/security-logger"
import { handleApiError } from "@/lib/server-error-handler"

/**
 * POST /api/v1/auth/register
 *
 * Registers a new user account
 *
 * Request body:
 * {
 *   email: string
 *   password: string
 *   driverName: string
 *   teamName?: string
 * }
 *
 * Response (success):
 * {
 *   success: true,
 *   data: { user: {...} },
 *   message: "Registration successful"
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
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)
  const requestContext = getRequestContext(request, requestId)
  const ip = getClientIp(request)

  try {
    // Check rate limit
    const rateLimitResult = checkRateLimit(request, RATE_LIMITS.auth)
    if (!rateLimitResult.allowed) {
      logRateLimitHit(
        ip,
        request.nextUrl.pathname,
        RATE_LIMITS.auth.maxRequests,
        rateLimitResult.retryAfterSeconds || 60,
        requestContext
      )
      return errorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Too many registration attempts. Please try again later.",
        {
          resetTime: rateLimitResult.resetTime,
        },
        429
      )
    }

    // Parse request body
    const bodyResult = await parseRequestBody<{
      email?: string
      password?: string
      driverName?: string
      teamName?: string
    }>(request)
    if (!bodyResult.success) {
      return bodyResult.response
    }
    const body = bodyResult.data

    requestLogger.info("Registration attempt", {
      email: body.email
        ? `${body.email.substring(0, 3)}***@${body.email.split("@")[1]}`
        : undefined,
    })

    // Basic validation before delegating to core logic
    if (!body.email || !body.password || !body.driverName) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Email, password, and driver name are required",
        undefined,
        400
      )
    }

    // Delegate all business logic to core function
    const result = await registerUser({
      email: body.email,
      password: body.password,
      driverName: body.driverName,
      teamName: body.teamName,
    })

    if (result.success) {
      requestLogger.info("Registration successful", {
        userId: result.user.id,
      })

      return successResponse({ user: result.user }, 201, "Registration successful")
    } else {
      requestLogger.warn("Registration failed", {
        code: result.error.code,
        message: result.error.message,
      })

      // Map core error codes to HTTP status codes
      const statusCode = result.error.code === "EMAIL_ALREADY_EXISTS" ? 409 : 400
      return errorResponse(result.error.code, result.error.message, undefined, statusCode)
    }
  } catch (error: unknown) {
    // Handle unexpected errors
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
