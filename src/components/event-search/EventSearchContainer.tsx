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
import CheckLiveRCButton from "./CheckLiveRCButton"
import ImportStatusToast, { type ImportStatus } from "./ImportStatusToast"
import { parseApiResponse } from "@/lib/api-response-helper"

const FAVOURITES_STORAGE_KEY = "mre_favourite_tracks"
const LAST_DATE_RANGE_STORAGE_KEY = "mre_last_date_range"
const LAST_TRACK_STORAGE_KEY = "mre_last_track"

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
  const [ignoreDates, setIgnoreDates] = useState<boolean>(false)
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

    // Load tracks from API
    loadTracks()
  }, [])

  const loadTracks = async () => {
    try {
      setIsLoadingTracks(true)
      const response = await fetch("/api/v1/tracks?followed=false&active=true")
      const result = await parseApiResponse<{ tracks: any[] }>(response)
      
      if (!result.success) {
        console.error("Error loading tracks:", result.error)
        setErrors({ track: result.error.message })
        return
      }
      
      setTracks(
        result.data.tracks.map((track: any) => ({
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

    // Skip date validation if "ignore dates" is checked
    if (!ignoreDates) {
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

          if (start > today || end > today) {
            newErrors.endDate = "Cannot select future dates. Please select today or earlier."
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
      ignoreDates 
    })
    if (!validateForm() || !selectedTrack) {
      console.log("EventSearchContainer: Validation failed or no track selected", {
        validationPassed: validateForm(),
        hasSelectedTrack: !!selectedTrack
      })
      return
    }

    try {
      setIsLoadingEvents(true)
      setErrors({})

      // Persist form values
      try {
        localStorage.setItem(
          LAST_DATE_RANGE_STORAGE_KEY,
          JSON.stringify({ startDate, endDate })
        )
        localStorage.setItem(LAST_TRACK_STORAGE_KEY, JSON.stringify(selectedTrack))
      } catch (error) {
        console.error("Failed to persist form values:", error)
      }

      // Build query string - only include dates if not ignoring dates and dates are provided
      const params = new URLSearchParams({
        track_id: selectedTrack.id,
      })
      
      if (!ignoreDates) {
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
        track: any
        events: any[]
      }>(response)

      if (!result.success) {
        // Handle validation errors
        if (result.error.code === "VALIDATION_ERROR") {
          const field = (result.error.details as any)?.field
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

      const dbEvents = result.data.events.map((event: any) => ({
        id: event.id,
        eventName: event.eventName,
        eventDate: event.eventDate || event.event_date,
        ingestDepth: event.ingestDepth || event.ingest_depth,
        sourceEventId: event.sourceEventId || event.source_event_id, // Include for matching
      }))

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:276',message:'Search returned events',data:{eventCount:dbEvents.length,events:dbEvents.map((e:any)=>({id:e.id,eventName:e.eventName,sourceEventId:e.sourceEventId,ingestDepth:e.ingestDepth}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E,F'})}).catch(()=>{});
      // #endregion

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

      // Build request body - only include dates if not ignoring dates and dates are provided
      const requestBody: any = {
        track_id: selectedTrack.id,
      }
      
      if (!ignoreDates) {
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
        new_events: any[]
        existing_events: any[]
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
        const newEvents = result.data.new_events.map((event: any) => ({
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
      } else {
        // No new events found
        setImportStatus({
          status: "completed",
          message: "No new events found on LiveRC for this search.",
        })
      }
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:420',message:'Import started',data:{eventId:event.id,eventName:event.eventName,sourceEventId:event.sourceEventId,ingestDepth:event.ingestDepth,hasSelectedTrack:!!selectedTrack,selectedTrackId:selectedTrack?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (!selectedTrack) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:423',message:'Import aborted - no selected track',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return
    }

    setImportingEventId(event.id)

    try {
      // Check if event has an id (edge case - should not happen for new events)
      if (event.id && !event.id.startsWith("liverc-")) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:429',message:'Using event ID endpoint',data:{eventId:event.id,endpoint:`/api/v1/events/${event.id}/ingest`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        // Event already exists in DB, use event ID endpoint
        const response = await fetch(`/api/v1/events/${event.id}/ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ depth: "laps_full" }),
        })
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:437',message:'API response received',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        const result = await parseApiResponse(response)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:440',message:'API response parsed',data:{success:result.success,hasError:!result.success,errorCode:!result.success?result.error?.code:undefined,errorMessage:!result.success?result.error?.message:undefined,hasData:result.success?!!result.data:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        if (!result.success) {
          throw new Error(result.error.message)
        }
      } else {
        // New event - use source ID endpoint
        // Extract sourceEventId from event (stored during discovery)
        const sourceEventId = event.sourceEventId
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:445',message:'Using source ID endpoint',data:{hasSourceEventId:!!sourceEventId,sourceEventId:sourceEventId,trackId:selectedTrack.id,endpoint:'/api/v1/events/ingest'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        if (!sourceEventId) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:448',message:'Missing sourceEventId error',data:{eventName:event.eventName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          throw new Error(`Missing sourceEventId for event: ${event.eventName}`)
        }
        
        const requestBody = {
          source_event_id: sourceEventId,
          track_id: selectedTrack.id,
          depth: "laps_full",
        }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:455',message:'Sending API request',data:{requestBody},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        const response = await fetch("/api/v1/events/ingest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:465',message:'API response received',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        const result = await parseApiResponse(response)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:468',message:'API response parsed',data:{success:result.success,hasError:!result.success,errorCode:!result.success?result.error?.code:undefined,errorMessage:!result.success?result.error?.message:undefined,responseData:result.success?result.data:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
        // #endregion
        if (!result.success) {
          throw new Error(result.error.message)
        }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:471',message:'Import API succeeded',data:{responseData:result.success?result.data:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
      }

      // Show success message
      setImportStatus({
        status: "completed",
        message: `Import completed for "${event.eventName}".`,
      })

      // Refresh search to update event status
      // Wait a moment to ensure the database transaction has committed
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:478',message:'Waiting before refresh',data:{waitMs:1000},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      await new Promise(resolve => setTimeout(resolve, 1000))
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:481',message:'Starting search refresh',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // Re-run search to get updated event list with imported event
      await handleSearch()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:484',message:'Search refresh completed',data:{eventCount:events.length,eventsSnapshot:events.map((e:Event)=>({id:e.id,eventName:e.eventName,sourceEventId:e.sourceEventId,ingestDepth:e.ingestDepth}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E,F'})}).catch(()=>{});
      // #endregion
      
      // Don't auto-check LiveRC immediately after import - the imported event should now be in DB
      // and will be found by the search. If user wants to check for new events, they can manually trigger it.
    } catch (error) {
      console.error("Error importing event:", error)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/81eec606-eae6-4063-8584-aec156f4ab27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'EventSearchContainer.tsx:491',message:'Import error caught',data:{errorMessage:error instanceof Error?error.message:String(error),errorName:error instanceof Error?error.name:undefined,errorStack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
      // #endregion
      
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
    setIgnoreDates(false)
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
    } catch (error) {
      console.error("Failed to clear localStorage:", error)
    }
  }

  const handleIgnoreDatesToggle = (checked: boolean) => {
    setIgnoreDates(checked)
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
        ignoreDates={ignoreDates}
        favourites={favourites}
        tracks={tracks}
        errors={errors}
        isLoading={isLoadingEvents}
        onTrackSelect={setSelectedTrack}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onIgnoreDatesChange={handleIgnoreDatesToggle}
        onToggleFavourite={handleToggleFavourite}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {/* Check LiveRC Button */}
      {selectedTrack && (
        <div className="flex justify-start">
          <CheckLiveRCButton onClick={checkLiveRC} isLoading={isCheckingLiveRC} />
        </div>
      )}

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

