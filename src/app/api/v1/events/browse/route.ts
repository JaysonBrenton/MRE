// @fileoverview Cross-track event browse API route (database-only, paginated)
//
// @description Lists ingested events across all tracks for Event Search when no
//              track is selected. Does not call LiveRC.

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { browseEvents } from "@/core/events/browse-events"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError } from "@/lib/server-error-handler"

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

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized event browse request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")
    const pageParam = searchParams.get("page")
    const pageSizeParam = searchParams.get("page_size")
    const databaseOnly =
      searchParams.get("database_only") !== "false" && searchParams.get("database_only") !== "0"

    const page = pageParam ? parseInt(pageParam, 10) : undefined
    const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : undefined

    requestLogger.debug("Event browse request", {
      startDate,
      endDate,
      page,
      pageSize,
      databaseOnly,
    })

    const result = await browseEvents({
      startDate: startDate && startDate.trim() !== "" ? startDate : undefined,
      endDate: endDate && endDate.trim() !== "" ? endDate : undefined,
      page,
      pageSize,
      databaseOnly,
    })

    requestLogger.info("Event browse successful", {
      eventCount: result.events.length,
      total: result.total,
      page: result.page,
    })

    return successResponse({
      events: result.events,
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
    })
  } catch (error: unknown) {
    if (hasErrorCode(error)) {
      if (error.code === "VALIDATION_ERROR") {
        requestLogger.warn("Event browse validation error", {
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

    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(errorInfo.code, errorInfo.message, undefined, errorInfo.statusCode)
  }
}
