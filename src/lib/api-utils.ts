/**
 * @fileoverview API response utilities following mobile-safe architecture format
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Helper functions for creating standardized API responses
 *
 * @purpose Provides utilities for creating API responses that follow the
 *          mobile-safe architecture standard format defined in
 *          docs/architecture/mobile-safe-architecture-guidelines.md.
 *          All API responses must follow the documented structure for consistency
 *          across web and mobile clients.
 *
 * @relatedFiles
 * - docs/architecture/mobile-safe-architecture-guidelines.md (API format standard)
 */

import { NextResponse } from "next/server"

/**
 * API success response format
 */
export type ApiSuccessResponse<T = unknown> = {
  success: true
  data: T
  message?: string
}

/**
 * API error response format
 */
export type ApiErrorResponse = {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/**
 * Cache control header values for different data types
 */
export const CACHE_CONTROL = {
  /** Static reference data (tracks, personas) - 1 hour */
  STATIC: "public, max-age=3600",
  /** Event summaries, event lists - 5 minutes */
  EVENT_SUMMARY: "public, max-age=300",
  /** User-specific data - 1 minute, private */
  USER_DATA: "private, max-age=60",
  /** No caching - admin, ingestion, auth endpoints */
  NO_CACHE: "no-store, no-cache, must-revalidate",
} as const

/**
 * Creates a standardized success response
 *
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @param message - Optional success message
 * @param cacheControl - Optional Cache-Control header value
 * @returns NextResponse with standardized success format
 */
export function successResponse<T>(
  data: T,
  status = 200,
  message?: string,
  cacheControl?: string
): NextResponse<ApiSuccessResponse<T>> {
  const headers: HeadersInit = {}

  if (cacheControl) {
    headers["Cache-Control"] = cacheControl
  }

  return NextResponse.json(
    {
      success: true as const,
      data,
      ...(message && { message }),
    },
    {
      status,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    }
  )
}

/**
 * Creates a standardized error response
 *
 * @param code - Error code
 * @param message - Human-readable error message
 * @param details - Optional error details
 * @param status - HTTP status code (default: 400)
 * @returns NextResponse with standardized error format
 */
export function errorResponse(
  code: string,
  message: string,
  details?: unknown,
  status = 400
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status }
  )
}

/**
 * Creates a standardized server error response
 *
 * @param message - Error message (default: "Internal server error")
 * @param status - HTTP status code (default: 500)
 * @returns NextResponse with standardized error format
 */
export function serverErrorResponse(
  message: string = "Internal server error",
  status = 500
): NextResponse<ApiErrorResponse> {
  return errorResponse("INTERNAL_ERROR", message, undefined, status)
}

/**
 * Parses request body as JSON with error handling
 *
 * @param request - Next.js request object
 * @returns Parsed body or error result
 */
export async function parseRequestBody<T>(
  request: Request
): Promise<
  { success: true; data: T } | { success: false; response: NextResponse<ApiErrorResponse> }
> {
  try {
    const body = await request.json()
    return { success: true, data: body as T }
  } catch (error) {
    return {
      success: false,
      response: errorResponse(
        "INVALID_REQUEST",
        "Invalid JSON in request body",
        error instanceof Error ? { message: error.message } : undefined,
        400
      ),
    }
  }
}

/**
 * Creates a standardized rate limit exceeded response
 *
 * @param retryAfterSeconds - Seconds until the rate limit resets
 * @param message - Optional custom message
 * @returns NextResponse with 429 status and Retry-After header
 */
export function rateLimitResponse(
  retryAfterSeconds: number,
  message = "Too many requests. Please try again later."
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message,
        details: {
          retryAfterSeconds,
        },
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + retryAfterSeconds),
      },
    }
  )
}
