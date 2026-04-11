/**
 * Session Analysis helpers: `effectiveSessionAnalysisScopeKey` / `getSessionAnalysisClassKeys` remain
 * taxonomy-aware for other callers. The Overview Session Analysis UI uses LiveRC entry-list class
 * names (`race.className`) plus `raceMatchesLiveRcClassAndSkill` / `getSkillTierOptionsForLiveRcClassName`
 * when `eventHasVehicleDenormalization` is true so chips match the non-vehicle path.
 */

import { formatClassName, isPlaceholderClass } from "@/lib/format-class-name"
import type { EventAnalysisData } from "./get-event-analysis-data"

export const UNCLASSIFIED_VEHICLE_KEY = "__unclassified__"

/** Same sentinel when `className` is missing; distinct export name for session class chips. */
export const UNCLASSIFIED_CLASS_KEY = UNCLASSIFIED_VEHICLE_KEY

export type RaceAnalysisRow = EventAnalysisData["races"][number]

/** True once ingestion has populated at least one race with vehicle / ERC link, or the user mapped a car taxonomy. */
export function eventHasVehicleDenormalization(data: EventAnalysisData): boolean {
  return data.races.some(
    (r) =>
      r.userCarTaxonomy != null ||
      (r.vehicleType != null && String(r.vehicleType).trim() !== "") ||
      (r.eventRaceClassId != null && String(r.eventRaceClassId).trim() !== "")
  )
}

/** Session Analysis scope key: user car taxonomy slug when set, else LiveRC class name chip. */
export function effectiveSessionAnalysisScopeKey(race: RaceAnalysisRow): string {
  const tax = race.userCarTaxonomy?.slug?.trim()
  if (tax) return tax
  return effectiveClassKey(race)
}

export function effectiveVehicleKey(race: RaceAnalysisRow): string {
  const tax = race.userCarTaxonomy?.slug?.trim()
  if (tax) return tax
  const vt = race.vehicleType?.trim()
  if (vt) return vt
  return UNCLASSIFIED_VEHICLE_KEY
}

/** Session Analysis chip key: trimmed `className`, or unclassified when empty / unusable. */
export function effectiveClassKey(race: RaceAnalysisRow): string {
  const cn = race.className?.trim()
  if (cn && !isPlaceholderClass(race.className)) return cn
  return UNCLASSIFIED_CLASS_KEY
}

export function classChipLabel(key: string, data?: EventAnalysisData): string {
  if (key === UNCLASSIFIED_CLASS_KEY) return "Unclassified"
  if (data) {
    for (const r of data.races) {
      if (r.userCarTaxonomy?.slug === key) {
        return r.userCarTaxonomy.pathLabel
      }
    }
  }
  return formatClassName(key)
}

export function getSessionAnalysisClassKeys(data: EventAnalysisData): string[] {
  const seen = new Set<string>()
  for (const r of data.races) {
    if (isPlaceholderClass(r.className)) continue
    seen.add(effectiveSessionAnalysisScopeKey(r))
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b))
}

export function getSkillTierOptionsForClass(data: EventAnalysisData, classKey: string): string[] {
  const tiers = new Set<string>()
  for (const r of data.races) {
    if (isPlaceholderClass(r.className)) continue
    if (effectiveSessionAnalysisScopeKey(r) !== classKey) continue
    const t = r.skillTier?.trim()
    if (t) tiers.add(t)
  }
  return Array.from(tiers).sort((a, b) => a.localeCompare(b))
}

export function raceMatchesSessionClassAndSkill(
  race: RaceAnalysisRow,
  classKey: string | null,
  skillTier: string | null
): boolean {
  if (!classKey) return false
  if (isPlaceholderClass(race.className)) return false
  if (effectiveSessionAnalysisScopeKey(race) !== classKey) return false
  if (skillTier === null || skillTier === "" || skillTier === "all") return true
  const rt = race.skillTier?.trim()
  if (!rt) return true
  return rt === skillTier
}

/** Skill tiers present on races with this LiveRC `className` (trimmed equality). */
export function getSkillTierOptionsForLiveRcClassName(
  data: EventAnalysisData,
  className: string | null
): string[] {
  if (className == null) return []
  const cn = className.trim()
  const tiers = new Set<string>()
  for (const r of data.races) {
    if (isPlaceholderClass(r.className)) continue
    if (r.className?.trim() !== cn) continue
    const t = r.skillTier?.trim()
    if (t) tiers.add(t)
  }
  return Array.from(tiers).sort((a, b) => a.localeCompare(b))
}

/**
 * Session Analysis when scoped by entry-list class name: match `race.className`, optional skill tier.
 * When `className` is null (“All Classes”), all non-placeholder races match; tier filter applies across the event.
 */
export function raceMatchesLiveRcClassAndSkill(
  race: RaceAnalysisRow,
  className: string | null,
  skillTier: string | null
): boolean {
  if (isPlaceholderClass(race.className)) return false
  if (className == null) {
    if (skillTier === null || skillTier === "" || skillTier === "all") return true
    const rt = race.skillTier?.trim()
    if (!rt) return true
    return rt === skillTier
  }
  if (race.className?.trim() !== className.trim()) return false
  if (skillTier === null || skillTier === "" || skillTier === "all") return true
  const rt = race.skillTier?.trim()
  if (!rt) return true
  return rt === skillTier
}
