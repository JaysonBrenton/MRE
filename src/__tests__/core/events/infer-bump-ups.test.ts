import { describe, it, expect } from "vitest"
import type { SessionData } from "@/core/events/get-sessions-data"
import {
  inferBumpUpsFromSessions,
  getLadderRank,
  isSessionMainForBumpUps,
  labelLooksLikeLcq,
  sortSessionsForLadder,
} from "@/core/events/infer-bump-ups"

function session(
  partial: Partial<SessionData> & Pick<SessionData, "id" | "raceLabel">
): SessionData {
  return {
    raceId: partial.raceId ?? partial.id,
    className: partial.className ?? "1/8 Pro Nitro Buggy",
    raceOrder: partial.raceOrder ?? null,
    startTime: partial.startTime ?? null,
    durationSeconds: partial.durationSeconds ?? null,
    sessionType: partial.sessionType ?? null,
    sectionHeader: partial.sectionHeader ?? null,
    participantCount: partial.participantCount ?? 2,
    topFinishers: partial.topFinishers ?? [],
    results: partial.results ?? [],
    ...partial,
  }
}

describe("getLadderRank", () => {
  it("returns null for qualifying", () => {
    expect(getLadderRank("Qualifier Round 1", "race")).toBeNull()
  })

  it('ranks "Last Chance Qualifier" as LCQ, not qualifying (substring "qualif")', () => {
    expect(getLadderRank("1/8 Nitro Last Chance Qualifier", "race")).toBe(7)
    expect(getLadderRank("Last Chance Qualifier", "qualifying")).toBe(7)
  })

  it("ranks A-Main above B-Main", () => {
    const a = getLadderRank("1/8 Buggy A-Main", "main")
    const b = getLadderRank("1/8 Buggy B-Main", "main")
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a! > b!).toBe(true)
  })

  it("ranks LCQ between semi and A conceptually", () => {
    expect(getLadderRank("LCQ", "main")).toBe(7)
    expect(getLadderRank("Semi-Final A", "main")).toBe(6)
  })
})

describe("labelLooksLikeLcq", () => {
  it("detects LCQ and last chance", () => {
    expect(labelLooksLikeLcq("LCQ Final")).toBe(true)
    expect(labelLooksLikeLcq("Last Chance Qualifier")).toBe(true)
    expect(labelLooksLikeLcq("B-Main")).toBe(false)
  })
})

describe("isSessionMainForBumpUps", () => {
  it("includes LCQ and semi-finals even when sessionType is not main", () => {
    const lcq = session({
      id: "lcq",
      raceLabel: "Last Chance Qualifier",
      sessionType: "race",
      sectionHeader: "Main Events",
      results: [],
    })
    expect(isSessionMainForBumpUps(lcq)).toBe(true)

    const semi = session({
      id: "semi",
      raceLabel: "Semi-Final 1",
      sessionType: "race",
      sectionHeader: "Qualifier Round 1",
      results: [],
    })
    expect(isSessionMainForBumpUps(semi)).toBe(true)
  })

  it("excludes generic qualifying when not under mains ladder", () => {
    const qual = session({
      id: "q1",
      raceLabel: "Qualifier Round 1",
      sessionType: "qualifying",
      sectionHeader: "Seeding Round 1",
      results: [],
    })
    expect(isSessionMainForBumpUps(qual)).toBe(false)
  })
})

describe("inferBumpUpsFromSessions", () => {
  it("returns empty when fewer than two ladder sessions", () => {
    const s = session({
      id: "r1",
      raceLabel: "1/8 Buggy A-Main",
      raceOrder: 10,
      results: [
        {
          raceResultId: "x",
          raceDriverId: "y",
          driverId: "d1",
          driverName: "Driver One",
          positionFinal: 1,
          lapsCompleted: 10,
          totalTimeSeconds: 100,
          fastLapTime: 9,
          avgLapTime: 10,
          consistency: null,
        },
      ],
    })
    expect(inferBumpUpsFromSessions([s])).toEqual([])
  })

  it("emits one row for B-Main to A-Main advancement", () => {
    const bMain = session({
      id: "b",
      raceLabel: "1/8 Nitro Buggy B-Main",
      raceOrder: 1,
      results: [
        {
          raceResultId: "r1",
          raceDriverId: "rd1",
          driverId: "d1",
          driverName: "Jane",
          positionFinal: 1,
          lapsCompleted: 10,
          totalTimeSeconds: 200,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
        },
      ],
    })
    const aMain = session({
      id: "a",
      raceLabel: "1/8 Nitro Buggy A-Main",
      raceOrder: 2,
      results: [
        {
          raceResultId: "r2",
          raceDriverId: "rd2",
          driverId: "d1",
          driverName: "Jane",
          positionFinal: 8,
          lapsCompleted: 10,
          totalTimeSeconds: 300,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
        },
      ],
    })
    const rows = inferBumpUpsFromSessions(sortSessionsForLadder([aMain, bMain]))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      driverName: "Jane",
      fromRaceLabel: bMain.raceLabel,
      toRaceLabel: aMain.raceLabel,
      fromPosition: 1,
      toPosition: 8,
      kind: "advance",
    })
  })

  it("emits one row for bracket final 1/8 Even Final to 1/4 Odd Final", () => {
    const s8 = session({
      id: "b8",
      className: "Buggy",
      raceLabel: "Buggy 1/8 Even Final",
      raceOrder: 1,
      sectionHeader: "Main Events",
      sessionType: "race",
      results: [
        {
          raceResultId: "r1",
          raceDriverId: "rd1",
          driverId: "d1",
          driverName: "Alex",
          positionFinal: 1,
          lapsCompleted: 10,
          totalTimeSeconds: 200,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
        },
      ],
    })
    const s4 = session({
      id: "b4",
      className: "Buggy",
      raceLabel: "Buggy 1/4 Odd Final",
      raceOrder: 2,
      sectionHeader: "Main Events",
      sessionType: "race",
      results: [
        {
          raceResultId: "r2",
          raceDriverId: "rd2",
          driverId: "d1",
          driverName: "Alex",
          positionFinal: 3,
          lapsCompleted: 10,
          totalTimeSeconds: 300,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
        },
      ],
    })
    const rows = inferBumpUpsFromSessions(sortSessionsForLadder([s8, s4]))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      driverName: "Alex",
      fromRaceLabel: s8.raceLabel,
      toRaceLabel: s4.raceLabel,
      kind: "advance",
    })
  })

  it("does not emit bump between A1-Main and A2-Main (same bracket rank)", () => {
    const a1 = session({
      id: "a1",
      raceLabel: "1/8 Buggy A1-Main",
      raceOrder: 1,
      results: [
        {
          raceResultId: "r1",
          raceDriverId: "rd1",
          driverId: "d1",
          driverName: "Bob",
          positionFinal: 1,
          lapsCompleted: 10,
          totalTimeSeconds: 100,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
        },
      ],
    })
    const a2 = session({
      id: "a2",
      raceLabel: "1/8 Buggy A2-Main",
      raceOrder: 2,
      results: [
        {
          raceResultId: "r2",
          raceDriverId: "rd2",
          driverId: "d1",
          driverName: "Bob",
          positionFinal: 1,
          lapsCompleted: 10,
          totalTimeSeconds: 100,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
        },
      ],
    })
    expect(inferBumpUpsFromSessions([a1, a2])).toEqual([])
  })

  it("infers Last Chance Qualifier to A-Main with kind lcq (real-world label)", () => {
    const lcq = session({
      id: "lcq",
      raceLabel: "1/8 Nitro Last Chance Qualifier",
      raceOrder: 1,
      sessionType: "race",
      sectionHeader: "Main Events",
      results: [
        {
          raceResultId: "r1",
          raceDriverId: "rd1",
          driverId: "d1",
          driverName: "Sam",
          positionFinal: 1,
          lapsCompleted: 5,
          totalTimeSeconds: 100,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
        },
      ],
    })
    const aMain = session({
      id: "a",
      raceLabel: "1/8 Nitro Buggy A-Main",
      raceOrder: 2,
      sessionType: "main",
      sectionHeader: "Main Events",
      results: [
        {
          raceResultId: "r2",
          raceDriverId: "rd2",
          driverId: "d1",
          driverName: "Sam",
          positionFinal: 10,
          lapsCompleted: 10,
          totalTimeSeconds: 200,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
        },
      ],
    })
    const rows = inferBumpUpsFromSessions(sortSessionsForLadder([lcq, aMain]))
    expect(rows).toHaveLength(1)
    expect(rows[0]!).toMatchObject({
      driverName: "Sam",
      fromRaceLabel: lcq.raceLabel,
      toRaceLabel: aMain.raceLabel,
      kind: "lcq",
    })
  })

  it("marks kind lcq when from session is LCQ", () => {
    const lcq = session({
      id: "lcq",
      raceLabel: "LCQ",
      raceOrder: 1,
      results: [
        {
          raceResultId: "r1",
          raceDriverId: "rd1",
          driverId: "d1",
          driverName: "Sam",
          positionFinal: 1,
          lapsCompleted: 5,
          totalTimeSeconds: 100,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
        },
      ],
    })
    const aMain = session({
      id: "a",
      raceLabel: "A-Main",
      raceOrder: 2,
      results: [
        {
          raceResultId: "r2",
          raceDriverId: "rd2",
          driverId: "d1",
          driverName: "Sam",
          positionFinal: 12,
          lapsCompleted: 10,
          totalTimeSeconds: 200,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
        },
      ],
    })
    const rows = inferBumpUpsFromSessions([lcq, aMain])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.kind).toBe("lcq")
  })

  it("ignores qualifying in the ladder but still infers B-Main to A-Main", () => {
    const qual = session({
      id: "qual",
      raceLabel: "Qualifier Round 1",
      raceOrder: 1,
      sessionType: "qualifying",
      sectionHeader: "Seeding",
      results: [
        {
          raceResultId: "r0",
          raceDriverId: "rd0",
          driverId: "d1",
          driverName: "Pat",
          positionFinal: 1,
          lapsCompleted: 5,
          totalTimeSeconds: 100,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
        },
      ],
    })
    const bMain = session({
      id: "b",
      raceLabel: "1/8 Buggy B-Main",
      raceOrder: 2,
      sessionType: "main",
      results: [
        {
          raceResultId: "r1",
          raceDriverId: "rd1",
          driverId: "d1",
          driverName: "Pat",
          positionFinal: 1,
          lapsCompleted: 10,
          totalTimeSeconds: 200,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
        },
      ],
    })
    const aMain = session({
      id: "a",
      raceLabel: "1/8 Buggy A-Main",
      raceOrder: 3,
      sessionType: "main",
      results: [
        {
          raceResultId: "r2",
          raceDriverId: "rd2",
          driverId: "d1",
          driverName: "Pat",
          positionFinal: 8,
          lapsCompleted: 10,
          totalTimeSeconds: 300,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
        },
      ],
    })
    const rows = inferBumpUpsFromSessions([qual, bMain, aMain])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.fromRaceLabel).toBe(bMain.raceLabel)
    expect(rows[0]!.toRaceLabel).toBe(aMain.raceLabel)
  })
})
