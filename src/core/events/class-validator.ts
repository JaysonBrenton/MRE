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
