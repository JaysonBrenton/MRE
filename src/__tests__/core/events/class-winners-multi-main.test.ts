/**
 * @fileoverview Tests for class winner selection from multi-main standings
 */

import { describe, it, expect } from "vitest"
import {
  baseClassFromMultiMainLabel,
  canonicalClassBaseForWinnerMatch,
  isMainSplitOnlyLabel,
  pickBestMultiMainBlockForClass,
  listMultiMainBlocksForCanonicalClass,
  multiMainBlockMatchesCanonicalClass,
} from "@/core/events/class-winners-multi-main"
import { buildClassWinners } from "@/core/events/build-event-highlights"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

describe("canonicalClassBaseForWinnerMatch", () => {
  it("strips the same scale prefix as multi-main labels", () => {
    expect(canonicalClassBaseForWinnerMatch("1/8 EP Buggy")).toBe("EP Buggy")
    expect(canonicalClassBaseForWinnerMatch("Ep Buggy")).toBe("Ep Buggy")
  })
})

describe("multiMainBlockMatchesCanonicalClass", () => {
  it("matches registration class with scale prefix to multi-main block base", () => {
    const mm = {
      id: "x",
      classLabel: "1/8 Ep Buggy Triple A-Main",
      tieBreaker: null,
      completedMains: 3,
      totalMains: 3,
      entries: [],
    }
    expect(multiMainBlockMatchesCanonicalClass(mm, "1/8 EP Buggy")).toBe(true)
    expect(multiMainBlockMatchesCanonicalClass(mm, "EP Buggy")).toBe(true)
    expect(multiMainBlockMatchesCanonicalClass(mm, "Ic Buggy")).toBe(false)
  })
})

describe("baseClassFromMultiMainLabel", () => {
  it("strips Triple A-Main and scale prefix", () => {
    expect(baseClassFromMultiMainLabel("1/8 Ep Buggy Triple A-Main")).toBe("Ep Buggy")
    expect(baseClassFromMultiMainLabel("Ep Buggy Triple A-Main")).toBe("Ep Buggy")
  })

  it("strips Triple B-Main", () => {
    expect(baseClassFromMultiMainLabel("Ep Buggy Triple B-Main")).toBe("Ep Buggy")
  })
})

describe("isMainSplitOnlyLabel", () => {
  it("flags B-main-only labels", () => {
    expect(isMainSplitOnlyLabel("Ep Buggy Triple B-Main")).toBe(true)
    expect(isMainSplitOnlyLabel("Something B-Main")).toBe(true)
  })

  it("does not flag combined or A-main labels", () => {
    expect(isMainSplitOnlyLabel("Ep Buggy Triple A-Main")).toBe(false)
    expect(isMainSplitOnlyLabel("Ep Buggy")).toBe(false)
  })
})

describe("pickBestMultiMainBlockForClass", () => {
  it("prefers larger entry list (combined overall)", () => {
    const small = {
      id: "a",
      classLabel: "Ep Buggy",
      tieBreaker: null,
      completedMains: 3,
      totalMains: 3,
      entries: [
        {
          position: 1,
          seededPosition: null,
          driverId: "d1",
          driverName: "Wrong",
          points: 1,
          mainBreakdown: null,
        },
        {
          position: 2,
          seededPosition: null,
          driverId: "d2",
          driverName: "X",
          points: 2,
          mainBreakdown: null,
        },
      ],
    }
    const large = {
      id: "b",
      classLabel: "Ep Buggy Triple A-Main",
      tieBreaker: null,
      completedMains: 3,
      totalMains: 3,
      entries: Array.from({ length: 20 }, (_, i) => ({
        position: i + 1,
        seededPosition: null,
        driverId: `d${i}`,
        driverName: i === 0 ? "Right" : `P${i + 1}`,
        points: i + 1,
        mainBreakdown: null,
      })),
    }
    const picked = pickBestMultiMainBlockForClass([small, large], "Ep Buggy")
    expect(picked?.classLabel).toBe("Ep Buggy Triple A-Main")
    expect(picked?.entries[0]?.driverName).toBe("Right")
  })

  it("returns null when only B-main split exists", () => {
    const bOnly = {
      id: "b",
      classLabel: "Ep Buggy Triple B-Main",
      tieBreaker: null,
      completedMains: 1,
      totalMains: 1,
      entries: [
        {
          position: 1,
          seededPosition: null,
          driverId: "d1",
          driverName: "Ben",
          points: 1,
          mainBreakdown: null,
        },
      ],
    }
    expect(pickBestMultiMainBlockForClass([bOnly], "Ep Buggy")).toBeNull()
  })
})

describe("listMultiMainBlocksForCanonicalClass", () => {
  it("matches base class across multi-main labels", () => {
    const mm: EventAnalysisData["multiMainResults"] = [
      {
        id: "1",
        classLabel: "Ep Buggy",
        tieBreaker: null,
        completedMains: 3,
        totalMains: 3,
        entries: [],
      },
      {
        id: "2",
        classLabel: "Ep Buggy Triple A-Main",
        tieBreaker: null,
        completedMains: 3,
        totalMains: 3,
        entries: [],
      },
    ]
    expect(listMultiMainBlocksForCanonicalClass(mm, "Ep Buggy")).toHaveLength(2)
  })
})

describe("buildClassWinners", () => {
  it("emits one row per registration class and picks largest multi-main block", () => {
    const races: EventAnalysisData["races"] = []
    const multiMain: EventAnalysisData["multiMainResults"] = [
      {
        id: "m1",
        classLabel: "Ep Buggy",
        tieBreaker: null,
        completedMains: 3,
        totalMains: 3,
        entries: [
          {
            position: 1,
            seededPosition: null,
            driverId: "a",
            driverName: "Small",
            points: 1,
            mainBreakdown: null,
          },
        ],
      },
      {
        id: "m2",
        classLabel: "Ep Buggy Triple A-Main",
        tieBreaker: null,
        completedMains: 3,
        totalMains: 3,
        entries: [
          {
            position: 1,
            seededPosition: null,
            driverId: "b",
            driverName: "Perry",
            points: 1,
            mainBreakdown: null,
          },
          {
            position: 2,
            seededPosition: null,
            driverId: "c",
            driverName: "Other",
            points: 2,
            mainBreakdown: null,
          },
        ],
      },
      {
        id: "m3",
        classLabel: "Ep Buggy Triple B-Main",
        tieBreaker: null,
        completedMains: 1,
        totalMains: 1,
        entries: [
          {
            position: 1,
            seededPosition: null,
            driverId: "d",
            driverName: "Yarnold",
            points: 1,
            mainBreakdown: null,
          },
        ],
      },
      {
        id: "m4",
        classLabel: "Ic Buggy",
        tieBreaker: null,
        completedMains: 1,
        totalMains: 1,
        entries: [
          {
            position: 1,
            seededPosition: null,
            driverId: "z",
            driverName: "Zac",
            points: 1,
            mainBreakdown: null,
          },
        ],
      },
    ]
    const winners = buildClassWinners({
      races,
      multiMainResults: multiMain,
      registrationClassNames: ["Ep Buggy", "Ic Buggy"],
    })
    expect(winners).toHaveLength(2)
    const ep = winners.find((w) => w.className === "Ep Buggy")
    const ic = winners.find((w) => w.className === "Ic Buggy")
    expect(ep?.winnerName).toBe("Perry")
    expect(ic?.winnerName).toBe("Zac")
  })

  it("matches multi-main overall when registration class has a scale prefix (1/8 …)", () => {
    const races: EventAnalysisData["races"] = [
      {
        id: "r-fallback",
        raceId: "r-fallback",
        className: "1/8 EP Buggy",
        raceLabel: "1/8 EP Buggy A3-Main",
        raceOrder: 99,
        startTime: null,
        durationSeconds: null,
        sessionType: "main",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/r",
        results: [
          {
            raceResultId: "rr-rw",
            raceDriverId: "rd-rw",
            driverId: "d-riley",
            driverName: "RILEY LANDER-WEST",
            positionFinal: 1,
            lapsCompleted: 17,
            totalTimeSeconds: 600,
            fastLapTime: 30,
            avgLapTime: null,
            consistency: null,
            qualifyingPosition: null,
            secondsBehind: null,
            liveRcStats: null,
          },
        ],
      },
    ]
    const multiMain: EventAnalysisData["multiMainResults"] = [
      {
        id: "m-overall",
        classLabel: "1/8 Ep Buggy Triple A-Main",
        tieBreaker: null,
        completedMains: 3,
        totalMains: 3,
        entries: [
          {
            position: 1,
            seededPosition: null,
            driverId: "d-matt",
            driverName: "MATTHEW COUPER",
            points: 2,
            mainBreakdown: null,
          },
          {
            position: 2,
            seededPosition: null,
            driverId: "d-riley",
            driverName: "RILEY LANDER-WEST",
            points: 3,
            mainBreakdown: null,
          },
        ],
      },
    ]
    const winners = buildClassWinners({
      races,
      multiMainResults: multiMain,
      registrationClassNames: ["1/8 EP Buggy"],
    })
    expect(winners).toHaveLength(1)
    expect(winners[0]?.winnerName).toBe("MATTHEW COUPER")
  })
})
