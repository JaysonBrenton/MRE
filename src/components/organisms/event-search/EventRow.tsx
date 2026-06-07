/**
 * @fileoverview Event row component for event table
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Individual event row/card in the event table
 *
 * @purpose Displays event information with action buttons (Download, Open, Retry import).
 *          Desktop-optimized table row layout.
 *
 * @relatedFiles
 * - src/components/event-search/EventTable.tsx (parent component)
 */

"use client"

import { useMemo, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { useRouter } from "next/navigation"
import EventStatusBadge, { type EventStatus } from "@/components/molecules/EventStatusBadge"
import { formatDateDisplay, formatDateTimeDisplay, isEventInFuture } from "@/lib/date-utils"
import {
  EVENT_SEARCH_TABLE_BODY_CELL_CLASS,
  EVENT_SEARCH_TABLE_BODY_ROW_CLASS,
  EVENT_SEARCH_TABLE_EVENT_NAME_TEXT_CLASS,
  EVENT_SEARCH_TABLE_NAME_CELL_CLASS,
  EVENT_SEARCH_TABLE_NAME_SCROLL_CLASS,
  EVENT_SEARCH_TABLE_NAME_TEXT_CLASS,
} from "./event-search-table-layout"

/** Matches primary action button width (Download / Open) in the event search table (~104px). */
const EVENT_ROW_ACTION_BUTTON_WIDTH_CLASS = "w-[6.5rem] min-w-[6.5rem] shrink-0"

export interface Event {
  id: string
  eventName: string
  eventDate: string | null | undefined // ISO string, may be null/undefined
  ingestDepth: string
  /** ISO string from DB when laps are imported; optional for LiveRC-only rows */
  lastIngestedAt?: string | null
  sourceEventId?: string // Optional: for unimported events from LiveRC
  eventUrl?: string // Optional: LiveRC event page URL for linking
  /** Set for cross-track browse results. */
  trackName?: string
}

/** Progress bar fill when GET /ingestion/jobs returns pipeline_stage (queued ingest). */
const PIPELINE_STAGE_PROGRESS: Record<string, number> = {
  idle: 5,
  fetch_event_page: 12,
  fetch_entry_list: 20,
  await_event_lock: 24,
  persist_event: 28,
  persist_entry_list: 38,
  persist_races: 48,
  fetch_race_pages: 52,
  ingest_laps: 86,
  persist_multi_main: 78,
  persist_rankings: 80,
  driver_matching: 90,
  vehicle_class_normalization: 94,
}

export interface EventRowProps {
  event: Event
  onImport?: (event: Event) => void
  statusOverride?: EventStatus
  errorMessage?: string // Optional error message for failed imports
  containsDriver?: boolean // Whether the driver name was found in the entry list
  importProgress?: {
    stage?: string
    /** Machine stage from GET /ingestion/jobs (queue mode) — drives real progress % */
    pipelineStageKey?: string
    counts?: { races: number; results: number; laps: number }
  } // Progress information for ongoing imports
  onSelectForDashboard?: (eventId: string) => void // Callback for selecting an event for dashboard context
  /** When true, Import/Retry buttons are disabled (e.g. another import is in progress) */
  importDisabled?: boolean
  /** Opens the import-failed details dialog (failed status badge) */
  onViewImportError?: () => void
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
  importDisabled = false,
  onViewImportError,
}: EventRowProps) {
  const router = useRouter()
  const derivedStatus = getStatusFromIngestDepth(event.ingestDepth, event.id, event.eventDate)

  // Check if event is scheduled (future) - this takes precedence over status override
  // Scheduled events should always show as "scheduled" regardless of other status
  const isScheduledEvent = isEventInFuture(event.eventDate)
  const status = isScheduledEvent ? "scheduled" : (statusOverride ?? derivedStatus)

  const formattedDate = formatDateDisplay(event.eventDate)
  const importedAtLabel = formatDateTimeDisplay(event.lastIngestedAt)
  const isLiveRCOnly = event.id.startsWith("liverc-")
  const isImported = status === "imported" || status === "stored"
  const isScheduled = status === "scheduled"
  const isImporting = status === "importing"
  const hasFailed = status === "failed"
  const isImportable = status === "new" && !isScheduled // Future events are not importable
  const canSelect = isImported && !isLiveRCOnly // Show Select button for all imported events

  const importButtonDisabled = isImporting || importDisabled

  const handleImport = () => {
    if (onImport && !importButtonDisabled) {
      onImport(event)
    }
  }

  const handleRetry = () => {
    if (onImport && !importButtonDisabled) {
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
        router.push(`/eventAnalysis?eventId=${event.id}`)
      }
    }
  }

  const rawImportProgress = useMemo(() => {
    if (!isImporting || !importProgress) {
      return undefined
    }

    let raw: number | undefined
    const key = importProgress.pipelineStageKey
    if (key && PIPELINE_STAGE_PROGRESS[key] !== undefined) {
      raw = PIPELINE_STAGE_PROGRESS[key]
    } else {
      const { stage } = importProgress
      if (stage) {
        const stageLower = stage.toLowerCase()
        if (stageLower.includes("connecting") || stageLower.includes("starting")) {
          raw = 5
        } else if (stageLower.includes("fetching")) {
          raw = 15
        } else if (stageLower.includes("race")) {
          raw = 35
        } else if (stageLower.includes("result")) {
          raw = 65
        } else if (
          stageLower.includes("still finishing") ||
          stageLower.includes("finishing import")
        ) {
          raw = 92
        } else if (stageLower.includes("lap")) {
          raw = 85
        } else if (stageLower.includes("importing")) {
          raw = 50
        }
      }
      if (raw === undefined) {
        raw = 25
      }
    }

    return raw
  }, [isImporting, importProgress])

  const [importProgressPeak, setImportProgressPeak] = useState(0)

  if (!isImporting) {
    if (importProgressPeak !== 0) {
      setImportProgressPeak(0)
    }
  } else if (rawImportProgress !== undefined) {
    const next = Math.max(importProgressPeak, rawImportProgress)
    if (next !== importProgressPeak) {
      setImportProgressPeak(next)
    }
  }

  const progress =
    !isImporting || rawImportProgress === undefined
      ? undefined
      : Math.max(importProgressPeak, rawImportProgress)

  return (
    <tr className={EVENT_SEARCH_TABLE_BODY_ROW_CLASS}>
      {/* Column 1 - Event Name */}
      <td className={`${EVENT_SEARCH_TABLE_BODY_CELL_CLASS} ${EVENT_SEARCH_TABLE_NAME_CELL_CLASS}`}>
        <div className="flex min-w-0 flex-col gap-1">
          <div
            className={`${EVENT_SEARCH_TABLE_NAME_SCROLL_CLASS} flex min-w-0 items-center gap-2`}
          >
            {event.eventUrl ? (
              <a
                href={event.eventUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${EVENT_SEARCH_TABLE_EVENT_NAME_TEXT_CLASS} font-normal underline decoration-[var(--token-accent)]/50 underline-offset-2 transition-colors hover:text-[var(--token-accent)] hover:decoration-[var(--token-accent)]`}
                aria-label={`View event on LiveRC (opens in new tab)`}
                title={event.eventName}
              >
                {event.eventName}
              </a>
            ) : (
              <h3
                className={`${EVENT_SEARCH_TABLE_EVENT_NAME_TEXT_CLASS} font-normal`}
                title={event.eventName}
              >
                {event.eventName}
              </h3>
            )}
            {containsDriver && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--token-status-success-bg)] px-2 py-1 text-xs font-medium text-[var(--token-status-success-text)]"
                title="You participated in this event"
                aria-label="You participated in this event"
              >
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                You participated
              </span>
            )}
          </div>
          {isImported && (
            <span className="text-xs text-[var(--token-text-secondary)]">
              {importedAtLabel ? `Event imported on ${importedAtLabel}.` : "Event imported."}
            </span>
          )}
        </div>
      </td>

      {/* Column 2 - Track Name */}
      <td className={`${EVENT_SEARCH_TABLE_BODY_CELL_CLASS} ${EVENT_SEARCH_TABLE_NAME_CELL_CLASS}`}>
        <div className={EVENT_SEARCH_TABLE_NAME_SCROLL_CLASS}>
          <p className={EVENT_SEARCH_TABLE_NAME_TEXT_CLASS} title={event.trackName ?? undefined}>
            {event.trackName ?? "—"}
          </p>
        </div>
      </td>

      {/* Column 3 - Event Status */}
      <td className={`${EVENT_SEARCH_TABLE_BODY_CELL_CLASS} text-center`}>
        <div className="inline-flex flex-col items-center gap-1">
          <EventStatusBadge
            status={status}
            progress={progress}
            stage={importProgress?.stage}
            importErrorHint={hasFailed ? errorMessage : undefined}
            onFailedClick={
              hasFailed && errorMessage && onViewImportError ? onViewImportError : undefined
            }
          />
        </div>
      </td>

      {/* Column 4 - Event Date */}
      <td className={`${EVENT_SEARCH_TABLE_BODY_CELL_CLASS} text-center`}>
        <p className={`${EVENT_SEARCH_TABLE_NAME_TEXT_CLASS} text-center`}>{formattedDate}</p>
      </td>

      {/* Column 5 - Actions */}
      <td className={EVENT_SEARCH_TABLE_BODY_CELL_CLASS}>
        <div className="flex justify-start">
          <div className="flex gap-2">
            {/* Download — fetches event data into MRE (same action as import pipeline) */}
            {isImportable && onImport && (
              <button
                type="button"
                onClick={handleImport}
                disabled={importButtonDisabled}
                title={
                  importDisabled && !isImporting ? "Finish the current import first" : undefined
                }
                className={`flex items-center justify-center rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)]/10 px-5 text-sm font-medium text-[var(--token-accent)] transition-colors hover:bg-[var(--token-accent)]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed h-11 ${EVENT_ROW_ACTION_BUTTON_WIDTH_CLASS}`}
                aria-label={`Download ${event.eventName}`}
              >
                Download
              </button>
            )}

            {/* Retry Button - shown for failed imports */}
            {hasFailed && onImport && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={importButtonDisabled}
                title={
                  importDisabled && !isImporting ? "Finish the current import first" : undefined
                }
                className={`flex items-center justify-center rounded-md border border-[var(--token-status-error-text)] bg-[var(--token-status-error-bg)] px-2 text-xs font-medium text-[var(--token-status-error-text)] transition-colors hover:bg-[var(--token-status-error-bg)] hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed h-11 ${EVENT_ROW_ACTION_BUTTON_WIDTH_CLASS}`}
                aria-label={`Retry import for ${event.eventName}`}
              >
                Retry import
              </button>
            )}

            {/* Open — open event in analysis / dashboard context */}
            {canSelect && (
              <button
                type="button"
                onClick={handleSelect}
                className={`flex items-center justify-center rounded-md border border-[var(--token-status-success-text)] bg-[var(--token-status-success-text)]/10 px-5 text-sm font-medium text-[var(--token-status-success-text)] transition-colors hover:bg-[var(--token-status-success-text)]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--token-interactive-focus-ring)] h-11 ${EVENT_ROW_ACTION_BUTTON_WIDTH_CLASS}`}
                aria-label={`Open ${event.eventName}`}
              >
                Open
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}
