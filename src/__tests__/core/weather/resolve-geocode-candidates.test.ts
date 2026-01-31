/**
 * @fileoverview Tests for resolveGeocodeCandidates function
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Unit tests for geocoding candidate resolution
 *
 * @purpose Validates candidate generation logic for different event name patterns,
 *          series vs normal track names, and edge cases.
 */

import { describe, it, expect } from "vitest"
import { resolveGeocodeCandidates } from "@/core/weather/resolve-geocode-candidates"
import type { Event, Track } from "@prisma/client"

function createMockEvent(
  eventName: string,
  trackName: string,
  overrides?: Partial<Event & { track: Partial<Track> }>
): Event & { track: Track } {
  return {
    id: "event-123",
    source: "liverc",
    sourceEventId: "source-123",
    trackId: "track-123",
    eventName,
    eventDate: new Date("2025-06-15T12:00:00Z"),
    eventEntries: 10,
    eventDrivers: 8,
    eventUrl: "https://example.com",
    ingestDepth: "none",
    lastIngestedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    track: {
      id: "track-123",
      source: "liverc",
      sourceTrackSlug: "slug-123",
      trackName,
      trackUrl: "https://example.com/track",
      eventsUrl: "https://example.com/events",
      livercTrackLastUpdated: null,
      lastSeenAt: null,
      isActive: true,
      isFollowed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides?.track,
    },
    ...overrides,
  } as Event & { track: Track }
}

describe("resolveGeocodeCandidates", () => {
  describe("series/championship track names", () => {
    it("should prioritize eventName-derived candidates for series tracks", () => {
      const event = createMockEvent(
        "ABC Rnd 4 Jakarta Indonesia w/ Scotty Ernst",
        "Asian Buggy Championship"
      )

      const candidates = resolveGeocodeCandidates(event)

      // Should prioritize location from eventName, then trackName as fallback
      expect(candidates.length).toBeGreaterThan(0)
      expect(candidates[0]).toContain("Jakarta")
      expect(candidates).toContain("Asian Buggy Championship")
    })

    it("should extract location from eventName with comma-separated pattern", () => {
      const event = createMockEvent("Round 5 Sydney, Australia", "National Championship Series")

      const candidates = resolveGeocodeCandidates(event)

      expect(candidates).toContain("Sydney, Australia")
      expect(candidates[0]).toBe("Sydney, Australia")
    })

    it("should handle eventName with 'w/' noise segment", () => {
      const event = createMockEvent(
        "ABC Rnd 4 Jakarta Indonesia w/ Scotty Ernst",
        "Asian Buggy Championship"
      )

      const candidates = resolveGeocodeCandidates(event)

      // Should remove "w/ Scotty Ernst" and extract location
      expect(candidates.some((c) => c.includes("Jakarta"))).toBe(true)
      expect(candidates.some((c) => c.includes("Scotty"))).toBe(false)
    })

    it("should handle eventName with 'with' noise segment", () => {
      const event = createMockEvent(
        "Round 3 Tokyo Japan with Special Guest",
        "World Tour Championship"
      )

      const candidates = resolveGeocodeCandidates(event)

      expect(candidates.some((c) => c.includes("Tokyo"))).toBe(true)
      expect(candidates.some((c) => c.includes("Special"))).toBe(false)
    })

    it("should remove round prefixes from eventName", () => {
      const event = createMockEvent("ABC Rnd 4 Jakarta Indonesia", "Championship Series")

      const candidates = resolveGeocodeCandidates(event)

      expect(candidates.some((c) => c.includes("Jakarta"))).toBe(true)
      expect(candidates.some((c) => c.includes("ABC"))).toBe(false)
      expect(candidates.some((c) => c.includes("Rnd 4"))).toBe(false)
    })
  })

  describe("normal track names", () => {
    it("should prioritize trackName for normal tracks", () => {
      const event = createMockEvent("Test Race Event", "Sydney Motorsport Park")

      const candidates = resolveGeocodeCandidates(event)

      // trackName should be first
      expect(candidates[0]).toBe("Sydney Motorsport Park")
    })

    it("should include eventName-derived candidates as fallback for normal tracks", () => {
      const event = createMockEvent("Race at Melbourne, Victoria", "Test Track")

      const candidates = resolveGeocodeCandidates(event)

      expect(candidates).toContain("Test Track")
      expect(candidates).toContain("Melbourne, Victoria")
    })
  })

  describe("edge cases", () => {
    it("should handle eventName with no location-like words", () => {
      const event = createMockEvent("Test Race", "Normal Track")

      const candidates = resolveGeocodeCandidates(event)

      // Should still include trackName
      expect(candidates).toContain("Normal Track")
      // May include "Test Race" as fallback
      expect(candidates.length).toBeGreaterThan(0)
    })

    it("should deduplicate candidates", () => {
      const event = createMockEvent("Race at Sydney", "Sydney")

      const candidates = resolveGeocodeCandidates(event)

      // "Sydney" should only appear once
      const sydneyCount = candidates.filter((c) => c === "Sydney").length
      expect(sydneyCount).toBeLessThanOrEqual(1)
    })

    it("should filter out candidates that match series pattern", () => {
      const event = createMockEvent("Test Championship Event", "Normal Track")

      const candidates = resolveGeocodeCandidates(event)

      // Should not include "Championship" as a candidate
      expect(candidates.some((c) => c === "Championship")).toBe(false)
    })

    it("should handle single-word location in eventName", () => {
      const event = createMockEvent("Round 1 Tokyo", "Championship Series")

      const candidates = resolveGeocodeCandidates(event)

      expect(candidates).toContain("Tokyo")
    })

    it("should handle multi-word location in eventName", () => {
      const event = createMockEvent("Round 2 New York City", "World Series")

      const candidates = resolveGeocodeCandidates(event)

      // Should extract "New York City" and shorter variants
      expect(candidates.some((c) => c.includes("New York"))).toBe(true)
    })

    it("should handle empty or minimal eventName", () => {
      const event = createMockEvent("A", "Test Track")

      const candidates = resolveGeocodeCandidates(event)

      // Should still include trackName
      expect(candidates).toContain("Test Track")
    })
  })

  describe("candidate ordering", () => {
    it("should order candidates correctly for series tracks", () => {
      const event = createMockEvent("ABC Rnd 4 Jakarta Indonesia", "Asian Buggy Championship")

      const candidates = resolveGeocodeCandidates(event)

      // EventName-derived candidates should come first
      expect(candidates[0]).not.toBe("Asian Buggy Championship")
      // TrackName should be last
      expect(candidates[candidates.length - 1]).toBe("Asian Buggy Championship")
    })

    it("should order candidates correctly for normal tracks", () => {
      const event = createMockEvent("Race at Melbourne", "Sydney Track")

      const candidates = resolveGeocodeCandidates(event)

      // TrackName should come first
      expect(candidates[0]).toBe("Sydney Track")
    })
  })
})
