/**
 * @fileoverview Tests for event search business logic
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Tests for event search functionality
 *
 * @purpose Validates event search logic including success cases and error handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { searchEvents } from "@/core/events/search-events"
import { searchEvents as searchEventsFromRepo } from "@/core/events/repo"
import { validateEventSearchParams } from "@/core/events/validate"

// Mock dependencies
vi.mock("@/core/events/repo")
vi.mock("@/core/events/validate")

describe("searchEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("successful search", () => {
    it("should search events with valid parameters", async () => {
      const mockInput = {
        trackId: "track-123",
        startDate: "2025-01-01T00:00:00Z",
        endDate: "2025-01-31T23:59:59Z",
      }

      const mockResult = {
        track: {
          id: "track-123",
          source: "liverc",
          sourceTrackSlug: "test-track",
          trackName: "Test Track",
        },
        events: [
          {
            id: "event-1",
            source: "liverc",
            sourceEventId: "12345",
            eventName: "Test Event",
            eventDate: "2025-01-15T00:00:00Z",
            eventEntries: 50,
            eventDrivers: 45,
            eventUrl: "https://liverc.com/event/12345",
            ingestDepth: "none",
            lastIngestedAt: null,
          },
        ],
      }

      vi.mocked(validateEventSearchParams).mockReturnValue(null)
      vi.mocked(searchEventsFromRepo).mockResolvedValue(mockResult)

      const result = await searchEvents(mockInput)

      expect(result).toEqual(mockResult)
      expect(validateEventSearchParams).toHaveBeenCalledWith(
        mockInput.trackId,
        mockInput.startDate,
        mockInput.endDate
      )
      expect(searchEventsFromRepo).toHaveBeenCalledWith({
        trackId: mockInput.trackId,
        startDate: new Date(mockInput.startDate),
        endDate: new Date(mockInput.endDate),
      })
    })

    it("should convert date strings to Date objects", async () => {
      const mockInput = {
        trackId: "track-123",
        startDate: "2025-01-01T00:00:00Z",
        endDate: "2025-01-31T23:59:59Z",
      }

      const mockResult = {
        track: {
          id: "track-123",
          source: "liverc",
          sourceTrackSlug: "test-track",
          trackName: "Test Track",
        },
        events: [],
      }

      vi.mocked(validateEventSearchParams).mockReturnValue(null)
      vi.mocked(searchEventsFromRepo).mockResolvedValue(mockResult)

      await searchEvents(mockInput)

      expect(searchEventsFromRepo).toHaveBeenCalledWith({
        trackId: mockInput.trackId,
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      })
    })
  })

  describe("validation errors", () => {
    it("should throw validation error when validation fails", async () => {
      const mockInput = {
        trackId: "",
        startDate: "2025-01-01T00:00:00Z",
        endDate: "2025-01-31T23:59:59Z",
      }

      const validationError = {
        code: "VALIDATION_ERROR",
        message: "track_id is required",
        field: "track_id",
      }

      vi.mocked(validateEventSearchParams).mockReturnValue(validationError)

      await expect(searchEvents(mockInput)).rejects.toEqual(validationError)
      expect(searchEventsFromRepo).not.toHaveBeenCalled()
    })

    it("should throw error for invalid date range", async () => {
      const mockInput = {
        trackId: "track-123",
        startDate: "2025-01-31T00:00:00Z",
        endDate: "2025-01-01T00:00:00Z", // End before start
      }

      const validationError = {
        code: "VALIDATION_ERROR",
        message: "start_date must be before or equal to end_date",
        field: "start_date",
      }

      vi.mocked(validateEventSearchParams).mockReturnValue(validationError)

      await expect(searchEvents(mockInput)).rejects.toEqual(validationError)
      expect(searchEventsFromRepo).not.toHaveBeenCalled()
    })
  })

  describe("track not found", () => {
    it("should throw error when track is not found", async () => {
      const mockInput = {
        trackId: "non-existent-track",
        startDate: "2025-01-01T00:00:00Z",
        endDate: "2025-01-31T23:59:59Z",
      }

      vi.mocked(validateEventSearchParams).mockReturnValue(null)
      vi.mocked(searchEventsFromRepo).mockRejectedValue(new Error("Track not found"))

      await expect(searchEvents(mockInput)).rejects.toThrow("Track not found")
    })
  })
})
