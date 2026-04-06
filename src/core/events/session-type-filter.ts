/**
 * @fileoverview Session type normalization and labels for UI filters (Session Results, etc.)
 */

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
  return sessionType ?? "race"
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
      return "Practice day"
    case "seeding":
      return "Seeding"
    case "race":
      return "Race"
    default:
      return key.charAt(0).toUpperCase() + key.slice(1)
  }
}
