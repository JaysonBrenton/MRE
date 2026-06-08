import { describe, expect, it } from "vitest"
import {
  computeEventSearchFiltersPopoverRect,
  EVENT_SEARCH_FILTERS_POPOVER_WIDTH_PX,
} from "@/components/organisms/event-search/event-search-filters-popover-layout"

function mockTriggerRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  } as DOMRect
}

describe("event-search-filters-popover-layout", () => {
  it("opens below the trigger when there is comfortable space", () => {
    const trigger = mockTriggerRect(100, 200, 120, 44)
    const rect = computeEventSearchFiltersPopoverRect(trigger, 800, 600)

    expect(rect.top).toBe(200 + 44 + 8)
    expect(rect.left).toBe(100)
    expect(rect.width).toBe(EVENT_SEARCH_FILTERS_POPOVER_WIDTH_PX)
    expect(rect.maxHeight).toBeGreaterThan(0)
  })

  it("clamps horizontal position inside the viewport", () => {
    const trigger = mockTriggerRect(700, 100, 120, 44)
    const rect = computeEventSearchFiltersPopoverRect(trigger, 800, 600)

    expect(rect.left + rect.width).toBeLessThanOrEqual(800 - 8)
  })

  it("opens above the trigger when space below is tight", () => {
    const trigger = mockTriggerRect(100, 520, 120, 44)
    const rect = computeEventSearchFiltersPopoverRect(trigger, 800, 600)

    expect(rect.top).toBeLessThan(trigger.top)
    expect(rect.maxHeight).toBeGreaterThan(0)
  })
})
