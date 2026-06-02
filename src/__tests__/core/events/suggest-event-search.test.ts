/**
 * @fileoverview Tests for the database-only Event Search suggestion logic.
 *
 * @description Validates query gating, limit clamping, and grouped results for
 *              suggestEventSearch. The repo layer is mocked so these tests stay
 *              deterministic and free of Prisma.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  suggestEventSearch,
  clampSuggestLimit,
  SUGGEST_DEFAULT_LIMIT,
  SUGGEST_MAX_LIMIT,
} from "@/core/events/suggest-event-search"
import { suggestTracksByText, suggestEventsByText } from "@/core/events/repo"

vi.mock("@/core/events/repo", () => ({
  suggestTracksByText: vi.fn(),
  suggestEventsByText: vi.fn(),
}))

const mockedSuggestTracks = vi.mocked(suggestTracksByText)
const mockedSuggestEvents = vi.mocked(suggestEventsByText)

describe("clampSuggestLimit", () => {
  it("defaults when undefined or NaN", () => {
    expect(clampSuggestLimit(undefined)).toBe(SUGGEST_DEFAULT_LIMIT)
    expect(clampSuggestLimit(Number.NaN)).toBe(SUGGEST_DEFAULT_LIMIT)
  })

  it("clamps below 1 up to 1 and above max down to max", () => {
    expect(clampSuggestLimit(0)).toBe(1)
    expect(clampSuggestLimit(-5)).toBe(1)
    expect(clampSuggestLimit(SUGGEST_MAX_LIMIT + 50)).toBe(SUGGEST_MAX_LIMIT)
  })

  it("truncates fractional values", () => {
    expect(clampSuggestLimit(5.9)).toBe(5)
  })
})

describe("suggestEventSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("short-circuits to empty groups for queries shorter than 2 chars", async () => {
    const result = await suggestEventSearch("a", 8)

    expect(result).toEqual({ query: "a", tracks: [], events: [] })
    expect(mockedSuggestTracks).not.toHaveBeenCalled()
    expect(mockedSuggestEvents).not.toHaveBeenCalled()
  })

  it("trims the query before length-gating", async () => {
    const result = await suggestEventSearch("   x   ", 8)

    expect(result.query).toBe("x")
    expect(mockedSuggestTracks).not.toHaveBeenCalled()
  })

  it("returns grouped track and event suggestions for valid queries", async () => {
    mockedSuggestTracks.mockResolvedValue([
      {
        id: "trk-1",
        trackName: "Canberra Off Road",
        sourceTrackSlug: "canberra",
        city: "Canberra",
        state: "ACT",
        country: "Australia",
      },
    ])
    mockedSuggestEvents.mockResolvedValue([
      {
        id: "evt-1",
        eventName: "Round 5",
        eventDate: "2026-05-30T00:00:00.000Z",
        trackId: "trk-1",
        trackName: "Canberra Off Road",
        ingestDepth: "laps_full",
      },
    ])

    const result = await suggestEventSearch("round", 8)

    expect(mockedSuggestTracks).toHaveBeenCalledWith("round", 8)
    expect(mockedSuggestEvents).toHaveBeenCalledWith("round", 8)
    expect(result.tracks).toHaveLength(1)
    expect(result.events[0].eventName).toBe("Round 5")
  })

  it("clamps the limit before passing it to the repo", async () => {
    mockedSuggestTracks.mockResolvedValue([])
    mockedSuggestEvents.mockResolvedValue([])

    await suggestEventSearch("round", 999)

    expect(mockedSuggestTracks).toHaveBeenCalledWith("round", SUGGEST_MAX_LIMIT)
    expect(mockedSuggestEvents).toHaveBeenCalledWith("round", SUGGEST_MAX_LIMIT)
  })
})
