import { describe, it, expect } from "vitest"
import {
  getRaceClassNamesForBumpUpChips,
  getRaceClassNamesFromRaces,
} from "@/core/events/class-validator"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

function minimalRace(className: string, id: string): EventAnalysisData["races"][number] {
  return {
    id,
    raceId: id,
    className,
    raceLabel: `${className} A-Main`,
    raceOrder: 1,
    startTime: null,
    durationSeconds: null,
    sessionType: "main",
    sectionHeader: "Main Events",
    raceUrl: `https://example.com/${id}`,
    results: [],
  }
}

describe("getRaceClassNamesFromRaces", () => {
  it("returns unique sorted class names from races only", () => {
    const data = {
      races: [
        minimalRace("1/8 Nitro Buggy", "r1"),
        minimalRace("1/8 Electric Buggy", "r2"),
        minimalRace("1/8 Nitro Buggy", "r3"),
      ],
    } as unknown as EventAnalysisData
    expect(getRaceClassNamesFromRaces(data)).toEqual(["1/8 Electric Buggy", "1/8 Nitro Buggy"])
  })

  it("returns empty array when no races", () => {
    const data = { races: [] } as unknown as EventAnalysisData
    expect(getRaceClassNamesFromRaces(data)).toEqual([])
  })
})

describe("getRaceClassNamesForBumpUpChips", () => {
  it("includes only classes that appear on mains / LCQ / semi rows, not practice-only labels", () => {
    const data = {
      races: [
        {
          ...minimalRace("Buggy", "p1"),
          raceLabel: "Practice 1",
          sessionType: "practice",
          sectionHeader: "Practice",
        },
        minimalRace("1/8 Nitro Buggy", "m1"),
      ],
      raceClasses: new Map(),
    } as unknown as EventAnalysisData
    expect(getRaceClassNamesForBumpUpChips(data)).toEqual(["1/8 Nitro Buggy"])
  })

  it("includes class when LCQ row uses that className", () => {
    const data = {
      races: [
        {
          id: "lcq",
          raceId: "lcq",
          className: "1/8 Nitro Buggy",
          raceLabel: "Last Chance Qualifier",
          raceOrder: 1,
          startTime: null,
          durationSeconds: null,
          sessionType: "race",
          sectionHeader: "Main Events",
          raceUrl: "https://example.com/lcq",
          results: [],
        },
      ],
      raceClasses: new Map(),
    } as unknown as EventAnalysisData
    expect(getRaceClassNamesForBumpUpChips(data)).toEqual(["1/8 Nitro Buggy"])
  })

  it("excludes electric and EP-prefixed classes from bump-up chips", () => {
    const data = {
      races: [
        minimalRace("EP Buggy", "e1"),
        minimalRace("EP Truggy", "e2"),
        minimalRace("1/8 Electric Buggy", "e3"),
        minimalRace("1/8 Nitro Buggy", "n1"),
      ],
      raceClasses: new Map([
        ["EP Buggy", { vehicleType: "1/8 Buggy", vehicleTypeNeedsReview: false }],
        [
          "1/8 Electric Buggy",
          { vehicleType: "1/8 Electric Buggy", vehicleTypeNeedsReview: false },
        ],
      ]),
    } as unknown as EventAnalysisData
    expect(getRaceClassNamesForBumpUpChips(data)).toEqual(["1/8 Nitro Buggy"])
  })
})
