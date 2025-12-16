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

import { getTracks as getTracksFromRepo, type GetTracksFilters } from "./repo"
import type { Track } from "@prisma/client"

/**
 * Get tracks with default filtering
 * 
 * Defaults to followed=true and active=true if not specified.
 * 
 * @param filters - Optional filters (followed defaults to true, active defaults to true)
 * @returns Array of Track objects
 */
export async function getTracks(filters: GetTracksFilters = {}): Promise<Track[]> {
  // Default to followed=true and active=true if not specified
  const finalFilters: GetTracksFilters = {
    followed: filters.followed !== undefined ? filters.followed : true,
    active: filters.active !== undefined ? filters.active : true,
  }

  return getTracksFromRepo(finalFilters)
}

