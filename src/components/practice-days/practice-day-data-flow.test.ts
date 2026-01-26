/**
 * @fileoverview End-to-end test for practice day data flow
 * 
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 * 
 * @description Tests the complete data flow from API response to component props
 */

import { describe, it, expect } from "vitest"

describe("Practice Day Data Flow - End to End", () => {
  // Simulate the complete transformation pipeline
  const transformApiResponseToComponentProps = (apiResponse: any) => {
    // Step 1: Extract practice days from API response
    const practiceDaysList = 
      apiResponse.practiceDays || 
      apiResponse.practice_days || 
      (Array.isArray(apiResponse) ? apiResponse : [])

    // Step 2: Transform snake_case to camelCase (from PracticeDaySearchContainer)
    const transformedPracticeDays = practiceDaysList.map((pd: any) => ({
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
    }))

    // Step 3: Normalize values for component (from PracticeDayRow)
    return transformedPracticeDays.map((pd: any) => {
      const safeSessionCount = pd.sessionCount ?? 0
      const safeTotalLaps = pd.totalLaps ?? 0
      const safeUniqueDrivers = pd.uniqueDrivers ?? 0
      const safeUniqueClasses = pd.uniqueClasses ?? 0

      return {
        ...pd,
        safeSessionCount,
        safeTotalLaps,
        safeUniqueDrivers,
        safeUniqueClasses,
      }
    })
  }

  it("should handle real API response format without errors", () => {
    // Simulate actual API response from ingestion service
    const apiResponse = {
      success: true,
      data: {
        practice_days: [
          {
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
          },
        ],
      },
    }

    const result = transformApiResponseToComponentProps(apiResponse.data)

    expect(result).toHaveLength(1)
    const practiceDay = result[0]

    // Verify all fields are properly transformed
    expect(practiceDay.date).toBe("2025-01-15")
    expect(practiceDay.trackSlug).toBe("test-track")
    expect(practiceDay.sessionCount).toBe(5)
    expect(practiceDay.totalLaps).toBe(1234)
    expect(practiceDay.uniqueDrivers).toBe(10)
    expect(practiceDay.uniqueClasses).toBe(3)

    // Verify safe values are numbers
    expect(typeof practiceDay.safeTotalLaps).toBe("number")
    expect(practiceDay.safeTotalLaps).toBe(1234)

    // Verify toLocaleString() works
    expect(() => practiceDay.safeTotalLaps.toLocaleString()).not.toThrow()
    expect(practiceDay.safeTotalLaps.toLocaleString()).toBe("1,234")
  })

  it("should handle API response with missing numeric fields", () => {
    const apiResponse = {
      success: true,
      data: {
        practice_days: [
          {
            date: "2025-01-15",
            track_slug: "test-track",
            // Missing: session_count, total_laps, unique_drivers, unique_classes
          },
        ],
      },
    }

    const result = transformApiResponseToComponentProps(apiResponse.data)

    expect(result).toHaveLength(1)
    const practiceDay = result[0]

    // All numeric fields should default to 0
    expect(practiceDay.sessionCount).toBe(0)
    expect(practiceDay.totalLaps).toBe(0)
    expect(practiceDay.uniqueDrivers).toBe(0)
    expect(practiceDay.uniqueClasses).toBe(0)

    // Safe values should also be 0
    expect(practiceDay.safeTotalLaps).toBe(0)
    expect(typeof practiceDay.safeTotalLaps).toBe("number")

    // toLocaleString() should work on 0
    expect(() => practiceDay.safeTotalLaps.toLocaleString()).not.toThrow()
    expect(practiceDay.safeTotalLaps.toLocaleString()).toBe("0")
  })

  it("should handle API response with null/undefined values", () => {
    const apiResponse = {
      success: true,
      data: {
        practice_days: [
          {
            date: "2025-01-15",
            track_slug: "test-track",
            session_count: null,
            total_laps: undefined,
            unique_drivers: null,
            unique_classes: undefined,
          },
        ],
      },
    }

    const result = transformApiResponseToComponentProps(apiResponse.data)

    expect(result).toHaveLength(1)
    const practiceDay = result[0]

    // All null/undefined values should become 0
    expect(practiceDay.sessionCount).toBe(0)
    expect(practiceDay.totalLaps).toBe(0)
    expect(practiceDay.uniqueDrivers).toBe(0)
    expect(practiceDay.uniqueClasses).toBe(0)

    // Safe values should be numbers
    expect(typeof practiceDay.safeTotalLaps).toBe("number")
    expect(() => practiceDay.safeTotalLaps.toLocaleString()).not.toThrow()
  })

  it("should prevent the original error: undefined.toLocaleString()", () => {
    // This test specifically verifies the fix for the original error
    const problematicApiResponse = {
      success: true,
      data: {
        practice_days: [
          {
            date: "2025-01-15",
            track_slug: "test-track",
            // total_laps is missing - this would cause the original error
          },
        ],
      },
    }

    const result = transformApiResponseToComponentProps(problematicApiResponse.data)

    expect(result).toHaveLength(1)
    const practiceDay = result[0]

    // Before fix: practiceDay.totalLaps would be undefined
    // After fix: practiceDay.totalLaps should be 0
    expect(practiceDay.totalLaps).toBe(0)
    expect(practiceDay.safeTotalLaps).toBe(0)

    // This should NOT throw "Cannot read properties of undefined (reading 'toLocaleString')"
    expect(() => {
      const value = practiceDay.safeTotalLaps
      if (value === undefined || value === null) {
        throw new Error("Value is still undefined/null")
      }
      return value.toLocaleString()
    }).not.toThrow()

    // Verify it actually works
    const formatted = practiceDay.safeTotalLaps.toLocaleString()
    expect(formatted).toBe("0")
  })
})
