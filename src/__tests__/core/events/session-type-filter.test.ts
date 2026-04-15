import { describe, expect, it } from "vitest"
import { sessionTypeFilterKeyForRace } from "@/core/events/session-type-filter"

describe("sessionTypeFilterKeyForRace", () => {
  it("buckets label-detected mains even when sessionType is generic", () => {
    expect(
      sessionTypeFilterKeyForRace({
        sessionType: "race",
        raceLabel: "1/8 Buggy A-Main",
        sectionHeader: null,
        className: "Buggy",
      })
    ).toBe("main")
    expect(
      sessionTypeFilterKeyForRace({
        sessionType: null,
        raceLabel: "A2-Main",
        sectionHeader: null,
        className: "Buggy",
      })
    ).toBe("main")
  })

  it("uses normalized session type when not a main", () => {
    expect(
      sessionTypeFilterKeyForRace({
        sessionType: "heat",
        raceLabel: "Heat 1",
        sectionHeader: null,
        className: "Buggy",
      })
    ).toBe("heat")
    expect(
      sessionTypeFilterKeyForRace({
        sessionType: null,
        raceLabel: "Round 1",
        sectionHeader: null,
        className: "Buggy",
      })
    ).toBe("race")
  })
})
