import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import type { ClassWinnerHighlight } from "@/core/events/build-event-highlights"
import { computeClassWinnerMeanAvgLapCards } from "@/core/events/event-class-winner-mean-avg-lap"

function raceStub(
  className: string,
  raceLabel: string,
  results: Array<{
    driverId: string
    driverName: string
    avgLapTime: number | null
  }>
): EventAnalysisData["races"][number] {
  return {
    id: `id-${raceLabel}`,
    raceId: `race-${raceLabel}`,
    className,
    raceLabel,
    raceOrder: 1,
    startTime: null,
    durationSeconds: null,
    sessionType: "heat",
    sectionHeader: null,
    raceUrl: "",
    results: results.map((r, i) => ({
      raceResultId: `rr-${raceLabel}-${r.driverId}`,
      raceDriverId: `rd-${r.driverId}`,
      driverId: r.driverId,
      driverName: r.driverName,
      positionFinal: i + 1,
      lapsCompleted: 10,
      totalTimeSeconds: 100,
      fastLapTime: 10,
      avgLapTime: r.avgLapTime,
      consistency: null,
      qualifyingPosition: null,
      secondsBehind: null,
      behindDisplay: null,
      liveRcStats: null,
    })),
  }
}

describe("event-class-winner-mean-avg-lap", () => {
  it("averages session avg lap for the named class winner only", () => {
    const winners: ClassWinnerHighlight[] = [
      {
        className: "Stock",
        classDisplay: "Stock",
        winnerName: "Ann Alpha",
        raceLabel: "Final",
      },
    ]
    const races: EventAnalysisData["races"] = [
      raceStub("Stock", "Q1", [
        { driverId: "a", driverName: "Ann Alpha", avgLapTime: 12 },
        { driverId: "b", driverName: "Bob Beta", avgLapTime: 11 },
      ]),
      raceStub("Stock", "Q2", [
        { driverId: "a", driverName: "Ann Alpha", avgLapTime: 10 },
        { driverId: "b", driverName: "Bob Beta", avgLapTime: 9 },
      ]),
    ]
    const cards = computeClassWinnerMeanAvgLapCards(winners, races)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.meanAvgLapSeconds).toBe(11)
    expect(cards[0]!.sessionsWithAvgLap).toBe(2)
  })

  it("returns null mean when winner has no avg lap rows", () => {
    const winners: ClassWinnerHighlight[] = [
      {
        className: "Stock",
        classDisplay: "Stock",
        winnerName: "Ann Alpha",
        raceLabel: "Final",
      },
    ]
    const races: EventAnalysisData["races"] = [
      raceStub("Stock", "Q1", [{ driverId: "a", driverName: "Ann Alpha", avgLapTime: null }]),
    ]
    const cards = computeClassWinnerMeanAvgLapCards(winners, races)
    expect(cards[0]!.meanAvgLapSeconds).toBeNull()
    expect(cards[0]!.sessionsWithAvgLap).toBe(0)
  })
})
