// @fileoverview LiveRC event discovery API route
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2026-01-02
// 
// @description API route for discovering events from LiveRC
// 
// @purpose Provides user-facing API for LiveRC event discovery. This route
//          delegates to core business logic functions, following the mobile-safe
//          architecture requirement that API routes should not contain business logic.

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { discoverLiveRCEvents } from "@/core/events/discover-liverc-events";
import { getTrackById } from "@/core/tracks/repo";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { createRequestLogger, generateRequestId } from "@/lib/request-context";
import { handleApiError, handleExternalServiceError } from "@/lib/server-error-handler";
import { IngestionServiceError } from "@/lib/ingestion-client";

export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized event discovery request")
    return errorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      {},
      401
    )
  }

  try {
    const body = await request.json();
    const { track_id, start_date, end_date, existing_event_source_ids, track: trackData } = body;

    requestLogger.debug("Event discovery request", {
      trackId: track_id,
      startDate: start_date,
      endDate: end_date,
    })

    // Validate required fields
    if (!track_id) {
      requestLogger.warn("Validation failed - missing track_id")
      return errorResponse(
        "VALIDATION_ERROR",
        "track_id is required",
        { field: "track_id" },
        400
      );
    }

    // Use provided track data or look it up
    let track = trackData
    if (!track) {
      track = await getTrackById(track_id);
      if (!track) {
        requestLogger.warn("Track not found", { trackId: track_id })
        return errorResponse(
          "NOT_FOUND",
          "Track not found",
          { track_id },
          404
        );
      }
    }

    // Convert existing_event_source_ids array to Set if provided
    const existingEventSourceIds = existing_event_source_ids
      ? new Set<string>(existing_event_source_ids)
      : undefined

    // Call core business logic function
    // Note: start_date and end_date are optional for discovery
    // If not provided, we'll discover all events (no date filtering)
    const result = await discoverLiveRCEvents({
      trackId: track.id,
      startDate: start_date,
      endDate: end_date,
      existingEventSourceIds,
      track: {
        id: track.id,
        source: track.source,
        sourceTrackSlug: track.sourceTrackSlug,
        trackName: track.trackName,
      },
    });

    requestLogger.info("Event discovery completed", {
      trackId: track.id,
      newEventsCount: result.newEvents.length,
      existingEventsCount: result.existingEvents.length,
    })

    return successResponse({
      new_events: result.newEvents,
      existing_events: result.existingEvents,
    });
  } catch (error: unknown) {
    // Handle IngestionServiceError specifically (structured errors from ingestion service)
    if (error instanceof IngestionServiceError) {
      const errorInfo = handleExternalServiceError(
        error,
        "LiveRC",
        "discoverLiveRCEvents",
        requestLogger
      )
      return errorResponse(
        errorInfo.code,
        errorInfo.message,
        {
          source: error.source,
          code: error.code,
          details: error.details,
        },
        errorInfo.statusCode
      )
    }
    
    // Handle errors from ingestion client (connection errors, timeouts, circuit breaker, etc.)
    if (error instanceof Error) {
      const isIngestionRelated = 
        error.message.includes("Discovery") ||
        error.message.includes("ingestion service") ||
        error.message.includes("LiveRC") ||
        error.message.includes("circuit open") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("timeout") ||
        error.message.includes("Cannot connect")
      
      if (isIngestionRelated) {
        const errorInfo = handleExternalServiceError(
          error,
          "LiveRC",
          "discoverLiveRCEvents",
          requestLogger
        )
        return errorResponse(
          errorInfo.code,
          errorInfo.message,
          {
            originalMessage: error.message,
            errorName: error.name,
          },
          errorInfo.statusCode
        )
      }
    }
    
    // Handle other errors
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      undefined,
      errorInfo.statusCode
    )
  }
}

