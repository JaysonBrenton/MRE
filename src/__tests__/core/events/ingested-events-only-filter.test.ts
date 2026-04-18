/**
 * @fileoverview Tests for ingested-events-only filter logic
 *
 * @description Verifies that when ingestedEventsOnly is true, only fully-ingested
 *              events (ingest_depth = laps_full) are shown. Excludes:
 *              - LiveRC-only events (id starts with "liverc-")
 *              - DB events with ingest_depth = none (metadata only, no race/lap data)
 *
 * @purpose Ensures the EventSearchContainer displayedEvents filter works correctly
 *          so users only see events with imported race/lap data when "Imported events only" is ON.
 */

import { describe, it, expect } from "vitest"

/** Filter logic extracted from EventSearchContainer - matches isEventFullyIngested semantics */
function isEventFullyIngested(e: { id: string; ingestDepth?: string }): boolean {
  if (e.id.startsWith("liverc-")) return false
  const d = (e.ingestDepth ?? "").trim().toLowerCase()
  return d === "laps_full" || d === "lapsfull"
}

function filterDisplayedEvents(
  events: Array<{ id: string; eventName: string; ingestDepth?: string }>,
  ingestedEventsOnly: boolean
): typeof events {
  return ingestedEventsOnly ? events.filter((e) => isEventFullyIngested(e)) : events
}

describe("ingested-events-only filter", () => {
  const dbEventFullyIngested = {
    id: "evt-uuid-123",
    eventName: "RCRA March 2024",
    ingestDepth: "laps_full",
  }
  const dbEventNotIngested = {
    id: "2394a986-ae82-4de0-bec7-f397c771a2ac",
    eventName: "T",
    ingestDepth: "none",
  }
  const livercEvent = {
    id: "liverc-12345",
    eventName: "Rcra Not Uploaded",
    ingestDepth: "none",
  }

  it("returns all events when ingestedEventsOnly is false", () => {
    const events = [dbEventFullyIngested, dbEventNotIngested, livercEvent]
    const result = filterDisplayedEvents(events, false)
    expect(result).toHaveLength(3)
    expect(result).toContainEqual(dbEventFullyIngested)
    expect(result).toContainEqual(dbEventNotIngested)
    expect(result).toContainEqual(livercEvent)
  })

  it("filters out LiveRC-only and DB events with ingest_depth=none when ingestedEventsOnly is true", () => {
    const events = [dbEventFullyIngested, dbEventNotIngested, livercEvent]
    const result = filterDisplayedEvents(events, true)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(dbEventFullyIngested)
    expect(result).not.toContainEqual(dbEventNotIngested)
    expect(result).not.toContainEqual(livercEvent)
  })

  it("returns empty when no events are fully ingested and ingestedEventsOnly is true", () => {
    const events = [dbEventNotIngested, livercEvent]
    const result = filterDisplayedEvents(events, true)
    expect(result).toHaveLength(0)
  })

  it("returns only fully-ingested events when mixed and ingestedEventsOnly is true", () => {
    const events = [
      dbEventFullyIngested,
      livercEvent,
      { id: "liverc-67890", eventName: "Another LiveRC", ingestDepth: "none" },
      { id: "evt-uuid-456", eventName: "DB Event 2", ingestDepth: "laps_full" },
      { id: "evt-uuid-789", eventName: "DB Event 3", ingestDepth: "none" },
    ]
    const result = filterDisplayedEvents(events, true)
    expect(result).toHaveLength(2)
    expect(result.map((e) => e.id)).toEqual(["evt-uuid-123", "evt-uuid-456"])
  })

  it("accepts lapsfull (no underscore) as fully ingested", () => {
    const event = { id: "evt-1", eventName: "Test", ingestDepth: "lapsfull" }
    const result = filterDisplayedEvents([event], true)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual(event)
  })
})
