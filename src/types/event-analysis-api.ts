import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import type { LiveRcRaceResultStats } from "@/core/events/live-rc-race-result-stats"

/**
 * API response type for event analysis data with ISO string dates and
 * plain objects for maps. This mirrors `EventAnalysisData` but adapts
 * date and Map fields to JSON-friendly representations.
 */
export type EventAnalysisDataApiResponse = Omit<
  EventAnalysisData,
  "event" | "races" | "summary" | "raceClasses" | "userHostTrack"
> & {
  isPracticeDay?: boolean
  /** Distinct raw registration class names from `event_entries` (see `EventAnalysisData`). */
  registrationClassNames?: string[]
  event: {
    id: string
    trackId: string
    eventName: string
    eventDate: string
    eventDateEnd?: string | null
    trackName: string
    trackDashboardUrl?: string | null
    eventUrl?: string
    website?: string | null
    facebookUrl?: string | null
    address?: string | null
    phone?: string | null
    email?: string | null
    /** LiveRC source event id (e.g. "491882") for entry list fetch; only set for LiveRC events */
    sourceEventId?: string
    /** LiveRC track slug (e.g. "rcra") for entry list URL; only set when track has source */
    trackSlug?: string
  }
  races: Array<{
    id: string
    raceId: string
    className: string
    raceLabel: string
    raceOrder: number | null
    /** LiveRC event list Time Completed (when known). */
    completedAt?: string | null
    startTime: string | null
    durationSeconds: number | null
    /** Session type: practice, seeding, qualifying, heat, main, race, practiceday */
    sessionType?: string | null
    /** LiveRC round heading (e.g. "Qualifier Round 1", "Main Events", "Seeding Round 2") */
    sectionHeader?: string | null
    /** LiveRC race result page URL (e.g. https://rcra.liverc.com/results/?p=view_race_result&id=6580435) */
    raceUrl: string
    /** Denormalized from ingestion (Session Analysis vehicle-first chips). */
    vehicleType?: string | null
    /** User-global taxonomy mapping (per-user; not shared). */
    userCarTaxonomy?: {
      taxonomyNodeId: string
      slug: string
      pathLabels: string[]
      pathLabel: string
    }
    skillTier?: string | null
    vehicleClassNormalizationNeedsReview?: boolean
    eventRaceClassId?: string | null
    results: Array<{
      raceResultId: string
      raceDriverId: string
      driverId: string
      driverName: string
      positionFinal: number
      lapsCompleted: number
      totalTimeSeconds: number | null
      fastLapTime: number | null
      /** Lap number (1-based) that produced fastLapTime, when lap data available. Optional for API compatibility. */
      fastLapLapNumber?: number | null
      avgLapTime: number | null
      consistency: number | null
      qualifyingPosition: number | null
      secondsBehind: number | null
      behindDisplay?: string | null
      liveRcStats: LiveRcRaceResultStats | null
    }>
  }>
  raceClasses: Record<string, { vehicleType: string | null; vehicleTypeNeedsReview: boolean }>
  summary: {
    totalRaces: number
    totalDrivers: number
    totalLaps: number
    dateRange: {
      earliest: string | null
      latest: string | null
    }
  }
  /** Per-user host track (catalogue); mirrors `EventAnalysisData.userHostTrack`. */
  userHostTrack?: EventAnalysisData["userHostTrack"]
}
