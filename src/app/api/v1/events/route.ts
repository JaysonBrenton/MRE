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
    const events = await getAllImportedEvents()

    requestLogger.info("Events list retrieved successfully", {
      eventCount: events.length,
    })

    return successResponse({
      events,
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

