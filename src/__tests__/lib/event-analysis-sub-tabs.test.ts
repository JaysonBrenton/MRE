import { describe, expect, it } from "vitest"

import {
  getSubTabLabel,
  getSubTabOptions,
} from "@/components/organisms/event-analysis/event-analysis-sub-tabs"

describe("event-analysis-sub-tabs", () => {
  it("labels event-results by scope", () => {
    expect(getSubTabLabel("event-results", "event")).toBe("Event Results")
    expect(getSubTabLabel("event-results", "session")).toBe("Session Results")
  })

  it("labels qualification-results in event scope", () => {
    expect(getSubTabLabel("qualification-results", "event")).toBe("Qualification Results")
  })

  it("getSubTabOptions: event scope includes ladder views; session scope has four core items", () => {
    const eventOpts = getSubTabOptions("event")
    expect(eventOpts).toHaveLength(7)
    expect(eventOpts[0]).toEqual({ id: "event-results", label: "Event Results" })
    expect(eventOpts[1]).toEqual({ id: "qualification-results", label: "Qualification Results" })
    expect(eventOpts[5]).toEqual({ id: "bump-ups", label: "Bump-Up" })
    expect(eventOpts[6]).toEqual({ id: "driver-progression", label: "Driver Progression" })
    const sessionOpts = getSubTabOptions("session")
    expect(sessionOpts).toHaveLength(4)
    expect(sessionOpts[0]).toEqual({ id: "event-results", label: "Session Results" })
  })
})
