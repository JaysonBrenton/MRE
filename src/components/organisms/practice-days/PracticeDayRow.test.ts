/**
 * @fileoverview Tests for PracticeDayRow component logic
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 */

import { describe, it, expect } from "vitest"

describe("PracticeDayRow data handling", () => {
  // Simulate the normalization logic from the component
  const normalizeNumericValues = (
    sessionCount?: number,
    totalLaps?: number,
    uniqueDrivers?: number,
    uniqueClasses?: number
  ) => {
    const safeSessionCount = sessionCount ?? 0
    const safeTotalLaps = totalLaps ?? 0
    const safeUniqueDrivers = uniqueDrivers ?? 0
    const safeUniqueClasses = uniqueClasses ?? 0

    return {
      safeSessionCount,
      safeTotalLaps,
      safeUniqueDrivers,
      safeUniqueClasses,
    }
  }

  it("should normalize undefined values to 0", () => {
    const result = normalizeNumericValues(undefined, undefined, undefined, undefined)

    expect(result.safeSessionCount).toBe(0)
    expect(result.safeTotalLaps).toBe(0)
    expect(result.safeUniqueDrivers).toBe(0)
    expect(result.safeUniqueClasses).toBe(0)
  })

  it("should normalize null values to 0", () => {
    const result = normalizeNumericValues(
      null as unknown as number,
      null as unknown as number,
      null as unknown as number,
      null as unknown as number
    )

    expect(result.safeSessionCount).toBe(0)
    expect(result.safeTotalLaps).toBe(0)
    expect(result.safeUniqueDrivers).toBe(0)
    expect(result.safeUniqueClasses).toBe(0)
  })

  it("should preserve valid numeric values", () => {
    const result = normalizeNumericValues(5, 1234, 10, 3)

    expect(result.safeSessionCount).toBe(5)
    expect(result.safeTotalLaps).toBe(1234)
    expect(result.safeUniqueDrivers).toBe(10)
    expect(result.safeUniqueClasses).toBe(3)
  })

  it("should allow toLocaleString() to be called on safeTotalLaps", () => {
    const testCases = [
      { totalLaps: 1234, expected: "1,234" },
      { totalLaps: 0, expected: "0" },
      { totalLaps: undefined, expected: "0" },
      { totalLaps: null as unknown as number, expected: "0" },
    ]

    testCases.forEach((testCase) => {
      const { safeTotalLaps } = normalizeNumericValues(0, testCase.totalLaps, 0, 0)

      expect(typeof safeTotalLaps).toBe("number")
      expect(() => safeTotalLaps.toLocaleString()).not.toThrow()

      // Verify the formatted output
      const formatted = safeTotalLaps.toLocaleString()
      expect(formatted).toBe(testCase.expected)
    })
  })

  it("should handle mixed undefined and defined values", () => {
    const result = normalizeNumericValues(5, undefined, 10, null as unknown as number)

    expect(result.safeSessionCount).toBe(5)
    expect(result.safeTotalLaps).toBe(0)
    expect(result.safeUniqueDrivers).toBe(10)
    expect(result.safeUniqueClasses).toBe(0)
  })
})
