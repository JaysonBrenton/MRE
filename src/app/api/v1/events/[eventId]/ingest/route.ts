// @fileoverview Event ingestion API route
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description API route for triggering event ingestion
// 
// @purpose Proxies ingestion requests to Python service

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { ingestionClient } from "@/lib/ingestion-client";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limiter";
import { createRequestLogger, generateRequestId } from "@/lib/request-context";
import { handleApiError, handleExternalServiceError } from "@/lib/server-error-handler";
import { getEventById } from "@/core/events/repo";
import {
  isRecoverableIngestionError,
  waitForIngestionCompletion,
} from "@/lib/ingestion-status";

const COMPLETION_POLL_ATTEMPTS = 3
const COMPLETION_POLL_DELAY_MS = 2000

// Increase timeout for large event ingestion (up to 10 minutes)
// Keep in sync with API_TIMEOUTS.INGESTION_MAX_DURATION (docs/core auth constants)
export const maxDuration = 600

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)
  const { eventId } = await params

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized event ingestion request")
    return errorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      {},
      401
    )
  }

  try {
    // Check rate limit for ingestion endpoints
    const rateLimitResult = checkRateLimit(request, RATE_LIMITS.ingestion)
    if (!rateLimitResult.allowed) {
      requestLogger.warn("Rate limit exceeded for ingestion", {
        resetTime: rateLimitResult.resetTime,
      })
      return errorResponse(
        "RATE_LIMIT_EXCEEDED",
        "Too many ingestion requests. Please try again later.",
        {
          resetTime: rateLimitResult.resetTime,
        },
        429
      )
    }

    const body = await request.json();
    const depth = body.depth || "laps_full";

    requestLogger.debug("Event ingestion request", {
      eventId,
      depth,
    })

    const result = await ingestionClient.ingestEvent(eventId, depth);

    requestLogger.info("Event ingestion completed", {
      eventId,
      depth,
      racesIngested: result?.races_ingested,
    })

    return successResponse(result);
  } catch (error: unknown) {
    if (isRecoverableIngestionError(error)) {
      const completedEvent = await waitForIngestionCompletion({
        fetchEvent: getEventById,
        eventId,
        attempts: COMPLETION_POLL_ATTEMPTS,
        delayMs: COMPLETION_POLL_DELAY_MS,
      })

      if (completedEvent && completedEvent.lastIngestedAt) {
        requestLogger.info("Event ingestion completed after timeout", {
          eventId,
          ingestDepth: completedEvent.ingestDepth,
        })

        return successResponse(
          {
            event_id: completedEvent.id,
            ingest_depth: completedEvent.ingestDepth,
            last_ingested_at: completedEvent.lastIngestedAt.toISOString(),
            races_ingested: 0,
            results_ingested: 0,
            laps_ingested: 0,
            status: "already_complete",
          },
          200,
          "Ingestion completed after a transient error"
        )
      }

      requestLogger.warn("Event ingestion still running after timeout", {
        eventId,
        attempts: COMPLETION_POLL_ATTEMPTS,
      })

      return successResponse(
        {
          event_id: eventId,
          ingest_depth: completedEvent?.ingestDepth ?? "laps_full",
          last_ingested_at: completedEvent?.lastIngestedAt?.toISOString() ?? null,
          races_ingested: 0,
          results_ingested: 0,
          laps_ingested: 0,
          status: "in_progress",
        },
        202,
        "Ingestion is still running in the background. Refresh shortly to see updated data."
      )
    }

    // Handle external service errors (ingestion service)
    if (error instanceof Error && error.message.includes("Ingestion")) {
      const errorInfo = handleExternalServiceError(
        error,
        "Ingestion",
        "ingestEvent",
        requestLogger
      )
      return errorResponse(
        errorInfo.code,
        errorInfo.message,
        { originalError: error.message },
        errorInfo.statusCode
      )
    }
    
    // Handle other errors
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      { originalError: error instanceof Error ? error.message : String(error) },
      errorInfo.statusCode
    )
  }
}
