// @fileoverview Event ingestion by source ID API route
//
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
//
// @description API route for ingesting events by source_event_id and track_id
//
// @purpose Provides user-facing API for ingesting newly discovered LiveRC events
//          that don't yet exist in the database. This route delegates to the
//          ingestion client, following the mobile-safe architecture requirement
//          that API routes should not contain business logic.

import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { ingestionClient, IngestionServiceError } from "@/lib/ingestion-client"
import { successResponse, errorResponse } from "@/lib/api-utils"
import { createRequestLogger, generateRequestId } from "@/lib/request-context"
import { handleApiError, handleExternalServiceError } from "@/lib/server-error-handler"
import { getEventBySourceId } from "@/core/events/repo"
import { toHttpErrorPayload } from "@/lib/ingestion-error-map"

// Increase timeout for large event ingestion (up to 10 minutes)
export const maxDuration = 600 // 10 minutes in seconds

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized event ingestion request")
    return errorResponse("UNAUTHORIZED", "Authentication required", {}, 401)
  }
  // Declare variables outside try block so they're accessible in catch
  let source_event_id: string | undefined
  let track_id: string | undefined

  try {
    const body = await request.json()
    source_event_id = body.source_event_id
    track_id = body.track_id
    const depth = body.depth

    // Validate required fields
    if (!source_event_id) {
      requestLogger.warn("Validation failed - missing source_event_id")
      return errorResponse(
        "VALIDATION_ERROR",
        "source_event_id is required",
        { field: "source_event_id" },
        400
      )
    }

    if (!track_id) {
      requestLogger.warn("Validation failed - missing track_id")
      return errorResponse("VALIDATION_ERROR", "track_id is required", { field: "track_id" }, 400)
    }

    // Call ingestion client
    const result = await ingestionClient.ingestEventBySourceId(
      source_event_id,
      track_id,
      depth || "laps_full"
    )

    requestLogger.info("Event ingestion completed", {
      sourceEventId: source_event_id,
      trackId: track_id,
      eventId: result?.event_id,
      racesIngested: result?.races_ingested,
    })

    return successResponse(result)
  } catch (error: unknown) {
    if (error instanceof IngestionServiceError) {
      const payload = toHttpErrorPayload(error, {
        sourceEventId: source_event_id,
        trackId: track_id,
      })
      const logMeta = {
        sourceEventId: source_event_id,
        trackId: track_id,
        code: error.code,
        status: payload.status,
      }

      if (error.code === "INGESTION_IN_PROGRESS") {
        requestLogger.info("Ingestion already running for source event", logMeta)
      } else {
        requestLogger.error("Ingestion service error", {
          ...logMeta,
          errorMessage: error.message,
          errorDetails: error.details,
          stack: error.stack,
        })
      }

      return errorResponse(error.code, payload.message, payload.details, payload.status)
    }

    // For connection errors or timeouts, check if ingestion actually succeeded
    // This handles the case where HTTP connection fails but ingestion completes
    if (error instanceof Error) {
      const isConnectionError =
        error.message.includes("fetch failed") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("timeout") ||
        error.message.includes("AbortError")

      if (isConnectionError && source_event_id) {
        try {
          // Check if event was actually created and ingested
          const event = await getEventBySourceId("liverc", source_event_id)
          if (event && event.ingestDepth === "laps_full" && event.lastIngestedAt) {
            // Ingestion actually succeeded! Return success response
            requestLogger.info("Event ingestion succeeded despite connection error", {
              sourceEventId: source_event_id,
              eventId: event.id,
              ingestDepth: event.ingestDepth,
            })

            return successResponse({
              event_id: event.id,
              ingest_depth: event.ingestDepth,
              last_ingested_at: event.lastIngestedAt.toISOString(),
              races_ingested: 0, // We don't have exact counts, but ingestion succeeded
              results_ingested: 0,
              laps_ingested: 0,
              status: "updated",
            })
          }
        } catch (checkError) {
          // If status check fails, continue with original error handling
          requestLogger.warn("Failed to check event status after connection error", {
            error: checkError instanceof Error ? checkError.message : String(checkError),
          })
        }
      }
    }

    // Handle external service errors (ingestion service)
    if (error instanceof Error && error.message.includes("Ingestion")) {
      const errorInfo = handleExternalServiceError(
        error,
        "Ingestion",
        "ingestEventBySourceId",
        requestLogger
      )
      return errorResponse(
        errorInfo.code,
        errorInfo.message,
        { originalError: error.message },
        errorInfo.statusCode
      )
    }

    // Handle other errors - log full error details for debugging
    requestLogger.error("Unexpected error during event ingestion", {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : String(error),
      sourceEventId: source_event_id,
      trackId: track_id,
    })

    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      { originalError: error instanceof Error ? error.message : String(error) },
      errorInfo.statusCode
    )
  }
}
