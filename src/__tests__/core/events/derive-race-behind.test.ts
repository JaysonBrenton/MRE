import { describe, expect, it } from "vitest"
import { withDerivedBehindSeconds } from "@/core/events/derive-race-behind"

describe("withDerivedBehindSeconds", () => {
  it("fills secondsBehind from total time gap when behind fields are missing", () => {
    const out = withDerivedBehindSeconds([
      {
        positionFinal: 1,
        lapsCompleted: 11,
        totalTimeSeconds: 307,
        secondsBehind: null,
        behindDisplay: null,
      },
      {
        positionFinal: 2,
        lapsCompleted: 11,
        totalTimeSeconds: 312.052,
        secondsBehind: null,
        behindDisplay: null,
      },
    ])
    expect(out[0].secondsBehind).toBeNull()
    expect(out[1].secondsBehind).toBeCloseTo(5.052, 3)
  })

  it("does not override explicit behindDisplay", () => {
    const out = withDerivedBehindSeconds([
      {
        positionFinal: 1,
        lapsCompleted: 11,
        totalTimeSeconds: 307,
        secondsBehind: null,
        behindDisplay: null,
      },
      {
        positionFinal: 2,
        lapsCompleted: 10,
        totalTimeSeconds: 300,
        secondsBehind: null,
        behindDisplay: "1 Lap",
      },
    ])
    expect(out[1].secondsBehind).toBeNull()
    expect(out[1].behindDisplay).toBe("1 Lap")
  })

  it("does not derive when lap counts differ", () => {
    const out = withDerivedBehindSeconds([
      {
        positionFinal: 1,
        lapsCompleted: 11,
        totalTimeSeconds: 307,
        secondsBehind: null,
        behindDisplay: null,
      },
      {
        positionFinal: 2,
        lapsCompleted: 10,
        totalTimeSeconds: 290,
        secondsBehind: null,
        behindDisplay: null,
      },
    ])
    expect(out[1].secondsBehind).toBeNull()
  })
})
