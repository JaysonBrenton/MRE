/**
 * @fileoverview LiveRC event discovery business logic
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Business logic for discovering events from LiveRC
 * 
 * @purpose Provides a clean interface for discovering events from LiveRC that
 *          are not yet in the MRE database. This will integrate with the
 *          Python ingestion service in the future.
 * 
 * @relatedFiles
 * - docs/architecture/liverc-ingestion/03-ingestion-pipeline.md (ingestion pipeline)
 * - ingestion/connectors/liverc/ (Python LiveRC connector)
 */

import { searchEvents as searchEventsFromRepo } from "./repo"
import { ingestionClient } from "@/lib/ingestion-client"

export interface DiscoverLiveRCEventsInput {
  trackId: string
  startDate?: string // ISO date string (optional)
  endDate?: string // ISO date string (optional)
}

export interface DiscoveredEvent {
  id?: string // May not have MRE ID if not in DB
  sourceEventId: string
  eventName: string
  eventDate: string // ISO string
  eventEntries?: number
  eventDrivers?: number
  eventUrl?: string
}

export interface DiscoverLiveRCEventsResult {
  newEvents: DiscoveredEvent[] // Events found on LiveRC but not in MRE DB
  existingEvents: DiscoveredEvent[] // Events already in MRE DB
}

/**
 * Discover events from LiveRC for a given track and date range
 * 
 * This function identifies events that exist on LiveRC but are not yet
 * in the MRE database. It compares LiveRC events with existing DB events.
 * 
 * @param input - Discovery parameters
 * @returns Discovered events separated into new and existing
 */
export async function discoverLiveRCEvents(
  input: DiscoverLiveRCEventsInput
): Promise<DiscoverLiveRCEventsResult> {
  // First, get events already in DB (with optional date filtering)
  const dbResult = await searchEventsFromRepo({
    trackId: input.trackId,
    startDate: input.startDate ? new Date(input.startDate) : undefined,
    endDate: input.endDate ? new Date(input.endDate) : undefined,
  })

  const existingEventIds = new Set(dbResult.events.map((e) => e.sourceEventId))

  // Get track to extract track slug
  const trackSlug = dbResult.track.sourceTrackSlug

  // Call Python ingestion service to discover events from LiveRC
  // If dates are not provided, pass undefined to get all events
  const livercEventSummaries = await ingestionClient.discoverEvents(
    trackSlug,
    input.startDate,
    input.endDate
  )

  // Map Python EventSummary to DiscoveredEvent
  const livercEvents: DiscoveredEvent[] = livercEventSummaries.map((summary) => ({
    id: undefined, // No DB ID yet
    sourceEventId: summary.source_event_id,
    eventName: summary.event_name,
    eventDate: summary.event_date,
    eventEntries: summary.event_entries,
    eventDrivers: summary.event_drivers,
    eventUrl: summary.event_url,
  }))

  // Separate new events from existing ones
  const newEvents: DiscoveredEvent[] = []
  const existingEvents: DiscoveredEvent[] = []

  for (const event of livercEvents) {
    if (existingEventIds.has(event.sourceEventId)) {
      existingEvents.push(event)
    } else {
      newEvents.push(event)
    }
  }

  return {
    newEvents,
    existingEvents,
  }
}
