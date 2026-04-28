/**
 * @fileoverview Tests for event mix analytics helpers
 */

import { describe, it, expect } from "vitest"
import type { SessionMixSegment } from "@/core/events/build-event-highlights"
import {
  dominantLineForSessionSummary,
  driversWord,
  formatMixInteger,
  formatPctOneDecimal,
  insightForMetric,
  lapsWord,
  plural,
  rankSegmentsDesc,
  safePctPart,
  sessionTypeColorVar,
  sessionsWord,
} from "@/lib/event-mix-analytics"

function segment(
  overrides: Partial<SessionMixSegment> & Pick<SessionMixSegment, "key" | "count" | "pct">
): SessionMixSegment {
  return {
    label: overrides.label ?? overrides.key,
    colorVar: "var(--token-chart-series-1)",
    ...overrides,
  }
}

describe("formatMixInteger", () => {
  it("formats with thousands separators", () => {
    expect(formatMixInteger(1302)).toBe("1,302")
    expect(formatMixInteger(1_234_567)).toBe("1,234,567")
  })

  it("handles non-finite", () => {
    expect(formatMixInteger(Number.NaN)).toBe("—")
    expect(formatMixInteger(Number.POSITIVE_INFINITY)).toBe("—")
  })
})

describe("safePctPart", () => {
  it("returns 0 for zero total", () => {
    expect(safePctPart(5, 0)).toBe(0)
    expect(safePctPart(0, 0)).toBe(0)
  })

  it("computes fraction of whole", () => {
    expect(safePctPart(14, 33)).toBeCloseTo((14 / 33) * 100, 10)
    expect(safePctPart(1, 3)).toBeCloseTo(100 / 3, 10)
  })
})

describe("plural / word helpers", () => {
  it("pluralises English pairs", () => {
    expect(plural(0, "x", "ys")).toBe("ys")
    expect(plural(1, "driver", "drivers")).toBe("driver")
    expect(plural(2, "driver", "drivers")).toBe("drivers")
  })

  it("sessionsWord", () => {
    expect(sessionsWord(1)).toBe("1 session")
    expect(sessionsWord(19)).toBe("19 sessions")
  })

  it("driversWord", () => {
    expect(driversWord(1)).toMatch(/^1 driver$/)
    expect(driversWord(20)).toMatch(/^20 drivers$/)
  })

  it("lapsWord", () => {
    expect(lapsWord(1)).toMatch(/^1 lap$/)
    expect(lapsWord(2)).toMatch(/^2 laps$/)
  })
})

describe("formatPctOneDecimal", () => {
  it("shows one decimal", () => {
    expect(formatPctOneDecimal(58.333)).toBe("58.3%")
  })
})

describe("rankSegmentsDesc", () => {
  it("sorts by count descending then label", () => {
    const a = segment({ key: "a", label: "A", count: 5, pct: 50 })
    const b = segment({ key: "b", label: "B", count: 10, pct: 50 })
    const c = segment({ key: "c", label: "C", count: 10, pct: 50 })
    const out = rankSegmentsDesc([a, b, c])
    expect(out.map((x) => x.key)).toEqual(["b", "c", "a"])
  })
})

describe("dominantLineForSessionSummary", () => {
  it("handles empty", () => {
    expect(dominantLineForSessionSummary([])).toBe("No sessions yet.")
  })

  it("handles single bucket", () => {
    expect(
      dominantLineForSessionSummary([segment({ key: "main", label: "Main", count: 3, pct: 100 })])
    ).toBe("Main only")
  })

  it('prefers "Main sessions dominate" when main wins', () => {
    expect(
      dominantLineForSessionSummary([
        segment({ key: "qualifying", label: "Qualifier", count: 2, pct: 40 }),
        segment({ key: "main", label: "Main", count: 3, pct: 60 }),
      ])
    ).toBe("Main sessions dominate")
  })
})

describe("sessionTypeColorVar", () => {
  it("maps known buckets", () => {
    expect(sessionTypeColorVar("main")).toContain("token-chart")
    expect(sessionTypeColorVar("qualifying")).toContain("token-chart")
    expect(sessionTypeColorVar("unknown")).toContain("token-chart")
  })
})

describe("insightForMetric", () => {
  const sessionSegments = [
    segment({ key: "main", label: "Main", count: 19, pct: 58 }),
    segment({ key: "qualifying", label: "Qualifier", count: 14, pct: 42 }),
  ]
  const driverSegments = [
    segment({ key: "c1", label: "Buggy Mod", count: 8, pct: 40 }),
    segment({ key: "c2", label: "Stock", count: 12, pct: 60 }),
  ]
  const lapSegments = [
    segment({ key: "c2", label: "Stock", count: 100, pct: 50 }),
    segment({ key: "c1", label: "Buggy Mod", count: 100, pct: 50 }),
  ]

  it("session insight names top slice", () => {
    const text = insightForMetric("session", sessionSegments, [], [])
    expect(text).toContain("Main")
    expect(text).toContain("%")
  })

  it("drivers insight references largest field", () => {
    const text = insightForMetric("drivers", [], driverSegments, [])
    expect(text).toContain("Stock")
    expect(text).toContain("entries")
  })

  it("laps insight does not divide by zero with empty totals", () => {
    expect(insightForMetric("laps", [], [], lapSegments)).toContain("lap")
  })
})
