/**
 * @fileoverview Tests for event-wide per-class average lap aggregation
 */

import { describe, it, expect } from "vitest"
import {
  computeTopAverageLapsPerClass,
  computeAllAverageLapsForClass,
} from "@/core/events/event-top-average-laps-per-class"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

type Race = EventAnalysisData["races"][number]
type Result = Race["results"][number]

function result(
  driverId: string,
  driverName: string,
  totalTimeSeconds: number,
  lapsCompleted: number
): Result {
  return {
    raceResultId: `${driverId}-rr`,
    raceDriverId: `${driverId}-rd`,
    driverId,
    driverName,
    positionFinal: 1,
    lapsCompleted,
    totalTimeSeconds,
    fastLapTime: 30,
    fastLapLapNumber: 1,
    avgLapTime: null,
    consistency: null,
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

describe("computeAllAverageLapsForClass", () => {
  it("lists every driver with event-wide average and rank", () => {
    const races: Race[] = [
      race("h1", "Heat 1", "Buggy", [result("a", "Alice", 340, 10), result("b", "Bob", 350, 10)]),
      race("h2", "Heat 2", "Buggy", [result("a", "Alice", 340, 10), result("c", "Carol", 360, 10)]),
    ]

    const all = computeAllAverageLapsForClass(races, "Buggy")
    expect(all).toHaveLength(3)
    expect(all[0].driverName).toBe("Alice")
    expect(all[0].avgLapSeconds).toBeCloseTo(34, 5)
    expect(all[0].rank).toBe(1)
    expect(all[1].driverName).toBe("Bob")
    expect(all[2].driverName).toBe("Carol")
  })

  it("returns empty array for unknown class", () => {
    expect(computeAllAverageLapsForClass([], "X")).toEqual([])
  })
})

describe("computeTopAverageLapsPerClass", () => {
  it("limits distinct averages to top three", () => {
    const races: Race[] = [
      race("h1", "Heat 1", "Buggy", [
        result("a", "A", 340, 10),
        result("b", "B", 350, 10),
        result("c", "C", 360, 10),
        result("d", "D", 370, 10),
      ]),
    ]
    const groups = computeTopAverageLapsPerClass(races)
    expect(groups).toHaveLength(1)
    const times = new Set(groups[0].entries.map((e) => e.avgLapSeconds))
    expect(times.size).toBeLessThanOrEqual(3)
  })
})
