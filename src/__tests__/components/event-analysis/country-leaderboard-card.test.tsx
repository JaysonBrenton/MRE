/**
 * @fileoverview Tests for CountryLeaderboardCard component
 */

/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import CountryLeaderboardCard from "@/components/organisms/event-analysis/CountryLeaderboardCard"

describe("CountryLeaderboardCard", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("renders prompt when no country selected", () => {
    render(<CountryLeaderboardCard />)
    expect(
      screen.getByText(/Enter a country and click Apply to view the leaderboard/i)
    ).toBeInTheDocument()
  })

  it("fetches leaderboard when country is applied", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString()
      if (url.includes("/api/v1/leaderboards/countries")) {
        return {
          ok: true,
          json: async () => ({ success: true, data: { countries: ["Australia"] } }),
        } as unknown as Response
      }
      if (url.includes("/api/v1/leaderboards/country")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              country: "Australia",
              year: 2026,
              total: 1,
              classes: ["1/8 Nitro Buggy"],
              rows: [
                {
                  driverId: "d1",
                  driverName: "Driver 1",
                  className: "1/8 Nitro Buggy",
                  points: 25,
                  wins: 1,
                  podiums: 0,
                  eventsCount: 1,
                },
              ],
            },
          }),
        } as unknown as Response
      }
      throw new Error("Unexpected fetch call in test")
    })

    vi.stubGlobal("fetch", fetchMock)

    render(<CountryLeaderboardCard />)

    const input = screen.getByLabelText(/Country:/i)
    fireEvent.change(input, { target: { value: "Australia" } })

    const applyButton = screen.getByRole("button", { name: /Apply/i })
    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(screen.getByText("Driver 1")).toBeInTheDocument()
    })
  })
})
