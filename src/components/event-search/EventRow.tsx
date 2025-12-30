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
 *          Desktop-optimized table row layout.
 * 
 * @relatedFiles
 * - src/components/event-search/EventTable.tsx (parent component)
 * - src/components/event-search/EventStatusBadge.tsx (status badge)
 */

"use client"

import { useRouter } from "next/navigation"
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
  statusOverride?: EventStatus
  isSelected?: boolean
  onSelect?: (event: Event, selected: boolean) => void
  isBulkImporting?: boolean
  errorMessage?: string // Optional error message for failed imports
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

export default function EventRow({ 
  event, 
  onImport, 
  statusOverride,
  isSelected = false,
  onSelect,
  isBulkImporting = false,
  errorMessage,
}: EventRowProps) {
  const router = useRouter()
  const derivedStatus = getStatusFromIngestDepth(event.ingestDepth, event.id)
  const status = statusOverride ?? derivedStatus
  const formattedDate = formatDateDisplay(event.eventDate)
  const isLiveRCOnly = event.id.startsWith("liverc-")
  const isImported = status === "imported" || status === "stored"
  const needsImport = status === "new" && !isLiveRCOnly
  const isImporting = status === "importing"
  const hasFailed = status === "failed"
  const canSelect = isImported
  const isImportable = status === "new"
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSelect && !isBulkImporting && !isImporting) {
      onSelect(event, e.target.checked)
    }
  }

  const handleSelect = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("mre-selected-event-id", event.id)
      router.push(`/events/analyse/${event.id}`)
    }
  }

  const handleRetry = () => {
    if (onImport && !isImporting) {
      onImport(event)
    }
  }

  return (
    <div 
      className={`grid grid-cols-4 items-center gap-4 px-4 py-4 border-b transition-colors duration-200 ${
        isSelected 
          ? "bg-[var(--token-surface-elevated)] border-2 border-[var(--token-accent)]" 
          : "border-[var(--token-border-default)] hover:bg-[var(--token-surface)]"
      }`}
    >
      {/* Mobile: Stacked layout, Desktop: Column 1 - Checkbox */}
      {isImportable && (
        <div className="flex items-center justify-center">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleCheckboxChange}
              disabled={isBulkImporting || isImporting}
              className="w-5 h-5 rounded border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-accent)] focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Select ${event.eventName} for import`}
            />
          </label>
        </div>
      )}
      {!isImportable && <div />}

      {/* Column 2 - Event Name */}
      <div>
        <h3 className="text-[var(--token-text-primary)] font-medium">{event.eventName}</h3>
      </div>

      {/* Column 3 - Event Date */}
      <p className="text-sm text-[var(--token-text-secondary)]">{formattedDate}</p>

      {/* Column 4 - Status and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <EventStatusBadge status={status} />
            {/* Import Progress Indicator */}
            {isImporting && (
              <div className="flex items-center gap-2" role="status" aria-live="polite">
                <svg className="h-4 w-4 animate-spin text-[var(--token-status-warning-text)]" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-xs text-[var(--token-text-muted)]">Importing...</span>
              </div>
            )}
          </div>
          {/* Error Message */}
          {hasFailed && errorMessage && (
            <p className="text-xs text-[var(--token-status-error-text)] mt-1" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2 ml-auto">
          {/* Retry Button - shown for failed imports */}
          {hasFailed && onImport && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={isImporting || isBulkImporting}
              className="flex items-center justify-center rounded-md border border-[var(--token-status-error-text)] bg-[var(--token-status-error-bg)] px-5 text-sm font-medium text-[var(--token-status-error-text)] transition-colors hover:bg-[var(--token-status-error-bg)] hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed h-11"
              aria-label={`Retry import for ${event.eventName}`}
            >
              Retry
            </button>
          )}
          
          {/* Import Button - shown for unimported events */}
          {needsImport && onImport && !hasFailed && (
            <button
              type="button"
              onClick={() => onImport(event)}
              disabled={isImporting || isBulkImporting}
              className="flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-5 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed h-11"
            >
              Import
            </button>
          )}
          
          {/* Analyse Button - shown for imported events */}
          {canSelect && (
            <button
              type="button"
              onClick={handleSelect}
              className="flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-5 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] h-11"
            >
              Analyse event
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
