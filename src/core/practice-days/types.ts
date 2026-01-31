/**
 * @fileoverview Practice day types
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description TypeScript types for practice day functionality
 */

export interface PracticeSessionSummary {
  sessionId: string
  driverName: string
  className: string
  transponderNumber?: string
  startTime: string
  durationSeconds: number
  lapCount: number
  fastestLap?: number
  averageLap?: number
  sessionUrl: string
}

export interface PracticeDaySummary {
  date: string
  trackSlug: string
  sessionCount: number
  totalLaps: number
  totalTrackTimeSeconds: number
  uniqueDrivers: number
  uniqueClasses: number
  timeRangeStart?: string
  timeRangeEnd?: string
  sessions: PracticeSessionSummary[]
}

export interface DiscoverPracticeDaysInput {
  trackId: string
  year: number
  month: number
}

export interface DiscoverPracticeDaysResult {
  practiceDays: PracticeDaySummary[]
}

export interface SearchPracticeDaysInput {
  trackId: string
  startDate?: string
  endDate?: string
}

export interface SearchPracticeDaysResult {
  practiceDays: Array<{
    id: string
    eventName: string
    eventDate: string | null
    sourceEventId: string
    trackId: string
    ingestDepth: string
  }>
}

export interface IngestPracticeDayInput {
  trackId: string
  date: string
}

export interface IngestPracticeDayResult {
  eventId: string
  sessionsIngested: number
  sessionsFailed: number
  status: string
}
