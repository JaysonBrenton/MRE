/**
 * @fileoverview Cross-track database browse for Event Search.
 *
 * @description Paginated listing of ingested events across all tracks when the
 *              user runs search without selecting a track. Never calls LiveRC.
 */

import { browseEventsInDatabase, type BrowseEventsInDatabaseResult } from "./repo"
import { validateBrowseEventsParams } from "./validate"

export const BROWSE_DEFAULT_PAGE_SIZE = 50
export const BROWSE_MAX_PAGE_SIZE = 100

export interface BrowseEventsInput {
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
  /** When true (Search LiveRC off), only laps_full events are returned. */
  databaseOnly?: boolean
}

export type BrowseEventsResult = BrowseEventsInDatabaseResult

export function clampBrowsePageSize(pageSize: number | undefined): number {
  if (pageSize === undefined || Number.isNaN(pageSize)) {
    return BROWSE_DEFAULT_PAGE_SIZE
  }
  return Math.min(Math.max(Math.trunc(pageSize), 1), BROWSE_MAX_PAGE_SIZE)
}

export function clampBrowsePage(page: number | undefined): number {
  if (page === undefined || Number.isNaN(page) || page < 1) {
    return 1
  }
  return Math.trunc(page)
}

/**
 * Browse events across all tracks with server-side pagination.
 */
export async function browseEvents(input: BrowseEventsInput): Promise<BrowseEventsResult> {
  const validationError = validateBrowseEventsParams(input.startDate || null, input.endDate || null)

  if (validationError) {
    throw validationError
  }

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

  const page = clampBrowsePage(input.page)
  const pageSize = clampBrowsePageSize(input.pageSize)

  return browseEventsInDatabase({
    startDate,
    endDate,
    page,
    pageSize,
    databaseOnly: input.databaseOnly ?? true,
  })
}
