/**
 * @fileoverview Tests for lap-trend race filtering helpers
 */

import { filterRacesForEventLapTrend } from "@/core/events/get-lap-data"
import { describe, expect, it } from "vitest"

describe("filterRacesForEventLapTrend", () => {
  it("drops LiveRC schedule placeholder rows", () => {
    const races = [
      { id: "1", className: "Buggy", raceLabel: "A-Main" },
      { id: "2", className: "Track Maintenance", raceLabel: "15 MIN BREAK" },
    ]
    expect(filterRacesForEventLapTrend(races)).toEqual([races[0]])
  })
})
