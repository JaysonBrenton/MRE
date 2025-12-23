/**
 * @fileoverview Event Search container component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Main container for Event Search feature
 * 
 * @purpose Manages form state, API calls, localStorage persistence, and validation.
 *          Coordinates between EventSearchForm and EventTable components.
 * 
 * @relatedFiles
 * - src/components/event-search/EventSearchForm.tsx (form component)
 * - src/components/event-search/EventTable.tsx (event table)
 * - docs/frontend/liverc/user-workflow.md (UX specification)
 */

"use client"

import { useState, useEffect, useRef } from "react"
import EventSearchForm from "./EventSearchForm"
import { type Track } from "./TrackRow"
import EventTable from "./EventTable"
import { type Event } from "./EventRow"
import ImportStatusToast, { type ImportStatus } from "./ImportStatusToast"
import { parseApiResponse } from "@/lib/api-response-helper"

/** API response type for track data */
interface ApiTrack {
  id: string
  trackName: string
  sourceTrackSlug: string
}

/** API response type for event data */
interface ApiEvent {
  id: string
  eventName: string
  eventDate?: string
  event_date?: string
  ingestDepth?: string
  ingest_depth?: string
  sourceEventId?: string
  source_event_id?: string
}

/** API response type for discovered event */
interface ApiDiscoveredEvent {
  id?: string
  sourceEventId: string
  eventName: string
  eventDate: string
}

const FAVOURITES_STORAGE_KEY = "mre_favourite_tracks"
const LAST_DATE_RANGE_STORAGE_KEY = "mre_last_date_range"
const LAST_TRACK_STORAGE_KEY = "mre_last_track"
const USE_DATE_FILTER_STORAGE_KEY = "mre_use_date_filter"

// Get default date range (last 30 days)
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  }
}

export default function EventSearchContainer() {
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [useDateFilter, setUseDateFilter] = useState<boolean>(false)
  const [favourites, setFavourites] = useState<string[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [isLoadingTracks, setIsLoadingTracks] = useState(true)
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  const [isCheckingLiveRC, setIsCheckingLiveRC] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [newEventsFromLiveRC, setNewEventsFromLiveRC] = useState<Event[]>([])
  const [importingEventId, setImportingEventId] = useState<string | null>(null)
  const keptLoadingForEmptyDB = useRef(false)
  const [importStatus, setImportStatus] = useState<{
    status: ImportStatus
    message: string
    eventName?: string
  } | null>(null)
  const [errors, setErrors] = useState<{
    track?: string
    startDate?: string
    endDate?: string
  }>({})

  // Load persisted data and tracks on mount
  useEffect(() => {
    // Load favourites from localStorage
    try {
      const storedFavourites = localStorage.getItem(FAVOURITES_STORAGE_KEY)
      if (storedFavourites) {
        setFavourites(JSON.parse(storedFavourites))
      }
    } catch (error) {
      console.error("Failed to load favourites from localStorage:", error)
    }

    // Load last date range from localStorage
    try {
      const storedDateRange = localStorage.getItem(LAST_DATE_RANGE_STORAGE_KEY)
      if (storedDateRange) {
        const { startDate: storedStart, endDate: storedEnd } = JSON.parse(storedDateRange)
        setStartDate(storedStart)
        setEndDate(storedEnd)
      } else {
        const defaultRange = getDefaultDateRange()
        setStartDate(defaultRange.startDate)
        setEndDate(defaultRange.endDate)
      }
    } catch (error) {
      console.error("Failed to load date range from localStorage:", error)
      const defaultRange = getDefaultDateRange()
      setStartDate(defaultRange.startDate)
      setEndDate(defaultRange.endDate)
    }

    // Load last selected track from localStorage
    try {
      const storedTrack = localStorage.getItem(LAST_TRACK_STORAGE_KEY)
      if (storedTrack) {
        setSelectedTrack(JSON.parse(storedTrack))
      }
    } catch (error) {
      console.error("Failed to load track from localStorage:", error)
    }

    // Load persisted date filter toggle state from localStorage
    try {
      const storedUseDateFilter = localStorage.getItem(USE_DATE_FILTER_STORAGE_KEY)
      if (storedUseDateFilter) {
        setUseDateFilter(JSON.parse(storedUseDateFilter))
      }
    } catch (error) {
      console.error("Failed to load date filter toggle from localStorage:", error)
    }

    // Load tracks from API
    loadTracks()
  }, [])

  const loadTracks = async () => {
    try {
      setIsLoadingTracks(true)
      const response = await fetch("/api/v1/tracks?followed=false&active=true")
      const result = await parseApiResponse<{ tracks: ApiTrack[] }>(response)
      
      if (!result.success) {
        console.error("Error loading tracks:", result.error)
        setErrors({ track: result.error.message })
        return
      }
      
      setTracks(
        result.data.tracks.map((track) => ({
          id: track.id,
          trackName: track.trackName,
          sourceTrackSlug: track.sourceTrackSlug,
        }))
      )
    } catch (error) {
      console.error("Error loading tracks:", error)
      setErrors({ track: "Unable to load tracks. Please try again." })
    } finally {
      setIsLoadingTracks(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}

    if (!selectedTrack) {
      newErrors.track = "Please select a track"
    }

    // Only validate dates if date filter is enabled
    if (useDateFilter) {
      // Dates are optional - only validate if provided
      const hasStartDate = startDate && startDate.trim() !== ""
      const hasEndDate = endDate && endDate.trim() !== ""

      // If one date is provided, both should be provided
      if (hasStartDate && !hasEndDate) {
        newErrors.endDate = "End date is required when start date is provided"
      }

      if (hasEndDate && !hasStartDate) {
        newErrors.startDate = "Start date is required when end date is provided"
      }

      // If both dates are provided, validate them
      if (hasStartDate && hasEndDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        const today = new Date()
        
        // Normalize all dates to start of day (midnight) for consistent comparison
        // This ensures timezone and time component differences don't affect validation
        start.setHours(0, 0, 0, 0)
        end.setHours(0, 0, 0, 0)
        today.setHours(0, 0, 0, 0)

        if (isNaN(start.getTime())) {
          newErrors.startDate = "Start date must be a valid date"
        }

        if (isNaN(end.getTime())) {
          newErrors.endDate = "End date must be a valid date"
        }

        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          if (start > end) {
            newErrors.startDate = "Start date must be before or equal to end date"
          }

          // Check each date individually for future date validation
          if (start > today) {
            newErrors.startDate = "Start date cannot be in the future. Please select today or earlier."
          }
          if (end > today) {
            newErrors.endDate = "End date cannot be in the future. Please select today or earlier."
          }

          const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
          if (daysDiff > 90) {
            newErrors.endDate = "Date range cannot exceed 3 months. Please select a shorter range."
          }
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSearch = async () => {
    console.log("EventSearchContainer: handleSearch called", { 
      selectedTrack, 
      startDate, 
      endDate, 
      useDateFilter 
    })
    if (!validateForm() || !selectedTrack) {
      console.log("EventSearchContainer: Validation failed or no track selected", {
        validationPassed: validateForm(),
        hasSelectedTrack: !!selectedTrack
      })
      return
    }

    try {
      setHasSearched(false) // Clear flag immediately to prevent flash of "No events found"
      setIsLoadingEvents(true)
      setErrors({})

      // Persist form values
      try {
        localStorage.setItem(
          LAST_DATE_RANGE_STORAGE_KEY,
          JSON.stringify({ startDate, endDate })
        )
        localStorage.setItem(LAST_TRACK_STORAGE_KEY, JSON.stringify(selectedTrack))
        localStorage.setItem(USE_DATE_FILTER_STORAGE_KEY, JSON.stringify(useDateFilter))
      } catch (error) {
        console.error("Failed to persist form values:", error)
      }

      // Build query string - only include dates if date filter is enabled and dates are provided
      const params = new URLSearchParams({
        track_id: selectedTrack.id,
      })
      
      if (useDateFilter) {
        if (startDate && startDate.trim() !== "") {
          params.append("start_date", startDate)
        }
        
        if (endDate && endDate.trim() !== "") {
          params.append("end_date", endDate)
        }
      }

      // Call API
      const response = await fetch(`/api/v1/events/search?${params.toString()}`)

      const result = await parseApiResponse<{
        track: { id: string; source: string; source_track_slug: string; track_name: string }
        events: ApiEvent[]
      }>(response)

      if (!result.success) {
        // Handle validation errors
        if (result.error.code === "VALIDATION_ERROR") {
          const field = (result.error.details as { field?: string })?.field
          if (field === "start_date") {
            setErrors({ startDate: result.error.message })
          } else if (field === "end_date") {
            setErrors({ endDate: result.error.message })
          } else {
            setErrors({ track: result.error.message })
          }
        } else {
          setErrors({ track: result.error.message })
        }
        setIsLoadingEvents(false)
        return
      }

      const dbEvents = result.data.events.map((event) => ({
        id: event.id,
        eventName: event.eventName,
        eventDate: event.eventDate || event.event_date || "",
        ingestDepth: (event.ingestDepth || event.ingest_depth || "").trim(),
        sourceEventId: event.sourceEventId || event.source_event_id, // Include for matching
      }))

      setEvents(dbEvents)

      // If DB search returned no events, immediately check LiveRC and keep loading state true
      // If DB search returned events, show them immediately and check LiveRC in background
      if (dbEvents.length === 0) {
        // Keep loading state true, immediately check LiveRC (no setTimeout)
        keptLoadingForEmptyDB.current = true
        checkLiveRC().catch((error) => {
          console.error("Error in auto-check LiveRC:", error)
          setIsLoadingEvents(false) // Only clear loading on error
          keptLoadingForEmptyDB.current = false
        })
      } else {
        // DB has results - show them immediately, check LiveRC in background for new events
        setIsLoadingEvents(false)
        setHasSearched(true)
        setTimeout(() => {
          checkLiveRC().catch((error) => {
            console.error("Error in auto-check LiveRC:", error)
          })
        }, 100)
      }
    } catch (error) {
      console.error("Error searching events:", error)
      setErrors({ track: "Unable to search events. Please try again." })
      setIsLoadingEvents(false)
    }
  }

  const checkLiveRC = async () => {
    if (!selectedTrack) return

    try {
      setIsCheckingLiveRC(true)
      setErrors({})

      // Build request body - only include dates if date filter is enabled and dates are provided
      const requestBody: { track_id: string; start_date?: string; end_date?: string } = {
        track_id: selectedTrack.id,
      }
      
      if (useDateFilter) {
        if (startDate && startDate.trim() !== "") {
          requestBody.start_date = startDate
        }
        
        if (endDate && endDate.trim() !== "") {
          requestBody.end_date = endDate
        }
      }

      const response = await fetch("/api/v1/events/discover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const result = await parseApiResponse<{
        new_events: ApiDiscoveredEvent[]
        existing_events: ApiDiscoveredEvent[]
      }>(response)

      if (!result.success) {
        // Don't show error toast for timeout - it's expected if ingestion service is busy
        // Only show error for actual failures
        if (!result.error.message?.includes("timeout")) {
          setImportStatus({
            status: "failed",
            message: result.error.message || "Unable to check LiveRC. Please try again later.",
          })
        }
        return
      }

      if (result.data.new_events && result.data.new_events.length > 0) {
        // Convert discovered events to Event format
        // Store sourceEventId for import later
        const newEvents = result.data.new_events.map((event) => ({
          id: event.id || `liverc-${event.sourceEventId}`,
          eventName: event.eventName,
          eventDate: event.eventDate,
          ingestDepth: "none", // Not imported yet
          sourceEventId: event.sourceEventId, // Store for import
        }))

        setNewEventsFromLiveRC(newEvents)
        
        // Add new events to the events list (they'll show with "New (LiveRC only)" status and Import button)
        setEvents((prevEvents) => {
          // Build sets of existing identifiers for deduplication
          const existingIds = new Set(prevEvents.map((e) => e.id))
          const existingSourceIds = new Set(
            prevEvents
              .map((e) => e.sourceEventId)
              .filter((id): id is string => id !== undefined)
          )
          
          // Filter out LiveRC-only events that match imported DB events by sourceEventId
          // This prevents showing "Import" button for already-imported events
          const filteredPrevEvents = prevEvents.filter((prevEvent) => {
            // Keep DB events (real IDs, not liverc-*)
            if (!prevEvent.id.startsWith("liverc-")) {
              return true
            }
            // Remove LiveRC-only events if a DB event with the same sourceEventId exists
            if (prevEvent.sourceEventId) {
              // Check if there's a DB event (non-liverc ID) with this sourceEventId
              const hasDbEvent = prevEvents.some(
                (e) => !e.id.startsWith("liverc-") && e.sourceEventId === prevEvent.sourceEventId
              )
              return !hasDbEvent
            }
            return true
          })
          
          // Add new events that don't duplicate existing ones
          // Double-check against both IDs and sourceEventIds to prevent duplicates
          const uniqueNewEvents = newEvents.filter((e: Event) => {
            // Don't add if ID already exists
            if (existingIds.has(e.id)) {
              return false
            }
            // Don't add if sourceEventId already exists in any event (DB or LiveRC)
            if (e.sourceEventId && existingSourceIds.has(e.sourceEventId)) {
              return false
            }
            // Additional check: don't add if a DB event with this sourceEventId exists
            // This handles race conditions where checkLiveRC runs before DB event is visible
            if (e.sourceEventId) {
              const hasDbEventWithSourceId = filteredPrevEvents.some(
                (prev) => !prev.id.startsWith("liverc-") && prev.sourceEventId === e.sourceEventId
              )
              if (hasDbEventWithSourceId) {
                return false
              }
            }
            return true
          })
          
          return [...filteredPrevEvents, ...uniqueNewEvents]
        })
      }
      // No new events found - silently continue (no toast notification needed)
    } catch (error) {
      console.error("Error checking LiveRC:", error)
      setImportStatus({
        status: "failed",
        message: "Unable to check LiveRC. Please try again later.",
      })
    } finally {
      setIsCheckingLiveRC(false)
      // Clear loading state when LiveRC check completes (if it was kept true for empty DB results)
      // This ensures "No events found" only shows after both DB and LiveRC checks complete
      if (keptLoadingForEmptyDB.current) {
        setIsLoadingEvents(false)
        keptLoadingForEmptyDB.current = false
      }
      // Mark that a search has been completed
      setHasSearched(true)
    }
  }

  const handleImportSingle = async (event: Event) => {
    if (!selectedTrack) {
      return
    }

    setImportingEventId(event.id)

    try {
      // Check if event has an id (edge case - should not happen for new events)
      if (event.id && !event.id.startsWith("liverc-")) {
        // Event already exists in DB, use event ID endpoint
        const response = await fetch(`/api/v1/events/${event.id}/ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ depth: "laps_full" }),
        })
        const result = await parseApiResponse(response)
        if (!result.success) {
          throw new Error(result.error.message)
        }
      } else {
        // New event - use source ID endpoint
        // Extract sourceEventId from event (stored during discovery)
        const sourceEventId = event.sourceEventId
        if (!sourceEventId) {
          throw new Error(`Missing sourceEventId for event: ${event.eventName}`)
        }
        
        const requestBody = {
          source_event_id: sourceEventId,
          track_id: selectedTrack.id,
          depth: "laps_full",
        }
        const response = await fetch("/api/v1/events/ingest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })
        const result = await parseApiResponse(response)
        if (!result.success) {
          throw new Error(result.error.message)
        }
      }

      // Show success message
      setImportStatus({
        status: "completed",
        message: `Import completed for "${event.eventName}".`,
      })

      // Refresh search to update event status
      // Wait a moment to ensure the database transaction has committed
      await new Promise(resolve => setTimeout(resolve, 1000))
      // Re-run search to get updated event list with imported event
      await handleSearch()
      
      // Don't auto-check LiveRC immediately after import - the imported event should now be in DB
      // and will be found by the search. If user wants to check for new events, they can manually trigger it.
    } catch (error) {
      console.error("Error importing event:", error)
      
      // Extract error message from the error
      let errorMessage = `Import failed for "${event.eventName}".`;
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      
      setImportStatus({
        status: "failed",
        message: errorMessage,
      })
    } finally {
      setImportingEventId(null)
    }
  }

  const handleReset = () => {
    setSelectedTrack(null)
    const defaultRange = getDefaultDateRange()
    setStartDate(defaultRange.startDate)
    setEndDate(defaultRange.endDate)
    setUseDateFilter(false)
    setEvents([])
    setHasSearched(false)
    setErrors({})
    setNewEventsFromLiveRC([])
    setImportingEventId(null)
    setImportStatus(null)

    // Clear localStorage
    try {
      localStorage.removeItem(LAST_DATE_RANGE_STORAGE_KEY)
      localStorage.removeItem(LAST_TRACK_STORAGE_KEY)
      localStorage.removeItem(USE_DATE_FILTER_STORAGE_KEY)
    } catch (error) {
      console.error("Failed to clear localStorage:", error)
    }
  }

  const handleUseDateFilterToggle = (checked: boolean) => {
    setUseDateFilter(checked)
    // Clear date errors when toggling
    setErrors((prev) => ({
      ...prev,
      startDate: undefined,
      endDate: undefined,
    }))
  }

  const handleToggleFavourite = (trackId: string) => {
    const newFavourites = favourites.includes(trackId)
      ? favourites.filter((id) => id !== trackId)
      : [...favourites, trackId]

    setFavourites(newFavourites)

    try {
      localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(newFavourites))
    } catch (error) {
      console.error("Failed to save favourites:", error)
    }
  }

  if (isLoadingTracks) {
    return (
      <div className="text-center py-8">
        <p className="text-[var(--token-text-secondary)]">Loading tracks...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <EventSearchForm
        selectedTrack={selectedTrack}
        startDate={startDate}
        endDate={endDate}
        useDateFilter={useDateFilter}
        favourites={favourites}
        tracks={tracks}
        errors={errors}
        isLoading={isLoadingEvents}
        onTrackSelect={setSelectedTrack}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onUseDateFilterChange={handleUseDateFilterToggle}
        onToggleFavourite={handleToggleFavourite}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {/* Event Table */}
      <EventTable 
        events={events} 
        isLoading={isLoadingEvents || isCheckingLiveRC}
        hasSearched={hasSearched}
        onImportEvent={handleImportSingle}
        importingEventId={importingEventId}
      />

      {/* Import Status Toast */}
      {importStatus && (
        <ImportStatusToast
          status={importStatus.status}
          message={importStatus.message}
          eventName={importStatus.eventName}
          onClose={() => setImportStatus(null)}
        />
      )}
    </div>
  )
}

