/**
 * @fileoverview Tests for closest battle summaries on mains (P1–P2 and per-driver adjacent gaps).
 */

import { describe, expect, it } from "vitest"
import {
  computeClosestP1P2PerClass,
  computeDriverClosestBattles,
} from "@/core/events/event-closest-battles"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

function mainRace(
  partial: Partial<EventAnalysisData["races"][number]> &
    Pick<EventAnalysisData["races"][number], "className" | "raceLabel" | "results">
): EventAnalysisData["races"][number] {
  return {
    id: partial.id ?? "r1",
    raceId: partial.raceId ?? "r1",
    className: partial.className,
    raceLabel: partial.raceLabel,
    raceOrder: partial.raceOrder ?? 1,
    completedAt: partial.completedAt ?? null,
    startTime: partial.startTime ?? null,
    durationSeconds: partial.durationSeconds ?? null,
    sessionType: partial.sessionType ?? "main",
    sectionHeader: partial.sectionHeader ?? null,
    raceUrl: partial.raceUrl ?? "",
    vehicleType: partial.vehicleType ?? null,
    skillTier: partial.skillTier ?? null,
    vehicleClassNormalizationNeedsReview: partial.vehicleClassNormalizationNeedsReview ?? false,
    eventRaceClassId: partial.eventRaceClassId ?? null,
    results: partial.results,
  }
}

describe("computeClosestP1P2PerClass", () => {
  it("picks smallest P1–P2 gap per class on mains", () => {
    const races: EventAnalysisData["races"] = [
      mainRace({
        className: "Stock",
        raceLabel: "A1",
        results: [
          {
            raceResultId: "a",
            raceDriverId: "x",
            driverId: "d1",
            driverName: "A",
            positionFinal: 1,
            lapsCompleted: 10,
            totalTimeSeconds: 100,
            fastLapTime: 9,
            fastLapLapNumber: null,
            avgLapTime: 10,
            consistency: null,
            qualifyingPosition: null,
            secondsBehind: null,
            behindDisplay: null,
            liveRcStats: null,
          },
          {
            raceResultId: "b",
            raceDriverId: "y",
            driverId: "d2",
            driverName: "B",
            positionFinal: 2,
            lapsCompleted: 10,
            totalTimeSeconds: 100.5,
            fastLapTime: 9,
            fastLapLapNumber: null,
            avgLapTime: 10,
            consistency: null,
            qualifyingPosition: null,
            secondsBehind: null,
            behindDisplay: null,
            liveRcStats: null,
          },
        ],
      }),
      mainRace({
        id: "r2",
        raceId: "r2",
        className: "Stock",
        raceLabel: "A2",
        results: [
          {
            raceResultId: "c",
            raceDriverId: "x",
            driverId: "d1",
            driverName: "A",
            positionFinal: 1,
            lapsCompleted: 10,
            totalTimeSeconds: 100,
            fastLapTime: 9,
            fastLapLapNumber: null,
            avgLapTime: 10,
            consistency: null,
            qualifyingPosition: null,
            secondsBehind: null,
            behindDisplay: null,
            liveRcStats: null,
          },
          {
            raceResultId: "d",
            raceDriverId: "y",
            driverId: "d2",
            driverName: "B",
            positionFinal: 2,
            lapsCompleted: 10,
            totalTimeSeconds: 100.2,
            fastLapTime: 9,
            fastLapLapNumber: null,
            avgLapTime: 10,
            consistency: null,
            qualifyingPosition: null,
            secondsBehind: null,
            behindDisplay: null,
            liveRcStats: null,
          },
        ],
      }),
    ]
    const rows = computeClosestP1P2PerClass(races)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.gapSeconds).toBeCloseTo(0.2, 5)
    expect(rows[0]!.gapDisplay).toBe("200 ms")
    expect(rows[0]!.raceLabel).toBe("A2")
  })

  it("includes class when P1 finishes more laps than P2 (lap-down; total times not comparable)", () => {
    const races: EventAnalysisData["races"] = [
      mainRace({
        className: "1/8 Electric Buggy",
        raceLabel: "1/8 Electric Buggy A3-Main",
        results: [
          {
            raceResultId: "a",
            raceDriverId: "x",
            driverId: "d1",
            driverName: "Winner",
            positionFinal: 1,
            lapsCompleted: 11,
            totalTimeSeconds: 434.134,
            fastLapTime: 9,
            fastLapLapNumber: null,
            avgLapTime: 10,
            consistency: null,
            qualifyingPosition: null,
            secondsBehind: null,
            behindDisplay: null,
            liveRcStats: null,
          },
          {
            raceResultId: "b",
            raceDriverId: "y",
            driverId: "d2",
            driverName: "Second",
            positionFinal: 2,
            lapsCompleted: 10,
            totalTimeSeconds: 425.288,
            fastLapTime: 9,
            fastLapLapNumber: null,
            avgLapTime: 10,
            consistency: null,
            qualifyingPosition: null,
            secondsBehind: null,
            behindDisplay: "1 Lap",
            liveRcStats: null,
          },
        ],
      }),
    ]
    const rows = computeClosestP1P2PerClass(races)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.className).toBe("1/8 Electric Buggy")
    expect(rows[0]!.gapSeconds).toBeNull()
    expect(rows[0]!.gapDisplay).toBe("1 Lap")
    expect(rows[0]!.p1Name).toBe("Winner")
    expect(rows[0]!.p2Name).toBe("Second")
  })
})

describe("computeDriverClosestBattles", () => {
  it("uses minimum adjacent gap across mains for each driver", () => {
    const races: EventAnalysisData["races"] = [
      mainRace({
        className: "Mod",
        raceLabel: "A1",
        results: [
          {
            raceResultId: "a",
            raceDriverId: "x",
            driverId: "d1",
            driverName: "P1",
            positionFinal: 1,
            lapsCompleted: 10,
            totalTimeSeconds: 100,
            fastLapTime: 9,
            fastLapLapNumber: null,
            avgLapTime: 10,
            consistency: null,
            qualifyingPosition: null,
            secondsBehind: null,
            behindDisplay: null,
            liveRcStats: null,
          },
          {
            raceResultId: "b",
            raceDriverId: "y",
            driverId: "d2",
            driverName: "P2",
            positionFinal: 2,
            lapsCompleted: 10,
            totalTimeSeconds: 100.4,
            fastLapTime: 9,
            fastLapLapNumber: null,
            avgLapTime: 10,
            consistency: null,
            qualifyingPosition: null,
            secondsBehind: null,
            behindDisplay: null,
            liveRcStats: null,
          },
        ],
      }),
    ]
    const rows = computeDriverClosestBattles(races)
    const p1 = rows.find((r) => r.driverName === "P1")
    const p2 = rows.find((r) => r.driverName === "P2")
    expect(p1?.gapSeconds).toBeCloseTo(0.4, 5)
    expect(p1?.opponentName).toBe("P2")
    expect(p2?.gapSeconds).toBeCloseTo(0.4, 5)
    expect(p2?.opponentName).toBe("P1")
  })
})
