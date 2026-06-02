/**
 * @fileoverview Tests for omnibox track suggestion relevance ranking
 */

import { describe, it, expect } from "vitest"
import { rankTrackSuggestions, scoreTrackSuggestionMatch } from "@/core/events/repo"

describe("scoreTrackSuggestionMatch", () => {
  it("prefers exact track name over slug substring", () => {
    const exact = scoreTrackSuggestionMatch(
      { trackName: "RCRA", sourceTrackSlug: "rcra", city: "Australia" },
      "rcra"
    )
    const slugOnly = scoreTrackSuggestionMatch(
      { trackName: "Galenaro Racing Circuit", sourceTrackSlug: "grcraceway", city: null },
      "rcra"
    )
    expect(exact).toBeGreaterThan(slugOnly)
  })
})

describe("rankTrackSuggestions", () => {
  const candidates = [
    {
      id: "1",
      trackName: "400RcRaceway",
      sourceTrackSlug: "400rcraceway",
      city: null,
      state: null,
      country: "Canada",
    },
    {
      id: "2",
      trackName: "RCRA",
      sourceTrackSlug: "rcra",
      city: null,
      state: null,
      country: "Australia",
    },
    {
      id: "3",
      trackName: "Adrenaline RC Racing",
      sourceTrackSlug: "adrenalinercracing",
      city: null,
      state: null,
      country: "United States",
    },
  ]

  it("returns exact name match first for rcra", () => {
    const ranked = rankTrackSuggestions(candidates, "rcra", 8)
    expect(ranked[0]?.trackName).toBe("RCRA")
  })
})
