import { describe, expect, it } from "vitest"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  buildMainBracketLadderModel,
  driversAdvancedToNextRoundSorted,
} from "@/core/events/main-bracket-ladder-model"

function makeResult(
  id: string,
  driverId: string,
  driverName: string,
  position: number,
  qualifyingPosition: number | null = null
): EventAnalysisData["races"][number]["results"][number] {
  return {
    raceResultId: `rr-${id}`,
    raceDriverId: `rd-${id}`,
    driverId,
    driverName,
    positionFinal: position,
    lapsCompleted: 10,
    totalTimeSeconds: 300,
    fastLapTime: null,
    avgLapTime: null,
    consistency: null,
    qualifyingPosition,
    secondsBehind: null,
    liveRcStats: null,
  }
}

function baseEventData(races: EventAnalysisData["races"]): EventAnalysisData {
  return {
    event: {
      id: "evt-1",
      trackId: "trk-1",
      eventName: "Test Event",
      eventDate: new Date("2026-01-01"),
      trackName: "Test Track",
    },
    races,
    drivers: [],
    entryList: [],
    raceClasses: new Map(),
    multiMainResults: [],
    summary: {
      totalRaces: races.length,
      totalDrivers: 4,
      totalLaps: 40,
      dateRange: {
        earliest: new Date("2026-01-01"),
        latest: new Date("2026-01-01"),
      },
    },
    qualPointsTopQualifiers: null,
    userHostTrack: null,
  }
}

describe("buildMainBracketLadderModel", () => {
  it("marks drivers as progressed when they appear in later rounds", () => {
    const races: EventAnalysisData["races"] = [
      {
        id: "r1",
        raceId: "r1",
        className: "Buggy",
        raceLabel: "Buggy 1/8 Odd Final",
        raceOrder: 1,
        startTime: new Date("2026-01-01T10:00:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/r1",
        results: [makeResult("a", "d1", "Alex", 1, 2), makeResult("b", "d2", "Blake", 2, 8)],
      },
      {
        id: "r2",
        raceId: "r2",
        className: "Buggy",
        raceLabel: "Buggy 1/4 Odd Final",
        raceOrder: 2,
        startTime: new Date("2026-01-01T11:00:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/r2",
        results: [makeResult("c", "d1", "Alex", 3, 2), makeResult("d", "d3", "Chris", 5, 7)],
      },
    ]

    const model = buildMainBracketLadderModel(baseEventData(races), "Buggy")
    expect(model).not.toBeNull()
    expect(model?.nodes).toHaveLength(2)
    const round2 = model?.nodes.find((n) => n.sessionId === "r2")
    expect(round2).toBeTruthy()
    expect(round2?.advancedDriverCount).toBe(1)
    const alex = round2?.drivers.find((d) => d.driverId === "d1")
    const chris = round2?.drivers.find((d) => d.driverId === "d3")
    expect(alex?.advancedFromPriorRound).toBe(true)
    expect(alex?.progressedFromRoundLabel).toBe("1/8 Odd")
    expect(chris?.advancedFromPriorRound).toBe(false)
    expect(chris?.progressedFromRoundLabel).toBeNull()

    const round1 = model?.nodes.find((n) => n.sessionId === "r1")
    expect(round1).toBeTruthy()
    const { target, drivers } = driversAdvancedToNextRoundSorted(round1!, model!)
    expect(target?.sessionId).toBe("r2")
    expect(drivers.map((d) => d.driverId)).toEqual(["d1"])
  })

  it("returns null when class has fewer than two ranked ladder sessions", () => {
    const races: EventAnalysisData["races"] = [
      {
        id: "r1",
        raceId: "r1",
        className: "Buggy",
        raceLabel: "Buggy A-Main",
        raceOrder: 1,
        startTime: new Date("2026-01-01T10:00:00Z"),
        durationSeconds: 300,
        sessionType: "main",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/r1",
        results: [makeResult("a", "d1", "Alex", 1)],
      },
    ]
    expect(buildMainBracketLadderModel(baseEventData(races), "Buggy")).toBeNull()
  })

  it("detects odd and even branches from bracket labels", () => {
    const races: EventAnalysisData["races"] = [
      {
        id: "o",
        raceId: "o",
        className: "Buggy",
        raceLabel: "Buggy 1/8 Odd Final",
        raceOrder: 1,
        startTime: new Date("2026-01-01T10:00:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/o",
        results: [makeResult("a", "d1", "Alex", 1)],
      },
      {
        id: "e",
        raceId: "e",
        className: "Buggy",
        raceLabel: "Buggy 1/8 Even Final",
        raceOrder: 2,
        startTime: new Date("2026-01-01T10:20:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/e",
        results: [makeResult("b", "d2", "Blake", 1)],
      },
      {
        id: "q",
        raceId: "q",
        className: "Buggy",
        raceLabel: "Buggy 1/4 Final",
        raceOrder: 3,
        startTime: new Date("2026-01-01T11:00:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/q",
        results: [makeResult("c", "d1", "Alex", 3)],
      },
    ]
    const model = buildMainBracketLadderModel(baseEventData(races), "Buggy")
    expect(model).not.toBeNull()
    expect(model?.nodes.find((n) => n.sessionId === "o")?.branch).toBe("odd")
    expect(model?.nodes.find((n) => n.sessionId === "e")?.branch).toBe("even")
  })

  it("shares one column for same-denom odd/even and never edges sibling halves together", () => {
    const races: EventAnalysisData["races"] = [
      {
        id: "16o",
        raceId: "16o",
        className: "Buggy",
        raceLabel: "Buggy 1/16 Odd Final",
        raceOrder: 1,
        startTime: new Date("2026-01-01T10:00:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/16o",
        results: [makeResult("a", "d1", "Alex", 1)],
      },
      {
        id: "16e",
        raceId: "16e",
        className: "Buggy",
        raceLabel: "Buggy 1/16 Even Final",
        raceOrder: 2,
        startTime: new Date("2026-01-01T10:30:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/16e",
        results: [makeResult("b", "d2", "Blake", 1)],
      },
      {
        id: "8o",
        raceId: "8o",
        className: "Buggy",
        raceLabel: "Buggy 1/8 Odd Final",
        raceOrder: 3,
        startTime: new Date("2026-01-01T11:00:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/8o",
        results: [makeResult("c", "d1", "Alex", 2)],
      },
      {
        id: "8e",
        raceId: "8e",
        className: "Buggy",
        raceLabel: "Buggy 1/8 Even Final",
        raceOrder: 4,
        startTime: new Date("2026-01-01T11:30:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/8e",
        results: [makeResult("d", "d2", "Blake", 2)],
      },
    ]
    const model = buildMainBracketLadderModel(baseEventData(races), "Buggy")
    expect(model).not.toBeNull()
    const col16o = model!.nodes.find((n) => n.sessionId === "16o")!.tierIndex
    const col16e = model!.nodes.find((n) => n.sessionId === "16e")!.tierIndex
    expect(col16o).toBe(col16e)

    const edgeSet = new Set(model!.edges.map((e) => `${e.fromSessionId}->${e.toSessionId}`))
    expect(edgeSet.has("16o->8o")).toBe(true)
    expect(edgeSet.has("16e->8e")).toBe(true)
    expect(edgeSet.has("16e->16o")).toBe(false)
    expect(edgeSet.has("16o->16e")).toBe(false)

    const node16o = model!.nodes.find((n) => n.sessionId === "16o")!
    const { target, drivers } = driversAdvancedToNextRoundSorted(node16o, model!)
    expect(target?.sessionId).toBe("8o")
    expect(drivers.map((d) => d.driverId)).toEqual(["d1"])
  })

  it("places 1/1 final on center lane even with odd/even label", () => {
    const races: EventAnalysisData["races"] = [
      {
        id: "half-odd",
        raceId: "half-odd",
        className: "Buggy",
        raceLabel: "Buggy 1/2 Odd Final",
        raceOrder: 1,
        startTime: new Date("2026-01-01T10:00:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/half-odd",
        results: [makeResult("a", "d1", "Alex", 1)],
      },
      {
        id: "half-even",
        raceId: "half-even",
        className: "Buggy",
        raceLabel: "Buggy 1/2 Even Final",
        raceOrder: 2,
        startTime: new Date("2026-01-01T10:30:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/half-even",
        results: [makeResult("b", "d2", "Blake", 1)],
      },
      {
        id: "final-even",
        raceId: "final-even",
        className: "Buggy",
        raceLabel: "Buggy 1/1 Even Final",
        raceOrder: 3,
        startTime: new Date("2026-01-01T11:00:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/final-even",
        results: [makeResult("c", "d1", "Alex", 2), makeResult("d", "d2", "Blake", 3)],
      },
    ]

    const model = buildMainBracketLadderModel(baseEventData(races), "Buggy")
    expect(model).not.toBeNull()
    const finalNode = model?.nodes.find((n) => n.sessionId === "final-even")
    expect(finalNode?.branch).toBe("center")
  })

  it("places LCQ before 1/1 finals in bracket ladders", () => {
    const races: EventAnalysisData["races"] = [
      {
        id: "half-odd",
        raceId: "half-odd",
        className: "Buggy",
        raceLabel: "Buggy 1/2 Odd Final",
        raceOrder: 1,
        startTime: new Date("2026-01-01T10:00:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/half-odd",
        results: [makeResult("a", "d1", "Alex", 1)],
      },
      {
        id: "half-even",
        raceId: "half-even",
        className: "Buggy",
        raceLabel: "Buggy 1/2 Even Final",
        raceOrder: 2,
        startTime: new Date("2026-01-01T10:30:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/half-even",
        results: [makeResult("b", "d2", "Blake", 1)],
      },
      {
        id: "final-even",
        raceId: "final-even",
        className: "Buggy",
        raceLabel: "Buggy 1/1 Even Final",
        raceOrder: 4,
        startTime: new Date("2026-01-01T12:00:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/final-even",
        results: [makeResult("c", "d3", "Chris", 2)],
      },
      {
        id: "lcq",
        raceId: "lcq",
        className: "Buggy",
        raceLabel: "Buggy Last Chance Qualifier",
        raceOrder: 3,
        startTime: new Date("2026-01-01T11:30:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/lcq",
        results: [makeResult("d", "d4", "Dana", 1)],
      },
    ]

    const model = buildMainBracketLadderModel(baseEventData(races), "Buggy")
    expect(model).not.toBeNull()
    const halfOddNode = model?.nodes.find((n) => n.sessionId === "half-odd")
    const finalNode = model?.nodes.find((n) => n.sessionId === "final-even")
    const lcqNode = model?.nodes.find((n) => n.sessionId === "lcq")
    expect(halfOddNode).toBeTruthy()
    expect(finalNode).toBeTruthy()
    expect(lcqNode).toBeTruthy()
    expect(lcqNode!.tierIndex).toBeGreaterThan(halfOddNode!.tierIndex)
    expect(lcqNode!.tierIndex).toBeLessThan(finalNode!.tierIndex)
  })

  it("supports mixed direct and LCQ progression paths into 1/1 final", () => {
    const races: EventAnalysisData["races"] = [
      {
        id: "half-odd",
        raceId: "half-odd",
        className: "Buggy",
        raceLabel: "Buggy 1/2 Odd Final",
        raceOrder: 1,
        startTime: new Date("2026-01-01T10:00:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/half-odd",
        results: [
          makeResult("o1", "josh", "JOSH PAIN", 3),
          makeResult("o2", "felix", "FELIX KOEGLER", 4),
        ],
      },
      {
        id: "half-even",
        raceId: "half-even",
        className: "Buggy",
        raceLabel: "Buggy 1/2 Even Final",
        raceOrder: 2,
        startTime: new Date("2026-01-01T10:30:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/half-even",
        results: [makeResult("e1", "andrew", "ANDREW FOORD", 2)],
      },
      {
        id: "lcq",
        raceId: "lcq",
        className: "Buggy",
        raceLabel: "Buggy Last Chance Qualifier",
        raceOrder: 3,
        startTime: new Date("2026-01-01T11:30:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/lcq",
        results: [
          makeResult("l1", "josh", "JOSH PAIN", 1),
          makeResult("l2", "felix", "FELIX KOEGLER", 2),
        ],
      },
      {
        id: "final-even",
        raceId: "final-even",
        className: "Buggy",
        raceLabel: "Buggy 1/1 Even Final",
        raceOrder: 4,
        startTime: new Date("2026-01-01T12:00:00Z"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/final-even",
        results: [
          makeResult("f1", "andrew", "ANDREW FOORD", 3),
          makeResult("f2", "josh", "JOSH PAIN", 5),
          makeResult("f3", "felix", "FELIX KOEGLER", 6),
        ],
      },
    ]

    const model = buildMainBracketLadderModel(baseEventData(races), "Buggy")
    expect(model).not.toBeNull()

    const edgeSet = new Set(model!.edges.map((e) => `${e.fromSessionId}->${e.toSessionId}`))
    expect(edgeSet.has("half-even->final-even")).toBe(true)
    expect(edgeSet.has("half-odd->lcq")).toBe(true)
    expect(edgeSet.has("lcq->final-even")).toBe(true)

    const edgeKindByKey = new Map(
      model!.edges.map((e) => [`${e.fromSessionId}->${e.toSessionId}`, e.kind])
    )
    expect(edgeKindByKey.get("half-even->final-even")).toBe("direct")
    expect(edgeKindByKey.get("half-odd->lcq")).toBe("via_lcq")
    expect(edgeKindByKey.get("lcq->final-even")).toBe("via_lcq")

    const edgeCountByKey = new Map(
      model!.edges.map((e) => [`${e.fromSessionId}->${e.toSessionId}`, e.driverCount])
    )
    expect(edgeCountByKey.get("half-even->final-even")).toBe(1)
    expect(edgeCountByKey.get("half-odd->lcq")).toBe(2)
    expect(edgeCountByKey.get("lcq->final-even")).toBe(2)
  })
})
