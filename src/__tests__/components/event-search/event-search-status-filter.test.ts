import { describe, expect, it, vi, afterEach } from "vitest"
import {
  applyEventStatusFilters,
  eventMatchesStatusFilters,
  isEventFullyIngested,
} from "@/components/organisms/event-search/event-search-status-filter"
import * as dateUtils from "@/lib/date-utils"

describe("event-search-status-filter", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("isEventFullyIngested", () => {
    it("returns true for laps_full DB events", () => {
      expect(isEventFullyIngested({ id: "evt-1", ingestDepth: "laps_full" })).toBe(true)
      expect(isEventFullyIngested({ id: "evt-1", ingestDepth: "lapsfull" })).toBe(true)
    })

    it("returns false for LiveRC-only and non-imported events", () => {
      expect(isEventFullyIngested({ id: "liverc-123", ingestDepth: "laps_full" })).toBe(false)
      expect(isEventFullyIngested({ id: "evt-1", ingestDepth: "none" })).toBe(false)
      expect(isEventFullyIngested({ id: "evt-1" })).toBe(false)
    })
  })

  describe("eventMatchesStatusFilters", () => {
    it("shows all events when both toggles are on", () => {
      const ready = { id: "evt-1", ingestDepth: "laps_full", eventDate: "2024-01-01" }
      const notUploaded = { id: "liverc-1", ingestDepth: "none", eventDate: "2024-06-01" }

      expect(eventMatchesStatusFilters(ready, { includeReady: true, includeScheduled: true })).toBe(
        true
      )
      expect(
        eventMatchesStatusFilters(notUploaded, { includeReady: true, includeScheduled: true })
      ).toBe(true)
    })

    it("hides Ready events when includeReady is off", () => {
      const ready = { id: "evt-1", ingestDepth: "laps_full", eventDate: "2024-01-01" }
      const notUploaded = { id: "evt-2", ingestDepth: "none", eventDate: "2024-06-01" }

      expect(
        eventMatchesStatusFilters(ready, { includeReady: false, includeScheduled: true })
      ).toBe(false)
      expect(
        eventMatchesStatusFilters(notUploaded, { includeReady: false, includeScheduled: true })
      ).toBe(true)
    })

    it("hides Scheduled events when includeScheduled is off", () => {
      vi.spyOn(dateUtils, "isEventInFuture").mockReturnValue(true)
      const scheduled = { id: "evt-future", ingestDepth: "none", eventDate: "2099-12-31" }

      expect(
        eventMatchesStatusFilters(scheduled, { includeReady: true, includeScheduled: false })
      ).toBe(false)
    })

    it("treats future events as Scheduled even when laps_full", () => {
      vi.spyOn(dateUtils, "isEventInFuture").mockReturnValue(true)
      const futureReady = { id: "evt-1", ingestDepth: "laps_full", eventDate: "2099-12-31" }

      expect(
        eventMatchesStatusFilters(futureReady, { includeReady: false, includeScheduled: true })
      ).toBe(true)
      expect(
        eventMatchesStatusFilters(futureReady, { includeReady: true, includeScheduled: false })
      ).toBe(false)
    })
  })

  describe("applyEventStatusFilters", () => {
    const events = [
      { id: "evt-ready", ingestDepth: "laps_full", eventDate: "2024-01-01" },
      { id: "evt-new", ingestDepth: "none", eventDate: "2024-06-01" },
    ]

    it("returns the same array reference when both toggles are on", () => {
      const result = applyEventStatusFilters(events, {
        includeReady: true,
        includeScheduled: true,
      })
      expect(result).toBe(events)
    })

    it("filters Ready rows when includeReady is off", () => {
      const result = applyEventStatusFilters(events, {
        includeReady: false,
        includeScheduled: true,
      })
      expect(result.map((e) => e.id)).toEqual(["evt-new"])
    })
  })
})
