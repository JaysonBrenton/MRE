/**
 * @fileoverview Search domain types
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description TypeScript type definitions for unified search feature
 */

export type SessionType = "race" | "practice" | "qualifying" | "practiceday"

export interface UnifiedSearchParams {
  query?: string
  driverName?: string
  sessionType?: SessionType
  startDate?: string
  endDate?: string
  page?: number
  itemsPerPage?: number
}

export interface EventSearchResult {
  id: string
  eventName: string
  eventDate: string | null
  trackName: string
  trackId: string
  source: string
  sourceEventId: string
  eventUrl: string
  ingestDepth: string
}

export interface SessionSearchResult {
  id: string
  raceId: string
  raceLabel: string
  className: string
  sessionType: SessionType // Backward compatibility: defaults to "race" if null in database
  eventId: string
  eventName: string
  eventDate: string | null
  trackName: string
  startTime: string | null // ISO string for serialization
  durationSeconds: number | null
  raceOrder: number | null
}

export interface UnifiedSearchResult {
  events: EventSearchResult[]
  sessions: SessionSearchResult[]
  totalEvents: number
  totalSessions: number
  currentPage: number
  totalPages: number
  itemsPerPage: number
}

export interface SearchEventsParams {
  query?: string
  driverIds?: string[]
  startDate?: Date
  endDate?: Date
  page: number
  itemsPerPage: number
}

export interface SearchSessionsParams {
  query?: string
  driverIds?: string[]
  sessionType?: SessionType
  startDate?: Date
  endDate?: Date
  page: number
  itemsPerPage: number
}

export interface SearchEventsResult {
  events: EventSearchResult[]
  total: number
}

export interface SearchSessionsResult {
  sessions: SessionSearchResult[]
  total: number
}
