/**
 * @fileoverview Client fetch for the active tracks catalogue (event search, track pickers).
 */

import { parseApiResponse } from "@/lib/api-response-helper"

export type TracksCatalogTrack = {
  id: string
  trackName: string
  sourceTrackSlug: string
  country?: string
}

interface ApiTrack {
  id: string
  trackName: string
  sourceTrackSlug: string
  country?: string | null
}

export async function fetchActiveTracksCatalog(): Promise<
  { success: true; tracks: TracksCatalogTrack[] } | { success: false; errorMessage: string }
> {
  try {
    const response = await fetch("/api/v1/tracks?followed=false&active=true", {
      cache: "no-store",
    })
    const result = await parseApiResponse<{ tracks: ApiTrack[] }>(response)
    if (!result.success) {
      return {
        success: false,
        errorMessage: result.error.message,
      }
    }
    const tracks = result.data.tracks.map((track) => ({
      id: track.id,
      trackName: track.trackName,
      sourceTrackSlug: track.sourceTrackSlug,
      country: track.country ?? undefined,
    }))
    return { success: true, tracks }
  } catch {
    return { success: false, errorMessage: "Unable to load tracks. Please try again." }
  }
}
