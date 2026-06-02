/**
 * @fileoverview Tests for lap-by-lap trend chart pure helpers
 */

import {
  alignedEventLapX,
  buildAggregateTooltipPayload,
  buildCrosshairTooltipPayload,
  computeSessionBands,
  computeSessionDividers,
  computeSessionLayout,
  countPlottableLaps,
  defaultDriverLineColor,
  filterLapTrendDriversByRaceIds,
  lapChartXValue,
  lapForDriverAtChartX,
  sessionBandsFromLayout,
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

  it("returns null lap cells when no driver has a lap at the snapped index (no nearest fallback)", () => {
    const drivers = [
      driverSeries("a", [
        { lapIndex: 10, raceId: "q1", raceLabel: "Q1", lapNumber: 10, lapTimeSeconds: 32.0 },
      ]),
    ]

    const payload = buildAggregateTooltipPayload({
      drivers,
      lapIndexValue: 11,
      minLapIndex: 1,
      maxLapIndex: 20,
      raceDisplayLabelById: new Map(),
    })

    expect(payload!.lapIndex).toBe(11)
    expect(payload!.columns[0].lapTimeSeconds).toBeNull()
    expect(payload!.columns[0].currentLapNumber).toBeNull()
  })

  it("uses session lap numbers when xDimension is sessionLapNumber", () => {
    const drivers = [
      driverSeries("a", [
        { lapIndex: 47, raceId: "m1", raceLabel: "A-Main", lapNumber: 3, lapTimeSeconds: 32.0 },
      ]),
    ]

    const payload = buildAggregateTooltipPayload({
      drivers,
      lapIndexValue: 3.1,
      minLapIndex: 1,
      maxLapIndex: 10,
      raceDisplayLabelById: new Map([["m1", "A-Main"]]),
      xDimension: "sessionLapNumber",
    })

    expect(payload!.lapIndex).toBe(3)
    expect(payload!.columns[0].lapTimeSeconds).toBe(32.0)
    expect(payload!.columns[0].currentLapNumber).toBe(3)
    expect(payload!.columns[0].deltaToDriverBestSeconds).toBe(0)
    expect(payload!.columns[0].deltaToChartBestSeconds).toBe(0)
  })

  it("enriches columns with deltas and outlier flags", () => {
    const drivers = [
      driverSeries("a", [
        { lapIndex: 5, raceId: "q1", raceLabel: "Q1", lapNumber: 5, lapTimeSeconds: 32.0 },
        { lapIndex: 6, raceId: "q1", raceLabel: "Q1", lapNumber: 6, lapTimeSeconds: 31.5 },
      ]),
      driverSeries("b", [
        { lapIndex: 5, raceId: "q1", raceLabel: "Q1", lapNumber: 5, lapTimeSeconds: 32.4 },
      ]),
    ]

    const payload = buildCrosshairTooltipPayload({
      drivers,
      lapIndexValue: 5,
      minLapIndex: 1,
      maxLapIndex: 10,
      raceDisplayLabelById: new Map([["q1", "Qualifier 1"]]),
      outlierLapKeysByDriverId: new Map([["b", new Set(["5-q1"])]]),
    })

    expect(payload!.columns[0].deltaToDriverBestSeconds).toBeCloseTo(0.5, 3)
    expect(payload!.columns[0].deltaToChartBestSeconds).toBeCloseTo(0.5, 3)
    expect(payload!.columns[1].deltaToDriverBestSeconds).toBe(0)
    expect(payload!.columns[1].deltaToChartBestSeconds).toBeCloseTo(0.9, 3)
    expect(payload!.columns[1].isOutlierLap).toBe(true)
  })
})

describe("lapChartXValue", () => {
  it("reads session lap number when dimension is sessionLapNumber", () => {
    const lap = {
      lapIndex: 47,
      raceId: "m1",
      raceLabel: "Main",
      lapNumber: 5,
      lapTimeSeconds: 32,
      className: "Buggy",
    }
    expect(lapChartXValue(lap, "eventLapIndex")).toBe(47)
    expect(lapChartXValue(lap, "sessionLapNumber")).toBe(5)
  })

  it("uses the session-aligned axis when a layout is supplied", () => {
    const lap = {
      lapIndex: 47,
      raceId: "m1",
      raceLabel: "Main",
      lapNumber: 5,
      lapTimeSeconds: 32,
      className: "Buggy",
    }
    const layout = computeSessionLayout([driverSeries("a", [lap])])
    // single session m1 starts at offset 0, so aligned x = lapNumber
    expect(lapChartXValue(lap, "eventLapIndex", layout)).toBe(5)
  })
})

describe("computeSessionLayout / alignment (Option 1)", () => {
  // Two drivers with different qualifier lap counts → different per-driver cumulative lapIndex,
  // but they share the Main (m1) and should align on a shared session-aligned x-axis.
  const drivers = [
    driverSeries("a", [
      { lapIndex: 1, raceId: "q1", raceLabel: "Q1", lapNumber: 1, lapTimeSeconds: 32.0 },
      { lapIndex: 2, raceId: "q1", raceLabel: "Q1", lapNumber: 2, lapTimeSeconds: 32.1 },
      { lapIndex: 3, raceId: "q1", raceLabel: "Q1", lapNumber: 3, lapTimeSeconds: 32.2 },
      { lapIndex: 4, raceId: "m1", raceLabel: "A-Main", lapNumber: 1, lapTimeSeconds: 31.5 },
      { lapIndex: 5, raceId: "m1", raceLabel: "A-Main", lapNumber: 2, lapTimeSeconds: 31.6 },
    ]),
    driverSeries("b", [
      { lapIndex: 1, raceId: "q1", raceLabel: "Q1", lapNumber: 1, lapTimeSeconds: 33.0 },
      { lapIndex: 2, raceId: "q1", raceLabel: "Q1", lapNumber: 2, lapTimeSeconds: 33.1 },
      { lapIndex: 3, raceId: "q1", raceLabel: "Q1", lapNumber: 3, lapTimeSeconds: 33.2 },
      { lapIndex: 4, raceId: "q1", raceLabel: "Q1", lapNumber: 4, lapTimeSeconds: 33.3 },
      { lapIndex: 5, raceId: "m1", raceLabel: "A-Main", lapNumber: 1, lapTimeSeconds: 31.8 },
      { lapIndex: 6, raceId: "m1", raceLabel: "A-Main", lapNumber: 2, lapTimeSeconds: 31.9 },
    ]),
  ]

  it("sizes each session by its widest driver and concatenates chronologically", () => {
    const layout = computeSessionLayout(drivers)
    expect(layout.entries).toEqual([
      { raceId: "q1", raceLabel: "Q1", startOffset: 0, lapCount: 4 },
      { raceId: "m1", raceLabel: "A-Main", startOffset: 4, lapCount: 2 },
    ])
    expect(layout.totalLaps).toBe(6)
  })

  it("aligns the same session-lap to the same x for both drivers", () => {
    const layout = computeSessionLayout(drivers)
    const aMainLapA = drivers[0].laps[3] // m1, lapNumber 1
    const aMainLapB = drivers[1].laps[4] // m1, lapNumber 1
    expect(alignedEventLapX(aMainLapA, layout)).toBe(5)
    expect(alignedEventLapX(aMainLapB, layout)).toBe(5)
  })

  it("derives exact, driver-independent session bands from the layout", () => {
    const layout = computeSessionLayout(drivers)
    expect(sessionBandsFromLayout(layout)).toEqual([
      { raceId: "q1", raceLabel: "Q1", startLapIndex: 1, endLapIndex: 4 },
      { raceId: "m1", raceLabel: "A-Main", startLapIndex: 5, endLapIndex: 6 },
    ])
  })

  it("reports a single session (not 'Multiple sessions') for both drivers at the aligned Main lap", () => {
    const layout = computeSessionLayout(drivers)
    const payload = buildCrosshairTooltipPayload({
      drivers,
      lapIndexValue: 5,
      minLapIndex: 1,
      maxLapIndex: layout.totalLaps,
      raceDisplayLabelById: new Map([["m1", "A-Main"]]),
      xDimension: "eventLapIndex",
      sessionLayout: layout,
    })
    expect(payload!.sessionHeading).toBe("A-Main")
    expect(payload!.lapInSessionNumber).toBe(1)
    expect(payload!.columns[0].lapTimeSeconds).toBe(31.5)
    expect(payload!.columns[1].lapTimeSeconds).toBe(31.8)
  })

  it("without the layout, the legacy per-driver index misaligns the two drivers (regression guard)", () => {
    const payload = buildCrosshairTooltipPayload({
      drivers,
      lapIndexValue: 5,
      minLapIndex: 1,
      maxLapIndex: 6,
      raceDisplayLabelById: new Map(),
      xDimension: "eventLapIndex",
    })
    // Driver A index 5 = Main lap 2; Driver B index 5 = Main lap 1 → still a mismatch without layout
    expect(payload!.columns[0].currentLapNumber).toBe(2)
    expect(payload!.columns[1].currentLapNumber).toBe(1)
  })
})

describe("lapForDriverAtChartX", () => {
  it("matches exact session lap number only", () => {
    const laps = [
      {
        lapIndex: 47,
        raceId: "m1",
        raceLabel: "Main",
        lapNumber: 3,
        lapTimeSeconds: 32.0,
        className: "Buggy",
      },
    ]
    expect(lapForDriverAtChartX(laps, 3, "sessionLapNumber")?.lapTimeSeconds).toBe(32.0)
    expect(lapForDriverAtChartX(laps, 4, "sessionLapNumber")).toBeNull()
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
