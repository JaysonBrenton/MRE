export interface EventAnalysisSummary {
  event: {
    id: string
    eventName: string
    eventDate: string
    trackName: string
  }
  summary: {
    totalRaces: number
    totalDrivers: number
    totalLaps: number
    dateRange: {
      earliest: string | null
      latest: string | null
    }
  }
  topDrivers?: Array<{
    driverId: string
    driverName: string
    fastestLapTime: number
    raceLabel: string
    className: string
    raceId: string
  }>
  mostConsistentDrivers?: Array<{
    driverId: string
    driverName: string
    consistency: number
    raceLabel: string
    className: string
    raceId: string
  }>
  bestAvgLapDrivers?: Array<{
    driverId: string
    driverName: string
    avgLapTime: number
    raceLabel: string
    className: string
    raceId: string
  }>
  userBestLap?: {
    lapTime: number
    position: number // position among all drivers (1-based)
    gapToFastest: number // seconds behind fastest driver
  }
  userBestConsistency?: {
    consistency: number
    position: number // position among all drivers (1-based)
    gapToBest: number // consistency points behind best driver
  }
  userBestAvgLap?: {
    avgLapTime: number
    position: number // position among all drivers (1-based)
    gapToBest: number // seconds behind best average lap time
  }
}

export interface ImportedEventSummary {
  id: string
  eventName: string
  eventDate: string | null
  track: {
    trackName: string
  }
}

export type DensityPreference = "compact" | "comfortable" | "spacious"
