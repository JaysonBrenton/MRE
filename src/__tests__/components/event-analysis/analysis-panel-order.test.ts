import { describe, expect, it } from "vitest"
import {
  EVENT_LEVEL_ANALYSIS_PANEL_IDS,
  normalizePanelOrder,
} from "@/components/organisms/event-analysis/analysis-panel-order"

describe("normalizePanelOrder", () => {
  it("returns defaults when stored value is invalid", () => {
    expect(normalizePanelOrder(null, EVENT_LEVEL_ANALYSIS_PANEL_IDS)).toEqual([
      ...EVENT_LEVEL_ANALYSIS_PANEL_IDS,
    ])
  })

  it("appends new panel ids missing from stored order", () => {
    const stored = ["event-level-analysis-col-3", "event-level-analysis-col-1"]
    expect(normalizePanelOrder(stored, EVENT_LEVEL_ANALYSIS_PANEL_IDS)).toEqual([
      "event-level-analysis-col-3",
      "event-level-analysis-col-1",
      "event-level-analysis-col-4",
      "event-level-analysis-col-5",
      "event-level-analysis-col-6",
      "event-level-analysis-col-8",
    ])
  })

  it("drops unknown ids from stored order", () => {
    const stored = ["event-level-analysis-col-1", "unknown-panel", "event-level-analysis-col-4"]
    expect(normalizePanelOrder(stored, EVENT_LEVEL_ANALYSIS_PANEL_IDS)).toEqual([
      "event-level-analysis-col-1",
      "event-level-analysis-col-4",
      "event-level-analysis-col-3",
      "event-level-analysis-col-5",
      "event-level-analysis-col-6",
      "event-level-analysis-col-8",
    ])
  })
})
