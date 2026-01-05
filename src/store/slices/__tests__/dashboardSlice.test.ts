import { afterEach, describe, expect, it, vi } from "vitest"
import reducer, { clearEvent, fetchEventData, selectEvent } from "@/store/slices/dashboardSlice"
import type { EventAnalysisSummary } from "@root-types/dashboard"

const createState = () => reducer(undefined, { type: "@@INIT" })

describe("dashboardSlice reducers", () => {
  it("sets loading and clears data when selecting a new event", () => {
    const state = reducer(createState(), selectEvent("abc"))
    expect(state.selectedEventId).toBe("abc")
    expect(state.isEventLoading).toBe(true)
    expect(state.eventData).toBeNull()
    expect(state.eventError).toBeNull()
  })

  it("clears state when clearEvent is dispatched", () => {
    const startState = {
      ...createState(),
      selectedEventId: "race-123",
      eventData: { event: { id: "race-123" } } as EventAnalysisSummary,
      eventError: "boom",
      isEventLoading: true,
    }

    const nextState = reducer(startState, clearEvent())

    expect(nextState.selectedEventId).toBeNull()
    expect(nextState.eventData).toBeNull()
    expect(nextState.eventError).toBeNull()
    expect(nextState.isEventLoading).toBe(false)
  })

  it("ignores re-selecting the same event", () => {
    const startState = {
      ...createState(),
      selectedEventId: "event-1",
      eventData: { event: { id: "event-1" } } as EventAnalysisSummary,
      isEventLoading: false,
    }

    const nextState = reducer(startState, selectEvent("event-1"))
    expect(nextState.selectedEventId).toBe("event-1")
    expect(nextState.isEventLoading).toBe(false)
    expect(nextState.eventData).toEqual(startState.eventData)
  })
})

describe("fetchEventData thunk", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("resolves with summary data", async () => {
    const mockSummary = { summary: { laps: 10 } }

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockSummary }),
      })
    )

    const thunk = fetchEventData("race-42")
    const result = await thunk(vi.fn(), () => ({}), undefined)

    expect(result.type).toBe("dashboard/fetchEventData/fulfilled")
    expect(result.payload).toEqual(mockSummary)
  })

  it("rejects with NOT_FOUND metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    const thunk = fetchEventData("missing")
    const result = await thunk(vi.fn(), () => ({}), undefined)

    expect(result.type).toBe("dashboard/fetchEventData/rejected")
    expect(result.payload).toEqual({ message: "Event not found", code: "NOT_FOUND" })
  })
})
