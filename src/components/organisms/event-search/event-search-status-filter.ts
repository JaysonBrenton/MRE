/**
 * @fileoverview Client-side status filters for Event Search results (Ready / Scheduled).
 */

import { isEventInFuture } from "@/lib/date-utils"

/** True when event has race/lap data imported (ingest_depth = laps_full). */
export function isEventFullyIngested(e: { id: string; ingestDepth?: string }): boolean {
  if (e.id.startsWith("liverc-")) return false
  const d = (e.ingestDepth ?? "").trim().toLowerCase()
  return d === "laps_full" || d === "lapsfull"
}

export interface EventSearchStatusFilterOptions {
  includeReady: boolean
  includeScheduled: boolean
}

/**
 * Whether an event row should appear given Ready / Scheduled inclusion toggles.
 * Scheduled (future date) takes precedence over Ready, matching EventRow badge logic.
 */
export function eventMatchesStatusFilters(
  event: { id: string; ingestDepth?: string; eventDate?: string | null },
  opts: EventSearchStatusFilterOptions
): boolean {
  if (isEventInFuture(event.eventDate)) {
    return opts.includeScheduled
  }
  if (isEventFullyIngested(event)) {
    return opts.includeReady
  }
  return true
}

export function applyEventStatusFilters<
  T extends { id: string; ingestDepth?: string; eventDate?: string | null },
>(events: T[], opts: EventSearchStatusFilterOptions): T[] {
  if (opts.includeReady && opts.includeScheduled) {
    return events
  }
  return events.filter((e) => eventMatchesStatusFilters(e, opts))
}
