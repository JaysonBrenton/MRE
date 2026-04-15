/**
 * @fileoverview Tests for event-wide per-class fastest lap aggregation
 */

import { describe, it, expect } from "vitest"
import {
  computeTopFastestLapsPerClass,
  computeAllBestLapsForClass,
} from "@/core/events/event-top-fastest-laps-per-class"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

type Race = EventAnalysisData["races"][number]
type Result = Race["results"][number]

function result(
  driverId: string,
  driverName: string,
  fastLapTime: number,
  lapNum: number | null = 1
): Result {
  return {
    raceResultId: `${driverId}-rr`,
    raceDriverId: `${driverId}-rd`,
    driverId,
    driverName,
    positionFinal: 1,
    lapsCompleted: 10,
    totalTimeSeconds: 300,
    fastLapTime,
    fastLapLapNumber: lapNum,
    avgLapTime: null,
    consistency: null,
    qualifyingPosition: null,
    secondsBehind: null,
    liveRcStats: null,
  }
}

function race(id: string, label: string, className: string, results: Result[]): Race {
  return {
    id,
    raceId: id,
    className,
    raceLabel: label,
    raceOrder: 0,
    startTime: null,
    durationSeconds: null,
    sessionType: "heat",
    sectionHeader: null,
    raceUrl: `https://example.com/r/${id}`,
    results,
  }
}

describe("computeAllBestLapsForClass", () => {
  it("lists every driver best lap with ranks (ties share rank)", () => {
    const races: Race[] = [
      race("h1", "Heat 1", "Buggy", [result("a", "Alice", 34.0, 5), result("b", "Bob", 34.5, 3)]),
      race("h2", "Heat 2", "Buggy", [result("c", "Carol", 34.2, 2), result("a", "Alice", 33.9, 8)]),
    ]

    const all = computeAllBestLapsForClass(races, "Buggy")
    expect(all).toHaveLength(3)
    expect(all[0].driverName).toBe("Alice")
    expect(all[0].lapTimeSeconds).toBe(33.9)
    expect(all[0].rank).toBe(1)
    expect(all[1].driverName).toBe("Carol")
    expect(all[1].rank).toBe(2)
    expect(all[2].driverName).toBe("Bob")
    expect(all[2].rank).toBe(3)
  })

  it("returns empty array for unknown class", () => {
    expect(computeAllBestLapsForClass([], "X")).toEqual([])
  })
})

describe("computeTopFastestLapsPerClass", () => {
  it("still limits to top three distinct lap times", () => {
    const races: Race[] = [
      race("h1", "Heat 1", "Buggy", [
        result("a", "A", 34.0),
        result("b", "B", 34.1),
        result("c", "C", 34.2),
        result("d", "D", 34.3),
      ]),
    ]
    const groups = computeTopFastestLapsPerClass(races)
    expect(groups).toHaveLength(1)
    expect(groups[0].entries.length).toBeLessThanOrEqual(4)
    const times = new Set(groups[0].entries.map((e) => e.lapTimeSeconds))
    expect(times.size).toBeLessThanOrEqual(3)
  })
})
