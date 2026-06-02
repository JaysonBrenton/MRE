/**
 * @fileoverview Get tracks business logic
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Business logic wrapper for retrieving tracks
 *
 * @purpose Provides a clean interface for getting tracks with filtering logic.
 *          Handles default filter values and returns typed track data.
 *
 * @relatedFiles
 * - src/core/tracks/repo.ts (database access)
 */

import { getTracks as getTracksFromRepo, type GetTracksFilters, type TrackListItem } from "./repo"

/**
 * Get tracks with default filtering
 *
 * Defaults to followed=true and active=true when `catalogue` is not set.
 * Pass `{ catalogue: true }` to omit the isFollowed filter (track pickers).
 *
 * @param filters - Optional filters (followed defaults to true, active defaults to true)
 * @returns Array of track list items (id, trackName, sourceTrackSlug, country)
 */
export async function getTracks(filters: GetTracksFilters = {}): Promise<TrackListItem[]> {
  const finalFilters: GetTracksFilters = {
    active: filters.active !== undefined ? filters.active : true,
  }

  if (filters.catalogue) {
    finalFilters.catalogue = true
  } else {
    finalFilters.followed = filters.followed !== undefined ? filters.followed : true
  }

  return getTracksFromRepo(finalFilters)
}
