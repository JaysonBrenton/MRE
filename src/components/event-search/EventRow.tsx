/**
 * @fileoverview Event row component for event table
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Individual event row/card in the event table
 * 
 * @purpose Displays event information with status badge and "Analyse event" button.
 *          Mobile-friendly card layout that degrades from table format.
 * 
 * @relatedFiles
 * - src/components/event-search/EventTable.tsx (parent component)
 * - src/components/event-search/EventStatusBadge.tsx (status badge)
 */

"use client"

import Link from "next/link"
import EventStatusBadge, { type EventStatus } from "./EventStatusBadge"
import { formatDateDisplay } from "@/lib/date-utils"

export interface Event {
  id: string
  eventName: string
  eventDate: string | null | undefined // ISO string, may be null/undefined
  ingestDepth: string
  sourceEventId?: string // Optional: for unimported events from LiveRC
}

export interface EventRowProps {
  event: Event
  onImport?: (event: Event) => void
  isImporting?: boolean
}

function getStatusFromIngestDepth(ingestDepth: string | null | undefined, eventId?: string): EventStatus {
  // Check if this is a LiveRC-only event (ID starts with "liverc-")
  if (eventId?.startsWith("liverc-")) {
    return "new"
  }

  // Normalize ingestDepth: trim whitespace and convert to lowercase
  const normalizedDepth = ingestDepth?.trim().toLowerCase() || ""

  switch (normalizedDepth) {
    case "laps_full":
    case "lapsfull": // Handle potential variations
      return "imported"
    case "none":
    case "": // Empty or null means not imported
      return "new"
    default:
      // For any other value, check if it contains "full" or "laps" as a hint
      // This handles edge cases where API might return variations
      if (normalizedDepth.includes("full") || normalizedDepth.includes("laps")) {
        return "imported"
      }
      // Default to new for unknown values
      return "new"
  }
}

export default function EventRow({ event, onImport, isImporting = false }: EventRowProps) {
  const status = getStatusFromIngestDepth(event.ingestDepth, event.id)
  const formattedDate = formatDateDisplay(event.eventDate)
  const isImported = status === "imported"
  const needsImport = status === "new" && (event.id.startsWith("liverc-") || (event.ingestDepth?.trim().toLowerCase() === "none"))
  // Show analyse button if event is imported (isImporting only affects the import button, not analyse)
  const canAnalyse = isImported

  return (
    <div className="flex flex-col sm:grid sm:grid-cols-3 sm:items-center gap-4 px-4 py-4 border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface)] transition-colors">
      {/* Mobile: Stacked layout, Desktop: Column 1 - Event Name */}
      <div className="space-y-2 sm:space-y-0">
        <h3 className="text-[var(--token-text-primary)] font-medium">{event.eventName}</h3>
        {/* Mobile: Show date below name */}
        <p className="text-sm text-[var(--token-text-secondary)] sm:hidden">{formattedDate}</p>
      </div>

      {/* Desktop: Column 2 - Event Date */}
      <p className="hidden sm:block text-sm text-[var(--token-text-secondary)]">{formattedDate}</p>

      {/* Mobile: Status and Buttons, Desktop: Column 3 - Status and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <EventStatusBadge status={status} />
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2 sm:ml-auto">
          {/* Import Button - shown for unimported events */}
          {needsImport && onImport && (
            <button
              type="button"
              onClick={() => onImport(event)}
              disabled={isImporting}
              className="mobile-button w-full sm:w-auto flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed sm:px-5 h-11"
            >
              {isImporting ? "Importing..." : "Import"}
            </button>
          )}
          
          {/* Analyse Button - shown for imported events */}
          {canAnalyse && (
            <Link
              href={`/events/analyse/${event.id}`}
              className="mobile-button w-full sm:w-auto flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] sm:px-5 h-11"
              prefetch={false}
            >
              Analyse event
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

