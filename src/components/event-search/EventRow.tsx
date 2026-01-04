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
 *          Desktop-optimized table row layout. Calculates import progress from
 *          import counts (races, results, laps) or import stage, and passes it
 *          to EventStatusBadge for visual progress indication.
 * 
 * @features
 * - Progress calculation: Estimates import progress from counts or stage information
 * - Volume-based calculation: Uses weighted approach based on data volume
 * - Stage-based fallback: Maps import stages to progress percentages when counts unavailable
 * - Real-time updates: Progress updates as import counts change during polling
 * 
 * @relatedFiles
 * - src/components/event-search/EventTable.tsx (parent component)
 * - src/components/event-search/EventStatusBadge.tsx (status badge with progress visualization)
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
  containsDriver?: boolean // Whether the driver name was found in the entry list
  importProgress?: { stage?: string; counts?: { races: number; results: number; laps: number } } // Progress information for ongoing imports
  onSelectForDashboard?: (eventId: string) => void // Callback for selecting an event for dashboard context
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

/**
 * Calculates import progress percentage from import counts using a volume-based approach,
 * or falls back to stage-based progress when counts aren't available.
 * Progress is estimated based on the relative amounts of races, results, and laps imported,
 * or mapped from import stage if counts are missing.
 */
function calculateImportProgress(
  counts?: { races: number; results: number; laps: number },
  stage?: string
): number | undefined {
  // If we have counts, use volume-based calculation
  if (counts) {
    const { races, results, laps } = counts

    // If no counts exist, we're just starting (0-10%)
    if (races === 0 && results === 0 && laps === 0) {
      return 5 // Small initial progress
    }

    // Volume-based calculation using weighted approach
    // Races are typically fewer (10-30% of progress)
    // Results are moderate (30-70% of progress)
    // Laps are most numerous (70-95% of progress)

    let progress = 0

    // Race progress: 0-30% (weighted by race count, but races are typically 1-5 per event)
    // If we have races, we're at least 10% done
    if (races > 0) {
      // Assume typical event has 1-5 races, so each race is roughly 4-6% progress
      // Cap at 30% for races
      progress += Math.min(30, 10 + (races * 4))
    }

    // Result progress: 30-70% (weighted by result count)
    // Results are more numerous than races but less than laps
    if (results > 0) {
      // If we have results, we're at least 30% done
      // Each result adds roughly 0.1-0.5% depending on volume
      // Typical event might have 20-100 results
      const resultProgress = Math.min(40, results * 0.3) // Cap additional progress at 40%
      progress = Math.max(progress, 30) + resultProgress
    }

    // Lap progress: 70-95% (weighted by lap count)
    // Laps are the most numerous data points
    if (laps > 0) {
      // If we have laps, we're at least 70% done
      // Each lap adds a tiny amount (0.01-0.05% depending on volume)
      // Typical event might have 500-5000 laps
      const lapProgress = Math.min(25, laps * 0.005) // Cap additional progress at 25%
      progress = Math.max(progress, 70) + lapProgress
    }

    // Clamp between 5% (minimum when counts exist) and 95% (maximum before completion)
    return Math.max(5, Math.min(95, Math.round(progress)))
  }

  // Fallback to stage-based progress when counts aren't available
  if (stage) {
    const normalizedStage = stage.toLowerCase().trim()
    
    if (normalizedStage.includes("starting") || normalizedStage.includes("connecting")) {
      return 5
    }
    if (normalizedStage.includes("fetching event") || normalizedStage.includes("fetching")) {
      return 15
    }
    if (normalizedStage.includes("importing race")) {
      return 35
    }
    if (normalizedStage.includes("importing result")) {
      return 55
    }
    if (normalizedStage.includes("importing lap")) {
      return 75
    }
    // Default "Importing..." or any other stage
    return 50
  }

  // No counts and no stage - return undefined
  return undefined
}

export default function EventRow({ 
  event, 
  onImport, 
  statusOverride,
  isSelected = false,
  onSelect,
  isBulkImporting = false,
  errorMessage,
  containsDriver = false,
  importProgress,
  onSelectForDashboard,
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
  const canSelectForDashboard = isImported && !isLiveRCOnly && onSelectForDashboard
  
  // Calculate progress for importing status
  const importProgressPercentage = isImporting 
    ? calculateImportProgress(importProgress?.counts, importProgress?.stage) 
    : undefined
  
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

  const handleSelectForDashboard = () => {
    if (onSelectForDashboard && canSelectForDashboard) {
      onSelectForDashboard(event.id)
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
      <div className="flex items-center gap-2">
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
      </div>

      {/* Column 3 - Event Date */}
      <p className="text-sm text-[var(--token-text-secondary)]">{formattedDate}</p>

      {/* Column 4 - Status and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <EventStatusBadge status={status} progress={importProgressPercentage} />
            {/* Import Progress Indicator */}
            {isImporting && (
              <div className="flex items-center gap-2" role="status" aria-live="polite">
                <span className="text-xs text-[var(--token-text-muted)]">
                  {importProgress?.counts
                    ? `${importProgress.counts.races} race${importProgress.counts.races !== 1 ? "s" : ""}, ${importProgress.counts.results} result${importProgress.counts.results !== 1 ? "s" : ""}, ${importProgress.counts.laps} lap${importProgress.counts.laps !== 1 ? "s" : ""} imported`
                    : importProgress?.stage || "Importing..."}
                </span>
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
          
          {/* Select for Dashboard Button - shown for imported events when in modal context */}
          {canSelectForDashboard && (
            <button
              type="button"
              onClick={handleSelectForDashboard}
              className="flex items-center justify-center rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)]/10 px-5 text-sm font-medium text-[var(--token-accent)] transition-colors hover:bg-[var(--token-accent)]/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] h-11"
            >
              Select
            </button>
          )}
          
          {/* Analyse Button - shown for imported events when not in modal context */}
          {canSelect && !onSelectForDashboard && (
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
