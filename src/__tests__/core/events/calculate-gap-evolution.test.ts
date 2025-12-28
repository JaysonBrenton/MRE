/**
 * @fileoverview Tests for gap evolution calculation logic
 * 
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 * 
 * @description Tests for gap evolution calculations
 * 
 * @purpose Validates gap calculation logic including edge cases.
 */

import { describe, it, expect } from "vitest"
import {
  calculateGapEvolution,
  calculateTopNGapEvolution,
  type DriverLapSeries,
} from "@/core/events/calculate-gap-evolution"

// Note: The implementation uses driverId, not raceDriverId

describe("calculateGapEvolution", () => {
  describe("basic gap calculation", () => {
    it("should calculate gaps correctly for two drivers", () => {
      const driverSeries: DriverLapSeries[] = [
        {
          driverId: "driver-1",
          driverName: "Driver 1",
          laps: [
            {
              lapNumber: 1,
              lapTimeSeconds: 30.0,
              elapsedRaceTime: 30.0,
              positionOnLap: 1,
            },
            {
              lapNumber: 2,
              lapTimeSeconds: 30.5,
              elapsedRaceTime: 60.5,
              positionOnLap: 1,
            },
          ],
        },
        {
          driverId: "driver-2",
          driverName: "Driver 2",
          laps: [
            {
              lapNumber: 1,
              lapTimeSeconds: 31.0,
              elapsedRaceTime: 31.0,
              positionOnLap: 2,
            },
            {
              lapNumber: 2,
              lapTimeSeconds: 31.5,
              elapsedRaceTime: 62.5,
              positionOnLap: 2,
            },
          ],
        },
      ]

      const result = calculateGapEvolution(driverSeries)

      expect(result).toHaveLength(2)

      // Driver 1 (leader) should have 0 gap
      const driver1Result = result.find((r) => r.driverId === "driver-1")
      expect(driver1Result).toBeDefined()
      expect(driver1Result?.gaps).toHaveLength(2)
      expect(driver1Result?.gaps[0].gapToLeader).toBe(0)
      expect(driver1Result?.gaps[1].gapToLeader).toBe(0)

      // Driver 2 should have gaps
      const driver2Result = result.find((r) => r.driverId === "driver-2")
      expect(driver2Result).toBeDefined()
      expect(driver2Result?.gaps).toHaveLength(2)
      expect(driver2Result?.gaps[0].gapToLeader).toBe(1.0) // 31.0 - 30.0
      expect(driver2Result?.gaps[1].gapToLeader).toBe(2.0) // 62.5 - 60.5
    })
  })

  describe("edge cases", () => {
    it("should return empty array for empty input", () => {
      const result = calculateGapEvolution([])
      expect(result).toEqual([])
    })

    it("should handle single driver", () => {
      const driverSeries: DriverLapSeries[] = [
        {
          driverId: "driver-1",
          driverName: "Driver 1",
          laps: [
            {
              lapNumber: 1,
              lapTimeSeconds: 30.0,
              elapsedRaceTime: 30.0,
              positionOnLap: 1,
            },
          ],
        },
      ]

      const result = calculateGapEvolution(driverSeries)

      expect(result).toHaveLength(1)
      expect(result[0].gaps).toHaveLength(1)
      expect(result[0].gaps[0].gapToLeader).toBe(0) // Leader has 0 gap
    })

    it("should handle drivers with different lap counts", () => {
      const driverSeries: DriverLapSeries[] = [
        {
          driverId: "driver-1",
          driverName: "Driver 1",
          laps: [
            {
              lapNumber: 1,
              lapTimeSeconds: 30.0,
              elapsedRaceTime: 30.0,
              positionOnLap: 1,
            },
            {
              lapNumber: 2,
              lapTimeSeconds: 30.5,
              elapsedRaceTime: 60.5,
              positionOnLap: 1,
            },
          ],
        },
        {
          driverId: "driver-2",
          driverName: "Driver 2",
          laps: [
            {
              lapNumber: 1,
              lapTimeSeconds: 31.0,
              elapsedRaceTime: 31.0,
              positionOnLap: 2,
            },
            // Driver 2 only completed 1 lap
          ],
        },
      ]

      const result = calculateGapEvolution(driverSeries)

      expect(result).toHaveLength(2)

      // Driver 1 should have gaps for both laps
      const driver1Result = result.find((r) => r.driverId === "driver-1")
      expect(driver1Result?.gaps).toHaveLength(2)

      // Driver 2 should only have gap for lap 1
      const driver2Result = result.find((r) => r.driverId === "driver-2")
      expect(driver2Result?.gaps).toHaveLength(1)
      expect(driver2Result?.gaps[0].gapToLeader).toBe(1.0)
    })

    it("should ensure gap cannot be negative", () => {
      // Edge case: if calculation somehow results in negative, should be clamped to 0
      const driverSeries: DriverLapSeries[] = [
        {
          driverId: "driver-1",
          driverName: "Driver 1",
          laps: [
            {
              lapNumber: 1,
              lapTimeSeconds: 30.0,
              elapsedRaceTime: 30.0,
              positionOnLap: 1,
            },
          ],
        },
      ]

      const result = calculateGapEvolution(driverSeries)

      expect(result[0].gaps[0].gapToLeader).toBeGreaterThanOrEqual(0)
    })
  })

  describe("multiple drivers", () => {
    it("should calculate gaps for three drivers correctly", () => {
      const driverSeries: DriverLapSeries[] = [
        {
          driverId: "driver-1",
          driverName: "Driver 1",
          laps: [
            {
              lapNumber: 1,
              lapTimeSeconds: 30.0,
              elapsedRaceTime: 30.0,
              positionOnLap: 1,
            },
          ],
        },
        {
          driverId: "driver-2",
          driverName: "Driver 2",
          laps: [
            {
              lapNumber: 1,
              lapTimeSeconds: 31.0,
              elapsedRaceTime: 31.0,
              positionOnLap: 2,
            },
          ],
        },
        {
          driverId: "driver-3",
          driverName: "Driver 3",
          laps: [
            {
              lapNumber: 1,
              lapTimeSeconds: 32.0,
              elapsedRaceTime: 32.0,
              positionOnLap: 3,
            },
          ],
        },
      ]

      const result = calculateGapEvolution(driverSeries)

      expect(result).toHaveLength(3)

      // All should have gaps calculated
      result.forEach((driverResult) => {
        expect(driverResult.gaps).toHaveLength(1)
        expect(driverResult.gaps[0].gapToLeader).toBeGreaterThanOrEqual(0)
      })

      // Driver 1 (leader) should have 0 gap
      const driver1Result = result.find((r) => r.driverId === "driver-1")
      expect(driver1Result?.gaps[0].gapToLeader).toBe(0)

      // Driver 2 should have 1.0 gap
      const driver2Result = result.find((r) => r.driverId === "driver-2")
      expect(driver2Result?.gaps[0].gapToLeader).toBe(1.0)

      // Driver 3 should have 2.0 gap
      const driver3Result = result.find((r) => r.driverId === "driver-3")
      expect(driver3Result?.gaps[0].gapToLeader).toBe(2.0)
    })
  })
})

describe("calculateTopNGapEvolution", () => {
  it("should return top N drivers by best lap time", () => {
    const driverSeries: DriverLapSeries[] = [
      {
        driverId: "driver-1",
        driverName: "Driver 1",
        laps: [
          {
            lapNumber: 1,
            lapTimeSeconds: 30.0,
            elapsedRaceTime: 30.0,
            positionOnLap: 1,
          },
        ],
      },
      {
        driverId: "driver-2",
        driverName: "Driver 2",
        laps: [
          {
            lapNumber: 1,
            lapTimeSeconds: 31.0,
            elapsedRaceTime: 31.0,
            positionOnLap: 2,
          },
        ],
      },
      {
          driverId: "driver-3",
        driverName: "Driver 3",
        laps: [
          {
            lapNumber: 1,
            lapTimeSeconds: 32.0,
            elapsedRaceTime: 32.0,
            positionOnLap: 3,
          },
        ],
      },
      {
          driverId: "driver-4",
        driverName: "Driver 4",
        laps: [
          {
            lapNumber: 1,
            lapTimeSeconds: 33.0,
            elapsedRaceTime: 33.0,
            positionOnLap: 4,
          },
        ],
      },
    ]

    const result = calculateTopNGapEvolution(driverSeries, 2)

    expect(result).toHaveLength(2)
    expect(result[0].driverId).toBe("driver-1")
    expect(result[1].driverId).toBe("driver-2")
  })

  it("should default to top 3 drivers", () => {
    const driverSeries: DriverLapSeries[] = [
      {
        driverId: "driver-1",
        driverName: "Driver 1",
        laps: [
          {
            lapNumber: 1,
            lapTimeSeconds: 30.0,
            elapsedRaceTime: 30.0,
            positionOnLap: 1,
          },
        ],
      },
      {
        driverId: "driver-2",
        driverName: "Driver 2",
        laps: [
          {
            lapNumber: 1,
            lapTimeSeconds: 31.0,
            elapsedRaceTime: 31.0,
            positionOnLap: 2,
          },
        ],
      },
      {
          driverId: "driver-3",
        driverName: "Driver 3",
        laps: [
          {
            lapNumber: 1,
            lapTimeSeconds: 32.0,
            elapsedRaceTime: 32.0,
            positionOnLap: 3,
          },
        ],
      },
      {
          driverId: "driver-4",
        driverName: "Driver 4",
        laps: [
          {
            lapNumber: 1,
            lapTimeSeconds: 33.0,
            elapsedRaceTime: 33.0,
            positionOnLap: 4,
          },
        ],
      },
    ]

    const result = calculateTopNGapEvolution(driverSeries)

    expect(result).toHaveLength(3)
  })

  it("should return empty array for empty input", () => {
    const result = calculateTopNGapEvolution([])
    expect(result).toEqual([])
  })
})
