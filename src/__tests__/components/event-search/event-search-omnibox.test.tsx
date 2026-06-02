/**
 * @fileoverview Tests for the database-only Event Search omnibox.
 */

/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import EventSearchOmnibox from "@/components/organisms/event-search/EventSearchOmnibox"

function suggestResponse(overrides: { tracks?: unknown[]; events?: unknown[]; query?: string }) {
  return {
    ok: true,
    headers: { get: () => "application/json" },
    text: async () =>
      JSON.stringify({
        success: true,
        data: {
          query: overrides.query ?? "round",
          tracks: overrides.tracks ?? [],
          events: overrides.events ?? [],
        },
      }),
  } as unknown as Response
}

const sampleTrack = {
  id: "trk-1",
  trackName: "Canberra Off Road",
  sourceTrackSlug: "canberra",
  city: "Canberra",
  state: "ACT",
  country: "Australia",
}

const sampleEvent = {
  id: "evt-1",
  eventName: "Round 5 Championship",
  eventDate: "2026-05-30T00:00:00.000Z",
  trackId: "trk-1",
  trackName: "Canberra Off Road",
  ingestDepth: "laps_full",
}

describe("EventSearchOmnibox", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("does not fetch for queries shorter than 2 characters", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    render(<EventSearchOmnibox onSelectTrack={vi.fn()} onSelectEvent={vi.fn()} />)

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "a" } })

    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("fetches suggestions and renders grouped tracks and events", async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      suggestResponse({ tracks: [sampleTrack], events: [sampleEvent] })
    )
    vi.stubGlobal("fetch", fetchMock)

    render(<EventSearchOmnibox onSelectTrack={vi.fn()} onSelectEvent={vi.fn()} />)

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "round" } })

    expect(await screen.findByText("Canberra Off Road")).toBeInTheDocument()
    expect(screen.getByText("Round 5 Championship")).toBeInTheDocument()

    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toContain("/api/v1/events/search/suggest?q=round")
  })

  it("invokes onSelectTrack when a track suggestion is clicked", async () => {
    const onSelectTrack = vi.fn()
    const fetchMock = vi.fn(async () => suggestResponse({ tracks: [sampleTrack] }))
    vi.stubGlobal("fetch", fetchMock)

    render(<EventSearchOmnibox onSelectTrack={onSelectTrack} onSelectEvent={vi.fn()} />)

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "canb" } })

    const option = await screen.findByText("Canberra Off Road")
    fireEvent.click(option)

    await waitFor(() => {
      expect(onSelectTrack).toHaveBeenCalledWith({
        id: "trk-1",
        trackName: "Canberra Off Road",
        sourceTrackSlug: "canberra",
        country: "Australia",
      })
    })
  })

  it("invokes onSelectEvent with the event id when an event suggestion is clicked", async () => {
    const onSelectEvent = vi.fn()
    const fetchMock = vi.fn(async () => suggestResponse({ events: [sampleEvent] }))
    vi.stubGlobal("fetch", fetchMock)

    render(<EventSearchOmnibox onSelectTrack={vi.fn()} onSelectEvent={onSelectEvent} />)

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "round" } })

    const option = await screen.findByText("Round 5 Championship")
    fireEvent.click(option)

    await waitFor(() => {
      expect(onSelectEvent).toHaveBeenCalledWith("evt-1")
    })
  })
})
