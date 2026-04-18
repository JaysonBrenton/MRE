/**
 * Regression: bump-up inference must not use selectedDriverIds when loading sessions.
 * Otherwise a Truggy-only (or any) selection drops all sessions for other classes → no rows.
 */

import { describe, it, expect } from "vitest"
import { getSessionsData, getSessionsForBumpUpInference } from "@/core/events/get-sessions-data"
import { inferBumpUpsFromSessions } from "@/core/events/infer-bump-ups"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

const D_BUG = "driver-buggy"
const D_TRUG = "driver-truggy"

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

function mockEvent(): EventAnalysisData {
  return {
    event: {
      id: "evt-1",
      trackId: "t1",
      eventName: "RCRA-style nationals",
      eventDate: new Date("2026-01-01"),
      trackName: "Track",
    },
    races: [
      {
        id: "bug-b",
        raceId: "bug-b",
        className: "Buggy",
        raceLabel: "Buggy B-Main",
        raceOrder: 1,
        startTime: new Date("2026-01-01T12:00:00"),
        durationSeconds: 300,
        sessionType: "main",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/bug-b",
        results: [result("bb1", D_BUG, "Bug Racer", 1)],
      },
      {
        id: "bug-a",
        raceId: "bug-a",
        className: "Buggy",
        raceLabel: "Buggy A-Main",
        raceOrder: 2,
        startTime: new Date("2026-01-01T14:00:00"),
        durationSeconds: 300,
        sessionType: "main",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/bug-a",
        results: [result("ba1", D_BUG, "Bug Racer", 8)],
      },
      {
        id: "tr-a",
        raceId: "tr-a",
        className: "Truggy",
        raceLabel: "Truggy A-Main",
        raceOrder: 3,
        startTime: new Date("2026-01-01T16:00:00"),
        durationSeconds: 300,
        sessionType: "main",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/tr-a",
        results: [result("ta1", D_TRUG, "Trug Racer", 1)],
      },
    ],
    drivers: [],
    entryList: [],
    raceClasses: new Map(),
    multiMainResults: [],
    summary: {
      totalRaces: 3,
      totalDrivers: 2,
      totalLaps: 30,
      dateRange: { earliest: new Date("2026-01-01"), latest: new Date("2026-01-01") },
    },
    qualPointsTopQualifiers: null,
    userHostTrack: null,
  }
}

describe("bump-ups session scope (no driver filter)", () => {
  it("when selectedDriverIds only includes another class’s driver, Buggy sessions are empty — wrong for bump-ups", () => {
    const data = mockEvent()
    const buggyOnlyTruggySelection = getSessionsData(data, [D_TRUG], "Buggy")
    expect(buggyOnlyTruggySelection.sessions).toHaveLength(0)
  })

  it("getSessionsForBumpUpInference matches full-class sessions and bump-ups are inferred", () => {
    const data = mockEvent()
    const sessions = getSessionsForBumpUpInference(data, "Buggy")
    expect(sessions.length).toBeGreaterThanOrEqual(2)
    const rows = inferBumpUpsFromSessions(sessions)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.driverId).toBe(D_BUG)
    expect(rows[0]!.fromRaceLabel).toContain("B-Main")
    expect(rows[0]!.toRaceLabel).toContain("A-Main")
  })
})
