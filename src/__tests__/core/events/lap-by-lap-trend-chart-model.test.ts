/**
 * @fileoverview Tests for lap-by-lap trend chart pure helpers
 */

import {
  buildAggregateTooltipPayload,
  computeSessionBands,
  computeSessionDividers,
  countPlottableLaps,
  defaultDriverLineColor,
  filterLapTrendDriversByRaceIds,
} from "@/core/events/lap-by-lap-trend-chart-model"
import type { DriverLapTrendSeries } from "@/core/events/get-lap-data"
import { describe, expect, it } from "vitest"

function driverSeries(
  driverId: string,
  laps: Array<{
    lapIndex: number
    raceId: string
    raceLabel: string
    lapNumber: number
    lapTimeSeconds: number
    positionOnLap?: number
  }>
): DriverLapTrendSeries {
  return {
    driverId,
    driverName: driverId,
    laps: laps.map((lap) => ({
      ...lap,
      className: "Buggy",
    })),
  }
}

describe("computeSessionBands", () => {
  it("merges session boundaries across all drivers ordered by earliest lap index", () => {
    const drivers = [
      driverSeries("a", [
        { lapIndex: 1, raceId: "q1", raceLabel: "Q1", lapNumber: 1, lapTimeSeconds: 32.1 },
        { lapIndex: 2, raceId: "q1", raceLabel: "Q1", lapNumber: 2, lapTimeSeconds: 32.2 },
        { lapIndex: 3, raceId: "m1", raceLabel: "A-Main", lapNumber: 1, lapTimeSeconds: 31.9 },
      ]),
      driverSeries("b", [
        { lapIndex: 1, raceId: "q1", raceLabel: "Q1", lapNumber: 1, lapTimeSeconds: 33.0 },
        { lapIndex: 2, raceId: "m1", raceLabel: "A-Main", lapNumber: 1, lapTimeSeconds: 32.5 },
        { lapIndex: 3, raceId: "m1", raceLabel: "A-Main", lapNumber: 2, lapTimeSeconds: 32.6 },
      ]),
    ]

    expect(computeSessionBands(drivers)).toEqual([
      { raceId: "q1", raceLabel: "Q1", startLapIndex: 1, endLapIndex: 2 },
      { raceId: "m1", raceLabel: "A-Main", startLapIndex: 2, endLapIndex: 3 },
    ])
  })
})

describe("computeSessionDividers", () => {
  it("returns one divider per session band after the first with stable raceId identity", () => {
    const bands = computeSessionBands([
      driverSeries("a", [
        { lapIndex: 1, raceId: "q1", raceLabel: "Q1", lapNumber: 1, lapTimeSeconds: 32.1 },
        { lapIndex: 2, raceId: "m1", raceLabel: "A-Main", lapNumber: 1, lapTimeSeconds: 31.9 },
      ]),
      driverSeries("b", [
        { lapIndex: 1, raceId: "q2", raceLabel: "Q2", lapNumber: 1, lapTimeSeconds: 33.0 },
        { lapIndex: 2, raceId: "m1", raceLabel: "A-Main", lapNumber: 1, lapTimeSeconds: 32.5 },
      ]),
    ])

    const dividers = computeSessionDividers(bands)
    expect(dividers.map((d) => d.raceId)).toEqual(["q2", "m1"])
    expect(new Set(dividers.map((d) => d.raceId)).size).toBe(dividers.length)
  })
})

describe("buildAggregateTooltipPayload", () => {
  it("resolves each driver independently at the snapped lap index", () => {
    const drivers = [
      driverSeries("a", [
        {
          lapIndex: 10,
          raceId: "q2",
          raceLabel: "Q2",
          lapNumber: 3,
          lapTimeSeconds: 32.0,
          positionOnLap: 2,
        },
      ]),
      driverSeries("b", [
        {
          lapIndex: 10,
          raceId: "m1",
          raceLabel: "A-Main",
          lapNumber: 1,
          lapTimeSeconds: 31.5,
          positionOnLap: 1,
        },
      ]),
    ]

    const payload = buildAggregateTooltipPayload({
      drivers,
      lapIndexValue: 10.2,
      minLapIndex: 1,
      maxLapIndex: 20,
      raceDisplayLabelById: new Map([["q2", "Qualifier 2"]]),
    })

    expect(payload).not.toBeNull()
    expect(payload!.lapIndex).toBe(10)
    expect(payload!.sessionHeading).toBe("Multiple sessions")
    expect(payload!.columns[0].lapTimeSeconds).toBe(32.0)
    expect(payload!.columns[0].raceId).toBe("q2")
    expect(payload!.columns[1].lapTimeSeconds).toBe(31.5)
    expect(payload!.columns[1].raceId).toBe("m1")
  })

  it("uses a single session heading when all drivers share the race at that index", () => {
    const drivers = [
      driverSeries("a", [
        { lapIndex: 5, raceId: "q1", raceLabel: "Q1", lapNumber: 5, lapTimeSeconds: 32.0 },
      ]),
      driverSeries("b", [
        { lapIndex: 5, raceId: "q1", raceLabel: "Q1", lapNumber: 5, lapTimeSeconds: 32.4 },
      ]),
    ]

    const payload = buildAggregateTooltipPayload({
      drivers,
      lapIndexValue: 5,
      minLapIndex: 1,
      maxLapIndex: 10,
      raceDisplayLabelById: new Map([["q1", "Qualifier 1 [1/2]"]]),
    })

    expect(payload!.sessionHeading).toBe("Qualifier 1 [1/2]")
  })
})

describe("filterLapTrendDriversByRaceIds", () => {
  it("filters laps without re-indexing", () => {
    const drivers = [
      driverSeries("a", [
        { lapIndex: 5, raceId: "q1", raceLabel: "Q1", lapNumber: 1, lapTimeSeconds: 32.0 },
        { lapIndex: 12, raceId: "m1", raceLabel: "Main", lapNumber: 1, lapTimeSeconds: 31.5 },
      ]),
    ]
    const filtered = filterLapTrendDriversByRaceIds(drivers, new Set(["q1"]))
    expect(filtered[0].laps.map((l) => l.lapIndex)).toEqual([5])
  })
})

describe("countPlottableLaps", () => {
  it("ignores non-positive lap times", () => {
    const driver = driverSeries("a", [
      { lapIndex: 1, raceId: "q1", raceLabel: "Q1", lapNumber: 1, lapTimeSeconds: 32.0 },
      { lapIndex: 2, raceId: "q1", raceLabel: "Q1", lapNumber: 2, lapTimeSeconds: 0 },
    ])
    expect(countPlottableLaps(driver.laps)).toBe(1)
  })
})

describe("defaultDriverLineColor", () => {
  it("assigns stable palette slots by sorted driver id", () => {
    const ids = ["charlie", "alpha", "bravo"]
    expect(defaultDriverLineColor("alpha", ids)).toBe(
      defaultDriverLineColor("alpha", ["bravo", "alpha", "charlie"])
    )
    expect(defaultDriverLineColor("alpha", ids)).not.toBe(defaultDriverLineColor("bravo", ids))
  })
})
