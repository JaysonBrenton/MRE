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
  it("returns multi-main detail with result summary and per-main rows", () => {
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
      raceLabel: "Overall (3/3 mains)",
    }
    const d = resolveClassWinnerModalDetail(highlight, { races, multiMainResults: multiMain })
    expect(d?.kind).toBe("multiMain")
    if (d?.kind !== "multiMain") return
    expect(d.combinedPoints).toBe(2)
    expect(d.resultSummaryLine).toBe("[2] [1] 16/10:01.000")
    expect(d.mainRows.map((r) => r.label)).toEqual(["A1", "A2", "A3"])
    expect(d.tieBreaker).toBe("Best finish in A3")
    expect(d.driverMainsParticipated).toBe(3)
  })

  it("counts driver mains participated when a main is sit-out (0/0.000)", () => {
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
      raceLabel: "Overall (3/3 mains)",
    }
    const d = resolveClassWinnerModalDetail(highlight, { races, multiMainResults: multiMain })
    expect(d?.kind).toBe("multiMain")
    if (d?.kind !== "multiMain") return
    expect(d.completedMains).toBe(3)
    expect(d.totalMains).toBe(3)
    expect(d.driverMainsParticipated).toBe(2)
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
        ],
      },
    ]
    const multiMain: EventAnalysisData["multiMainResults"] = []
    const highlight = {
      className: "Ic Buggy",
      classDisplay: "Ic Buggy",
      winnerName: "ZAC RYAN",
      raceLabel: "Ic Buggy A-Main",
    }
    const d = resolveClassWinnerModalDetail(highlight, { races, multiMainResults: multiMain })
    expect(d?.kind).toBe("featuredMain")
    if (d?.kind !== "featuredMain") return
    expect(d.raceLabel).toBe("Ic Buggy A-Main")
    expect(d.positionFinal).toBe(1)
    expect(d.lapsCompleted).toBe(50)
    expect(d.lapsTimeLine).toBe("50 / 30:07")
    expect(d.fastLapFormatted).toBe("0:45.200")
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
    expect(d.combinedPoints).toBe(2)
    expect(d.resultSummaryLine).toBe("[1] 10/5:00.000")
    expect(d.driverMainsParticipated).toBe(1)
  })
})
