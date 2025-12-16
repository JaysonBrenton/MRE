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
import { getEventWithRaces } from "@/core/events/repo";
import { successResponse, errorResponse, serverErrorResponse } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const event = await getEventWithRaces(eventId);

    if (!event) {
      return errorResponse(
        "NOT_FOUND",
        "Event not found",
        {},
        404
      );
    }

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
    console.error("Error fetching event:", error);
    return serverErrorResponse("Failed to fetch event");
  }
}

