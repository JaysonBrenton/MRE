/**
 * @fileoverview Tests for calculateTrackTemperature function
 * 
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 * 
 * @description Unit tests for track temperature calculation formula
 * 
 * @purpose Validates that track temperature calculation works correctly with
 *          various inputs, including edge cases and solar radiation adjustments.
 */

import { describe, it, expect } from "vitest"
import { calculateTrackTemperature } from "@/core/weather/calculate-track-temp"

describe("calculateTrackTemperature", () => {
  describe("basic calculation", () => {
    it("should calculate track temp as 1.2x air temp by default", () => {
      expect(calculateTrackTemperature(20)).toBe(24) // 20 * 1.2 = 24
      expect(calculateTrackTemperature(30)).toBe(36) // 30 * 1.2 = 36
      expect(calculateTrackTemperature(0)).toBe(0) // 0 * 1.2 = 0
    })

    it("should round to 1 decimal place", () => {
      const result = calculateTrackTemperature(25.7)
      expect(result).toBe(30.8) // 25.7 * 1.2 = 30.84, rounded to 30.8
    })
  })

  describe("solar radiation adjustment", () => {
    it("should add solar adjustment at noon (peak)", () => {
      const noon = calculateTrackTemperature(20, 12)
      const midnight = calculateTrackTemperature(20, 0)
      
      // At noon, solar factor should be at maximum (1.0), adding up to 5°C
      // At midnight, solar factor should be at minimum (0.0), adding 0°C
      expect(noon).toBeGreaterThan(midnight)
      expect(noon).toBeGreaterThan(24) // Base 24 + some solar adjustment
    })

    it("should have less solar adjustment in early morning", () => {
      const earlyMorning = calculateTrackTemperature(20, 6)
      const noon = calculateTrackTemperature(20, 12)
      
      expect(earlyMorning).toBeLessThan(noon)
      expect(earlyMorning).toBeGreaterThan(20) // Still above air temp
    })

    it("should have less solar adjustment in evening", () => {
      const evening = calculateTrackTemperature(20, 18)
      const noon = calculateTrackTemperature(20, 12)
      
      expect(evening).toBeLessThan(noon)
      expect(evening).toBeGreaterThan(20) // Still above air temp
    })
  })

  describe("clamping behavior", () => {
    it("should never return temperature below air temperature", () => {
      const result = calculateTrackTemperature(10)
      expect(result).toBeGreaterThanOrEqual(10)
    })

    it("should clamp to maximum reasonable temperature (70°C)", () => {
      const result = calculateTrackTemperature(60, 12) // High temp at peak solar
      expect(result).toBeLessThanOrEqual(70)
    })

    it("should handle negative air temperatures", () => {
      const result = calculateTrackTemperature(-5)
      expect(result).toBe(-6) // -5 * 1.2 = -6, but clamped to >= -5
      expect(result).toBeGreaterThanOrEqual(-5)
    })
  })

  describe("edge cases", () => {
    it("should handle very high air temperatures", () => {
      const result = calculateTrackTemperature(50)
      expect(result).toBeGreaterThanOrEqual(50)
      expect(result).toBeLessThanOrEqual(70)
    })

    it("should handle very low air temperatures", () => {
      const result = calculateTrackTemperature(-20)
      expect(result).toBeGreaterThanOrEqual(-20)
    })

    it("should handle hour values at boundaries", () => {
      expect(() => calculateTrackTemperature(20, 0)).not.toThrow()
      expect(() => calculateTrackTemperature(20, 23)).not.toThrow()
      expect(() => calculateTrackTemperature(20, 12)).not.toThrow()
    })
  })
})

