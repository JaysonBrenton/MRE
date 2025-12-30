/**
 * @fileoverview Get sessions data - processes race data for sessions/heats visualization
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Processes EventAnalysisData to prepare session/heats data for visualization
 * 
 * @purpose Provides structured data for sessions/heats charts and tables.
 *          Filters by selected drivers, sorts by race label, and calculates metrics.
 * 
 * @relatedFiles
 * - src/core/events/get-event-analysis-data.ts (data source)
 * - src/components/event-analysis/SessionsTab.tsx (consumer)
 */

import type { EventAnalysisData } from "./get-event-analysis-data"

export interface SessionData {
  id: string
  raceId: string
  className: string
  raceLabel: string
  raceOrder: number | null
  startTime: Date | null
  durationSeconds: number | null
  participantCount: number
  topFinishers: Array<{
    driverId: string
    driverName: string
    position: number
    lapsCompleted: number
    totalTimeSeconds: number | null
    fastLapTime: number | null
  }>
  results: Array<{
    raceResultId: string
    raceDriverId: string
    driverId: string
    driverName: string
    positionFinal: number
    lapsCompleted: number
    totalTimeSeconds: number | null
    fastLapTime: number | null
    avgLapTime: number | null
    consistency: number | null
  }>
}

export interface SessionsData {
  sessions: SessionData[]
  availableClasses: string[]
  totalSessions: number
  dateRange: {
    earliest: Date | null
    latest: Date | null
  }
}

export interface DriverLapTrend {
  driverId: string
  driverName: string
  sessions: Array<{
    sessionId: string
    raceLabel: string
    bestLapTime: number | null
    avgLapTime: number | null
    position: number
  }>
}

export interface HeatProgressionData {
  className: string
  stages: Array<{
    stage: string // "qualifying" | "heat" | "final"
    sessions: SessionData[]
  }>
}

/**
 * Calculate session metrics from race data
 */
function calculateSessionMetrics(
  race: EventAnalysisData["races"][0]
): SessionData {
  const participantCount = race.results.length
  const topFinishers = race.results
    .slice(0, 5)
    .map((result) => ({
      driverId: result.driverId,
      driverName: result.driverName,
      position: result.positionFinal,
      lapsCompleted: result.lapsCompleted,
      totalTimeSeconds: result.totalTimeSeconds,
      fastLapTime: result.fastLapTime,
    }))

  return {
    id: race.id,
    raceId: race.id,
    className: race.className,
    raceLabel: race.raceLabel,
    raceOrder: race.raceOrder,
    startTime: race.startTime,
    durationSeconds: race.durationSeconds,
    participantCount,
    topFinishers,
    results: race.results.map((result) => ({
      raceResultId: result.raceResultId,
      raceDriverId: result.raceDriverId,
      driverId: result.driverId,
      driverName: result.driverName,
      positionFinal: result.positionFinal,
      lapsCompleted: result.lapsCompleted,
      totalTimeSeconds: result.totalTimeSeconds,
      fastLapTime: result.fastLapTime,
      avgLapTime: result.avgLapTime,
      consistency: result.consistency,
    })),
  }
}

/**
 * Filter sessions by selected drivers
 */
function filterSessionsByDrivers(
  sessions: SessionData[],
  selectedDriverIds: string[]
): SessionData[] {
  if (selectedDriverIds.length === 0) {
    return sessions
  }

  return sessions.filter((session) =>
    session.results.some((result) =>
      selectedDriverIds.includes(result.driverId)
    )
  )
}

/**
 * Sort sessions by race label (ascending)
 */
function sortSessionsByLabel(sessions: SessionData[]): SessionData[] {
  return [...sessions].sort((a, b) => {
    const labelA = a.raceLabel || ""
    const labelB = b.raceLabel || ""
    return labelA.localeCompare(labelB, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  })
}

/**
 * Get unique classes from sessions
 */
function getAvailableClasses(sessions: SessionData[]): string[] {
  const classes = new Set<string>()
  sessions.forEach((session) => {
    classes.add(session.className)
  })
  return Array.from(classes).sort()
}

/**
 * Filter sessions by class
 */
function filterSessionsByClass(
  sessions: SessionData[],
  className: string | null
): SessionData[] {
  if (className === null) {
    return sessions
  }
  return sessions.filter((session) => session.className === className)
}

/**
 * Get sessions data from event analysis data
 */
export function getSessionsData(
  data: EventAnalysisData,
  selectedDriverIds: string[] = [],
  selectedClass: string | null = null
): SessionsData {
  // Calculate session metrics
  let sessions = data.races.map(calculateSessionMetrics)

  // Filter by selected drivers
  sessions = filterSessionsByDrivers(sessions, selectedDriverIds)

  // Filter by class
  sessions = filterSessionsByClass(sessions, selectedClass)

  // Sort by race label
  sessions = sortSessionsByLabel(sessions)

  // Get available classes (from all sessions, not filtered)
  const allSessions = data.races.map(calculateSessionMetrics)
  const availableClasses = getAvailableClasses(allSessions)

  // Calculate date range
  const dates = sessions
    .map((s) => s.startTime)
    .filter((d): d is Date => d !== null)
  const earliest = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null
  const latest = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null

  return {
    sessions,
    availableClasses,
    totalSessions: sessions.length,
    dateRange: {
      earliest,
      latest,
    },
  }
}

/**
 * Get driver lap time trends across sessions
 */
export function getDriverLapTrends(
  data: EventAnalysisData,
  driverIds: string[]
): DriverLapTrend[] {
  if (driverIds.length === 0) {
    return []
  }

  const driverMap = new Map<
    string,
    {
      driverId: string
      driverName: string
      sessions: DriverLapTrend["sessions"]
    }
  >()

  // Initialize driver map
  driverIds.forEach((driverId) => {
    const driver = data.drivers.find((d) => d.driverId === driverId)
    if (driver) {
      driverMap.set(driverId, {
        driverId,
        driverName: driver.driverName,
        sessions: [],
      })
    }
  })

  // Process each race
  data.races.forEach((race) => {
    race.results.forEach((result) => {
      if (driverIds.includes(result.driverId)) {
        const driverData = driverMap.get(result.driverId)
        if (driverData) {
          driverData.sessions.push({
            sessionId: race.id,
            raceLabel: race.raceLabel,
            bestLapTime: result.fastLapTime,
            avgLapTime: result.avgLapTime,
            position: result.positionFinal,
          })
        }
      }
    })
  })

  // Sort sessions by race label for each driver
  driverMap.forEach((driverData) => {
    driverData.sessions.sort((a, b) => {
      return a.raceLabel.localeCompare(b.raceLabel, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    })
  })

  return Array.from(driverMap.values())
}

/**
 * Build heat progression structure
 */
export function buildHeatProgression(
  data: EventAnalysisData
): HeatProgressionData[] {
  const classMap = new Map<string, SessionData[]>()

  // Group sessions by class
  data.races.forEach((race) => {
    const session = calculateSessionMetrics(race)
    if (!classMap.has(session.className)) {
      classMap.set(session.className, [])
    }
    classMap.get(session.className)!.push(session)
  })

  // Build progression for each class
  const progressions: HeatProgressionData[] = []

  classMap.forEach((sessions, className) => {
    // Sort by race order or label
    const sorted = [...sessions].sort((a, b) => {
      if (a.raceOrder !== null && b.raceOrder !== null) {
        return a.raceOrder - b.raceOrder
      }
      return a.raceLabel.localeCompare(b.raceLabel, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    })

    // Infer stage from race label
    const stages = new Map<string, SessionData[]>()
    
    sorted.forEach((session) => {
      const label = session.raceLabel.toLowerCase()
      let stage = "heat"
      
      if (label.includes("qualif") || label.includes("qual")) {
        stage = "qualifying"
      } else if (label.includes("final")) {
        stage = "final"
      } else if (label.includes("heat")) {
        stage = "heat"
      }

      if (!stages.has(stage)) {
        stages.set(stage, [])
      }
      stages.get(stage)!.push(session)
    })

    progressions.push({
      className,
      stages: Array.from(stages.entries()).map(([stage, sessions]) => ({
        stage,
        sessions,
      })),
    })
  })

  return progressions
}

