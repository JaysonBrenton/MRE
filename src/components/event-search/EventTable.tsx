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

export type SortField = "date" | "name"
export type SortDirection = "asc" | "desc"

export interface EventTableProps {
  events: Event[]
  isLoading?: boolean
  hasSearched?: boolean
  onImportEvent?: (event: Event) => void
  statusOverrides?: Record<string, EventStatus>
  selectedEventIds?: Set<string>
  onEventSelect?: (event: Event, selected: boolean) => void
  isBulkImporting?: boolean
  onSelectAll?: () => void
}

export default function EventTable({ 
  events, 
  isLoading, 
  hasSearched = false, 
  onImportEvent, 
  statusOverrides,
  selectedEventIds = new Set(),
  onEventSelect,
  isBulkImporting = false,
  onSelectAll,
}: EventTableProps) {
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  // Helper to check if event is importable
  const isEventImportable = (event: Event): boolean => {
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

  // Check if all importable events are selected
  const importableEvents = events.filter(isEventImportable)
  const allImportableSelected = importableEvents.length > 0 && 
    importableEvents.every((e) => selectedEventIds.has(e.id))

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
    } else {
      comparison = a.eventName.localeCompare(b.eventName)
    }

    return sortDirection === "asc" ? comparison : -comparison
  })

  if (isLoading) {
    return (
      <div className="mt-8 text-center py-8" role="status" aria-live="polite">
        <p className="text-[var(--token-text-secondary)]">Searching for events...</p>
      </div>
    )
  }

  // Don't show "No events found" if search hasn't been executed yet
  if (!hasSearched) {
    return null
  }

  if (events.length === 0) {
    return (
      <div className="mt-8 text-center py-8">
        <p className="text-[var(--token-text-secondary)]">
          No events found for this track and date range. Try changing your dates or selecting a different track.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-8">
      {/* Desktop: Table Header (hidden on mobile) */}
      <div className="hidden sm:grid sm:grid-cols-4 gap-4 px-4 py-3 border-b border-[var(--token-border-default)]">
        {/* Checkbox column header */}
        <div className="flex items-center justify-center">
          <div className="text-sm font-medium text-[var(--token-text-secondary)]">Analyse Event</div>
        </div>
        <button
          type="button"
          onClick={() => handleSort("name")}
          className="text-left text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
        >
          Event Name
          {sortField === "name" && (
            <span className="ml-2">{sortDirection === "asc" ? "↑" : "↓"}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => handleSort("date")}
          className="text-left text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
        >
          Event Date
          {sortField === "date" && (
            <span className="ml-2">{sortDirection === "asc" ? "↑" : "↓"}</span>
          )}
        </button>
        <div className="text-sm font-medium text-[var(--token-text-secondary)]">Status</div>
      </div>

      {/* Event List */}
      <div className="divide-y divide-[var(--token-border-default)]">
        {sortedEvents.map((event) => {
          const isImportable = isEventImportable(event)
          return (
            <EventRow 
              key={event.id} 
              event={event} 
              onImport={onImportEvent}
              statusOverride={statusOverrides?.[event.id]}
              isSelected={selectedEventIds.has(event.id)}
              onSelect={isImportable ? onEventSelect : undefined}
              isBulkImporting={isBulkImporting}
            />
          )
        })}
      </div>
    </div>
  )
}
