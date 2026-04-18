import { buildTopQualifierOverviewCards } from "@/core/events/top-qualifier-overview-cards"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

const baseQual = {
  label: "Qual Points",
  sourcePointsId: "p1",
  viewPointsUrl: null as string | null,
}

function raceStub(
  id: string,
  className: string,
  raceLabel: string,
  sessionType: string | null,
  results: Array<{ driverId: string; positionFinal: number }>,
  raceOrder: number
): EventAnalysisData["races"][number] {
  return {
    id,
    raceId: id,
    className,
    raceLabel,
    raceOrder,
    completedAt: null,
    startTime: null,
    durationSeconds: null,
    sessionType,
    sectionHeader: null,
    raceUrl: "",
    results: results.map((r, i) => ({
      raceResultId: `${id}-r${i}`,
      raceDriverId: `${id}-rd${i}`,
      driverId: r.driverId,
      driverName: "D",
      positionFinal: r.positionFinal,
      lapsCompleted: 0,
      totalTimeSeconds: null,
      fastLapTime: null,
      fastLapLapNumber: null,
      avgLapTime: null,
      consistency: null,
      qualifyingPosition: null,
      secondsBehind: null,
      behindDisplay: null,
      liveRcStats: null,
    })),
  }
}

describe("buildTopQualifierOverviewCards", () => {
  it("builds one card per class with position-1 leader and qualifier session rows", () => {
    const qualPoints: NonNullable<EventAnalysisData["qualPointsTopQualifiers"]> = {
      ...baseQual,
      standings: [
        {
          className: "Buggy",
          position: 1,
          driverId: "drv1",
          driverDisplayName: "Alice",
          points: 42,
        },
        {
          className: "Buggy",
          position: 2,
          driverId: "drv2",
          driverDisplayName: "Bob",
          points: 40,
        },
      ],
    }

    const races: EventAnalysisData["races"] = [
      raceStub(
        "q1",
        "Buggy",
        "Qualifier Round 1",
        "qualifying",
        [{ driverId: "drv1", positionFinal: 2 }],
        1
      ),
      raceStub("m1", "Buggy", "A-Main", "main", [{ driverId: "drv1", positionFinal: 1 }], 10),
    ]

    const cards = buildTopQualifierOverviewCards(qualPoints, races)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.driverDisplayName).toBe("Alice")
    expect(cards[0]!.sessions).toHaveLength(1)
    expect(cards[0]!.sessions[0]!.raceLabel).toBe("Qualifier Round 1")
    expect(cards[0]!.sessions[0]!.positionFinal).toBe(2)
  })

  it("drops unstructured open practice sessions", () => {
    const qualPoints: NonNullable<EventAnalysisData["qualPointsTopQualifiers"]> = {
      ...baseQual,
      standings: [
        {
          className: "Buggy",
          position: 1,
          driverId: "drv1",
          driverDisplayName: "Alice",
          points: 10,
        },
      ],
    }

    const races: EventAnalysisData["races"] = [
      raceStub(
        "pr",
        "Buggy",
        "Open Practice",
        "practice",
        [{ driverId: "drv1", positionFinal: 1 }],
        0
      ),
      raceStub(
        "qf",
        "Buggy",
        "Qualifier Round 1",
        "qualifying",
        [{ driverId: "drv1", positionFinal: 1 }],
        1
      ),
    ]

    const cards = buildTopQualifierOverviewCards(qualPoints, races)
    expect(cards[0]!.sessions.map((s) => s.raceLabel)).toEqual(["Qualifier Round 1"])
  })
})
