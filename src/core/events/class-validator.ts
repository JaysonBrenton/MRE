/**
 * @fileoverview Race class utilities
 *
 * @created 2025-01-29
 * @creator Auto-generated
 * @lastModified 2025-01-29
 *
 * @description Utilities for extracting race classes from event data.
 *
 * @purpose Extracts race classes from EventEntry records. All race classes
 *          from the entry list are considered valid (no validation filtering).
 *
 * @relatedFiles
 * - src/core/events/get-event-analysis-data.ts (uses this)
 * - src/components/event-analysis/ChartControls.tsx (uses this)
 * - docs/domain/racing-classes.md (domain model reference)
 */

import type { EventAnalysisData } from "./get-event-analysis-data"
import { isClassExcludedFromBumpUps } from "./bump-up-class-eligibility"
import { raceMightBeBumpUpLadderRace } from "./infer-bump-ups"

/**
 * Extracts race classes from EventAnalysisData.
 *
 * Uses EventEntry.className as the source (race classes from entry list).
 * All race classes are included - no validation filtering.
 *
 * @param data - The event analysis data containing races and entry list
 * @returns Sorted array of unique race class names
 *
 * @example
 * const classes = getValidClasses(eventData)
 * // Returns: ["40+ Electric Buggy", "Pro Electric Buggy", "Spt. Nitro Truck"]
 */
export function getValidClasses(data: EventAnalysisData): string[] {
  const classes = new Set<string>()

  if (data.entryList.length > 0) {
    // Use EventEntry.className (race classes from entry list)
    data.entryList.forEach((entry) => {
      if (entry.className?.trim()) {
        classes.add(entry.className.trim())
      }
    })
  } else {
    // Practice days have no entry list; derive from Race.className
    data.races.forEach((race) => {
      if (race.className?.trim()) {
        classes.add(race.className.trim())
      }
    })
  }

  return Array.from(classes).sort()
}

/**
 * Unique `race.className` values from ingested races (sorted).
 * Use for filters that must align with session rows (e.g. bump-ups), where entry-list class
 * strings may differ or include noise.
 */
export function getRaceClassNamesFromRaces(data: EventAnalysisData): string[] {
  const classes = new Set<string>()
  data.races.forEach((race) => {
    const cn = race.className?.trim()
    if (cn) classes.add(cn)
  })
  return Array.from(classes).sort()
}

/**
 * Class names for Bump-Up chips: only `race.className` values that appear on at least one
 * mains-ladder row (main / LCQ / semi). Omits classes that only exist on practice/qualifier
 * rows — e.g. a short "Buggy" label on practice while mains use "1/8 Nitro Buggy".
 */
export function getRaceClassNamesForBumpUpChips(data: EventAnalysisData): string[] {
  const classes = new Set<string>()
  for (const race of data.races) {
    const cn = race.className?.trim()
    if (!cn) continue
    if (!raceMightBeBumpUpLadderRace(race)) continue
    const vehicleType = data.raceClasses?.get(cn)?.vehicleType ?? null
    if (isClassExcludedFromBumpUps(cn, vehicleType)) continue
    classes.add(cn)
  }
  return Array.from(classes).sort()
}
