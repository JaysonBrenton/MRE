// @fileoverview Event detail API route
// 
// @created 2025-01-27
// @creator Jayson Brenton
// @lastModified 2025-01-27
// 
// @description API route for getting event details
// 
// @purpose Provides user-facing API for event metadata and ingestion status

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getEventWithRaces } from "@/core/events/repo";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { createRequestLogger, generateRequestId } from "@/lib/request-context";
import { handleApiError } from "@/lib/server-error-handler";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const requestId = generateRequestId()
  const requestLogger = createRequestLogger(request, requestId)

  // Check authentication
  const session = await auth()
  if (!session) {
    requestLogger.warn("Unauthorized event detail request")
    return errorResponse(
      "UNAUTHORIZED",
      "Authentication required",
      {},
      401
    )
  }

  try {
    const { eventId } = await params;
    const event = await getEventWithRaces(eventId);

    if (!event) {
      requestLogger.warn("Event not found", { eventId })
      return errorResponse(
        "NOT_FOUND",
        "Event not found",
        {},
        404
      );
    }

    requestLogger.info("Event fetched successfully", {
      eventId,
      racesCount: event.races.length,
    })

    return successResponse({
      id: event.id,
      source: event.source,
      source_event_id: event.sourceEventId,
      track_id: event.trackId,
      event_name: event.eventName,
      event_date: event.eventDate.toISOString(),
      event_entries: event.eventEntries,
      event_drivers: event.eventDrivers,
      event_url: event.eventUrl,
      ingest_depth: event.ingestDepth,
      last_ingested_at: event.lastIngestedAt?.toISOString() || null,
      races: event.races.map((race) => ({
        id: race.id,
        event_id: race.eventId,
        class_name: race.className,
        race_label: race.raceLabel,
        race_order: race.raceOrder,
        start_time: race.startTime?.toISOString() || null,
        duration_seconds: race.durationSeconds,
      })),
    });
  } catch (error) {
    const errorInfo = handleApiError(error, request, requestId)
    return errorResponse(
      errorInfo.code,
      errorInfo.message,
      undefined,
      errorInfo.statusCode
    )
  }
}

