import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

/**
 * API response type for event analysis data with ISO string dates and
 * plain objects for maps. This mirrors `EventAnalysisData` but adapts
 * date and Map fields to JSON-friendly representations.
 */
export type EventAnalysisDataApiResponse = Omit<
  EventAnalysisData,
  "event" | "races" | "summary" | "raceClasses"
> & {
  isPracticeDay?: boolean
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
    venueCorrected?: boolean
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
    startTime: string | null
    durationSeconds: number | null
    /** Session type: practice, seeding, qualifying, heat, main, race, practiceday */
    sessionType?: string | null
    /** LiveRC round heading (e.g. "Qualifier Round 1", "Main Events", "Seeding Round 2") */
    sectionHeader?: string | null
    /** LiveRC race result page URL (e.g. https://rcra.liverc.com/results/?p=view_race_result&id=6580435) */
    raceUrl: string
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
}
