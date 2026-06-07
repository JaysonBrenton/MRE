import { describe, expect, it } from "vitest"
import {
  EVENT_SEARCH_ACTIONS_COL_WIDTH,
  EVENT_SEARCH_DATE_COL_WIDTH,
  EVENT_SEARCH_EVENT_NAME_COL_PERCENT,
  EVENT_SEARCH_STATUS_COL_WIDTH,
  EVENT_SEARCH_TABLE_CLASS,
  EVENT_SEARCH_TRACK_NAME_COL_PERCENT,
} from "@/components/organisms/event-search/event-search-table-layout"

describe("event-search-table-layout", () => {
  it("uses viewport-first table layout with fixed utility column widths", () => {
    expect(EVENT_SEARCH_TABLE_CLASS).toContain("table-fixed")
    expect(EVENT_SEARCH_TABLE_CLASS).toContain("w-full")

    expect(EVENT_SEARCH_EVENT_NAME_COL_PERCENT).toMatch(/%$/)
    expect(EVENT_SEARCH_TRACK_NAME_COL_PERCENT).toMatch(/%$/)

    const eventPct = parseFloat(EVENT_SEARCH_EVENT_NAME_COL_PERCENT)
    const trackPct = parseFloat(EVENT_SEARCH_TRACK_NAME_COL_PERCENT)
    expect(eventPct + trackPct).toBeLessThan(100)

    expect(EVENT_SEARCH_STATUS_COL_WIDTH).toBe("8rem")
    expect(EVENT_SEARCH_DATE_COL_WIDTH).toBe("7.5rem")
    expect(EVENT_SEARCH_ACTIONS_COL_WIDTH).toBe("8.5rem")
  })
})
