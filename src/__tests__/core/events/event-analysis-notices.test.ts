/**
 * @fileoverview Tests for Event Analysis notice helpers
 *
 * @created 2025-12-27
 * @creator Codex (AI Assistant)
 * @lastModified 2025-12-27
 *
 * @description Ensures driver selection notice helpers correctly identify
 *              drivers lacking the telemetry required by each chart.
 */

import { describe, it, expect } from "vitest"
import {
  getDriversMissingAvgVsFastest,
  getDriversMissingBestLap,
  type DriverMetricSnapshot,
} from "@/core/events/event-analysis-notices"

describe("event analysis notices", () => {
  const driverStats: DriverMetricSnapshot[] = [
    {
      driverId: "driver-a",
      bestLapTime: 32.123,
      avgLapTime: 34.0,
    },
    {
      driverId: "driver-b",
      bestLapTime: null,
      avgLapTime: null,
    },
    {
      driverId: "driver-c",
      bestLapTime: 0,
      avgLapTime: 36.5,
    },
    {
      driverId: "driver-d",
      bestLapTime: 31.8,
      avgLapTime: null,
    },
  ]

  it("detects drivers with missing fastest laps", () => {
    const result = getDriversMissingBestLap(
      ["driver-a", "driver-b", "driver-c", "driver-z"],
      driverStats
    )

    expect(result).toEqual(["driver-b", "driver-c", "driver-z"])
  })

  it("returns empty array when no drivers selected", () => {
    expect(getDriversMissingBestLap([], driverStats)).toEqual([])
  })

  it("detects drivers missing data for Avg vs Fastest chart", () => {
    const result = getDriversMissingAvgVsFastest(
      ["driver-a", "driver-b", "driver-d"],
      driverStats
    )

    expect(result).toEqual(["driver-b", "driver-d"])
  })

  it("deduplicates repeated driver IDs", () => {
    const result = getDriversMissingAvgVsFastest(
      ["driver-b", "driver-b", "driver-b"],
      driverStats
    )

    expect(result).toEqual(["driver-b"])
  })

})

