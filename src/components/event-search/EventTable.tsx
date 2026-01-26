/**
 * @fileoverview Event table component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Displays events in table (desktop) or list (mobile) format
 * 
 * @purpose Shows search results with event name, date, and status. Includes
 *          sorting, empty states, and loading states. Degrades to list format
 *          on mobile per mobile UX guidelines.
 * 
 * @relatedFiles
 * - src/components/event-search/EventRow.tsx (event row component)
 * - docs/frontend/liverc/user-workflow.md (UX specification)
 */

"use client"

import { useState } from "react"
import EventRow, { type Event } from "./EventRow"
import type { EventStatus } from "./EventStatusBadge"
import { isEventInFuture } from "@/lib/date-utils"

export type SortField = "date" | "name" | "status"
export type SortDirection = "asc" | "desc"

export interface EventTableProps {
  events: Event[]
  isLoading?: boolean
  hasSearched?: boolean
  isCheckingLiveRC?: boolean // Whether LiveRC is currently being checked
  onImportEvent?: (event: Event) => void
  statusOverrides?: Record<string, EventStatus>
  errorMessages?: Record<string, string>
  driverInEvents?: Record<string, boolean> // Map of sourceEventId to boolean
  eventImportProgress?: Record<string, { stage?: string; counts?: { races: number; results: number; laps: number } }> // Progress information per event
  onSelectForDashboard?: (eventId: string) => void // Callback for selecting an event for dashboard context
}

export default function EventTable({ 
  events, 
  isLoading, 
  hasSearched = false, 
  isCheckingLiveRC = false,
  onImportEvent, 
  statusOverrides,
  errorMessages = {},
  driverInEvents = {},
  eventImportProgress = {},
  onSelectForDashboard,
}: EventTableProps) {
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  // Helper function to get event status for sorting (matches logic in EventRow)
  function getEventStatus(event: Event, statusOverrides?: Record<string, EventStatus>): EventStatus {
    // Check if event is scheduled (future) - this takes precedence
    if (isEventInFuture(event.eventDate)) {
      return "scheduled"
    }

    // Check for status override
    const overrideStatus = statusOverrides?.[event.id]
    if (overrideStatus) {
      return overrideStatus
    }

    // Check if this is a LiveRC-only event (ID starts with "liverc-")
    if (event.id.startsWith("liverc-")) {
      return "new"
    }

    // Normalize ingestDepth: trim whitespace and convert to lowercase
    const normalizedDepth = event.ingestDepth?.trim().toLowerCase() || ""

    switch (normalizedDepth) {
      case "laps_full":
      case "lapsfull": // Handle potential variations
        return "imported"
      case "none":
      case "": // Empty or null means not imported
        return "new"
      default:
        // For any other value, check if it contains "full" or "laps" as a hint
        if (normalizedDepth.includes("full") || normalizedDepth.includes("laps")) {
          return "imported"
        }
        // Default to new for unknown values
        return "new"
    }
  }

  // Status sort order: scheduled < new < importing < failed < imported/stored
  const statusSortOrder: Record<EventStatus, number> = {
    scheduled: 0,
    new: 1,
    importing: 2,
    failed: 3,
    imported: 4,
    stored: 4,
  }

  // Helper to check if event is importable
  // Excludes scheduled (future) events and already imported events
  const isEventImportable = (event: Event): boolean => {
    // Check if event is in the future - scheduled events cannot be imported
    if (isEventInFuture(event.eventDate)) {
      return false
    }
    const overrideStatus = statusOverrides?.[event.id]
    if (overrideStatus) {
      return overrideStatus === "new"
    }
    // Check if LiveRC-only event
    if (event.id.startsWith("liverc-")) {
      return true
    }
    // Check ingest depth
    const normalizedDepth = event.ingestDepth?.trim().toLowerCase() || ""
    return normalizedDepth !== "laps_full" && normalizedDepth !== "lapsfull"
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // Set new field with default direction
      setSortField(field)
      setSortDirection(field === "date" ? "desc" : "asc")
    }
  }

  const sortedEvents = [...events].sort((a, b) => {
    let comparison = 0

    if (sortField === "date") {
      // Handle null/undefined dates - put them at the end
      if (!a.eventDate && !b.eventDate) return 0
      if (!a.eventDate) return 1
      if (!b.eventDate) return -1
      
      const dateA = new Date(a.eventDate).getTime()
      const dateB = new Date(b.eventDate).getTime()
      
      // Handle invalid dates
      if (isNaN(dateA) && isNaN(dateB)) return 0
      if (isNaN(dateA)) return 1
      if (isNaN(dateB)) return -1
      
      comparison = dateA - dateB
    } else if (sortField === "name") {
      comparison = a.eventName.localeCompare(b.eventName)
    } else if (sortField === "status") {
      const statusA = getEventStatus(a, statusOverrides)
      const statusB = getEventStatus(b, statusOverrides)
      const orderA = statusSortOrder[statusA] ?? 99
      const orderB = statusSortOrder[statusB] ?? 99
      comparison = orderA - orderB
      // If same status order, sort by name as secondary
      if (comparison === 0) {
        comparison = a.eventName.localeCompare(b.eventName)
      }
    }

    return sortDirection === "asc" ? comparison : -comparison
  })

  // Don't render anything if we're loading or haven't searched yet
  // This prevents any flash of old data during state transitions
  // Show loading state while checking database or LiveRC
  if (isLoading || isCheckingLiveRC || !hasSearched) {
    if (isLoading || isCheckingLiveRC) {
      return (
        <div className="mt-8 text-center py-8 w-full min-w-0" role="status" aria-live="polite">
          <p className="text-[var(--token-text-secondary)]">Searching for events...</p>
        </div>
      )
    }
    return null
  }

  // Only show empty state after both database and LiveRC checks have completed
  if (events.length === 0 && !isCheckingLiveRC && !isLoading && hasSearched) {
    return (
      <div className="mt-8 py-8 w-full min-w-0 flex-shrink-0">
        <div className="mx-auto max-w-2xl min-w-[320px] px-4 space-y-3">
          <p className="text-center text-[var(--token-text-primary)] font-medium">
            No events found
          </p>
          <p className="text-center text-sm text-[var(--token-text-secondary)]">
            No events were found for this track and date range. Try:
          </p>
          <div className="flex justify-center">
            <ul className="text-sm text-[var(--token-text-secondary)] space-y-1 list-disc list-outside text-left">
              <li>Expanding your date range</li>
              <li>Selecting a different track</li>
              <li>Checking if events exist on LiveRC for this track</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 w-full min-w-0">
      {/* Desktop: Table Header (hidden on mobile) */}
      <div className="grid grid-cols-[2.5fr_1fr_1fr_1.5fr] gap-4 px-4 py-3 border-b border-[var(--token-border-default)]">
        <div
          className="text-left"
          aria-sort={sortField === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
        >
          <button
            type="button"
            onClick={() => handleSort("name")}
            className="text-left text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
            aria-label={`Sort by event name ${sortField === "name" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
          >
            Event Name
            {sortField === "name" && (
              <span className="ml-2" aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>
            )}
          </button>
        </div>
        <div
          className="text-center"
          aria-sort={sortField === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
        >
          <button
            type="button"
            onClick={() => handleSort("status")}
            className="text-center text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
            aria-label={`Sort by event status ${sortField === "status" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
          >
            Event Status
            {sortField === "status" && (
              <span className="ml-2" aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>
            )}
          </button>
        </div>
        <div
          className="text-center"
          aria-sort={sortField === "date" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
        >
          <button
            type="button"
            onClick={() => handleSort("date")}
            className="text-center text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
            aria-label={`Sort by event date ${sortField === "date" ? (sortDirection === "asc" ? "ascending" : "descending") : ""}`}
          >
            Event Date
            {sortField === "date" && (
              <span className="ml-2" aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>
            )}
          </button>
        </div>
        <div className="text-sm font-medium text-[var(--token-text-secondary)] text-center">
          <span aria-label="Actions column">Actions</span>
        </div>
      </div>

      {/* Event List */}
      <div className="divide-y divide-[var(--token-border-default)]">
        {sortedEvents.map((event) => {
          const isImportable = isEventImportable(event)
          // Check driver participation: for LiveRC events use sourceEventId, for DB events use eventId
          const containsDriver = event.id.startsWith("liverc-")
            ? (event.sourceEventId ? driverInEvents[event.sourceEventId] === true : false)
            : driverInEvents[event.id] === true
          return (
            <EventRow 
              key={event.id} 
              event={event} 
              onImport={onImportEvent}
              statusOverride={statusOverrides?.[event.id]}
              errorMessage={errorMessages[event.id]}
              containsDriver={containsDriver}
              importProgress={eventImportProgress[event.id]}
              onSelectForDashboard={onSelectForDashboard}
            />
          )
        })}
      </div>
    </div>
  )
}
