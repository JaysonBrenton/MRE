/**
 * @fileoverview Event row component for event table
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Individual event row/card in the event table
 * 
 * @purpose Displays event information with action buttons (Import, Select, Retry).
 *          Desktop-optimized table row layout.
 * 
 * @relatedFiles
 * - src/components/event-search/EventTable.tsx (parent component)
 */

"use client"

import { useRouter } from "next/navigation"
import EventStatusBadge, { type EventStatus } from "./EventStatusBadge"
import { formatDateDisplay, isEventInFuture } from "@/lib/date-utils"

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
  statusOverride?: EventStatus
  errorMessage?: string // Optional error message for failed imports
  containsDriver?: boolean // Whether the driver name was found in the entry list
  importProgress?: { stage?: string; counts?: { races: number; results: number; laps: number } } // Progress information for ongoing imports
  onSelectForDashboard?: (eventId: string) => void // Callback for selecting an event for dashboard context
}

function getStatusFromIngestDepth(
  ingestDepth: string | null | undefined, 
  eventId?: string,
  eventDate?: string | null | undefined
): EventStatus {
  // Check if event is in the future - if so, it's scheduled
  if (isEventInFuture(eventDate)) {
    return "scheduled"
  }

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

export default function EventRow({ 
  event, 
  onImport, 
  statusOverride,
  errorMessage,
  containsDriver = false,
  importProgress,
  onSelectForDashboard,
}: EventRowProps) {
  const router = useRouter()
  const derivedStatus = getStatusFromIngestDepth(event.ingestDepth, event.id, event.eventDate)
  
  // Check if event is scheduled (future) - this takes precedence over status override
  // Scheduled events should always show as "scheduled" regardless of other status
  const isScheduledEvent = isEventInFuture(event.eventDate)
  const status = isScheduledEvent ? "scheduled" : (statusOverride ?? derivedStatus)
  
  const formattedDate = formatDateDisplay(event.eventDate)
  const isLiveRCOnly = event.id.startsWith("liverc-")
  const isImported = status === "imported" || status === "stored"
  const isScheduled = status === "scheduled"
  const needsImport = status === "new" && !isLiveRCOnly
  const isImporting = status === "importing"
  const hasFailed = status === "failed"
  const isImportable = status === "new" && !isScheduled // Future events are not importable
  const canSelect = isImported && !isLiveRCOnly // Show Select button for all imported events

  const handleImport = () => {
    if (onImport && !isImporting) {
      onImport(event)
    }
  }

  const handleRetry = () => {
    if (onImport && !isImporting) {
      onImport(event)
    }
  }

  const handleSelect = () => {
    // If callback is provided (modal context), use it
    if (onSelectForDashboard) {
      onSelectForDashboard(event.id)
    } else {
      // Otherwise, navigate to dashboard directly
      if (typeof window !== "undefined") {
        sessionStorage.setItem("mre-selected-event-id", event.id)
        router.push(`/dashboard?eventId=${event.id}`)
      }
    }
  }

  // Calculate progress percentage for importing status
  // Progress is estimated based on typical ingestion stages:
  // - Fetching event data: 0-20%
  // - Importing races: 20-50%
  // - Importing results: 50-80%
  // - Importing laps: 80-100%
  const calculateProgress = (): number | undefined => {
    if (!isImporting || !importProgress) {
      return undefined
    }

    const { stage, counts } = importProgress

    // Stage-based progress estimation
    if (stage) {
      const stageLower = stage.toLowerCase()
      if (stageLower.includes("connecting") || stageLower.includes("starting")) {
        return 5
      } else if (stageLower.includes("fetching")) {
        return 15
      } else if (stageLower.includes("race")) {
        return 35
      } else if (stageLower.includes("result")) {
        return 65
      } else if (stageLower.includes("lap")) {
        return 85
      } else if (stageLower.includes("importing")) {
        return 50 // Generic importing stage
      }
    }

    // Default progress for importing status without specific stage info
    return isImporting ? 25 : undefined
  }

  const progress = calculateProgress()

  return (
    <div 
      className="grid grid-cols-[2.5fr_1fr_1fr_1.5fr] items-center gap-4 px-4 py-4 border-b transition-colors duration-200 border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)]"
    >
      {/* Column 1 - Event Name */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-[var(--token-text-primary)] font-medium">{event.eventName}</h3>
        {containsDriver && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-[var(--token-status-success-bg)] px-2 py-1 text-xs font-medium text-[var(--token-status-success-text)]"
            title="You participated in this event"
            aria-label="You participated in this event"
          >
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            You participated
          </span>
        )}
        {errorMessage && (
          <span
            className="text-xs text-[var(--token-status-error-text)]"
            title={errorMessage}
            aria-label={`Error: ${errorMessage}`}
          >
            ⚠️
          </span>
        )}
      </div>

      {/* Column 2 - Event Status */}
      <div className="flex flex-col items-center gap-1">
        <EventStatusBadge status={status} progress={progress} stage={importProgress?.stage} />
      </div>

      {/* Column 3 - Event Date */}
      <p className="text-sm text-[var(--token-text-secondary)] text-center">{formattedDate}</p>

      {/* Column 4 - Actions */}
      <div className="flex items-center justify-center gap-4">
        {/* Action Buttons */}
        <div className="flex gap-2">
          {/* Import Button - shown for importable events */}
          {isImportable && onImport && (
            <button
              type="button"
              onClick={handleImport}
              disabled={isImporting}
              className="flex items-center justify-center rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)]/10 px-5 text-sm font-medium text-[var(--token-accent)] transition-colors hover:bg-[var(--token-accent)]/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed h-11"
              aria-label={`Import ${event.eventName}`}
            >
              Import
            </button>
          )}
          
          {/* Retry Button - shown for failed imports */}
          {hasFailed && onImport && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={isImporting}
              className="flex items-center justify-center rounded-md border border-[var(--token-status-error-text)] bg-[var(--token-status-error-bg)] px-5 text-sm font-medium text-[var(--token-status-error-text)] transition-colors hover:bg-[var(--token-status-error-bg)] hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed h-11"
              aria-label={`Retry import for ${event.eventName}`}
            >
              Retry
            </button>
          )}
          
          {/* Select Button - shown for imported events */}
          {canSelect && (
            <button
              type="button"
              onClick={handleSelect}
              className="flex items-center justify-center rounded-md border border-[var(--token-status-success-text)] bg-[var(--token-status-success-text)]/10 px-5 text-sm font-medium text-[var(--token-status-success-text)] transition-colors hover:bg-[var(--token-status-success-text)]/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] h-11"
              aria-label={`Select ${event.eventName} for dashboard`}
            >
              Select
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
