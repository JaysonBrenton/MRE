/**
 * @fileoverview Tests for FullRaceResultsTable expandable lap rows
 */

/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
import FullRaceResultsTable, {
  type RaceResultRow,
} from "@/components/organisms/event-analysis/FullRaceResultsTable"

function makeRow(overrides: Partial<RaceResultRow> = {}): RaceResultRow {
  return {
    raceResultId: "rr-test-1",
    raceDriverId: "rd-1",
    driverId: "d-1",
    driverName: "Test Driver",
    positionFinal: 1,
    lapsCompleted: 2,
    totalTimeSeconds: 40,
    fastLapTime: 16.5,
    fastLapLapNumber: 2,
    avgLapTime: 17.0,
    consistency: 0.5,
    qualifyingPosition: 1,
    secondsBehind: 0,
    behindDisplay: null,
    liveRcStats: null,
    ...overrides,
  }
}

describe("FullRaceResultsTable", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("fetches and shows lap rows when expanded", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url.includes("/api/v1/race-results/rr-test-1/laps")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              race_result_id: "rr-test-1",
              laps: [
                {
                  lap_number: 1,
                  position_on_lap: 1,
                  lap_time_seconds: 17.25,
                  lap_time_raw: "0:17.250",
                  pace_string: null,
                  elapsed_race_time: 17.25,
                  segments_json: null,
                },
                {
                  lap_number: 2,
                  position_on_lap: 1,
                  lap_time_seconds: 16.5,
                  lap_time_raw: "0:16.500",
                  pace_string: "FT",
                  elapsed_race_time: 33.7,
                  segments_json: { a: 1 },
                },
              ],
            },
          }),
        } as unknown as Response
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    render(<FullRaceResultsTable rows={[makeRow()]} />)

    const expand = screen.getByRole("button", { name: /Show lap-by-lap detail for Test Driver/i })
    expect(expand).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(expand)

    expect(expand).toHaveAttribute("aria-expanded", "true")

    await waitFor(() => {
      const detail = document.getElementById("mre-lap-detail-rr-test-1")
      expect(detail).toBeTruthy()
      expect(within(detail as HTMLElement).getByText("FT")).toBeInTheDocument()
    })

    const detailEl = document.getElementById("mre-lap-detail-rr-test-1")!
    expect(within(detailEl).getAllByText("0:17.250").length).toBeGreaterThanOrEqual(1)
    expect(within(detailEl).getAllByText("0:16.500")).toHaveLength(2)
    expect(within(detailEl).getByText("View JSON")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/race-results/rr-test-1/laps")
    )

    fireEvent.click(expand)
    expect(expand).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(expand)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("shows retry when fetch fails", async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: false,
          status: 500,
          json: async () => ({
            success: false,
            error: { code: "ERR", message: "Server error" },
          }),
        }) as unknown as Response
    )

    vi.stubGlobal("fetch", fetchMock)

    render(<FullRaceResultsTable rows={[makeRow()]} />)

    fireEvent.click(screen.getByRole("button", { name: /Show lap-by-lap detail for Test Driver/i }))

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument()
    })

    fetchMock.mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            race_result_id: "rr-test-1",
            laps: [
              {
                lap_number: 1,
                position_on_lap: 1,
                lap_time_seconds: 10,
                lap_time_raw: "0:10.000",
                pace_string: null,
                elapsed_race_time: 10,
                segments_json: null,
              },
            ],
          },
        }),
      } as unknown as Response
    })

    fireEvent.click(screen.getByRole("button", { name: /^Retry$/i }))

    await waitFor(() => {
      const detail = document.getElementById("mre-lap-detail-rr-test-1")
      expect(detail).toBeTruthy()
      const matches = within(detail as HTMLElement).getAllByText("0:10.000")
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })
  })
})
