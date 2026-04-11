import { describe, it, expect } from "vitest"
import { computeDriverStatsFromRaces } from "@/core/events/compute-driver-stats-from-races"
import type { LiveRcRaceResultStats } from "@/core/events/live-rc-race-result-stats"

const liverc: LiveRcRaceResultStats = {
  avgTop5: 34.0,
  avgTop10: 34.5,
  avgTop15: 35.0,
  top2Consecutive: 70.0,
  top3Consecutive: 105.0,
  stdDeviation: 2.5,
}

describe("computeDriverStatsFromRaces", () => {
  it("clears LiveRC fields when multiple races", () => {
    const out = computeDriverStatsFromRaces([
      {
        raceLabel: "R1",
        results: [
          {
            driverId: "d1",
            driverName: "A",
            lapsCompleted: 10,
            fastLapTime: 30,
            avgLapTime: 31,
            consistency: 90,
            positionFinal: 1,
            liveRcStats: liverc,
          },
        ],
      },
      {
        raceLabel: "R2",
        results: [
          {
            driverId: "d1",
            driverName: "A",
            lapsCompleted: 10,
            fastLapTime: 29,
            avgLapTime: 30,
            consistency: 91,
            positionFinal: 1,
            liveRcStats: liverc,
          },
        ],
      },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].avgTop5).toBeNull()
    expect(out[0].top3Consecutive).toBeNull()
  })

  it("maps liveRcStats per driver when a single race", () => {
    const out = computeDriverStatsFromRaces([
      {
        raceLabel: "Final",
        results: [
          {
            driverId: "d1",
            driverName: "A",
            lapsCompleted: 10,
            fastLapTime: 30,
            avgLapTime: 31,
            consistency: 90,
            positionFinal: 1,
            liveRcStats: liverc,
          },
          {
            driverId: "d2",
            driverName: "B",
            lapsCompleted: 10,
            fastLapTime: 31,
            avgLapTime: 32,
            consistency: 88,
            positionFinal: 2,
            liveRcStats: null,
          },
        ],
      },
    ])
    expect(out.find((d) => d.driverId === "d1")!.avgTop5).toBe(34.0)
    expect(out.find((d) => d.driverId === "d1")!.top3Consecutive).toBe(105.0)
    expect(out.find((d) => d.driverId === "d2")!.avgTop5).toBeNull()
  })
})
