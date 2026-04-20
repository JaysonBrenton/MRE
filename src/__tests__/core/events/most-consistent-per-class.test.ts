import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  compareMostConsistentEntries,
  computeConsistencyRankedForClass,
  computeMostConsistentLeadersPerClass,
} from "@/core/events/event-most-consistent-per-class"

function raceStub(
  className: string,
  results: Array<{
    driverId: string
    driverName: string
    consistency: number | null
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
      fastLapTime: 10,
      avgLapTime: 11,
      consistency: r.consistency,
      qualifyingPosition: null,
      secondsBehind: null,
      behindDisplay: null,
      liveRcStats: null,
    })),
  }
}

describe("event-most-consistent-per-class", () => {
  it("picks highest mean consistency per class", () => {
    const races: EventAnalysisData["races"] = [
      raceStub("Stock", [
        { driverId: "a", driverName: "Ann", consistency: 80 },
        { driverId: "b", driverName: "Bob", consistency: 90 },
      ]),
      raceStub("Stock", [
        { driverId: "a", driverName: "Ann", consistency: 100 },
        { driverId: "b", driverName: "Bob", consistency: 70 },
      ]),
    ]
    const leaders = computeMostConsistentLeadersPerClass(races)
    const stock = leaders.find((x) => x.className === "Stock")
    expect(stock?.leader.driverName).toBe("Ann")
    expect(stock?.leader.avgConsistency).toBe(90)
  })

  it("ranks full class list for modal", () => {
    const races: EventAnalysisData["races"] = [
      raceStub("Mod", [{ driverId: "x", driverName: "X", consistency: 50 }]),
      raceStub("Mod", [
        { driverId: "y", driverName: "Y", consistency: 99 },
        { driverId: "x", driverName: "X", consistency: 60 },
      ]),
    ]
    const ranked = computeConsistencyRankedForClass(races, "Mod")
    expect(ranked.map((r) => r.driverName)).toEqual(["Y", "X"])
    expect(ranked[0]!.avgConsistency).toBeCloseTo(99, 5)
    expect(ranked[1]!.avgConsistency).toBeCloseTo(55, 5)
  })

  it("compareMostConsistentEntries breaks ties by session count", () => {
    const a = {
      driverId: "a",
      driverName: "A",
      avgConsistency: 88,
      sessionsWithConsistency: 2,
    }
    const b = {
      driverId: "b",
      driverName: "B",
      avgConsistency: 88,
      sessionsWithConsistency: 3,
    }
    expect(compareMostConsistentEntries(a, b)).toBeGreaterThan(0)
  })
})
