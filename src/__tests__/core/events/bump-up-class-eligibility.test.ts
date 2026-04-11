import { describe, it, expect } from "vitest"
import { isClassExcludedFromBumpUps } from "@/core/events/bump-up-class-eligibility"

describe("isClassExcludedFromBumpUps", () => {
  it("excludes EP-prefixed and Electric in name", () => {
    expect(isClassExcludedFromBumpUps("EP Buggy")).toBe(true)
    expect(isClassExcludedFromBumpUps("EP Truggy")).toBe(true)
    expect(isClassExcludedFromBumpUps("1/8 Electric Buggy")).toBe(true)
  })

  it("does not exclude nitro classes", () => {
    expect(isClassExcludedFromBumpUps("1/8 Nitro Buggy")).toBe(false)
    expect(isClassExcludedFromBumpUps("EP Nitro Buggy")).toBe(false)
    expect(isClassExcludedFromBumpUps("Buggy", "1/8 Nitro Buggy")).toBe(false)
  })

  it("excludes when vehicleType contains Electric", () => {
    expect(isClassExcludedFromBumpUps("Buggy", "1/8 Electric Buggy")).toBe(true)
  })
})
