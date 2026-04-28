/**
 * @fileoverview Tests for class winner modal detail resolution
 */

import { describe, it, expect } from "vitest"
import {
  buildClassWinners,
  resolveClassWinnerModalDetail,
} from "@/core/events/build-event-highlights"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

describe("resolveClassWinnerModalDetail", () => {
  it("returns multi-main class standings and per-main columns", () => {
    const races: EventAnalysisData["races"] = []
    const multiMain: EventAnalysisData["multiMainResults"] = [
      {
        id: "m1",
        classLabel: "Ep Buggy Triple A-Main",
        tieBreaker: "Best finish in A3",
        completedMains: 3,
        totalMains: 3,
        entries: [
          {
            position: 1,
            seededPosition: 2,
            driverId: "a",
            driverName: "DARREN PERRY",
            points: 2,
            mainBreakdown: {
              A1: { position: 2, points: 2, lapsTime: "17/10:02.843" },
              A2: { position: 1, points: 1, lapsTime: "16/10:01.000" },
              A3: { position: 1, points: 1, lapsTime: "18/10:03.000" },
            },
          },
        ],
      },
    ]
    const highlight = {
      className: "Ep Buggy",
      classDisplay: "Ep Buggy",
      winnerName: "DARREN PERRY",
      secondPlaceName: null,
      thirdPlaceName: null,
      raceLabel: "Overall (3/3 mains)",
    }
    const d = resolveClassWinnerModalDetail(highlight, { races, multiMainResults: multiMain })
    expect(d?.kind).toBe("multiMain")
    if (d?.kind !== "multiMain") return
    expect(d.mainColumnLabels).toEqual(["A1", "A2", "A3"])
    expect(d.standingsRows).toHaveLength(1)
    const row = d.standingsRows[0]!
    expect(row.driverName).toBe("DARREN PERRY")
    expect(row.highlight).toBe(true)
    expect(row.points).toBe(2)
    expect(row.mainCells[0]).toBe("17/10:02.843")
    expect(row.mainCells[1]).toBe("16/10:01.000")
    expect(row.mainCells[2]).toBe("18/10:03.000")
    expect(d.tieBreaker).toBe("Best finish in A3")
  })

  it("shows an em dash for a sit-out main (0/0.000) in the standings table", () => {
    const races: EventAnalysisData["races"] = []
    const multiMain: EventAnalysisData["multiMainResults"] = [
      {
        id: "m1",
        classLabel: "Ep Buggy Triple A-Main",
        tieBreaker: null,
        completedMains: 3,
        totalMains: 3,
        entries: [
          {
            position: 1,
            seededPosition: 1,
            driverId: "a",
            driverName: "DARREN PERRY",
            points: 2,
            mainBreakdown: {
              A1: { position: 1, points: 1, lapsTime: "17/10:02.843" },
              A2: { position: 1, points: 1, lapsTime: "16/10:01.000" },
              A3: { position: 1, points: 1, lapsTime: "0/0.000" },
            },
          },
        ],
      },
    ]
    const highlight = {
      className: "Ep Buggy",
      classDisplay: "Ep Buggy",
      winnerName: "DARREN PERRY",
      secondPlaceName: null,
      thirdPlaceName: null,
      raceLabel: "Overall (3/3 mains)",
    }
    const d = resolveClassWinnerModalDetail(highlight, { races, multiMainResults: multiMain })
    expect(d?.kind).toBe("multiMain")
    if (d?.kind !== "multiMain") return
    expect(d.completedMains).toBe(3)
    expect(d.totalMains).toBe(3)
    const row = d.standingsRows[0]!
    expect(row.mainCells[0]).toBe("17/10:02.843")
    expect(row.mainCells[1]).toBe("16/10:01.000")
    expect(row.mainCells[2]).toBe("—")
  })

  it("uses featured main when no multi-main block", () => {
    const races: EventAnalysisData["races"] = [
      {
        id: "r1",
        raceId: "r1",
        className: "Ic Buggy",
        raceLabel: "Ic Buggy A-Main",
        raceOrder: 10,
        completedAt: null,
        startTime: null,
        durationSeconds: 600,
        sessionType: "main",
        sectionHeader: "Mains",
        raceUrl: "https://example.com/r",
        results: [
          {
            raceResultId: "rr1",
            raceDriverId: "rd1",
            driverId: "d1",
            driverName: "ZAC RYAN",
            positionFinal: 1,
            lapsCompleted: 50,
            totalTimeSeconds: 30 * 60 + 7.805,
            fastLapTime: 45.2,
            avgLapTime: null,
            consistency: null,
            qualifyingPosition: null,
            secondsBehind: null,
            liveRcStats: null,
          },
          {
            raceResultId: "rr2",
            raceDriverId: "rd2",
            driverId: "d2",
            driverName: "ALICE BETA",
            positionFinal: 2,
            lapsCompleted: 50,
            totalTimeSeconds: 30 * 60 + 10.5,
            fastLapTime: 46.0,
            avgLapTime: null,
            consistency: null,
            qualifyingPosition: null,
            secondsBehind: null,
            liveRcStats: null,
          },
        ],
      },
    ]
    const multiMain: EventAnalysisData["multiMainResults"] = []
    const highlight = {
      className: "Ic Buggy",
      classDisplay: "Ic Buggy",
      winnerName: "ZAC RYAN",
      secondPlaceName: null,
      thirdPlaceName: null,
      raceLabel: "Ic Buggy A-Main",
    }
    const d = resolveClassWinnerModalDetail(highlight, { races, multiMainResults: multiMain })
    expect(d?.kind).toBe("featuredMain")
    if (d?.kind !== "featuredMain") return
    expect(d.sessionRaceLabel).toBe("Ic Buggy A-Main")
    expect(d.standingsRows).toHaveLength(2)
    const z = d.standingsRows.find((r) => r.driverName === "ZAC RYAN")
    const a = d.standingsRows.find((r) => r.driverName === "ALICE BETA")
    expect(z?.position).toBe(1)
    expect(z?.highlight).toBe(true)
    expect(z?.lapsTimeLine).toBe("50 / 30:07")
    expect(z?.fastLapFormatted).toBe("0:45.200")
    expect(a?.position).toBe(2)
    expect(a?.highlight).toBe(false)
  })

  it("matches buildClassWinners highlight for multi-main winner", () => {
    const races: EventAnalysisData["races"] = []
    const multiMain: EventAnalysisData["multiMainResults"] = [
      {
        id: "m2",
        classLabel: "Ep Buggy Triple A-Main",
        tieBreaker: null,
        completedMains: 3,
        totalMains: 3,
        entries: [
          {
            position: 1,
            seededPosition: null,
            driverId: "b",
            driverName: "Perry",
            points: 2,
            mainBreakdown: {
              A1: { position: 1, points: 1, lapsTime: "10/5:00.000" },
            },
          },
        ],
      },
    ]
    const winners = buildClassWinners({
      races,
      multiMainResults: multiMain,
      registrationClassNames: ["Ep Buggy"],
    })
    const w = winners[0]
    expect(w).toBeDefined()
    const d = resolveClassWinnerModalDetail(w!, { races, multiMainResults: multiMain })
    expect(d?.kind).toBe("multiMain")
    if (d?.kind !== "multiMain") return
    expect(d.standingsRows[0]!.points).toBe(2)
    expect(d.standingsRows[0]!.mainCells[0]).toBe("10/5:00.000")
  })
})
