/**
 * @fileoverview Tests for LapByLapTrendChart loading and empty states
 */

/** @vitest-environment jsdom */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, render, screen, fireEvent, within } from "@testing-library/react"
import LapByLapTrendChart from "@/components/organisms/event-analysis/LapByLapTrendChart"
import type { DriverLapTrendSeries } from "@/core/events/get-lap-data"

vi.mock("@visx/responsive", () => ({
  ParentSize: ({ children }: { children: (args: { width: number }) => React.ReactNode }) =>
    children({ width: 800 }),
}))

const sampleDrivers: DriverLapTrendSeries[] = [
  {
    driverId: "d1",
    driverName: "Driver One",
    laps: [
      {
        lapIndex: 1,
        raceId: "r1",
        raceLabel: "Q1",
        className: "Buggy",
        lapNumber: 1,
        lapTimeSeconds: 32.123,
        positionOnLap: 2,
      },
      {
        lapIndex: 2,
        raceId: "r1",
        raceLabel: "Q1",
        className: "Buggy",
        lapNumber: 2,
        lapTimeSeconds: 32.456,
        positionOnLap: 1,
      },
    ],
  },
]

describe("LapByLapTrendChart", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    } as unknown as Storage)
  })

  it("shows loading state when drivers are pending and data has not arrived", () => {
    render(
      <LapByLapTrendChart
        drivers={[]}
        isLoading
        pendingDriverCount={2}
        emptyMessage="Loading lap data…"
        chartTitle="Driver laps"
      />
    )

    expect(screen.getByText("Loading lap data…")).toBeInTheDocument()
    expect(screen.queryByText("No drivers selected")).not.toBeInTheDocument()
  })

  it("keeps rendering chart content while isLoading with stale driver data", () => {
    render(
      <LapByLapTrendChart
        drivers={sampleDrivers}
        isLoading
        pendingDriverCount={1}
        chartTitle="Driver laps"
      />
    )

    expect(screen.getByText("Driver One")).toBeInTheDocument()
    expect(screen.queryByText("Updating…")).not.toBeInTheDocument()
  })

  it("shows empty state when no drivers are selected and not loading", () => {
    render(
      <LapByLapTrendChart
        drivers={[]}
        chartTitle="Driver laps"
        headerControls={<span>Scope</span>}
      />
    )

    expect(screen.getByText("No drivers selected")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Lap chart display options/i })
    ).not.toBeInTheDocument()
  })

  it("uses custom x-axis label when provided", () => {
    render(
      <LapByLapTrendChart
        drivers={sampleDrivers}
        chartTitle="Driver laps"
        xAxisLabel="Lap number (this session)"
      />
    )

    expect(screen.getByText("Lap number (this session)")).toBeInTheDocument()
  })

  it("renders LiveRC-style position lanes when position on lap is enabled", () => {
    const { container } = render(
      <LapByLapTrendChart
        drivers={sampleDrivers}
        chartTitle="Driver laps"
        enablePositionAxisToggle
        height={480}
      />
    )

    expect(container.querySelector('[data-testid="lap-by-lap-position-lanes"]')).toBeNull()

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Lap chart display options/i }))
    })
    const positionToggle = screen.getByRole("menuitemcheckbox", { name: /Position on lap/i })
    act(() => {
      fireEvent.click(positionToggle)
    })

    const positionLanes = container.querySelector('[data-testid="lap-by-lap-position-lanes"]')
    expect(positionLanes).not.toBeNull()
    expect(positionLanes?.querySelectorAll("circle").length).toBeGreaterThan(0)

    const chartDesc = container.querySelector("desc")
    expect(chartDesc?.textContent).toMatch(/upper band/i)

    expect(within(positionToggle).getByText("On")).toBeInTheDocument()
  })
})
