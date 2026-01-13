/**
 * @fileoverview Unit test for driver names in sessions data
 * 
 * @created 2025-01-XX
 * @creator System
 * @lastModified 2025-01-XX
 * 
 * @description Verifies that driver names are always present in session results
 */

import { describe, it, expect } from 'vitest'
import { getSessionsData } from '@/core/events/get-sessions-data'
import type { EventAnalysisData } from '@/core/events/get-event-analysis-data'

describe('Sessions Data Driver Names', () => {
  it('should always include driverName in results array', () => {
    // Create mock event analysis data
    const mockData: EventAnalysisData = {
      event: {
        id: 'test-event-id',
        eventName: 'Test Event',
        eventDate: new Date('2025-01-01'),
        trackName: 'Test Track',
      },
      races: [
        {
          id: 'race-1',
          raceId: 'race-1',
          className: 'Test Class',
          raceLabel: 'Heat 1',
          raceOrder: 1,
          startTime: new Date('2025-01-01T10:00:00'),
          durationSeconds: 300,
          results: [
            {
              raceResultId: 'result-1',
              raceDriverId: 'race-driver-1',
              driverId: 'driver-1',
              driverName: 'Test Driver 1',
              positionFinal: 1,
              lapsCompleted: 10,
              totalTimeSeconds: 300,
              fastLapTime: 30.0,
              avgLapTime: 30.0,
              consistency: 95.0,
            },
            {
              raceResultId: 'result-2',
              raceDriverId: 'race-driver-2',
              driverId: 'driver-2',
              driverName: '', // Empty string
              positionFinal: 2,
              lapsCompleted: 10,
              totalTimeSeconds: 305,
              fastLapTime: 30.5,
              avgLapTime: 30.5,
              consistency: 94.0,
            },
            {
              raceResultId: 'result-3',
              raceDriverId: 'race-driver-3',
              driverId: 'driver-3',
              driverName: undefined as string | undefined, // Undefined
              positionFinal: 3,
              lapsCompleted: 9,
              totalTimeSeconds: 310,
              fastLapTime: 31.0,
              avgLapTime: 31.0,
              consistency: 93.0,
            },
          ],
        },
      ],
      drivers: [
        {
          driverId: 'driver-1',
          driverName: 'Test Driver 1',
          racesParticipated: 1,
          bestLapTime: 30.0,
          avgLapTime: 30.0,
          consistency: 95.0,
        },
        {
          driverId: 'driver-2',
          driverName: 'Test Driver 2',
          racesParticipated: 1,
          bestLapTime: 30.5,
          avgLapTime: 30.5,
          consistency: 94.0,
        },
        {
          driverId: 'driver-3',
          driverName: 'Test Driver 3',
          racesParticipated: 1,
          bestLapTime: 31.0,
          avgLapTime: 31.0,
          consistency: 93.0,
        },
      ],
      entryList: [
        {
          id: 'entry-1',
          driverId: 'driver-1',
          driverName: 'Test Driver 1',
          className: 'Test Class',
          transponderNumber: '123',
          carNumber: '1',
        },
        {
          id: 'entry-2',
          driverId: 'driver-2',
          driverName: 'Test Driver 2',
          className: 'Test Class',
          transponderNumber: '456',
          carNumber: '2',
        },
        {
          id: 'entry-3',
          driverId: 'driver-3',
          driverName: 'Test Driver 3',
          className: 'Test Class',
          transponderNumber: '789',
          carNumber: '3',
        },
      ],
      raceClasses: new Map(),
      summary: {
        totalRaces: 1,
        totalDrivers: 3,
        totalLaps: 29,
        dateRange: {
          earliest: new Date('2025-01-01T10:00:00'),
          latest: new Date('2025-01-01T10:00:00'),
        },
      },
    }

    // Get sessions data
    const sessionsData = getSessionsData(mockData, [], 'Test Class')

    // Verify sessions were created
    expect(sessionsData.sessions.length).toBeGreaterThan(0)

    // Check each session
    sessionsData.sessions.forEach((session) => {
      // Verify topFinishers have driver names
      expect(session.topFinishers.length).toBeGreaterThan(0)
      session.topFinishers.forEach((finisher) => {
        expect(finisher.driverName).toBeDefined()
        expect(typeof finisher.driverName).toBe('string')
        expect(finisher.driverName.trim().length).toBeGreaterThan(0)
      })

      // Verify results have driver names
      expect(session.results.length).toBeGreaterThan(0)
      session.results.forEach((result) => {
        expect(result.driverName).toBeDefined()
        expect(typeof result.driverName).toBe('string')
        expect(result.driverName.trim().length).toBeGreaterThan(0)
        expect(result.driverName).not.toBe('')
      })
    })
  })

  it('should use fallback driver names from lookup when result.driverName is missing', () => {
    const mockData: EventAnalysisData = {
      event: {
        id: 'test-event-id',
        eventName: 'Test Event',
        eventDate: new Date('2025-01-01'),
        trackName: 'Test Track',
      },
      races: [
        {
          id: 'race-1',
          raceId: 'race-1',
          className: 'Test Class',
          raceLabel: 'Heat 1',
          raceOrder: 1,
          startTime: new Date('2025-01-01T10:00:00'),
          durationSeconds: 300,
          results: [
            {
              raceResultId: 'result-1',
              raceDriverId: 'race-driver-1',
              driverId: 'driver-1',
              driverName: undefined as string | undefined, // Missing driver name
              positionFinal: 1,
              lapsCompleted: 10,
              totalTimeSeconds: 300,
              fastLapTime: 30.0,
              avgLapTime: 30.0,
              consistency: 95.0,
            },
          ],
        },
      ],
      drivers: [
        {
          driverId: 'driver-1',
          driverName: 'Driver From Drivers Array',
          racesParticipated: 1,
          bestLapTime: 30.0,
          avgLapTime: 30.0,
          consistency: 95.0,
        },
      ],
      entryList: [
        {
          id: 'entry-1',
          driverId: 'driver-1',
          driverName: 'Driver From Entry List',
          className: 'Test Class',
          transponderNumber: '123',
          carNumber: '1',
        },
      ],
      raceClasses: new Map(),
      summary: {
        totalRaces: 1,
        totalDrivers: 1,
        totalLaps: 10,
        dateRange: {
          earliest: new Date('2025-01-01T10:00:00'),
          latest: new Date('2025-01-01T10:00:00'),
        },
      },
    }

    const sessionsData = getSessionsData(mockData, [], 'Test Class')

    expect(sessionsData.sessions.length).toBeGreaterThan(0)
    const session = sessionsData.sessions[0]

    // Verify results have driver names from lookup
    expect(session.results.length).toBeGreaterThan(0)
    session.results.forEach((result) => {
      expect(result.driverName).toBeDefined()
      expect(typeof result.driverName).toBe('string')
      expect(result.driverName.trim().length).toBeGreaterThan(0)
      // Should use driver name from drivers array or entry list, or "Unknown Driver"
      expect(['Driver From Drivers Array', 'Driver From Entry List', 'Unknown Driver']).toContain(result.driverName)
    })
  })
})
