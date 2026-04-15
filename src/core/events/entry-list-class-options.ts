/**
 * Class filter options for Entry List and Session Analysis nav — must match EntryList.tsx behavior.
 */

import type { EventAnalysisData } from "./get-event-analysis-data"
import { isPlaceholderClass } from "@/lib/format-class-name"

/** Unique entry `className` values, sorted like `EntryList` class dropdown (`localeCompare`). */
export function getEntryListClassOptions(
  entryList: ReadonlyArray<{ className: string }>
): string[] {
  const set = new Set<string>()
  for (const e of entryList) {
    const c = e.className?.trim()
    if (c) set.add(c)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

/**
 * Session Analysis pills: same as entry list when rows exist; otherwise distinct non-placeholder
 * `race.className` values (alphabetical) so events without ingested entries still get a nav.
 */
export function getSessionAnalysisNavClassOptions(data: EventAnalysisData): string[] {
  const fromEntries = getEntryListClassOptions(data.entryList)
  if (fromEntries.length > 0) return fromEntries
  const set = new Set<string>()
  for (const r of data.races) {
    const c = r.className?.trim()
    if (!c || isPlaceholderClass(r.className)) continue
    set.add(c)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}
