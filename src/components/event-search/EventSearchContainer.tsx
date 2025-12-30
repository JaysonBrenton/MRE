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
import { type EventStatus } from "./EventStatusBadge"
import BulkImportBar from "./BulkImportBar"
import ErrorDisplay from "./ErrorDisplay"
import { parseApiResponse } from "@/lib/api-response-helper"
import { logger } from "@/lib/logger"

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

interface ApiIngestionResult {
  event_id: string
  ingest_depth: string
  last_ingested_at: string | null
  races_ingested: number
  results_ingested: number
  laps_ingested: number
  status?: "updated" | "already_complete" | "in_progress"
}

const FAVOURITES_STORAGE_KEY = "mre_favourite_tracks"
const LAST_DATE_RANGE_STORAGE_KEY = "mre_last_date_range"
const LAST_TRACK_STORAGE_KEY = "mre_last_track"
const USE_DATE_FILTER_STORAGE_KEY = "mre_use_date_filter"
const SELECTED_EVENT_IDS_STORAGE_KEY = "mre_selected_event_ids"
const PENDING_REFRESH_DELAY_MS = 5000

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
  const [, setNewEventsFromLiveRC] = useState<Event[]>([])
  const keptLoadingForEmptyDB = useRef(false)
  const [eventStatusOverrides, setEventStatusOverrides] = useState<Record<string, EventStatus>>({})
  const [eventErrorMessages, setEventErrorMessages] = useState<Record<string, string>>({})
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set())
  const [isImportingBulk, setIsImportingBulk] = useState(false)
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null)
  const [searchKey, setSearchKey] = useState(0) // Key to force EventTable remount on new search
  const [isStartingSearch, setIsStartingSearch] = useState(false) // Track if we're starting a new search
  const dbEventsRef = useRef<Event[]>([]) // Ref to track DB events to ensure they're preserved
  const abortControllerRef = useRef<AbortController | null>(null) // Ref to track AbortController for cancelling LiveRC requests
  const [errors, setErrors] = useState<{
    track?: string
    startDate?: string
    endDate?: string
  }>({})
  const [apiError, setApiError] = useState<{
    message: string
    errorId?: string
    details?: unknown
    onRetry?: () => void
  } | null>(null)

  const ensureDbEventsVisible = () => {
    setEvents((prevEvents) => {
      if (dbEventsRef.current.length === 0) {
        return prevEvents
      }

      if (prevEvents.length === 0) {
        logger.warn("Restoring DB events after LiveRC issue", {
          dbEventCount: dbEventsRef.current.length,
        })
        return dbEventsRef.current
      }

      const hasDbEvents = prevEvents.some((event) => !event.id.startsWith("liverc-"))
      if (!hasDbEvents) {
        logger.warn("DB events missing from list - merging them back", {
          dbEventCount: dbEventsRef.current.length,
        })
        const existingLiveRCEvents = prevEvents.filter((event) => event.id.startsWith("liverc-"))
        return [...dbEventsRef.current, ...existingLiveRCEvents]
      }

      return prevEvents
    })
  }
  
  // Generate error reference ID
  const generateErrorId = (): string => {
    return `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
  }

  const updateEventStatusOverride = (eventId: string, status?: EventStatus) => {
    setEventStatusOverrides((prev) => {
      if (!status) {
        const next = { ...prev }
        delete next[eventId]
        return next
      }
      return { ...prev, [eventId]: status }
    })
  }

  const updateEventErrorMessage = (eventId: string, message?: string) => {
    setEventErrorMessages((prev) => {
      if (!message) {
        const next = { ...prev }
        delete next[eventId]
        return next
      }
      return { ...prev, [eventId]: message }
    })
  }

  // Load persisted data and tracks on mount
  useEffect(() => {
    // Load favourites from localStorage
    try {
      const storedFavourites = localStorage.getItem(FAVOURITES_STORAGE_KEY)
      if (storedFavourites) {
        setFavourites(JSON.parse(storedFavourites))
      }
    } catch (error) {
      logger.error("Failed to load favourites from localStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
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
      logger.error("Failed to load date range from localStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
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
      logger.error("Failed to load track from localStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Load persisted date filter toggle state from localStorage
    try {
      const storedUseDateFilter = localStorage.getItem(USE_DATE_FILTER_STORAGE_KEY)
      if (storedUseDateFilter) {
        setUseDateFilter(JSON.parse(storedUseDateFilter))
      }
    } catch (error) {
      logger.error("Failed to load date filter toggle from localStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
    }


    // Load persisted selected event IDs from sessionStorage
    // Note: We'll filter out invalid IDs after events are loaded
    try {
      const storedSelectedIds = sessionStorage.getItem(SELECTED_EVENT_IDS_STORAGE_KEY)
      if (storedSelectedIds) {
        const ids = JSON.parse(storedSelectedIds) as string[]
        setSelectedEventIds(new Set(ids))
      }
    } catch (error) {
      logger.error("Failed to load selected event IDs from sessionStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Load tracks from API
    loadTracks()
  }, [])

  // Filter out persisted event IDs that no longer exist in current results
  useEffect(() => {
    if (events.length > 0 && selectedEventIds.size > 0) {
      const validEventIds = new Set(events.map((e) => e.id))
      const filteredIds = Array.from(selectedEventIds).filter((id) => validEventIds.has(id))
      
      if (filteredIds.length !== selectedEventIds.size) {
        setSelectedEventIds(new Set(filteredIds))
        try {
          if (filteredIds.length > 0) {
            sessionStorage.setItem(SELECTED_EVENT_IDS_STORAGE_KEY, JSON.stringify(filteredIds))
          } else {
            sessionStorage.removeItem(SELECTED_EVENT_IDS_STORAGE_KEY)
          }
        } catch (error) {
          logger.error("Failed to update selected event IDs in sessionStorage", {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }
  }, [events, selectedEventIds])

  const loadTracks = async () => {
    try {
      setIsLoadingTracks(true)
      const response = await fetch("/api/v1/tracks?followed=false&active=true")
      const result = await parseApiResponse<{ tracks: ApiTrack[] }>(response)
      
      if (!result.success) {
        logger.error("Error loading tracks", {
          error: result.error.message || String(result.error),
        })
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
      logger.error("Error loading tracks", {
        error: error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : String(error),
      })
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
    logger.debug("EventSearchContainer: handleSearch called", { 
      selectedTrack, 
      startDate, 
      endDate, 
      useDateFilter 
    })
    if (!validateForm() || !selectedTrack) {
      logger.debug("EventSearchContainer: Validation failed or no track selected", {
        validationPassed: validateForm(),
        hasSelectedTrack: !!selectedTrack
      })
      return
    }

    try {
      // Cancel any outstanding LiveRC request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      // Mark that we're starting a search to hide EventTable during transition
      setIsStartingSearch(true)
      // Clear all state FIRST to prevent any flash of old data
      // Order matters: clear search flag and events before setting loading state
      setHasSearched(false)
      setEvents([])
      dbEventsRef.current = [] // Clear DB events ref at start of new search
      // Then increment search key to force EventTable remount with clean state
      setSearchKey((prev) => prev + 1)
      setIsLoadingEvents(true)
      setErrors({})
      
      logger.debug("EventSearchContainer: Starting search", {
        trackId: selectedTrack.id,
        useDateFilter,
      })
      // Note: isStartingSearch will be cleared when:
      // - For empty DB results: after LiveRC check completes (in checkLiveRC finally block)
      // - For DB results: after LiveRC check completes (in checkLiveRC finally block)
      // - For errors: in the catch block below

      // Persist form values
      try {
        localStorage.setItem(
          LAST_DATE_RANGE_STORAGE_KEY,
          JSON.stringify({ startDate, endDate })
        )
        localStorage.setItem(LAST_TRACK_STORAGE_KEY, JSON.stringify(selectedTrack))
        localStorage.setItem(USE_DATE_FILTER_STORAGE_KEY, JSON.stringify(useDateFilter))
      } catch (error) {
        logger.error("Failed to persist form values", {
          error: error instanceof Error ? error.message : String(error),
        })
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

      // Call API with timeout to prevent hanging
      const searchAbortController = new AbortController()
      const searchTimeout = setTimeout(() => {
        searchAbortController.abort()
      }, 30000) // 30 second timeout for search

      let response: Response
      try {
        response = await fetch(`/api/v1/events/search?${params.toString()}`, {
          signal: searchAbortController.signal,
        })
      } catch (error) {
        clearTimeout(searchTimeout)
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Search request timed out. Please try again.")
        }
        throw error
      }
      clearTimeout(searchTimeout)

      const result = await parseApiResponse<{
        track: { id: string; source: string; source_track_slug: string; track_name: string }
        events: ApiEvent[]
      }>(response)

      if (!result.success) {
        const errorId = generateErrorId()
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
          setApiError(null) // Clear API error for validation errors
        } else {
          // Network or server errors
          setErrors({ track: result.error.message })
          setApiError({
            message: result.error.message || "Unable to search events. Please check your connection and try again.",
            errorId,
            details: result.error.details || { code: result.error.code, status: response.status },
            onRetry: handleSearch,
          })
        }
        setIsLoadingEvents(false)
        setIsStartingSearch(false) // Clear flag on API error
        ensureDbEventsVisible()
        return
      }
      
      // Clear API error on success
      setApiError(null)

      const dbEvents = result.data.events.map((event) => ({
        id: event.id,
        eventName: event.eventName,
        eventDate: event.eventDate || event.event_date || "",
        ingestDepth: (event.ingestDepth || event.ingest_depth || "").trim(),
        sourceEventId: event.sourceEventId || event.source_event_id, // Include for matching
      }))

      logger.debug("EventSearchContainer: DB search completed", {
        eventCount: dbEvents.length,
        eventIds: dbEvents.map((e) => e.id),
      })

      // Store track data from search result for use in LiveRC discovery
      const trackDataFromSearch = result.data.track

      // If DB search returned no events, immediately check LiveRC and keep loading state true
      // If DB search returned events, show them immediately and check LiveRC in background
      // Note: LiveRC check now supports driver filtering, so we can call it even when filter is enabled
      if (dbEvents.length === 0) {
        // If DB search returned no events, show empty state immediately and check LiveRC in background
        setEvents(dbEvents)
        setHasSearched(true)
        setIsStartingSearch(false) // Clear immediately to show empty state
        setIsLoadingEvents(false) // Clear main loading state
        setIsCheckingLiveRC(true) // Show LiveRC indicator separately
        keptLoadingForEmptyDB.current = true
        
        // Start LiveRC check in background with timeout
        const liveRCTimeout = setTimeout(() => {
          logger.warn("LiveRC check timed out after 30 seconds")
          setIsCheckingLiveRC(false)
          keptLoadingForEmptyDB.current = false
        }, 30000) // 30 second timeout
        
        checkLiveRC(trackDataFromSearch, []).catch((error) => {
          logger.error("Error in auto-check LiveRC", {
            error: error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : String(error),
          })
        }).finally(() => {
          clearTimeout(liveRCTimeout)
          setIsCheckingLiveRC(false)
          keptLoadingForEmptyDB.current = false
        })
      } else {
        // DB has results - show them immediately and check LiveRC in background
        // This provides instant feedback to users while LiveRC discovery runs asynchronously
        dbEventsRef.current = dbEvents
        setEvents(dbEvents)
        setHasSearched(true)
        setIsStartingSearch(false) // Clear immediately to show results
        setIsLoadingEvents(false) // Clear main loading state once DB data is visible
        setIsCheckingLiveRC(true)   // Show LiveRC indicator separately
        
        logger.debug("EventSearchContainer: DB events set, starting LiveRC check in background", {
          dbEventCount: dbEvents.length,
          dbEventIds: dbEvents.map((e) => e.id),
        })
        // Start LiveRC check in background - don't block UI rendering
        // Pass track data and event source IDs to avoid duplicate queries
        setTimeout(() => {
          checkLiveRC(trackDataFromSearch, dbEvents.map((e) => e.sourceEventId).filter((id): id is string => id !== undefined)).catch((error) => {
            logger.error("Error in auto-check LiveRC", {
            error: error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : String(error),
          })
          })
        }, 100)
      }
    } catch (error) {
      const errorId = generateErrorId()
      logger.error("Error searching events", {
        error: error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : String(error),
        errorId,
      })
      const errorMessage = error instanceof Error 
        ? `Network error: ${error.message}. Please check your connection and try again.`
        : "Unable to search events. Please try again."
      setErrors({ track: errorMessage })
      setApiError({
        message: errorMessage,
        errorId,
        details: error instanceof Error 
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
        onRetry: handleSearch,
      })
      setIsLoadingEvents(false)
      setIsStartingSearch(false) // Clear flag on error so UI is not stuck
    }
  }

  const checkLiveRC = async (
    trackData?: { id: string; source: string; source_track_slug: string; track_name: string },
    existingEventSourceIds: string[] = []
  ) => {
    if (!selectedTrack) return

    // Create new AbortController for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      setIsCheckingLiveRC(true)
      setErrors({})
      
      // Build request body - only include dates if date filter is enabled and dates are provided
      const requestBody: { 
        track_id: string
        start_date?: string
        end_date?: string
        existing_event_source_ids?: string[]
        track?: { id: string; source: string; sourceTrackSlug: string; trackName: string }
      } = {
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

      // Pass existing event source IDs to avoid duplicate DB queries
      if (existingEventSourceIds.length > 0) {
        requestBody.existing_event_source_ids = existingEventSourceIds
      }

      // Pass track info from search result to avoid re-querying
      if (trackData) {
        const sourceTrackSlug =
          trackData.source_track_slug || (trackData as { sourceTrackSlug?: string }).sourceTrackSlug || selectedTrack.sourceTrackSlug || ""
        const trackName =
          trackData.track_name || (trackData as { trackName?: string }).trackName || selectedTrack.trackName

        if (sourceTrackSlug) {
          requestBody.track = {
            id: trackData.id,
            source: trackData.source || "liverc",
            sourceTrackSlug,
            trackName,
          }
        }
      }

      const response = await fetch("/api/v1/events/discover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      })

      const result = await parseApiResponse<{
        new_events: ApiDiscoveredEvent[]
        existing_events: ApiDiscoveredEvent[]
      }>(response)

      if (!result.success) {
        // Handle timeout gracefully - it's expected if ingestion service is busy
        if (result.error.message?.includes("timeout")) {
          // Timeout is expected, don't show error but user will see no new events
          return
        }
        // Error occurred but we'll continue silently
        return
      }

      // Add new events from LiveRC
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
          logger.debug("EventSearchContainer: Adding LiveRC events to existing events", {
            prevEventCount: prevEvents.length,
            newEventCount: newEvents.length,
            prevEventIds: prevEvents.map((e) => e.id),
          })
          
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
          
          const finalEvents = [...filteredPrevEvents, ...uniqueNewEvents]
          logger.debug("EventSearchContainer: Final events after adding LiveRC events", {
            finalEventCount: finalEvents.length,
            dbEventCount: filteredPrevEvents.filter((e) => !e.id.startsWith("liverc-")).length,
            newLiveRCEventCount: uniqueNewEvents.length,
          })
          
          return finalEvents
        })
      } else {
        setNewEventsFromLiveRC([])
        // No new events found - DB events should still be visible
        // Explicitly ensure DB events are preserved (they were set before LiveRC check)
        // The setEvents callback above preserves prevEvents, so DB events should still be there
        logger.debug("LiveRC discovery completed with no new events - DB events should still be visible", {
          currentEventCount: events.length,
        })
        
        // Explicitly preserve DB events by ensuring they're still in state
        // This is a safety check - events should already be there from the initial setEvents(dbEvents) call
        ensureDbEventsVisible()
      }
      // No new events found - silently continue (no toast notification needed)
    } catch (error) {
      // Ignore AbortError - it's expected when a new search starts
      if (error instanceof Error && error.name === "AbortError") {
        logger.debug("LiveRC check cancelled by new search")
        return
      }

      logger.error("Error checking LiveRC", {
        error: error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : String(error),
      })
      ensureDbEventsVisible()
      // On error, DB events should still be visible (they were set before LiveRC check)
      // Don't clear events on error - preserve what we have
    } finally {
      // Clear abort controller reference if this is the current request
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
      }
      setIsCheckingLiveRC(false)
      if (isLoadingEvents) {
        setIsLoadingEvents(false)
      }
      // Clear loading state when LiveRC check completes
      // Note: isStartingSearch is already cleared when DB results are shown, so we don't need to clear it here
      if (keptLoadingForEmptyDB.current) {
        setIsLoadingEvents(false)
        setIsStartingSearch(false) // Clear for empty DB case
        keptLoadingForEmptyDB.current = false
      }
      // For DB events case, isLoadingEvents is already false (set when DB results were shown)
      // Mark that a search has been completed
      setHasSearched(true)
    }
  }

  const importEvent = async (
    event: Event,
    { refreshAfter = true, silentStart = false }: { refreshAfter?: boolean; silentStart?: boolean } = {}
  ) => {
    if (!selectedTrack) {
      return false
    }

      updateEventStatusOverride(event.id, "importing")
      updateEventErrorMessage(event.id) // Clear any previous error

    try {
      let ingestionResponse: ApiIngestionResult | null = null

      if (event.id && !event.id.startsWith("liverc-")) {
        const response = await fetch(`/api/v1/events/${event.id}/ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ depth: "laps_full" }),
        })
        const result = await parseApiResponse<ApiIngestionResult>(response)
        if (!result.success) {
          throw new Error(result.error.message)
        }
        ingestionResponse = result.data
      } else {
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
        const result = await parseApiResponse<ApiIngestionResult>(response)
        if (!result.success) {
          throw new Error(result.error.message)
        }
        ingestionResponse = result.data
      }

      const ingestionStatus = ingestionResponse?.status ?? "updated"
      const isPendingResponse = ingestionStatus === "in_progress"
      const clearLiveRcPlaceholder = () => {
        setNewEventsFromLiveRC((prev) =>
          prev.filter((newEvent) => newEvent.sourceEventId !== event.sourceEventId)
        )
      }

      if (isPendingResponse) {
        clearLiveRcPlaceholder()
        updateEventErrorMessage(event.id)

        setTimeout(() => {
          void handleSearch()
        }, PENDING_REFRESH_DELAY_MS)

        return true
      }

      updateEventStatusOverride(event.id)
      updateEventErrorMessage(event.id) // Clear error on success
      clearLiveRcPlaceholder()

      if (refreshAfter) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await handleSearch()
      }

      return true
    } catch (error) {
      logger.error("Error importing event", {
        error: error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : String(error),
      })

      let errorMessage = `Import failed. Please try again.`
      if (error instanceof Error) {
        errorMessage = error.message || errorMessage
      } else if (typeof error === "string") {
        errorMessage = error
      }

      updateEventStatusOverride(event.id, "failed")
      updateEventErrorMessage(event.id, errorMessage)
      return false
    }
  }

  const handleImportSingle = (event: Event) => {
    void importEvent(event)
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
    setApiError(null)
    setNewEventsFromLiveRC([])
    setEventStatusOverrides({})
    setEventErrorMessages({})
    handleClearSelection()

    // Clear localStorage
    try {
      localStorage.removeItem(LAST_DATE_RANGE_STORAGE_KEY)
      localStorage.removeItem(LAST_TRACK_STORAGE_KEY)
      localStorage.removeItem(USE_DATE_FILTER_STORAGE_KEY)
    } catch (error) {
      logger.error("Failed to clear localStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
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
      logger.error("Failed to save favourites", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Helper function to check if an event is importable
  const isEventImportable = (event: Event): boolean => {
    const overrideStatus = eventStatusOverrides[event.id]
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

  // Handle event selection toggle
  const handleEventSelect = (event: Event, selected: boolean) => {
    setSelectedEventIds((prev) => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(event.id)
      } else {
        newSet.delete(event.id)
      }
      
      // Persist to sessionStorage
      try {
        sessionStorage.setItem(SELECTED_EVENT_IDS_STORAGE_KEY, JSON.stringify(Array.from(newSet)))
      } catch (error) {
        logger.error("Failed to save selected event IDs to sessionStorage", {
          error: error instanceof Error ? error.message : String(error),
        })
      }
      
      return newSet
    })
  }

  // Handle select all importable events
  const handleSelectAllImportable = () => {
    const importableEvents = events.filter(isEventImportable)
    const newSet = new Set(importableEvents.map((e) => e.id))
    setSelectedEventIds(newSet)
    
    // Persist to sessionStorage
    try {
      sessionStorage.setItem(SELECTED_EVENT_IDS_STORAGE_KEY, JSON.stringify(Array.from(newSet)))
    } catch (error) {
      logger.error("Failed to save selected event IDs to sessionStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Handle clear selection
  const handleClearSelection = () => {
    setSelectedEventIds(new Set())
    try {
      sessionStorage.removeItem(SELECTED_EVENT_IDS_STORAGE_KEY)
    } catch (error) {
      logger.error("Failed to clear selected event IDs from sessionStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Handle bulk import
  const handleBulkImport = async () => {
    if (selectedEventIds.size === 0) return
    if (!selectedTrack) return

    // Filter to only importable events
    const eventsToImport = events.filter(
      (e) => selectedEventIds.has(e.id) && isEventImportable(e)
    )

    if (eventsToImport.length === 0) return

    setIsImportingBulk(true)
    setImportProgress({ current: 0, total: eventsToImport.length })

    let successfulImports = 0
    let failedImports = 0

    for (let i = 0; i < eventsToImport.length; i++) {
      const event = eventsToImport[i]
      setImportProgress({ current: i + 1, total: eventsToImport.length })
      
      // Set status to importing
      updateEventStatusOverride(event.id, "importing")

      const success = await importEvent(event, { refreshAfter: false, silentStart: true })
      
      if (success) {
        successfulImports++
        updateEventStatusOverride(event.id, "imported")
      } else {
        failedImports++
        updateEventStatusOverride(event.id, "failed")
      }
    }

    // Refresh event list after all imports complete
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await handleSearch()

    // Clear selection
    handleClearSelection()

    setIsImportingBulk(false)
    setImportProgress(null)
  }

  if (isLoadingTracks) {
    return (
      <div className="text-center py-8 w-full min-w-0" role="status" aria-live="polite">
        <p className="text-[var(--token-text-secondary)]">Loading tracks...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 w-full min-w-0">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isLoadingEvents
          ? "Loading events..."
          : isCheckingLiveRC
            ? "Checking LiveRC for additional events..."
            : ""}
      </div>
      
      {/* API Error Display */}
      {apiError && (
        <ErrorDisplay
          message={apiError.message}
          errorId={apiError.errorId}
          details={apiError.details as string | Record<string, unknown> | undefined}
          onRetry={apiError.onRetry}
          retryLabel="Retry Search"
        />
      )}
      
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

      {/* Bulk Import Bar */}
      <BulkImportBar
        selectedCount={selectedEventIds.size}
        importableCount={events.filter(isEventImportable).length}
        isImporting={isImportingBulk}
        importProgress={importProgress}
        onImport={handleBulkImport}
        onSelectAll={handleSelectAllImportable}
        onClearSelection={handleClearSelection}
      />

      {/* Event Table - Hide during search transition to prevent flash of old data */}
      {!isStartingSearch && (
        <EventTable 
          key={searchKey}
          events={events} 
          isLoading={isLoadingEvents || isCheckingLiveRC}
          hasSearched={hasSearched}
          onImportEvent={handleImportSingle}
          statusOverrides={eventStatusOverrides}
          errorMessages={eventErrorMessages}
          selectedEventIds={selectedEventIds}
          onEventSelect={handleEventSelect}
          isBulkImporting={isImportingBulk}
          onSelectAll={handleSelectAllImportable}
        />
      )}
      {/* Show loading state during transition */}
      {isStartingSearch && (
        <div className="mt-8 text-center py-8 w-full min-w-0" role="status" aria-live="polite">
          <p className="text-[var(--token-text-secondary)]">Searching for events...</p>
        </div>
      )}
    </div>
  )
}
