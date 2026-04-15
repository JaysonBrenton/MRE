import { describe, it, expect } from "vitest"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  buildDriverMainEventProgressionMatrix,
  describeMainLadderRound,
  getRaceClassNamesForDriverProgressionChips,
} from "@/core/events/driver-main-event-progression"
import type { SessionData } from "@/core/events/get-sessions-data"

const D1 = "d1"
const D2 = "d2"

function result(
  id: string,
  driverId: string,
  name: string,
  pos: number
): EventAnalysisData["races"][number]["results"][number] {
  return {
    raceResultId: `rr-${id}`,
    raceDriverId: `rd-${id}`,
    driverId,
    driverName: name,
    positionFinal: pos,
    lapsCompleted: 10,
    totalTimeSeconds: 300,
    fastLapTime: null,
    avgLapTime: null,
    consistency: null,
    qualifyingPosition: null,
    secondsBehind: null,
    liveRcStats: null,
  }
}

function mockBuggyLadder(): EventAnalysisData {
  return {
    event: {
      id: "evt-1",
      trackId: "t1",
      eventName: "Test",
      eventDate: new Date("2026-01-01"),
      trackName: "Track",
    },
    races: [
      {
        id: "semi",
        raceId: "semi",
        className: "Buggy",
        raceLabel: "Buggy Semi-Final 1",
        raceOrder: 1,
        startTime: new Date("2026-01-01T10:00:00"),
        durationSeconds: 300,
        sessionType: "main",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/s",
        results: [result("s1", D1, "Alice", 3)],
      },
      {
        id: "lcq",
        raceId: "lcq",
        className: "Buggy",
        raceLabel: "Buggy Last Chance Qualifier",
        raceOrder: 2,
        startTime: new Date("2026-01-01T11:00:00"),
        durationSeconds: 300,
        sessionType: "race",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/l",
        results: [result("l1", D1, "Alice", 1)],
      },
      {
        id: "amain",
        raceId: "amain",
        className: "Buggy",
        raceLabel: "Buggy A-Main",
        raceOrder: 3,
        startTime: new Date("2026-01-01T12:00:00"),
        durationSeconds: 300,
        sessionType: "main",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/a",
        results: [result("a1", D1, "Alice", 5)],
      },
    ],
    drivers: [],
    entryList: [],
    raceClasses: new Map(),
    multiMainResults: [],
    summary: {
      totalRaces: 3,
      totalDrivers: 1,
      totalLaps: 30,
      dateRange: { earliest: new Date("2026-01-01"), latest: new Date("2026-01-01") },
    },
    userHostTrack: null,
  }
}

describe("describeMainLadderRound", () => {
  it("labels LCQ and semi from session fields", () => {
    const semi: SessionData = {
      id: "1",
      raceId: "1",
      className: "Buggy",
      raceLabel: "Semi-Final A",
      raceOrder: 1,
      startTime: null,
      durationSeconds: null,
      sessionType: "main",
      sectionHeader: null,
      participantCount: 1,
      topFinishers: [],
      results: [],
    }
    expect(describeMainLadderRound(semi)).toBe("Semi")

    const lcq: SessionData = { ...semi, raceLabel: "LCQ" }
    expect(describeMainLadderRound(lcq)).toBe("LCQ")
  })
})

describe("getRaceClassNamesForDriverProgressionChips", () => {
  it("includes only classes with at least two mains-ladder sessions", () => {
    const data: EventAnalysisData = {
      event: {
        id: "e",
        trackId: "t",
        eventName: "Chip test",
        eventDate: new Date("2026-01-01"),
        trackName: "T",
      },
      races: [
        {
          id: "one-main-only",
          raceId: "one-main-only",
          className: "SoloMainClass",
          raceLabel: "SoloMainClass A-Main",
          raceOrder: 1,
          startTime: new Date("2026-01-01T12:00:00"),
          durationSeconds: 300,
          sessionType: "main",
          sectionHeader: "Main Events",
          raceUrl: "https://example.com/a",
          results: [result("r1", D1, "A", 1)],
        },
        {
          id: "b",
          raceId: "b",
          className: "TwoRoundClass",
          raceLabel: "TwoRoundClass B-Main",
          raceOrder: 2,
          startTime: new Date("2026-01-01T10:00:00"),
          durationSeconds: 300,
          sessionType: "main",
          sectionHeader: "Main Events",
          raceUrl: "https://example.com/b",
          results: [result("r2", D1, "A", 1)],
        },
        {
          id: "a",
          raceId: "a",
          className: "TwoRoundClass",
          raceLabel: "TwoRoundClass A-Main",
          raceOrder: 3,
          startTime: new Date("2026-01-01T14:00:00"),
          durationSeconds: 300,
          sessionType: "main",
          sectionHeader: "Main Events",
          raceUrl: "https://example.com/am",
          results: [result("r3", D1, "A", 5)],
        },
      ],
      drivers: [],
      entryList: [],
      raceClasses: new Map(),
      multiMainResults: [],
      summary: {
        totalRaces: 3,
        totalDrivers: 1,
        totalLaps: 10,
        dateRange: { earliest: new Date("2026-01-01"), latest: new Date("2026-01-01") },
      },
      userHostTrack: null,
    }
    const chips = getRaceClassNamesForDriverProgressionChips(data)
    expect(chips).toContain("TwoRoundClass")
    expect(chips).not.toContain("SoloMainClass")
  })
})

describe("buildDriverMainEventProgressionMatrix", () => {
  it("returns empty when className is null", () => {
    const m = buildDriverMainEventProgressionMatrix(mockBuggyLadder(), null)
    expect(m.columns).toEqual([])
    expect(m.rows).toEqual([])
  })

  it("builds columns in schedule order and one row per driver with positions", () => {
    const data = mockBuggyLadder()
    const { columns, rows } = buildDriverMainEventProgressionMatrix(data, "Buggy")
    expect(columns).toHaveLength(3)
    expect(columns[0]!.raceLabel).toContain("Semi")
    expect(columns[1]!.roundKind).toBe("LCQ")
    expect(columns[2]!.raceLabel).toContain("A-Main")

    expect(rows).toHaveLength(1)
    expect(rows[0]!.driverId).toBe(D1)
    expect(rows[0]!.driverName).toBe("Alice")
    expect(rows[0]!.positions).toEqual([3, 1, 5])
    expect(rows[0]!.ladderTierGain).toBe(2)
    expect(rows[0]!.finishPositionGain).toBe(-2)
  })

  it("orders drivers by ladder tier gain (most progressed first), then name", () => {
    const data: EventAnalysisData = {
      event: {
        id: "evt-2",
        trackId: "t1",
        eventName: "Sort test",
        eventDate: new Date("2026-01-01"),
        trackName: "Track",
      },
      races: [
        {
          id: "bmain",
          raceId: "bmain",
          className: "Buggy",
          raceLabel: "Buggy B-Main",
          raceOrder: 1,
          startTime: new Date("2026-01-01T10:00:00"),
          durationSeconds: 300,
          sessionType: "main",
          sectionHeader: "Main Events",
          raceUrl: "https://example.com/b",
          results: [result("b1", D2, "Zoe BMain", 1)],
        },
        {
          id: "amain",
          raceId: "amain",
          className: "Buggy",
          raceLabel: "Buggy A-Main",
          raceOrder: 2,
          startTime: new Date("2026-01-01T12:00:00"),
          durationSeconds: 300,
          sessionType: "main",
          sectionHeader: "Main Events",
          raceUrl: "https://example.com/a",
          results: [result("a1", D1, "Amy AMainOnly", 2), result("a2", D2, "Zoe BMain", 8)],
        },
      ],
      drivers: [],
      entryList: [],
      raceClasses: new Map(),
      multiMainResults: [],
      summary: {
        totalRaces: 2,
        totalDrivers: 2,
        totalLaps: 20,
        dateRange: { earliest: new Date("2026-01-01"), latest: new Date("2026-01-01") },
      },
      userHostTrack: null,
    }
    const { rows } = buildDriverMainEventProgressionMatrix(data, "Buggy")
    expect(rows).toHaveLength(2)
    expect(rows[0]!.driverId).toBe(D2)
    expect(rows[1]!.driverId).toBe(D1)
    expect(rows[0]!.ladderTierGain).toBeGreaterThan(rows[1]!.ladderTierGain ?? -999)
  })
})
