import { describe, it, expect } from "vitest"
import {
  getBracketFinalLadderRank,
  isMainEventsSection,
  parseBracketFinalDenominator,
} from "@/core/events/bump-up-ladder-strategies"

describe("parseBracketFinalDenominator", () => {
  it("parses RCRA-style Buggy finals", () => {
    expect(parseBracketFinalDenominator("Buggy 1/16 Even Final")).toBe(16)
    expect(parseBracketFinalDenominator("Buggy 1/4 Odd Final")).toBe(4)
    expect(parseBracketFinalDenominator("Buggy 1/1 Even Final")).toBe(1)
  })

  it("returns null for non-bracket labels", () => {
    expect(parseBracketFinalDenominator("EP Buggy A1-Main")).toBeNull()
    expect(parseBracketFinalDenominator("Buggy (Heat 1/7)")).toBeNull()
  })
})

describe("getBracketFinalLadderRank", () => {
  it("ranks 1/16 below 1/1 (closer to championship = higher rank)", () => {
    const r16 = getBracketFinalLadderRank("Buggy 1/16 Even Final", "Main Events", "race")
    const r1 = getBracketFinalLadderRank("Buggy 1/1 Even Final", "Main Events", "race")
    expect(r16).not.toBeNull()
    expect(r1).not.toBeNull()
    expect(r1! > r16!).toBe(true)
  })

  it("returns null outside Main Events when section is set", () => {
    expect(getBracketFinalLadderRank("Buggy 1/4 Odd Final", "Qualifier Round 1", "race")).toBeNull()
  })

  it("allows bracket finals when section is missing (ingestion gap)", () => {
    expect(getBracketFinalLadderRank("Buggy 1/4 Odd Final", null, "race")).not.toBeNull()
  })
})

describe("isMainEventsSection", () => {
  it("detects main events heading", () => {
    expect(isMainEventsSection("Main Events")).toBe(true)
    expect(isMainEventsSection("Qualifier Round 1")).toBe(false)
  })
})
