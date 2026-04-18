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
    if (c && !isPlaceholderClass(e.className)) set.add(c)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

function distinctRaceClassNames(data: EventAnalysisData): string[] {
  const set = new Set<string>()
  for (const r of data.races) {
    const c = r.className?.trim()
    if (!c || isPlaceholderClass(r.className)) continue
    set.add(c)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

/** Dedupe trimmed names, skip placeholders, sort for stable Session Analysis pills. */
function sortedUnionSessionTypeLabels(groups: ReadonlyArray<string>[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const group of groups) {
    for (const raw of group) {
      const t = raw.trim()
      if (!t || isPlaceholderClass(raw)) continue
      if (seen.has(t)) continue
      seen.add(t)
      out.push(t)
    }
  }
  return out.sort((a, b) => a.localeCompare(b))
}

/**
 * Session Analysis pills: LiveRC program bucket order from `programBucketOrder` when present;
 * otherwise a sorted union of entry-list and race `className` values (covers buckets missing from
 * the displayed entry list, e.g. no transponder rows, or metadata not yet stored).
 */
export function getSessionAnalysisNavClassOptions(data: EventAnalysisData): string[] {
  const order = data.programBucketOrder
  if (order?.length) {
    const seen = new Set<string>()
    const out: string[] = []
    for (const raw of order) {
      const cn = raw.trim()
      if (!cn || isPlaceholderClass(raw)) continue
      if (seen.has(cn)) continue
      seen.add(cn)
      out.push(cn)
    }
    const extras = [
      ...getEntryListClassOptions(data.entryList),
      ...distinctRaceClassNames(data),
    ].filter((c) => !seen.has(c.trim()))
    extras.sort((a, b) => a.localeCompare(b))
    for (const c of extras) {
      const t = c.trim()
      if (seen.has(t)) continue
      seen.add(t)
      out.push(c)
    }
    return out
  }

  return sortedUnionSessionTypeLabels([
    getEntryListClassOptions(data.entryList),
    distinctRaceClassNames(data),
  ])
}
