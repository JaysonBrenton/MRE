/**
 * @fileoverview Tests for driver statistics calculation logic
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Tests for driver statistics calculations
 *
 * @purpose Validates driver stats calculation logic including edge cases.
 */

import { describe, it, expect } from "vitest"
import { calculateDriverStats, type RaceResultData } from "@/core/events/calculate-driver-stats"

describe("calculateDriverStats", () => {
  describe("basic calculations", () => {
    it("should calculate stats correctly for single race result", () => {
      const raceResults: RaceResultData[] = [
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 1,
          lapsCompleted: 10,
          fastLapTime: 30.5,
          avgLapTime: 31.0,
          consistency: 95.5,
          laps: [
            {
              lapNumber: 1,
              lapTimeSeconds: 30.5,
              elapsedRaceTime: 30.5,
            },
          ],
        },
      ]

      const result = calculateDriverStats(raceResults)

      expect(result.raceDriverId).toBe("driver-1")
      expect(result.driverName).toBe("Driver 1")
      expect(result.racesParticipated).toBe(1)
      expect(result.bestLapTime).toBe(30.5)
      expect(result.avgLapTime).toBe(31.0)
      expect(result.consistency).toBe(95.5)
      expect(result.totalLaps).toBe(10)
      expect(result.positions).toEqual([1])
      expect(result.avgPosition).toBe(1)
    })

    it("should calculate averages correctly for multiple race results", () => {
      const raceResults: RaceResultData[] = [
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 1,
          lapsCompleted: 10,
          fastLapTime: 30.5,
          avgLapTime: 31.0,
          consistency: 95.0,
          laps: [],
        },
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 2,
          lapsCompleted: 10,
          fastLapTime: 30.8,
          avgLapTime: 31.5,
          consistency: 94.0,
          laps: [],
        },
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 3,
          lapsCompleted: 10,
          fastLapTime: 31.0,
          avgLapTime: 32.0,
          consistency: 93.0,
          laps: [],
        },
      ]

      const result = calculateDriverStats(raceResults)

      expect(result.racesParticipated).toBe(3)
      expect(result.bestLapTime).toBe(30.5) // Best of all races
      expect(result.avgLapTime).toBe((31.0 + 31.5 + 32.0) / 3) // Average of averages
      expect(result.consistency).toBe((95.0 + 94.0 + 93.0) / 3) // Average consistency
      expect(result.totalLaps).toBe(30)
      expect(result.positions).toEqual([1, 2, 3])
      expect(result.avgPosition).toBe(2) // (1 + 2 + 3) / 3
    })
  })

  describe("edge cases", () => {
    it("should throw error for empty race results", () => {
      expect(() => calculateDriverStats([])).toThrow(
        "Cannot calculate stats for empty race results"
      )
    })

    it("should handle null values correctly", () => {
      const raceResults: RaceResultData[] = [
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 1,
          lapsCompleted: 10,
          fastLapTime: null,
          avgLapTime: null,
          consistency: null,
          laps: [],
        },
      ]

      const result = calculateDriverStats(raceResults)

      expect(result.bestLapTime).toBeNull()
      expect(result.avgLapTime).toBeNull()
      expect(result.consistency).toBeNull()
      expect(result.totalLaps).toBe(10)
    })

    it("should handle mixed null and non-null values", () => {
      const raceResults: RaceResultData[] = [
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 1,
          lapsCompleted: 10,
          fastLapTime: null,
          avgLapTime: 31.0,
          consistency: 95.0,
          laps: [],
        },
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 2,
          lapsCompleted: 10,
          fastLapTime: 30.5,
          avgLapTime: null,
          consistency: null,
          laps: [],
        },
      ]

      const result = calculateDriverStats(raceResults)

      expect(result.bestLapTime).toBe(30.5) // Only second race has fastLapTime
      expect(result.avgLapTime).toBe(31.0) // Only first race has avgLapTime
      expect(result.consistency).toBe(95.0) // Only first race has consistency
    })

    it("should select best lap time correctly", () => {
      const raceResults: RaceResultData[] = [
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 1,
          lapsCompleted: 10,
          fastLapTime: 31.0,
          avgLapTime: 32.0,
          consistency: 95.0,
          laps: [],
        },
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 2,
          lapsCompleted: 10,
          fastLapTime: 30.5, // Better than first race
          avgLapTime: 31.5,
          consistency: 94.0,
          laps: [],
        },
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 3,
          lapsCompleted: 10,
          fastLapTime: 30.8,
          avgLapTime: 32.5,
          consistency: 93.0,
          laps: [],
        },
      ]

      const result = calculateDriverStats(raceResults)

      expect(result.bestLapTime).toBe(30.5) // Best across all races
    })
  })

  describe("aggregation", () => {
    it("should sum total laps correctly", () => {
      const raceResults: RaceResultData[] = [
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 1,
          lapsCompleted: 10,
          fastLapTime: 30.5,
          avgLapTime: 31.0,
          consistency: 95.0,
          laps: [],
        },
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 2,
          lapsCompleted: 15,
          fastLapTime: 30.8,
          avgLapTime: 31.5,
          consistency: 94.0,
          laps: [],
        },
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 3,
          lapsCompleted: 12,
          fastLapTime: 31.0,
          avgLapTime: 32.0,
          consistency: 93.0,
          laps: [],
        },
      ]

      const result = calculateDriverStats(raceResults)

      expect(result.totalLaps).toBe(37) // 10 + 15 + 12
    })

    it("should track all positions", () => {
      const raceResults: RaceResultData[] = [
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 1,
          lapsCompleted: 10,
          fastLapTime: 30.5,
          avgLapTime: 31.0,
          consistency: 95.0,
          laps: [],
        },
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 5,
          lapsCompleted: 10,
          fastLapTime: 30.8,
          avgLapTime: 31.5,
          consistency: 94.0,
          laps: [],
        },
        {
          raceDriverId: "driver-1",
          driverName: "Driver 1",
          positionFinal: 3,
          lapsCompleted: 10,
          fastLapTime: 31.0,
          avgLapTime: 32.0,
          consistency: 93.0,
          laps: [],
        },
      ]

      const result = calculateDriverStats(raceResults)

      expect(result.positions).toEqual([1, 5, 3])
      expect(result.avgPosition).toBe(3) // (1 + 5 + 3) / 3
    })
  })
})
