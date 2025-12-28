// @fileoverview Events API route
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description API route for fetching all fully imported events
// 
// @purpose Provides user-facing API for retrieving all events with full ingestion.
//          This route delegates to core repository functions, following the
//          mobile-safe architecture requirement that API routes should not contain
//          business logic or Prisma queries.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getAllImportedEvents } from "@/core/events/repo";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { createRequestLogger, generateRequestId } from "@/lib/request-context";
import { handleApiError } from "@/lib/server-error-handler";

// Cache events list for 30 minutes (1800 seconds)
export const revalidate = 1800

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized events list request")
    return errorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      {},
      401
    )
  }

  try {
    // Parse pagination parameters from query string
    const searchParams = request.nextUrl.searchParams
    const limitParam = searchParams.get("limit")
    const offsetParam = searchParams.get("offset")
    
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 20
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10)) : 0

    const result = await getAllImportedEvents({ limit, offset })

    requestLogger.info("Events list retrieved successfully", {
      eventCount: result.events.length,
      total: result.total,
      limit,
      offset,
    })

    return successResponse({
      events: result.events,
      pagination: {
        total: result.total,
        limit,
        offset,
      },
    })
  } catch (error: unknown) {
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

