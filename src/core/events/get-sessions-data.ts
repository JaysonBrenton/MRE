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
import { getValidClasses } from "./class-validator"

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
 * Calculate race duration from race results when not available in database
 * Uses the maximum totalTimeSeconds from all participants (slowest finisher)
 * @param results - Race results with totalTimeSeconds
 * @returns Duration in seconds or null if no valid times available
 */
function calculateDurationFromResults(
  results: Array<{ totalTimeSeconds: number | null }>
): number | null {
  const validTimes = results
    .map((r) => r.totalTimeSeconds)
    .filter((t): t is number => t !== null && t > 0)

  if (validTimes.length === 0) {
    return null
  }

  // Use maximum time (slowest finisher) as race duration
  return Math.max(...validTimes)
}

function buildDriverNameLookup(data: EventAnalysisData): Record<string, string> {
  const lookup: Record<string, string> = {}

  data.drivers.forEach((driver) => {
    const name = driver.driverName?.trim()
    if (name) {
      lookup[driver.driverId] = name
    }
  })

  data.entryList.forEach((entry) => {
    const name = entry.driverName?.trim()
    if (name && !lookup[entry.driverId]) {
      lookup[entry.driverId] = name
    }
  })

  data.races.forEach((race) => {
    race.results.forEach((result) => {
      const name = result.driverName?.trim()
      if (name && !lookup[result.driverId]) {
        lookup[result.driverId] = name
      }
    })
  })

  return lookup
}

/**
 * Fix malformed duplicated driver names
 * Pattern: "LASTNAME, FIRSTNAMEFIRSTNAME LASTNAME"
 * Examples: "TURNER, HARRISONHARRISON TURNER", "COOK, MICHAELMICHAEL COOK"
 */
function fixMalformedDriverName(name: string): string {
  // Try multiple patterns to catch different malformed formats
  // Pattern 1: "LASTNAME, FIRSTNAMEFIRSTNAME LASTNAME"
  const pattern1 = /^([A-Z][A-Z\s,]+?),\s*([A-Z]+)\2\s+\1$/
  let match = name.match(pattern1)
  if (match && match[1] && match[2]) {
    const fixed = `${match[1]}, ${match[2]}`
    console.warn("[fixMalformedDriverName] Fixed malformed driver name (pattern1):", {
      original: name,
      fixed: fixed,
    })
    return fixed
  }

  // Pattern 2: Check if first name is duplicated (e.g., "HARRISONHARRISON")
  const pattern2 = /^([A-Z][A-Z\s,]+?),\s*([A-Z]+)\2/
  match = name.match(pattern2)
  if (match && match[1] && match[2]) {
    const fixed = `${match[1]}, ${match[2]}`
    console.warn("[fixMalformedDriverName] Fixed malformed driver name (pattern2):", {
      original: name,
      fixed: fixed,
    })
    return fixed
  }

  return name
}

/**
 * Resolve driver name with fallback (legacy function - prefer using race data directly)
 */
function resolveDriverName(
  raceResultName: string | null | undefined,
  fallbackName: string | undefined
): string {
  // Check primary name first
  const primary = raceResultName?.trim()
  if (primary && primary.length > 0) {
    return fixMalformedDriverName(primary)
  }

  // Use fallback if primary is empty
  const fallback = fallbackName?.trim()
  if (fallback && fallback.length > 0) {
    return fixMalformedDriverName(fallback)
  }

  return "Unknown Driver"
}

function calculateSessionMetrics(
  race: EventAnalysisData["races"][0],
  driverNameLookup: Record<string, string>
): SessionData {
  const participantCount = race.results.length
  const topFinishers = race.results.slice(0, 5).map((result) => ({
    driverId: result.driverId,
    driverName: resolveDriverName(result.driverName, driverNameLookup[result.driverId]),
    position: result.positionFinal,
    lapsCompleted: result.lapsCompleted,
    totalTimeSeconds: result.totalTimeSeconds,
    fastLapTime: result.fastLapTime,
  }))

  // Calculate duration: use database value if available, otherwise calculate from results
  const durationSeconds = race.durationSeconds ?? calculateDurationFromResults(race.results)

  return {
    id: race.id,
    raceId: race.id,
    className: race.className,
    raceLabel: race.raceLabel,
    raceOrder: race.raceOrder,
    startTime: race.startTime,
    durationSeconds,
    participantCount,
    topFinishers,
    results: race.results.map((result, index) => {
      // CRITICAL: Use the actual race data driverName FIRST, not the fuzzy-matched lookup
      // The race data has the correct name from the database
      // Only use lookup as a last resort if race data is truly missing
      let driverName: string

      // Priority 1: Use driverName directly from race result (actual race data)
      if (
        result.driverName &&
        typeof result.driverName === "string" &&
        result.driverName.trim().length > 0
      ) {
        driverName = result.driverName.trim()
      } else {
        // Priority 2: Only if race data is missing, try lookup (but this may have fuzzy-matched malformed names)
        const lookupName = driverNameLookup[result.driverId]
        if (lookupName && typeof lookupName === "string" && lookupName.trim().length > 0) {
          driverName = lookupName.trim()
          console.warn("[getSessionsData] Using lookup name instead of race data:", {
            raceId: race.raceId,
            raceLabel: race.raceLabel,
            resultIndex: index,
            raceResultId: result.raceResultId,
            driverId: result.driverId,
            raceDataDriverName: result.driverName,
            lookupDriverName: lookupName,
          })
        } else {
          // Priority 3: Last resort fallback
          driverName = "Unknown Driver"
          console.warn("[getSessionsData] No driver name found in race data or lookup:", {
            raceId: race.raceId,
            raceLabel: race.raceLabel,
            resultIndex: index,
            raceResultId: result.raceResultId,
            driverId: result.driverId,
            raceDataDriverName: result.driverName,
            lookupDriverName: lookupName,
          })
        }
      }

      // Fix any malformed names (duplicated patterns)
      const fixedName = fixMalformedDriverName(driverName)
      if (fixedName !== driverName) {
        console.warn("[getSessionsData] Fixed malformed driver name:", {
          original: driverName,
          fixed: fixedName,
          raceId: race.raceId,
          raceLabel: race.raceLabel,
        })
        driverName = fixedName
      }

      const resultObj = {
        raceResultId: result.raceResultId,
        raceDriverId: result.raceDriverId,
        driverId: result.driverId,
        driverName: driverName,
        positionFinal: result.positionFinal,
        lapsCompleted: result.lapsCompleted,
        totalTimeSeconds: result.totalTimeSeconds,
        fastLapTime: result.fastLapTime,
        avgLapTime: result.avgLapTime,
        consistency: result.consistency,
      }

      // Log first result for verification
      if (index === 0) {
        console.log("[getSessionsData] First result object:", {
          raceId: race.raceId,
          raceLabel: race.raceLabel,
          result: resultObj,
          hasDriverName: "driverName" in resultObj,
          driverNameValue: resultObj.driverName,
          driverNameType: typeof resultObj.driverName,
        })
      }

      return resultObj
    }),
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
    session.results.some((result) => selectedDriverIds.includes(result.driverId))
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
function filterSessionsByClass(sessions: SessionData[], className: string | null): SessionData[] {
  if (className === null) {
    return []
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
  const driverNameLookup = buildDriverNameLookup(data)
  // Calculate session metrics
  let sessions = data.races.map((race) => calculateSessionMetrics(race, driverNameLookup))

  // Filter by selected drivers
  sessions = filterSessionsByDrivers(sessions, selectedDriverIds)

  // Filter by class
  sessions = filterSessionsByClass(sessions, selectedClass)

  // Sort by race label
  sessions = sortSessionsByLabel(sessions)

  // Get available classes (from all sessions, not filtered)
  const allSessions = data.races.map((race) => calculateSessionMetrics(race, driverNameLookup))
  const availableClasses = getAvailableClasses(allSessions)

  // Calculate date range
  const dates = sessions.map((s) => s.startTime).filter((d): d is Date => d !== null)
  const earliest = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null
  const latest = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null

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
export function getDriverLapTrends(data: EventAnalysisData, driverIds: string[]): DriverLapTrend[] {
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
export function buildHeatProgression(data: EventAnalysisData): HeatProgressionData[] {
  const driverNameLookup = buildDriverNameLookup(data)
  const classMap = new Map<string, SessionData[]>()

  // Group sessions by class
  data.races.forEach((race) => {
    const session = calculateSessionMetrics(race, driverNameLookup)
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
