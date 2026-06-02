/**
 * @fileoverview Database-only suggestion logic for the Event Search omnibox.
 *
 * @description Orchestrates type-ahead suggestions across tracks and events.
 *              Reads exclusively from the MRE database (no LiveRC). Used by
 *              GET /api/v1/events/search/suggest.
 *
 * @relatedFiles
 * - src/core/events/repo.ts (Prisma queries)
 * - src/app/api/v1/events/search/suggest/route.ts (API route)
 * - docs/architecture/event-search-omnibox.md (specification)
 */

import {
  suggestTracksByText,
  suggestEventsByText,
  type TrackSuggestion,
  type EventSuggestion,
} from "./repo"

/** Minimum query length before any database lookup runs. */
export const SUGGEST_MIN_QUERY_LENGTH = 2

/** Default number of suggestions returned per group. */
export const SUGGEST_DEFAULT_LIMIT = 8

/** Hard cap on suggestions per group. */
export const SUGGEST_MAX_LIMIT = 20

export interface EventSearchSuggestions {
  query: string
  tracks: TrackSuggestion[]
  events: EventSuggestion[]
}

/**
 * Clamp a requested per-group limit into the supported range.
 */
export function clampSuggestLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return SUGGEST_DEFAULT_LIMIT
  }
  return Math.min(Math.max(Math.trunc(limit), 1), SUGGEST_MAX_LIMIT)
}

/**
 * Return grouped track + event suggestions for the Event Search omnibox.
 *
 * Short-circuits to empty groups when the trimmed query is shorter than
 * {@link SUGGEST_MIN_QUERY_LENGTH}. Never performs network/LiveRC access.
 */
export async function suggestEventSearch(
  rawQuery: string,
  rawLimit?: number
): Promise<EventSearchSuggestions> {
  const query = rawQuery.trim()
  const limit = clampSuggestLimit(rawLimit)

  if (query.length < SUGGEST_MIN_QUERY_LENGTH) {
    return { query, tracks: [], events: [] }
  }

  const [tracks, events] = await Promise.all([
    suggestTracksByText(query, limit),
    suggestEventsByText(query, limit),
  ])

  return { query, tracks, events }
}
