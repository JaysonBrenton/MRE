/**
 * @fileoverview Tests for Event Level Analysis default driver heuristic
 */

import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { pickEventLevelDriverAnalysisDefaultDriver } from "@/core/events/pick-event-level-driver-analysis-default-driver"
import { describe, expect, it } from "vitest"

function raceStub(
  id: string,
  className: string,
  raceLabel: string,
  sessionType: string | null,
  results: Array<{ driverId: string; driverName?: string; positionFinal: number }>,
  raceOrder: number
): EventAnalysisData["races"][number] {
  return {
    id,
    raceId: id,
    className,
    raceLabel,
    raceOrder,
    completedAt: null,
    startTime: null,
    durationSeconds: null,
    sessionType,
    sectionHeader: null,
    raceUrl: "",
    results: results.map((r, i) => ({
      raceResultId: `${id}-r${i}`,
      raceDriverId: `${id}-rd${i}`,
      driverId: r.driverId,
      driverName: r.driverName ?? "Driver",
      positionFinal: r.positionFinal,
      lapsCompleted: 0,
      totalTimeSeconds: null,
      fastLapTime: null,
      fastLapLapNumber: null,
      avgLapTime: null,
      consistency: null,
      qualifyingPosition: null,
      secondsBehind: null,
      behindDisplay: null,
      liveRcStats: null,
    })),
  }
}

function baseData(
  overrides: Partial<
    Pick<EventAnalysisData, "races" | "multiMainResults" | "qualPointsTopQualifiers">
  >
): Pick<
  EventAnalysisData,
  "races" | "multiMainResults" | "overallFinalRankings" | "qualPointsTopQualifiers"
> {
  return {
    races: [],
    multiMainResults: [],
    overallFinalRankings: [],
    qualPointsTopQualifiers: null,
    ...overrides,
  }
}

describe("pickEventLevelDriverAnalysisDefaultDriver", () => {
  it("prefers multi-main winner for the class when present", () => {
    const data = baseData({
      multiMainResults: [
        {
          id: "mm1",
          classLabel: "Buggy Expert",
          tieBreaker: null,
          completedMains: 1,
          totalMains: 1,
          entries: [
            {
              position: 1,
              seededPosition: null,
              driverId: "winner",
              driverName: "Winner",
              points: 0,
              mainBreakdown: null,
            },
            {
              position: 2,
              seededPosition: null,
              driverId: "other",
              driverName: "Other",
              points: 0,
              mainBreakdown: null,
            },
          ],
        },
      ],
    })
    expect(pickEventLevelDriverAnalysisDefaultDriver({ data, className: "Buggy Expert" })).toBe(
      "winner"
    )
  })

  it("falls through to alphabetical first driver id when nothing else resolves", () => {
    const data = baseData({
      races: [
        raceStub(
          "p1",
          "Stock",
          "Stock Practice",
          "practice",
          [
            { driverId: "zane", driverName: "Zane", positionFinal: 5 },
            { driverId: "amy", driverName: "Amy", positionFinal: 3 },
          ],
          1
        ),
      ],
    })
    expect(pickEventLevelDriverAnalysisDefaultDriver({ data, className: "Stock" })).toBe("amy")
  })

  it("returns null for empty class name", () => {
    expect(
      pickEventLevelDriverAnalysisDefaultDriver({
        data: baseData({}),
        className: "   ",
      })
    ).toBeNull()
  })
})
