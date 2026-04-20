import { describe, it, expect } from "vitest"
import {
  countDriverParticipatedMains,
  isMultiMainCellSitOut,
} from "@/core/events/multi-main-participation"

describe("isMultiMainCellSitOut", () => {
  it("treats empty as sit-out", () => {
    expect(isMultiMainCellSitOut("")).toBe(true)
    expect(isMultiMainCellSitOut(undefined)).toBe(true)
    expect(isMultiMainCellSitOut(null)).toBe(true)
  })

  it("treats 0/0.000 as sit-out / DNS", () => {
    expect(isMultiMainCellSitOut("0/0.000")).toBe(true)
    expect(isMultiMainCellSitOut("0 / 0.000")).toBe(true)
  })

  it("treats normal laps/time as participated", () => {
    expect(isMultiMainCellSitOut("17/10:02.843")).toBe(false)
    expect(isMultiMainCellSitOut("3/2:05.998 (DNF)")).toBe(false)
  })
})

describe("countDriverParticipatedMains", () => {
  it("counts only mains the driver ran", () => {
    expect(countDriverParticipatedMains(["17/10:02.843", "16/10:01.000", "0/0.000"])).toBe(2)
  })
})
