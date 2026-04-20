import { describe, it, expect } from "vitest"
import { normalizeMultiMainBreakdownJson } from "@/core/events/normalize-multi-main-breakdown"

describe("normalizeMultiMainBreakdownJson", () => {
  it("maps ingestion laps_time to lapsTime", () => {
    const raw = {
      A1: { position: 2, points: 2, laps_time: "17/10:02.843" },
      A2: { position: 1, points: 1, laps_time: "16/10:01.000" },
    }
    expect(normalizeMultiMainBreakdownJson(raw)).toEqual({
      A1: { position: 2, points: 2, lapsTime: "17/10:02.843" },
      A2: { position: 1, points: 1, lapsTime: "16/10:01.000" },
    })
  })

  it("keeps camelCase lapsTime when already present", () => {
    const raw = { A1: { position: 1, points: 1, lapsTime: "10/5:00.000" } }
    expect(normalizeMultiMainBreakdownJson(raw)).toEqual({
      A1: { position: 1, points: 1, lapsTime: "10/5:00.000" },
    })
  })

  it("returns null for non-object", () => {
    expect(normalizeMultiMainBreakdownJson(null)).toBeNull()
    expect(normalizeMultiMainBreakdownJson([])).toBeNull()
  })
})
