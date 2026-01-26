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
  mostImprovedDrivers?: Array<{
    driverId: string
    driverName: string
    className: string
    firstRacePosition: number
    lastRacePosition: number
    positionImprovement: number
    firstRaceFastLap: number | null
    lastRaceFastLap: number | null
    lapTimeImprovement: number | null
    improvementScore: number
    firstRaceId: string
    lastRaceId: string
    raceLabel: string
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
  userBestImprovement?: {
    positionImprovement: number // e.g., improved by 5 positions
    lapTimeImprovement: number | null // seconds improved (negative = faster)
    position: number // rank among all improved drivers (1-based)
    gapToBest: number // positions behind most improved driver
    firstRacePosition: number // starting position in first race
    lastRacePosition: number // ending position in last race
    className: string // class the user competed in
    raceLabel: string // race label for context
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
