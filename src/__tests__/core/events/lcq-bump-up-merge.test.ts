import { describe, it, expect } from "vitest"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  getLcqMergeTargetClassName,
  mergeLcqSessionsForClass,
} from "@/core/events/lcq-bump-up-merge"
import type { SessionData } from "@/core/events/get-sessions-data"

function race(
  id: string,
  className: string,
  label: string,
  order: number,
  section: string | null = "Main Events"
): EventAnalysisData["races"][0] {
  return {
    id,
    raceId: id,
    className,
    raceLabel: label,
    raceOrder: order,
    startTime: new Date(`2026-03-08T${10 + order}:00:00Z`),
    durationSeconds: 600,
    sessionType: "race",
    sectionHeader: section,
    raceUrl: `https://x/${id}`,
    results: [],
  }
}

function sess(
  id: string,
  raceId: string,
  className: string,
  label: string,
  order: number
): SessionData {
  return {
    id,
    raceId,
    className,
    raceLabel: label,
    raceOrder: order,
    startTime: new Date(),
    durationSeconds: null,
    sessionType: "race",
    sectionHeader: "Main Events",
    participantCount: 0,
    topFinishers: [],
    results: [],
  }
}

describe("getLcqMergeTargetClassName", () => {
  it("returns the next ladder class after LCQ", () => {
    const schedule = [
      race("a", "Sportsman", "Sportsman A-Main", 40),
      race("b", "Last Chance Qualifier", "Last Chance Qualifier A-Main", 41),
      race("c", "Buggy", "Buggy 1/1 Even Final", 42),
    ]
    const lcq = schedule[1]!
    expect(getLcqMergeTargetClassName(lcq, schedule)).toBe("Buggy")
  })

  it("skips track maintenance placeholders", () => {
    const schedule = [
      race("a", "Last Chance Qualifier", "LCQ A-Main", 1),
      race("b", "Track Maintainance", "Track Maintainance K-Main", 2),
      race("c", "EP Buggy", "EP Buggy A1-Main", 3),
    ]
    const lcq = schedule[0]!
    expect(getLcqMergeTargetClassName(lcq, schedule)).toBe("EP Buggy")
  })
})

describe("mergeLcqSessionsForClass", () => {
  it("appends LCQ session when schedule says LCQ feeds target class", () => {
    const data: EventAnalysisData = {
      event: {
        id: "e1",
        trackId: "t1",
        eventName: "Test",
        eventDate: new Date(),
        trackName: "T",
      },
      isPracticeDay: false,
      races: [
        race("lcq", "Last Chance Qualifier", "Last Chance Qualifier A-Main", 10),
        race("bug", "Buggy", "Buggy 1/1 Even Final", 11),
      ],
      drivers: [],
      entryList: [],
      raceClasses: new Map(),
      multiMainResults: [],
      summary: {
        totalRaces: 2,
        totalDrivers: 0,
        totalLaps: 0,
        dateRange: { earliest: null, latest: null },
      },
    }

    const buggySessions = [sess("bug", "bug", "Buggy", "Buggy 1/1 Even Final", 11)]
    const allSessions = [
      sess("lcq", "lcq", "Last Chance Qualifier", "Last Chance Qualifier A-Main", 10),
      ...buggySessions,
    ]

    const merged = mergeLcqSessionsForClass(data, "Buggy", buggySessions, allSessions)
    expect(merged).toHaveLength(2)
    expect(merged.map((s) => s.className)).toContain("Last Chance Qualifier")
  })
})
