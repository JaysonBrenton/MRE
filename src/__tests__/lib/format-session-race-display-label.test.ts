import { describe, expect, it } from "vitest"
import type { SessionData } from "@/core/events/get-sessions-data"
import {
  abbreviateSectionHeader,
  formatSessionRaceDisplayLabel,
  parseHeatFractionFromLabel,
} from "@/lib/format-session-race-display-label"

function minimalSession(
  partial: Partial<SessionData> & Pick<SessionData, "id" | "raceLabel">
): SessionData {
  return {
    raceId: partial.id,
    className: partial.className ?? "1:8 Electric Buggy",
    raceOrder: partial.raceOrder ?? null,
    startTime: partial.startTime ?? null,
    durationSeconds: partial.durationSeconds ?? null,
    sessionType: partial.sessionType ?? "heat",
    sectionHeader: partial.sectionHeader ?? null,
    participantCount: partial.participantCount ?? 0,
    topFinishers: partial.topFinishers ?? [],
    results: partial.results ?? [],
    ...partial,
  } as SessionData
}

describe("format-session-race-display-label", () => {
  it("abbreviateSectionHeader maps LiveRC headings", () => {
    expect(abbreviateSectionHeader("Qualifier Round 1")).toBe("Q1")
    expect(abbreviateSectionHeader("Seeding Round 2")).toBe("S2")
    expect(abbreviateSectionHeader("Main Events")).toBe("Mains")
    expect(abbreviateSectionHeader("Practice")).toBe("Practice")
    expect(abbreviateSectionHeader(null)).toBeNull()
  })

  it("parseHeatFractionFromLabel reads parenthesized and bare forms", () => {
    expect(parseHeatFractionFromLabel("Electric Buggy (Heat 1/3)")).toEqual({ n: 1, d: 3 })
    expect(parseHeatFractionFromLabel("Heat 2 / 7")).toEqual({ n: 2, d: 7 })
  })

  it("formats Q1 [i/n] - class (Heat a of b)", () => {
    const t0 = new Date("2025-06-01T10:00:00Z")
    const t1 = new Date("2025-06-01T11:00:00Z")
    const ctx: SessionData[] = [
      minimalSession({
        id: "a",
        raceLabel: "Schedule — intermission",
        className: "Buggy",
        sectionHeader: "Qualifier Round 1",
        startTime: t0,
        sessionType: "race",
      }),
      minimalSession({
        id: "b",
        raceLabel: "Electric Buggy (Heat 1/3)",
        className: "Buggy",
        sectionHeader: "Qualifier Round 1",
        startTime: t1,
      }),
    ]
    const label = formatSessionRaceDisplayLabel(ctx[1]!, ctx)
    expect(label).toBe("Q1 [2/2] - Buggy (Heat 1 of 3)")
  })

  it("uses cohort size for heat denominator when LiveRC fractions disagree", () => {
    const t = (h: number) => new Date(`2025-06-01T${10 + h}:00:00Z`)
    const ctx: SessionData[] = [
      minimalSession({
        id: "h1",
        raceLabel: "Nitro Buggy (Heat 1/7)",
        className: "Nitro Buggy",
        sectionHeader: "Qualifier Round 3",
        startTime: t(0),
        raceOrder: 1,
      }),
      minimalSession({
        id: "h2",
        raceLabel: "Nitro Buggy (Heat 2/7)",
        className: "Nitro Buggy",
        sectionHeader: "Qualifier Round 3",
        startTime: t(1),
        raceOrder: 2,
      }),
      minimalSession({
        id: "h3",
        raceLabel: "Nitro Buggy (Heat 3/7)",
        className: "Nitro Buggy",
        sectionHeader: "Qualifier Round 3",
        startTime: t(2),
        raceOrder: 3,
      }),
    ]
    expect(formatSessionRaceDisplayLabel(ctx[0]!, ctx)).toBe("Q3 [1/3] - Nitro Buggy (Heat 1 of 3)")
    expect(formatSessionRaceDisplayLabel(ctx[2]!, ctx)).toBe("Q3 [3/3] - Nitro Buggy (Heat 3 of 3)")
  })

  it("[i/n] is race number within the round across all classes (LiveRC Race 1…N)", () => {
    const t = (m: number) => new Date(`2026-04-24T08:${37 + m}:00Z`)
    const q1 = "Qualifier Round 1"
    const ctx: SessionData[] = [
      minimalSession({
        id: "r1",
        raceLabel: "Electric Buggy (Heat 1/3)",
        className: "Electric Buggy",
        sectionHeader: q1,
        startTime: t(0),
        raceOrder: 1,
      }),
      minimalSession({
        id: "r2",
        raceLabel: "Electric Buggy (Heat 2/3)",
        className: "Electric Buggy",
        sectionHeader: q1,
        startTime: t(1),
        raceOrder: 2,
      }),
      minimalSession({
        id: "r3",
        raceLabel: "Electric Buggy (Heat 3/3)",
        className: "Electric Buggy",
        sectionHeader: q1,
        startTime: t(2),
        raceOrder: 3,
      }),
      minimalSession({
        id: "r4",
        raceLabel: "Nitro Truggy (Heat 1/2)",
        className: "Nitro Truggy",
        sectionHeader: q1,
        startTime: t(3),
        raceOrder: 4,
      }),
      minimalSession({
        id: "r5",
        raceLabel: "Nitro Truggy (Heat 2/2)",
        className: "Nitro Truggy",
        sectionHeader: q1,
        startTime: t(4),
        raceOrder: 5,
      }),
      ...[1, 2, 3, 4, 5, 6, 7].map((hn, i) =>
        minimalSession({
          id: `nb${hn}`,
          raceLabel: `Nitro Buggy (Heat ${hn}/7)`,
          className: "Nitro Buggy",
          sectionHeader: q1,
          startTime: t(5 + i),
          raceOrder: 5 + hn,
        })
      ),
    ]
    expect(formatSessionRaceDisplayLabel(ctx[5]!, ctx)).toBe(
      "Q1 [6/12] - Nitro Buggy (Heat 1 of 7)"
    )
    expect(formatSessionRaceDisplayLabel(ctx[11]!, ctx)).toBe(
      "Q1 [12/12] - Nitro Buggy (Heat 7 of 7)"
    )
  })

  it("falls back to raceLabel when no round or heat pattern", () => {
    const s = minimalSession({
      id: "x",
      raceLabel: "A-Main",
      className: "Buggy",
      sectionHeader: null,
    })
    expect(formatSessionRaceDisplayLabel(s, [s])).toBe("A-Main")
  })

  it("uses ASCII hyphen between class and race label (no em dash); normalizes em dash in raceLabel", () => {
    const t = new Date("2025-06-01T10:00:00Z")
    const ctx: SessionData[] = [
      minimalSession({
        id: "m",
        raceLabel: "Schedule — intermission",
        className: "Buggy",
        sectionHeader: "Main Events",
        startTime: t,
        sessionType: "race",
      }),
    ]
    expect(formatSessionRaceDisplayLabel(ctx[0]!, ctx)).toBe(
      "Mains - Buggy - Schedule - intermission"
    )
  })
})
