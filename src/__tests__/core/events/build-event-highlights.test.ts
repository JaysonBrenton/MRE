/**
 * @fileoverview Tests for event highlights builder
 */

import { describe, it, expect } from "vitest"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import { buildEventHighlights, formatClosestFinishGap } from "@/core/events/build-event-highlights"

function baseData(overrides: Partial<EventAnalysisData> = {}): EventAnalysisData {
  return {
    event: {
      id: "e1",
      trackId: "t1",
      eventName: "Test",
      eventDate: new Date("2026-03-01T00:00:00Z"),
      trackName: "Track",
    },
    races: [],
    drivers: [],
    entryList: [],
    raceClasses: new Map(),
    multiMainResults: [],
    summary: {
      totalRaces: 0,
      totalDrivers: 0,
      totalLaps: 0,
      dateRange: { earliest: null, latest: null },
    },
    qualPointsTopQualifiers: null,
    userHostTrack: null,
    ...overrides,
  }
}

describe("buildEventHighlights", () => {
  it("computes session mix percentages", () => {
    const data = baseData({
      races: [
        {
          id: "r1",
          raceId: "x1",
          className: "Buggy",
          raceLabel: "Q1",
          raceOrder: 1,
          startTime: null,
          durationSeconds: null,
          sessionType: "qualifying",
          sectionHeader: null,
          raceUrl: "u",
          results: [],
        },
        {
          id: "r2",
          raceId: "x2",
          className: "Buggy",
          raceLabel: "A-Main",
          raceOrder: 2,
          startTime: null,
          durationSeconds: null,
          sessionType: "main",
          sectionHeader: "Main Events",
          raceUrl: "u",
          results: [
            {
              raceResultId: "rr1",
              raceDriverId: "rd1",
              driverId: "d1",
              driverName: "Alice",
              positionFinal: 1,
              lapsCompleted: 10,
              totalTimeSeconds: 300,
              fastLapTime: 28.5,
              avgLapTime: 30,
              consistency: 0.9,
              qualifyingPosition: null,
              secondsBehind: null,
              behindDisplay: null,
              liveRcStats: null,
            },
            {
              raceResultId: "rr2",
              raceDriverId: "rd2",
              driverId: "d2",
              driverName: "Bob",
              positionFinal: 2,
              lapsCompleted: 10,
              totalTimeSeconds: 300.5,
              fastLapTime: 28.6,
              avgLapTime: 30.1,
              consistency: 0.88,
              qualifyingPosition: null,
              secondsBehind: null,
              behindDisplay: null,
              liveRcStats: null,
            },
          ],
        },
      ],
      drivers: [
        {
          driverId: "d1",
          driverName: "Alice",
          racesParticipated: 1,
          bestLapTime: 28.5,
          avgLapTime: 30,
          consistency: 0.9,
        },
        {
          driverId: "d2",
          driverName: "Bob",
          racesParticipated: 1,
          bestLapTime: 28.6,
          avgLapTime: 30.1,
          consistency: 0.88,
        },
      ],
    })
    const m = buildEventHighlights(data)
    expect(m.sessionMix).toHaveLength(2)
    expect(m.sessionMix.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 5)
    expect(m.closestFinishes).toHaveLength(1)
    expect(m.closestFinishes[0]!.gapSeconds).toBeCloseTo(0.5, 5)
    expect(m.closestFinishes[0]!.gapDisplay).toBe("500 ms")
    expect(m.mostConsistentDriver?.driverName).toBe("Alice")
    expect(m.mostConsistentDriver?.consistency).toBeCloseTo(0.9, 5)
    expect(m.topConsistentDrivers).toHaveLength(2)
    expect(m.topConsistentDrivers[0]).toEqual({
      driverName: "Alice",
      consistency: 0.9,
      racesParticipated: 1,
    })
    expect(m.fastestAvgLapDriver?.driverName).toBe("Alice")
    expect(m.fastestAvgLapDriver?.avgLapTime).toBeCloseTo(30, 5)
    expect(m.topFastestAvgLapDrivers).toHaveLength(2)
    expect(m.topFastestAvgLapDrivers[0]).toEqual({
      driverName: "Alice",
      avgLapTime: 30,
      racesParticipated: 1,
    })
  })

  it("ranks top three drivers by event-wide average consistency", () => {
    const driver = (id: string, name: string, consistency: number, racesParticipated: number) => ({
      driverId: id,
      driverName: name,
      racesParticipated,
      bestLapTime: 28.5,
      avgLapTime: 30,
      consistency,
    })
    const data = baseData({
      drivers: [
        driver("d1", "Low", 0.5, 2),
        driver("d2", "Mid", 0.75, 2),
        driver("d3", "High", 0.95, 2),
        driver("d4", "Fourth", 0.6, 1),
      ],
    })
    const m = buildEventHighlights(data)
    expect(m.topConsistentDrivers).toHaveLength(3)
    expect(m.topConsistentDrivers[0]!.driverName).toBe("High")
    expect(m.topConsistentDrivers[0]!.consistency).toBeCloseTo(0.95, 5)
    expect(m.topConsistentDrivers[1]!.driverName).toBe("Mid")
    expect(m.topConsistentDrivers[2]!.driverName).toBe("Fourth")
    expect(m.mostConsistentDriver?.driverName).toBe("High")
  })

  it("ranks top three drivers by event-wide average lap time (fastest first)", () => {
    const driver = (id: string, name: string, avgLapTime: number, racesParticipated: number) => ({
      driverId: id,
      driverName: name,
      racesParticipated,
      bestLapTime: avgLapTime - 1,
      avgLapTime,
      consistency: 0.85,
    })
    const data = baseData({
      drivers: [
        driver("d1", "Slowest", 32.5, 2),
        driver("d2", "Mid", 29.0, 2),
        driver("d3", "Fastest", 27.5, 2),
        driver("d4", "Fourth", 28.0, 1),
      ],
    })
    const m = buildEventHighlights(data)
    expect(m.topFastestAvgLapDrivers).toHaveLength(3)
    expect(m.topFastestAvgLapDrivers[0]!.driverName).toBe("Fastest")
    expect(m.topFastestAvgLapDrivers[0]!.avgLapTime).toBeCloseTo(27.5, 5)
    expect(m.topFastestAvgLapDrivers[1]!.driverName).toBe("Fourth")
    expect(m.topFastestAvgLapDrivers[2]!.driverName).toBe("Mid")
    expect(m.fastestAvgLapDriver?.driverName).toBe("Fastest")
  })

  it("ranks top three drivers by total laps completed across races", () => {
    const resultRow = (driverId: string, driverName: string, laps: number) => ({
      raceResultId: `rr-${driverId}`,
      raceDriverId: `rd-${driverId}`,
      driverId,
      driverName,
      positionFinal: 1,
      lapsCompleted: laps,
      totalTimeSeconds: 300,
      fastLapTime: 28.5,
      avgLapTime: 30,
      consistency: 0.9,
      qualifyingPosition: null,
      secondsBehind: null,
      liveRcStats: null,
    })
    const data = baseData({
      races: [
        {
          id: "r1",
          raceId: "x1",
          className: "Buggy",
          raceLabel: "M1",
          raceOrder: 1,
          startTime: null,
          durationSeconds: null,
          sessionType: "main",
          sectionHeader: null,
          raceUrl: "u",
          results: [
            resultRow("d1", "Alice", 10),
            resultRow("d2", "Bob", 8),
            resultRow("d3", "Carol", 6),
          ],
        },
        {
          id: "r2",
          raceId: "x2",
          className: "Buggy",
          raceLabel: "M2",
          raceOrder: 2,
          startTime: null,
          durationSeconds: null,
          sessionType: "main",
          sectionHeader: null,
          raceUrl: "u",
          results: [
            resultRow("d1", "Alice", 5),
            resultRow("d2", "Bob", 12),
            resultRow("d4", "Dan", 4),
          ],
        },
      ],
    })
    const m = buildEventHighlights(data)
    expect(m.topLapsCompleted).toHaveLength(3)
    expect(m.topLapsCompleted[0]).toEqual({ driverName: "Bob", totalLaps: 20 })
    expect(m.topLapsCompleted[1]).toEqual({ driverName: "Alice", totalLaps: 15 })
    expect(m.topLapsCompleted[2]).toEqual({ driverName: "Carol", totalLaps: 6 })
  })

  it("ranks top three fastest single laps across race results", () => {
    const resultRow = (id: string, driverName: string, fastLap: number) => ({
      raceResultId: `rr-${id}`,
      raceDriverId: `rd-${id}`,
      driverId: `d-${id}`,
      driverName,
      positionFinal: 1,
      lapsCompleted: 10,
      totalTimeSeconds: 300,
      fastLapTime: fastLap,
      avgLapTime: fastLap + 1,
      consistency: 0.9,
      qualifyingPosition: null,
      secondsBehind: null,
      liveRcStats: null,
    })
    const data = baseData({
      races: [
        {
          id: "r1",
          raceId: "x1",
          className: "Buggy",
          raceLabel: "Q1",
          raceOrder: 1,
          startTime: null,
          durationSeconds: null,
          sessionType: "qualifying",
          sectionHeader: null,
          raceUrl: "u",
          results: [resultRow("a", "Alice", 28.0)],
        },
        {
          id: "r2",
          raceId: "x2",
          className: "Buggy",
          raceLabel: "A-Main",
          raceOrder: 2,
          startTime: null,
          durationSeconds: null,
          sessionType: "main",
          sectionHeader: null,
          raceUrl: "u",
          results: [resultRow("b", "Bob", 27.5), resultRow("c", "Carol", 29.0)],
        },
      ],
    })
    const m = buildEventHighlights(data)
    expect(m.topFastLaps).toHaveLength(3)
    expect(m.topFastLaps[0]).toMatchObject({
      raceResultId: "rr-b",
      driverName: "Bob",
      fastLapTime: 27.5,
      raceLabel: "A-Main",
    })
    expect(m.topFastLaps[1]).toMatchObject({
      raceResultId: "rr-a",
      driverName: "Alice",
      fastLapTime: 28.0,
      raceLabel: "Q1",
    })
    expect(m.topFastLaps[2]).toMatchObject({
      raceResultId: "rr-c",
      driverName: "Carol",
      fastLapTime: 29.0,
    })
  })

  it("computes class mix by drivers from entry list", () => {
    const data = baseData({
      entryList: [
        {
          id: "e1",
          driverId: "d1",
          driverName: "A",
          className: "Buggy",
          transponderNumber: null,
          carNumber: null,
        },
        {
          id: "e2",
          driverId: "d2",
          driverName: "B",
          className: "Buggy",
          transponderNumber: null,
          carNumber: null,
        },
        {
          id: "e3",
          driverId: "d3",
          driverName: "C",
          className: "Touring",
          transponderNumber: null,
          carNumber: null,
        },
      ],
    })
    const m = buildEventHighlights(data)
    expect(m.classMixByDrivers).toHaveLength(2)
    expect(m.classMixByDrivers[0]!.label).toBe("Buggy")
    expect(m.classMixByDrivers[0]!.count).toBe(2)
    expect(m.classMixByDrivers[0]!.pct).toBeCloseTo((2 / 3) * 100, 5)
    expect(m.classMixByDrivers[1]!.label).toBe("Touring")
    expect(m.classMixByDrivers[1]!.count).toBe(1)
  })

  it("computes class mix by laps from race results", () => {
    const data = baseData({
      races: [
        {
          id: "r1",
          raceId: "x1",
          className: "Buggy",
          raceLabel: "M1",
          raceOrder: 1,
          startTime: null,
          durationSeconds: null,
          sessionType: "main",
          sectionHeader: null,
          raceUrl: "u",
          results: [
            {
              raceResultId: "rr1",
              raceDriverId: "rd1",
              driverId: "d1",
              driverName: "A",
              positionFinal: 1,
              lapsCompleted: 10,
              totalTimeSeconds: 300,
              fastLapTime: 28,
              avgLapTime: 30,
              consistency: 0.9,
              qualifyingPosition: null,
              secondsBehind: null,
              liveRcStats: null,
            },
            {
              raceResultId: "rr2",
              raceDriverId: "rd2",
              driverId: "d2",
              driverName: "B",
              positionFinal: 2,
              lapsCompleted: 10,
              totalTimeSeconds: 301,
              fastLapTime: 28.1,
              avgLapTime: 30.1,
              consistency: 0.88,
              qualifyingPosition: null,
              secondsBehind: null,
              liveRcStats: null,
            },
          ],
        },
        {
          id: "r2",
          raceId: "x2",
          className: "Touring",
          raceLabel: "M1",
          raceOrder: 2,
          startTime: null,
          durationSeconds: null,
          sessionType: "main",
          sectionHeader: null,
          raceUrl: "u",
          results: [
            {
              raceResultId: "rr3",
              raceDriverId: "rd3",
              driverId: "d3",
              driverName: "C",
              positionFinal: 1,
              lapsCompleted: 5,
              totalTimeSeconds: 200,
              fastLapTime: 29,
              avgLapTime: 31,
              consistency: 0.85,
              qualifyingPosition: null,
              secondsBehind: null,
              liveRcStats: null,
            },
          ],
        },
      ],
    })
    const m = buildEventHighlights(data)
    expect(m.classMixByLaps).toHaveLength(2)
    expect(m.classMixByLaps[0]!.label).toBe("Buggy")
    expect(m.classMixByLaps[0]!.count).toBe(20)
    expect(m.classMixByLaps[0]!.pct).toBeCloseTo((20 / 25) * 100, 5)
    expect(m.classMixByLaps[1]!.label).toBe("Touring")
    expect(m.classMixByLaps[1]!.count).toBe(5)
  })

  it("formats sub-second gaps", () => {
    expect(
      formatClosestFinishGap({
        raceLabel: "A",
        classDisplay: "B",
        p1Name: "a",
        p2Name: "b",
        gapSeconds: 0.042,
        gapDisplay: "42 ms",
      })
    ).toMatch(/42/)
  })
})
