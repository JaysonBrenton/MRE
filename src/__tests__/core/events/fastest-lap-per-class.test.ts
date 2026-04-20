import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  compareFastestLapEntries,
  computeFastestLapLeadersPerClass,
  computeFastestLapRankedForClass,
} from "@/core/events/event-fastest-lap-per-class"

function raceStub(
  className: string,
  results: Array<{
    driverId: string
    driverName: string
    fastLapTime: number | null
  }>
): EventAnalysisData["races"][number] {
  return {
    id: `r-${className}-${results.map((x) => x.driverId).join("-")}`,
    raceId: `r-${className}`,
    className,
    raceLabel: "Heat",
    raceOrder: 1,
    startTime: null,
    durationSeconds: null,
    sessionType: "heat",
    sectionHeader: null,
    raceUrl: "",
    results: results.map((r, i) => ({
      raceResultId: `rr-${className}-${r.driverId}-${i}`,
      raceDriverId: `rd-${r.driverId}`,
      driverId: r.driverId,
      driverName: r.driverName,
      positionFinal: i + 1,
      lapsCompleted: 10,
      totalTimeSeconds: 100,
      fastLapTime: r.fastLapTime,
      avgLapTime: 11,
      consistency: null,
      qualifyingPosition: null,
      secondsBehind: null,
      behindDisplay: null,
      liveRcStats: null,
    })),
  }
}

describe("event-fastest-lap-per-class", () => {
  it("picks lowest best fast lap per class", () => {
    const races: EventAnalysisData["races"] = [
      raceStub("Stock", [
        { driverId: "a", driverName: "Ann", fastLapTime: 12.5 },
        { driverId: "b", driverName: "Bob", fastLapTime: 12.0 },
      ]),
      raceStub("Stock", [
        { driverId: "a", driverName: "Ann", fastLapTime: 11.8 },
        { driverId: "b", driverName: "Bob", fastLapTime: 12.2 },
      ]),
    ]
    const leaders = computeFastestLapLeadersPerClass(races)
    const stock = leaders.find((x) => x.className === "Stock")
    expect(stock?.leader.driverName).toBe("Ann")
    expect(stock?.leader.bestFastLapSeconds).toBe(11.8)
    expect(stock?.leader.sessionsWithFastLap).toBe(2)
  })

  it("ranks full class list for modal", () => {
    const races: EventAnalysisData["races"] = [
      raceStub("Mod", [{ driverId: "x", driverName: "X", fastLapTime: 10.0 }]),
      raceStub("Mod", [
        { driverId: "y", driverName: "Y", fastLapTime: 9.5 },
        { driverId: "x", driverName: "X", fastLapTime: 9.8 },
      ]),
    ]
    const ranked = computeFastestLapRankedForClass(races, "Mod")
    expect(ranked.map((r) => r.driverName)).toEqual(["Y", "X"])
    expect(ranked[0]!.bestFastLapSeconds).toBe(9.5)
    expect(ranked[1]!.bestFastLapSeconds).toBe(9.8)
  })

  it("compareFastestLapEntries breaks ties by session count", () => {
    const a = {
      driverId: "a",
      driverName: "A",
      bestFastLapSeconds: 10,
      sessionsWithFastLap: 2,
    }
    const b = {
      driverId: "b",
      driverName: "B",
      bestFastLapSeconds: 10,
      sessionsWithFastLap: 3,
    }
    expect(compareFastestLapEntries(a, b)).toBeGreaterThan(0)
  })
})
