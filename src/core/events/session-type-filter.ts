/**
 * @fileoverview Session type normalization and labels for UI filters (Session Results, etc.)
 */

import type { EventAnalysisData } from "./get-event-analysis-data"
import { isEventMainSession } from "./main-bracket-overall"

const ORDER: Record<string, number> = {
  practiceday: 0,
  practice: 1,
  seeding: 2,
  qualifying: 3,
  heat: 4,
  main: 5,
  race: 6,
}

/** Normalize for filtering (null / missing → race, matching ingestion defaults). */
export function normalizeRaceSessionType(sessionType: string | null): string {
  if (sessionType == null) return "race"
  const t = sessionType.trim()
  return t === "" ? "race" : t
}

/** Fields sufficient for main detection + raw session type bucketing. */
export type SessionTypeFilterRaceFields = Pick<
  EventAnalysisData["races"][number],
  "sessionType" | "raceLabel" | "sectionHeader" | "className"
>

/**
 * Single bucket per race for session-type filters and counts. Mains are often `sessionType` race
 * or null in LiveRC-style data; align with `isEventMainSession` so “Main” appears and filters
 * correctly.
 */
export function sessionTypeFilterKeyForRace(race: SessionTypeFilterRaceFields): string {
  if (isEventMainSession(race as EventAnalysisData["races"][number])) return "main"
  return normalizeRaceSessionType(race.sessionType).toLowerCase()
}

export function sortSessionTypeFilterKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ra = ORDER[a] ?? 100
    const rb = ORDER[b] ?? 100
    if (ra !== rb) return ra - rb
    return a.localeCompare(b)
  })
}

export function sessionTypeFilterChipLabel(key: string): string {
  switch (key) {
    case "main":
      return "Main"
    case "heat":
      return "Heat"
    case "qualifying":
      return "Qualifier"
    case "practice":
      return "Practice"
    case "practiceday":
      return "Practice Day"
    case "seeding":
      return "Seeding"
    case "race":
      return "Other sessions"
    default:
      return key.charAt(0).toUpperCase() + key.slice(1)
  }
}
