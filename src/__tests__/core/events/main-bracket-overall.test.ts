/**
 * @fileoverview Tests for main bracket parsing and overall podium
 */

import { describe, it, expect } from "vitest"
import {
  parseMainBracketLeg,
  computeBracketPodium,
  computeBracketFullStandings,
  getSortedRaceResults,
  resolveMainsForBracketOverallRow,
  buildSimpleMainOverallRows,
  buildEventMainResultRows,
  pickPrimaryMainRace,
  isEventMainSession,
} from "@/core/events/main-bracket-overall"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

type Race = EventAnalysisData["races"][number]

function result(
  driverId: string,
  driverName: string,
  positionFinal: number
): Race["results"][number] {
  return {
    raceResultId: `${driverId}-rr`,
    raceDriverId: `${driverId}-rd`,
    driverId,
    driverName,
    positionFinal,
    lapsCompleted: 10,
    totalTimeSeconds: 300 + positionFinal,
    fastLapTime: 30,
    avgLapTime: null,
    consistency: null,
    liveRcStats: null,
  }
}

function race(
  id: string,
  label: string,
  positions: Array<{ id: string; name: string; pos: number }>,
  className = "1/8 Electric Buggy"
): Race {
  return {
    id,
    raceId: id,
    className,
    raceLabel: label,
    raceOrder: parseInt(id.replace(/\D/g, ""), 10) || 0,
    startTime: null,
    durationSeconds: null,
    sessionType: "main",
    sectionHeader: "Main Events",
    raceUrl: `https://example.com/${id}`,
    results: positions.map((p) => result(p.id, p.name, p.pos)),
  }
}

describe("isEventMainSession", () => {
  it("accepts sessionType main", () => {
    const r = race("x", "Anything", [{ id: "a", name: "A", pos: 1 }])
    r.sessionType = "main"
    expect(isEventMainSession(r)).toBe(true)
  })

  it("accepts race label containing main (case-insensitive)", () => {
    const r = race("x", "Expert A-Main", [{ id: "a", name: "A", pos: 1 }])
    r.sessionType = "race"
    expect(isEventMainSession(r)).toBe(true)
  })

  it("accepts Main Events section when label has no main (e.g. Final)", () => {
    const r = race("x", "Buggy Expert Final", [{ id: "a", name: "A", pos: 1 }])
    r.sessionType = "race"
    r.sectionHeader = "Main Events"
    expect(isEventMainSession(r)).toBe(true)
  })

  it("accepts Final in label without Main Events section", () => {
    const r = race("x", "Buggy Expert Final", [{ id: "a", name: "A", pos: 1 }])
    r.sessionType = "race"
    r.sectionHeader = null
    expect(isEventMainSession(r)).toBe(true)
  })

  it("rejects semi-final as class final", () => {
    const r = race("x", "Semi-Final 1", [{ id: "a", name: "A", pos: 1 }])
    r.sessionType = "race"
    r.sectionHeader = "Qualifier Round 1"
    expect(isEventMainSession(r)).toBe(false)
  })

  it("rejects generic race without main in label or Main Events section", () => {
    const r = race("x", "Heat 2/3", [{ id: "a", name: "A", pos: 1 }])
    r.sessionType = "heat"
    r.sectionHeader = "Qualifier Round 1"
    expect(isEventMainSession(r)).toBe(false)
  })
})

describe("parseMainBracketLeg", () => {
  it("parses A1-Main style labels", () => {
    expect(parseMainBracketLeg("1/8 Electric Buggy A1-Main")).toEqual({
      bracket: "A",
      leg: 1,
    })
    expect(parseMainBracketLeg("B3-Main")).toEqual({ bracket: "B", leg: 3 })
  })

  it("returns null when no bracket pattern", () => {
    expect(parseMainBracketLeg("Qualifier Round 1")).toBeNull()
  })
})

describe("computeBracketPodium", () => {
  it("ranks by best 2 of 3 (IFMAR example: 1+3 beats 2+2 on tie-break)", () => {
    const races: Race[] = [
      race("a1", "A1-Main", [
        { id: "d1", name: "Driver A", pos: 1 },
        { id: "d2", name: "Driver B", pos: 2 },
      ]),
      race("a2", "A2-Main", [
        { id: "d1", name: "Driver A", pos: 3 },
        { id: "d2", name: "Driver B", pos: 2 },
      ]),
      race("a3", "A3-Main", [
        { id: "d1", name: "Driver A", pos: 8 },
        { id: "d2", name: "Driver B", pos: 10 },
      ]),
    ]

    const p = computeBracketPodium(races)
    expect(p.first?.name).toBe("Driver A")
    expect(p.second?.name).toBe("Driver B")
  })
})

describe("computeBracketFullStandings", () => {
  it("lists every driver in podium order", () => {
    const races: Race[] = [
      race("a1", "A1-Main", [
        { id: "d1", name: "Driver A", pos: 1 },
        { id: "d2", name: "Driver B", pos: 2 },
      ]),
      race("a2", "A2-Main", [
        { id: "d1", name: "Driver A", pos: 3 },
        { id: "d2", name: "Driver B", pos: 2 },
      ]),
      race("a3", "A3-Main", [
        { id: "d1", name: "Driver A", pos: 8 },
        { id: "d2", name: "Driver B", pos: 10 },
      ]),
    ]
    const standings = computeBracketFullStandings(races)
    expect(standings.map((s) => s.driverName)).toEqual(["Driver A", "Driver B"])
    expect(standings[0].rank).toBe(1)
    expect(standings[1].rank).toBe(2)
  })
})

describe("getSortedRaceResults & resolveMainsForBracketOverallRow", () => {
  it("returns session order for single-main row", () => {
    const mains: Race[] = [
      race(
        "m1",
        "Stock Buggy Main Event",
        [
          { id: "a", name: "Alice", pos: 1 },
          { id: "b", name: "Bob", pos: 2 },
          { id: "c", name: "Carol", pos: 3 },
        ],
        "Stock Buggy"
      ),
    ]
    const rows = buildSimpleMainOverallRows(mains)
    expect(rows).toHaveLength(1)
    const resolved = resolveMainsForBracketOverallRow(rows[0], mains)
    expect(resolved).toHaveLength(1)
    const sorted = getSortedRaceResults(resolved[0])
    expect(sorted.map((r) => r.driverName)).toEqual(["Alice", "Bob", "Carol"])
  })
})

describe("buildSimpleMainOverallRows", () => {
  it("returns top 3 from a generic main when labels are not lettered", () => {
    const mains: Race[] = [
      race(
        "m1",
        "Stock Buggy Main Event",
        [
          { id: "a", name: "Alice", pos: 1 },
          { id: "b", name: "Bob", pos: 2 },
          { id: "c", name: "Carol", pos: 3 },
        ],
        "Stock Buggy"
      ),
    ]
    const rows = buildSimpleMainOverallRows(mains)
    expect(rows).toHaveLength(1)
    expect(rows[0].sessionKind).toBe("single-main")
    expect(rows[0].firstName).toBe("Alice")
    expect(rows[0].secondName).toBe("Bob")
    expect(rows[0].thirdName).toBe("Carol")
  })

  it("skips classes that already have lettered mains", () => {
    const mains: Race[] = [
      race("a1", "A1-Main", [
        { id: "d1", name: "Driver A", pos: 1 },
        { id: "d2", name: "Driver B", pos: 2 },
      ]),
      race("m1", "Some other main", [{ id: "x", name: "X", pos: 1 }], "1/8 Electric Buggy"),
    ]
    const simple = buildSimpleMainOverallRows(mains)
    expect(simple).toHaveLength(0)
  })
})

describe("pickPrimaryMainRace", () => {
  it("prefers higher raceOrder", () => {
    const early = race("1", "Main", [{ id: "a", name: "A", pos: 1 }])
    early.raceOrder = 1
    const late = race("2", "Main", [{ id: "b", name: "B", pos: 1 }])
    late.raceOrder = 5
    expect(pickPrimaryMainRace([early, late])!.id).toBe("2")
  })
})

describe("buildEventMainResultRows", () => {
  it("merges lettered bracket rows and single-main rows for different classes", () => {
    const mains: Race[] = [
      race(
        "a1",
        "A1-Main",
        [
          { id: "d1", name: "Driver A", pos: 1 },
          { id: "d2", name: "Driver B", pos: 2 },
        ],
        "Pro Buggy"
      ),
      race("m1", "Final", [{ id: "x", name: "Zed", pos: 1 }], "Stock Truck"),
    ]
    const rows = buildEventMainResultRows(mains)
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(rows.some((r) => r.className === "Stock Truck" && r.sessionKind === "single-main")).toBe(
      true
    )
    expect(rows.some((r) => r.className === "Pro Buggy" && r.sessionKind === "aggregate")).toBe(
      true
    )
  })
})
