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

import { searchEvents as searchEventsFromRepo, type SearchEventsResult } from "./repo"
import { validateEventSearchParams } from "./validate"

export interface SearchEventsInput {
  trackId: string
  startDate?: string // ISO date string (optional)
  endDate?: string // ISO date string (optional)
}

/**
 * Search events by track and optional date range
 * 
 * Validates parameters and ensures track exists before searching.
 * If dates are not provided, returns all events for the track.
 * 
 * @param input - Search parameters
 * @returns Search result with track info and matching events
 * @throws Error if validation fails or track not found
 */
export async function searchEvents(input: SearchEventsInput): Promise<SearchEventsResult> {
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
  // Start date: set to beginning of day (midnight)
  // End date: set to end of day (23:59:59.999) to include all events on that day
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

  // Search events (repo will throw if track not found)
  return searchEventsFromRepo({
    trackId: input.trackId,
    startDate,
    endDate,
  })
}

