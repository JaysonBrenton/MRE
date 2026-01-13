/**
 * @fileoverview Unified search business logic
 * 
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 * 
 * @description Orchestrates search across events and sessions
 */

import { searchEvents, searchSessions } from "./repo"
import { findDriversWithValidLaps } from "./driver-matching"
import type {
  UnifiedSearchParams,
  UnifiedSearchResult,
  SessionType,
} from "./types"

/**
 * Perform unified search across events and sessions
 */
export async function unifiedSearch(params: UnifiedSearchParams): Promise<UnifiedSearchResult> {
  const {
    query,
    driverName,
    sessionType,
    startDate,
    endDate,
    page = 1,
    itemsPerPage = 10,
  } = params

  // If driver name provided, find matching drivers first
  let driverIds: string[] | undefined
  if (driverName && driverName.trim() !== "") {
    const drivers = await findDriversWithValidLaps(driverName.trim())
    driverIds = drivers.map((d) => d.id)

    // If no drivers found, return empty results
    if (driverIds.length === 0) {
      return {
        events: [],
        sessions: [],
        totalEvents: 0,
        totalSessions: 0,
        currentPage: page,
        totalPages: 0,
        itemsPerPage,
      }
    }
  }

  // Parse dates
  const startDateObj = startDate ? new Date(startDate) : undefined
  const endDateObj = endDate ? new Date(endDate) : undefined

  // Search events and sessions in parallel
  const [eventsResult, sessionsResult] = await Promise.all([
    searchEvents({
      query,
      driverIds,
      startDate: startDateObj,
      endDate: endDateObj,
      page,
      itemsPerPage,
    }),
    searchSessions({
      query,
      driverIds,
      sessionType: sessionType as SessionType | undefined,
      startDate: startDateObj,
      endDate: endDateObj,
      page,
      itemsPerPage,
    }),
  ])

  // Calculate total pages (combined)
  const totalItems = eventsResult.total + sessionsResult.total
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))

  return {
    events: eventsResult.events,
    sessions: sessionsResult.sessions,
    totalEvents: eventsResult.total,
    totalSessions: sessionsResult.total,
    currentPage: page,
    totalPages,
    itemsPerPage,
  }
}
