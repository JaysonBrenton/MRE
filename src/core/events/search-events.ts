/**
 * @fileoverview Search events business logic
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Business logic for searching events by track and date range
 *
 * @purpose Provides a clean interface for searching events. Validates parameters,
 *          ensures track exists, and returns typed event data with track info.
 *
 * @relatedFiles
 * - src/core/events/repo.ts (database access)
 * - src/core/events/validate.ts (validation logic)
 */

import {
  searchEvents as searchEventsFromRepo,
  searchPracticeDayEvents as searchPracticeDayEventsFromRepo,
  type SearchEventsResult,
  type PracticeDayEventResult,
} from "./repo"
import { validateEventSearchParams } from "./validate"

export interface SearchEventsInput {
  trackId: string
  startDate?: string // ISO date string (optional)
  endDate?: string // ISO date string (optional)
  includePracticeDays?: boolean
}

export interface SearchEventsWithPracticeDaysResult extends SearchEventsResult {
  practiceDays: PracticeDayEventResult[]
  practiceRangeMin: string | null // ISO date string, earliest date in events or practice
  practiceRangeMax: string | null // ISO date string, latest date in events or practice
}

/**
 * Search events by track and optional date range
 *
 * Validates parameters and ensures track exists before searching.
 * If dates are not provided, returns all events for the track.
 * When includePracticeDays is true, also returns practice day events and date range for discover.
 *
 * @param input - Search parameters
 * @returns Search result with track info and matching events (and optionally practice days + range)
 * @throws Error if validation fails or track not found
 */
export async function searchEvents(
  input: SearchEventsInput
): Promise<SearchEventsResult | SearchEventsWithPracticeDaysResult> {
  // Validate parameters
  const validationError = validateEventSearchParams(
    input.trackId,
    input.startDate || null,
    input.endDate || null
  )

  if (validationError) {
    throw validationError
  }

  // Convert date strings to Date objects if provided
  let startDate: Date | undefined
  let endDate: Date | undefined

  if (input.startDate) {
    const date = new Date(input.startDate)
    date.setHours(0, 0, 0, 0)
    startDate = date
  }

  if (input.endDate) {
    const date = new Date(input.endDate)
    date.setHours(23, 59, 59, 999)
    endDate = date
  }

  const repoParams = { trackId: input.trackId, startDate, endDate }

  if (!input.includePracticeDays) {
    return searchEventsFromRepo(repoParams)
  }

  // Run event search and practice-day search in parallel
  const [eventsResult, practiceResult] = await Promise.all([
    searchEventsFromRepo(repoParams),
    searchPracticeDayEventsFromRepo(repoParams),
  ])

  const allDates: string[] = []
  for (const e of eventsResult.events) {
    if (e.eventDate) allDates.push(e.eventDate)
  }
  for (const pd of practiceResult.practiceDays) {
    if (pd.eventDate) allDates.push(pd.eventDate)
  }
  const practiceRangeMin =
    allDates.length > 0 ? allDates.reduce((a, b) => (a < b ? a : b)) : null
  const practiceRangeMax =
    allDates.length > 0 ? allDates.reduce((a, b) => (a > b ? a : b)) : null

  return {
    ...eventsResult,
    practiceDays: practiceResult.practiceDays,
    practiceRangeMin,
    practiceRangeMax,
  }
}
