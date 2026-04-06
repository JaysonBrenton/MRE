import { describe, it, expect } from "vitest"
import { parseLiveRcRaceResultStats } from "@/core/events/live-rc-race-result-stats"

describe("parseLiveRcRaceResultStats", () => {
  it("returns null for empty input", () => {
    expect(parseLiveRcRaceResultStats(null)).toBeNull()
    expect(parseLiveRcRaceResultStats(undefined)).toBeNull()
    expect(parseLiveRcRaceResultStats({})).toBeNull()
  })

  it("parses snake_case keys from raw_fields_json", () => {
    const s = parseLiveRcRaceResultStats({
      avg_top_5: 34.5,
      avg_top_10: 35.0,
      avg_top_15: 35.2,
      top_2_consecutive: 70.1,
      top_3_consecutive: 105.2,
      std_deviation: 2.5,
    })
    expect(s).not.toBeNull()
    expect(s!.avgTop5).toBe(34.5)
    expect(s!.avgTop10).toBe(35.0)
    expect(s!.avgTop15).toBe(35.2)
    expect(s!.top2Consecutive).toBe(70.1)
    expect(s!.top3Consecutive).toBe(105.2)
    expect(s!.stdDeviation).toBe(2.5)
  })
})
