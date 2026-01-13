/**
 * @fileoverview Unified search API route
 * 
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 * 
 * @description API route for unified search across events and sessions
 * 
 * @purpose Provides user-facing API for searching events and sessions.
 *          This route delegates to core business logic functions, following
 *          the mobile-safe architecture requirement that API routes should
 *          not contain business logic or Prisma queries.
 */

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { unifiedSearch } from "@/core/search/search"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"
import type { UnifiedSearchParams, SessionType } from "@/core/search/types"

/**
 * Type guard to check if error has code and message properties
 */
function hasErrorCode(error: unknown): error is { code: string; message: string; field?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    typeof (error as { message: unknown }).message === "string"
  )
}

/**
 * Validate and parse search parameters
 */
function parseSearchParams(searchParams: URLSearchParams): {
  params: UnifiedSearchParams
  errors: string[]
} {
  const errors: string[] = []
  const params: UnifiedSearchParams = {}

  // Query parameter
  const query = searchParams.get("q")
  if (query) {
    params.query = query.trim()
  }

  // Driver name parameter
  const driverName = searchParams.get("driver_name")
  if (driverName) {
    params.driverName = driverName.trim()
  }

  // Session type parameter
  const sessionType = searchParams.get("session_type")
  if (sessionType) {
    const validTypes: SessionType[] = ["race", "practice", "qualifying"]
    if (validTypes.includes(sessionType as SessionType)) {
      params.sessionType = sessionType as SessionType
    } else {
      errors.push(`Invalid session_type: ${sessionType}. Must be one of: ${validTypes.join(", ")}`)
    }
  }

  // Date range parameters
  const startDate = searchParams.get("start_date")
  const endDate = searchParams.get("end_date")
  if (startDate) {
    const date = new Date(startDate)
    if (isNaN(date.getTime())) {
      errors.push("Invalid start_date format. Use ISO 8601 format (YYYY-MM-DD)")
    } else {
      params.startDate = startDate
    }
  }
  if (endDate) {
    const date = new Date(endDate)
    if (isNaN(date.getTime())) {
      errors.push("Invalid end_date format. Use ISO 8601 format (YYYY-MM-DD)")
    } else {
      params.endDate = endDate
    }
  }
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (start > end) {
      errors.push("start_date must be before or equal to end_date")
    }
  }

  // Pagination parameters
  const page = searchParams.get("page")
  if (page) {
    const pageNum = parseInt(page, 10)
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push("page must be a positive integer")
    } else {
      params.page = pageNum
    }
  }

  const itemsPerPage = searchParams.get("items_per_page")
  if (itemsPerPage) {
    const itemsNum = parseInt(itemsPerPage, 10)
    if (isNaN(itemsNum) || itemsNum < 1 || itemsNum > 100) {
      errors.push("items_per_page must be between 1 and 100")
    } else {
      params.itemsPerPage = itemsNum
    }
  }

  return { params, errors }
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized search request")
    return errorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      {},
      401
    )
  }

  try {
    const searchParams = request.nextUrl.searchParams

    // Parse and validate parameters
    const { params, errors } = parseSearchParams(searchParams)

    if (errors.length > 0) {
      requestLogger.warn("Search validation errors", { errors })
      return errorResponse(
        "VALIDATION_ERROR",
        errors.join("; "),
        { errors },
        400
      )
    }

    requestLogger.debug("Unified search request", {
      query: params.query,
      driverName: params.driverName,
      sessionType: params.sessionType,
      startDate: params.startDate,
      endDate: params.endDate,
      page: params.page,
      itemsPerPage: params.itemsPerPage,
    })

    // Call core business logic function
    const result = await unifiedSearch(params)

    requestLogger.info("Unified search successful", {
      eventCount: result.totalEvents,
      sessionCount: result.totalSessions,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
    })

    return successResponse(result)
  } catch (error: unknown) {
    // Handle validation errors
    if (hasErrorCode(error)) {
      if (error.code === "VALIDATION_ERROR") {
        requestLogger.warn("Search validation error", {
          code: error.code,
          message: error.message,
          field: error.field,
        })
        return errorResponse(
          error.code,
          error.message,
          error.field ? { field: error.field } : {},
          400
        )
      }
    }

    // Handle unexpected errors using server error handler
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      undefined,
      errorInfo.statusCode
    )
  }
}
