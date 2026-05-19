import { describe, it, expect } from "vitest"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import {
  buildProgramOverviewModel,
  computeProgramOverviewLayout,
  shortenProgramOverviewRaceTitle,
} from "@/core/events/program-overview-model"

function mkRace(
  init: Partial<EventAnalysisData["races"][number]> & {
    id: string
    className: string
    raceLabel: string
    raceUrl: string
  }
): EventAnalysisData["races"][number] {
  return {
    raceId: init.raceId ?? init.id,
    raceOrder: init.raceOrder ?? null,
    startTime: init.startTime ?? null,
    durationSeconds: init.durationSeconds ?? null,
    sessionType: init.sessionType ?? null,
    sectionHeader: init.sectionHeader ?? null,
    results: init.results ?? [],
    completedAt: init.completedAt,
    ...init,
  }
}

function baseEvent(races: EventAnalysisData["races"]): EventAnalysisData {
  return {
    event: {
      id: "evt-1",
      trackId: "t1",
      eventName: "RCRA",
      eventDate: new Date("2026-01-10"),
      trackName: "Track",
    },
    races,
    drivers: [],
    entryList: [],
    raceClasses: new Map(),
    multiMainResults: [],
    summary: {
      totalRaces: races.length,
      totalDrivers: 0,
      totalLaps: 0,
      dateRange: { earliest: null, latest: null },
    },
    qualPointsTopQualifiers: null,
    userHostTrack: null,
  }
}

describe("shortenProgramOverviewRaceTitle", () => {
  it("drops LiveRC heat sheet boilerplate tails", () => {
    const raw = "1 EP Truggy A1-Main Length: 10:00 Timed Status: Complete (View Results)"
    expect(shortenProgramOverviewRaceTitle(raw)).toContain("A1-Main")
    expect(shortenProgramOverviewRaceTitle(raw)).not.toContain("Length")
    expect(shortenProgramOverviewRaceTitle(raw)).not.toContain("Timed")
    expect(shortenProgramOverviewRaceTitle(raw)).not.toContain("Status")
  })
})

describe("buildProgramOverviewModel", () => {
  it("buckets mains separately and merges practice family", () => {
    const data = baseEvent([
      mkRace({
        id: "pd",
        className: "EP Buggy",
        raceLabel: "Warmup",
        raceOrder: 0,
        startTime: new Date("2026-01-10T09:00:00"),
        sessionType: "practiceday",
        sectionHeader: "Practice",
        raceUrl: "https://example.com/a",
      }),
      mkRace({
        id: "p",
        className: "EP Buggy",
        raceLabel: "Round 3",
        raceOrder: 1,
        startTime: new Date("2026-01-10T10:00:00"),
        sessionType: "practice",
        sectionHeader: "Practice",
        raceUrl: "https://example.com/b",
      }),
      mkRace({
        id: "q",
        className: "EP Buggy",
        raceLabel: "Qualifier Round 2",
        raceOrder: 2,
        startTime: new Date("2026-01-10T12:00:00"),
        sessionType: "qualifying",
        sectionHeader: "Qualifying",
        raceUrl: "https://example.com/c",
      }),
      mkRace({
        id: "a",
        className: "EP Buggy",
        raceLabel: "EP Buggy A1-Main",
        raceOrder: 3,
        startTime: new Date("2026-01-10T16:00:00"),
        sessionType: "main",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/am",
      }),
      mkRace({
        id: "b",
        className: "EP Buggy",
        raceLabel: "EP Buggy B1-Main",
        raceOrder: 4,
        startTime: new Date("2026-01-10T17:00:00"),
        sessionType: "main",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/bm",
      }),
    ])
    const m = buildProgramOverviewModel(data, "EP Buggy")
    expect(m).not.toBeNull()
    expect(m!.aggregates.map((x) => x.phaseKey)).toEqual(["practice", "qualifying"])
    expect(m!.aggregates[0]!.sessions).toHaveLength(2)
    expect(m!.mains).toHaveLength(2)
    expect(m!.mains[0]!.raceLabelShort.toLowerCase()).toContain("a1-main")
    expect(m!.mains[1]!.raceLabelShort.toLowerCase()).toContain("b1-main")
  })

  it("excludes schedule placeholder rows", () => {
    const data = baseEvent([
      mkRace({
        id: "x",
        className: "EP Buggy",
        raceLabel: "*** Break ***",
        raceOrder: 0,
        startTime: null,
        sessionType: "practice",
        sectionHeader: "",
        raceUrl: "https://example.com/",
      }),
      mkRace({
        id: "m",
        className: "EP Buggy",
        raceLabel: "Final A-Main",
        raceOrder: 1,
        startTime: null,
        sessionType: "main",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/m",
      }),
    ])
    const m = buildProgramOverviewModel(data, "EP Buggy")
    expect(m).not.toBeNull()
    expect(m!.aggregates).toHaveLength(0)
    expect(m!.mains).toHaveLength(1)
  })

  it("returns null for unknown class", () => {
    expect(buildProgramOverviewModel(baseEvent([]), "Nope")).toBeNull()
  })
})

describe("computeProgramOverviewLayout", () => {
  it("produces nodes and fan edges into parallel mains", () => {
    const data = baseEvent([
      mkRace({
        id: "q",
        className: "EP Buggy",
        raceLabel: "Q",
        raceOrder: 1,
        startTime: null,
        sessionType: "qualifying",
        sectionHeader: "",
        raceUrl: "https://example.com/",
      }),
      mkRace({
        id: "a",
        className: "EP Buggy",
        raceLabel: "A Main",
        raceOrder: 2,
        sessionType: "main",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/a",
      }),
      mkRace({
        id: "b",
        className: "EP Buggy",
        raceLabel: "B Main",
        raceOrder: 3,
        sessionType: "main",
        sectionHeader: "Main Events",
        raceUrl: "https://example.com/b",
      }),
    ])
    const model = buildProgramOverviewModel(data, "EP Buggy")!
    const layout = computeProgramOverviewLayout(model)!
    expect(layout.nodes.some((n) => n.kind === "aggregate")).toBe(true)
    expect(layout.nodes.filter((n) => n.kind === "main")).toHaveLength(2)
    const fanEdges = layout.edges.filter((e) => e.id.includes("fan"))
    expect(fanEdges.length).toBe(2)
  })
})
