import { describe, expect, it } from "vitest"
import {
  DEFAULT_EVENT_SEARCH_FILTER_DRAFT,
  isFilterDraftEqual,
} from "@/components/organisms/event-search/event-search-filter-draft"

describe("event-search-filter-draft", () => {
  it("defaults includeReady and includeScheduled to true", () => {
    expect(DEFAULT_EVENT_SEARCH_FILTER_DRAFT.includeReady).toBe(true)
    expect(DEFAULT_EVENT_SEARCH_FILTER_DRAFT.includeScheduled).toBe(true)
  })

  it("detects status toggle changes in isFilterDraftEqual", () => {
    const base = { ...DEFAULT_EVENT_SEARCH_FILTER_DRAFT }
    expect(isFilterDraftEqual(base, { ...base })).toBe(true)

    expect(isFilterDraftEqual(base, { ...base, includeReady: false })).toBe(false)
    expect(isFilterDraftEqual(base, { ...base, includeScheduled: false })).toBe(false)
  })
})
