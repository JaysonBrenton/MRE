/**
 * @fileoverview Tests for PracticeDaySearchContainer data transformation
 * 
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 */

import { describe, it, expect } from "vitest"

describe("PracticeDaySearchContainer data transformation", () => {
  // Simulate the transformation logic from the component
  const transformPracticeDay = (pd: any) => ({
    date: pd.date,
    trackSlug: pd.track_slug || pd.trackSlug,
    sessionCount: pd.session_count ?? pd.sessionCount ?? 0,
    totalLaps: pd.total_laps ?? pd.totalLaps ?? 0,
    totalTrackTimeSeconds: pd.total_track_time_seconds ?? pd.totalTrackTimeSeconds ?? 0,
    uniqueDrivers: pd.unique_drivers ?? pd.uniqueDrivers ?? 0,
    uniqueClasses: pd.unique_classes ?? pd.uniqueClasses ?? 0,
    timeRangeStart: pd.time_range_start || pd.timeRangeStart,
    timeRangeEnd: pd.time_range_end || pd.timeRangeEnd,
    sessions: (pd.sessions || []).map((s: any) => ({
      sessionId: s.session_id || s.sessionId,
      driverName: s.driver_name || s.driverName,
      className: s.class_name || s.className,
      startTime: s.start_time || s.startTime,
      durationSeconds: s.duration_seconds ?? s.durationSeconds ?? 0,
      lapCount: s.lap_count ?? s.lapCount ?? 0,
    })),
  })

  it("should transform snake_case API response to camelCase", () => {
    const apiResponse = {
      date: "2025-01-15",
      track_slug: "test-track",
      session_count: 5,
      total_laps: 1234,
      total_track_time_seconds: 3600,
      unique_drivers: 10,
      unique_classes: 3,
      time_range_start: "2025-01-15T08:00:00Z",
      time_range_end: "2025-01-15T17:00:00Z",
      sessions: [
        {
          session_id: "session-1",
          driver_name: "John Doe",
          class_name: "Pro",
          start_time: "2025-01-15T08:00:00Z",
          duration_seconds: 1800,
          lap_count: 50,
        },
      ],
    }

    const transformed = transformPracticeDay(apiResponse)

    expect(transformed.date).toBe("2025-01-15")
    expect(transformed.trackSlug).toBe("test-track")
    expect(transformed.sessionCount).toBe(5)
    expect(transformed.totalLaps).toBe(1234)
    expect(transformed.totalTrackTimeSeconds).toBe(3600)
    expect(transformed.uniqueDrivers).toBe(10)
    expect(transformed.uniqueClasses).toBe(3)
    expect(transformed.timeRangeStart).toBe("2025-01-15T08:00:00Z")
    expect(transformed.timeRangeEnd).toBe("2025-01-15T17:00:00Z")
    expect(transformed.sessions).toHaveLength(1)
    expect(transformed.sessions[0].sessionId).toBe("session-1")
    expect(transformed.sessions[0].driverName).toBe("John Doe")
    expect(transformed.sessions[0].className).toBe("Pro")
  })

  it("should handle undefined numeric values by defaulting to 0", () => {
    const apiResponse = {
      date: "2025-01-15",
      track_slug: "test-track",
      session_count: undefined,
      total_laps: undefined,
      unique_drivers: null,
      unique_classes: undefined,
    }

    const transformed = transformPracticeDay(apiResponse)

    expect(transformed.sessionCount).toBe(0)
    expect(transformed.totalLaps).toBe(0)
    expect(transformed.uniqueDrivers).toBe(0)
    expect(transformed.uniqueClasses).toBe(0)
  })

  it("should handle missing fields gracefully", () => {
    const apiResponse = {
      date: "2025-01-15",
      track_slug: "test-track",
      // Missing all numeric fields
    }

    const transformed = transformPracticeDay(apiResponse)

    expect(transformed.sessionCount).toBe(0)
    expect(transformed.totalLaps).toBe(0)
    expect(transformed.totalTrackTimeSeconds).toBe(0)
    expect(transformed.uniqueDrivers).toBe(0)
    expect(transformed.uniqueClasses).toBe(0)
    expect(transformed.sessions).toEqual([])
  })

  it("should handle camelCase input (backward compatibility)", () => {
    const camelCaseResponse = {
      date: "2025-01-15",
      trackSlug: "test-track",
      sessionCount: 5,
      totalLaps: 1234,
      uniqueDrivers: 10,
      uniqueClasses: 3,
    }

    const transformed = transformPracticeDay(camelCaseResponse)

    expect(transformed.sessionCount).toBe(5)
    expect(transformed.totalLaps).toBe(1234)
    expect(transformed.uniqueDrivers).toBe(10)
    expect(transformed.uniqueClasses).toBe(3)
  })

  it("should ensure totalLaps is always a number for toLocaleString()", () => {
    const testCases = [
      { total_laps: 1234, expected: 1234 },
      { total_laps: 0, expected: 0 },
      { total_laps: undefined, expected: 0 },
      { total_laps: null, expected: 0 },
      {}, // missing field
    ]

    testCases.forEach((testCase) => {
      const transformed = transformPracticeDay({
        date: "2025-01-15",
        track_slug: "test-track",
        ...testCase,
      })

      expect(typeof transformed.totalLaps).toBe("number")
      expect(transformed.totalLaps).toBe(testCase.expected ?? 0)
      
      // This should not throw an error
      expect(() => transformed.totalLaps.toLocaleString()).not.toThrow()
    })
  })
})
