/**
 * @fileoverview Integration tests for Next.js to Python ingestion service communication
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Tests for end-to-end event import flow
 *
 * @purpose Validates communication between Next.js application and Python ingestion service,
 *          including error propagation and response handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { importEvent } from "@/core/events/import-event"
import { getEventById } from "@/core/events/repo"
import { ingestionClient } from "@/lib/ingestion-client"

// Mock dependencies
vi.mock("@/core/events/repo")
vi.mock("@/lib/ingestion-client")

describe("Event Import Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("successful event import", () => {
    it("should successfully import event via Python service", async () => {
      const mockEvent = {
        id: "event-123",
        source: "liverc",
        sourceEventId: "12345",
        trackId: "track-123",
        eventName: "Test Event",
        eventDate: new Date("2025-01-15"),
        eventEntries: 50,
        eventDrivers: 45,
        eventUrl: "https://liverc.com/event/12345",
        ingestDepth: "none" as const,
        lastIngestedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockIngestionResult = {
        event_id: "event-123",
        ingest_depth: "laps_full",
        last_ingested_at: "2025-01-27T12:00:00Z",
        races_ingested: 5,
        results_ingested: 45,
        laps_ingested: 450,
        status: "updated" as const,
      }

      vi.mocked(getEventById).mockResolvedValue(mockEvent)
      vi.mocked(ingestionClient.ingestEvent).mockResolvedValue(mockIngestionResult)

      const result = await importEvent({
        eventId: "event-123",
        depth: "laps_full",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.eventId).toBe("event-123")
        expect(result.status).toBe("started")
        expect(result.ingestDepth).toBe("laps_full")
      }

      expect(getEventById).toHaveBeenCalledWith("event-123")
      expect(ingestionClient.ingestEvent).toHaveBeenCalledWith("event-123", "laps_full")
    })
  })

  describe("error handling", () => {
    it("should handle event not found error", async () => {
      vi.mocked(getEventById).mockResolvedValue(null)

      const result = await importEvent({
        eventId: "non-existent-event",
        depth: "laps_full",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("NOT_FOUND")
        expect(result.error.message).toBe("Event not found")
      }

      expect(ingestionClient.ingestEvent).not.toHaveBeenCalled()
    })

    it("should handle Python service ingestion failure", async () => {
      const mockEvent = {
        id: "event-123",
        source: "liverc",
        sourceEventId: "12345",
        trackId: "track-123",
        eventName: "Test Event",
        eventDate: new Date("2025-01-15"),
        eventEntries: 50,
        eventDrivers: 45,
        eventUrl: "https://liverc.com/event/12345",
        ingestDepth: "none" as const,
        lastIngestedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(getEventById).mockResolvedValue(mockEvent)
      vi.mocked(ingestionClient.ingestEvent).mockRejectedValue(
        new Error("Ingestion failed: Connection timeout")
      )

      const result = await importEvent({
        eventId: "event-123",
        depth: "laps_full",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("INGESTION_FAILED")
        expect(result.error.message).toContain("Ingestion failed")
      }
    })

    it("should handle Python service HTTP errors", async () => {
      const mockEvent = {
        id: "event-123",
        source: "liverc",
        sourceEventId: "12345",
        trackId: "track-123",
        eventName: "Test Event",
        eventDate: new Date("2025-01-15"),
        eventEntries: 50,
        eventDrivers: 45,
        eventUrl: "https://liverc.com/event/12345",
        ingestDepth: "none" as const,
        lastIngestedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(getEventById).mockResolvedValue(mockEvent)
      vi.mocked(ingestionClient.ingestEvent).mockRejectedValue(
        new Error("Ingestion failed: Service unavailable")
      )

      const result = await importEvent({
        eventId: "event-123",
        depth: "laps_full",
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe("INGESTION_FAILED")
      }
    })
  })

  describe("response mapping", () => {
    it("should map Python service response correctly for already complete event", async () => {
      const mockEvent = {
        id: "event-123",
        source: "liverc",
        sourceEventId: "12345",
        trackId: "track-123",
        eventName: "Test Event",
        eventDate: new Date("2025-01-15"),
        eventEntries: 50,
        eventDrivers: 45,
        eventUrl: "https://liverc.com/event/12345",
        ingestDepth: "laps_full" as const,
        lastIngestedAt: new Date("2025-01-26"),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockIngestionResult = {
        event_id: "event-123",
        ingest_depth: "laps_full",
        last_ingested_at: "2025-01-26T12:00:00Z",
        races_ingested: 0,
        results_ingested: 0,
        laps_ingested: 0,
        status: "already_complete" as const,
      }

      vi.mocked(getEventById).mockResolvedValue(mockEvent)
      vi.mocked(ingestionClient.ingestEvent).mockResolvedValue(mockIngestionResult)

      const result = await importEvent({
        eventId: "event-123",
        depth: "laps_full",
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.ingestDepth).toBe("laps_full")
        expect(result.racesIngested).toBe(0)
        expect(result.resultsIngested).toBe(0)
        expect(result.lapsIngested).toBe(0)
      }
    })
  })
})
