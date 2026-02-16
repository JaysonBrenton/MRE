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

import { useState, useEffect, useRef, useMemo } from "react"
import EventSearchForm from "./EventSearchForm"
import { type Track } from "./TrackRow"
import EventTable from "./EventTable"
import EventSearchTableHeader from "./EventSearchTableHeader"
import EventRow, { type Event } from "./EventRow"
import { type EventStatus } from "@/components/molecules/EventStatusBadge"
import ErrorDisplay from "@/components/molecules/ErrorDisplay"
import ListPagination from "../event-analysis/ListPagination"
import PracticeDaySearchContainer from "../practice-days/PracticeDaySearchContainer"
import PracticeDayRow from "../practice-days/PracticeDayRow"
import { parseApiResponse } from "@/lib/api-response-helper"
import { clientLogger } from "@/lib/client-logger"
import { isPracticeDaysEnabled } from "@/lib/feature-flags"
import { isEventInFuture, formatDateLong, toLocalDateString } from "@/lib/date-utils"

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

/** Response when ingestion is queued (202); contains job_id to poll */
interface ApiQueuedIngestionResult {
  job_id: string
}

/** Ingested practice day from event search API (practice_days in response) */
interface ApiIngestedPracticeDay {
  id: string
  eventName: string
  eventDate: string | null
  sourceEventId: string
  trackId: string
  ingestDepth: string
}

/** Discovered practice day from practice-days/discover API */
interface DiscoveredPracticeDaySummary {
  date: string
  track_slug?: string
  session_count?: number
  total_laps?: number
  unique_drivers?: number
  unique_classes?: number
  time_range_start?: string | null
  time_range_end?: string | null
}

const JOB_POLL_INTERVAL_MS = 2000
const JOB_POLL_MAX_ATTEMPTS = 450 // ~15 min at 2s

/** Default lookback (days) for practice discover when no date filter is set (12 months). */
const PRACTICE_DISCOVER_DEFAULT_DAYS = 365

async function pollIngestionJobUntilComplete(
  jobId: string,
  onStatus?: (status: string) => void
): Promise<ApiIngestionResult> {
  for (let attempt = 0; attempt < JOB_POLL_MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`/api/v1/ingestion/jobs/${jobId}`)
    const parsed = await parseApiResponse<{
      job_id: string
      status: string
      result?: ApiIngestionResult
      error_code?: string
      error_message?: string
    }>(res)
    if (!parsed.success || !parsed.data) {
      throw new Error(parsed.success ? "No data" : parsed.error?.message ?? "Job status failed")
    }
    const { status, result, error_message } = parsed.data
    onStatus?.(status)
    if (status === "completed" && result) {
      return result
    }
    if (status === "failed") {
      throw new Error(error_message ?? "Import failed")
    }
    await new Promise((r) => setTimeout(r, JOB_POLL_INTERVAL_MS))
  }
  throw new Error("Import is taking longer than expected. Please check back later.")
}

const FAVOURITES_STORAGE_KEY = "mre_favourite_tracks"
const LAST_DATE_RANGE_STORAGE_KEY = "mre_last_date_range"
const LAST_TRACK_STORAGE_KEY = "mre_last_track"
const USE_DATE_FILTER_STORAGE_KEY = "mre_use_date_filter"
const DATE_RANGE_PRESET_STORAGE_KEY = "mre_date_range_preset"
const PAGINATION_STORAGE_KEY = "mre_event_search_pagination"
const PENDING_REFRESH_DELAY_MS = 5000

const KNOWN_IMPORTED_STORAGE_KEY = "mre_known_imported_events"
const KNOWN_IMPORTED_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const KNOWN_IMPORTED_MAX_SIZE = 200

function loadKnownImportedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(KNOWN_IMPORTED_STORAGE_KEY)
    if (!raw) return new Set()
    const { keys, updatedAt } = JSON.parse(raw) as {
      keys?: string[]
      updatedAt?: number
    }
    if (!Array.isArray(keys) || typeof updatedAt !== "number") return new Set()
    if (Date.now() - updatedAt > KNOWN_IMPORTED_TTL_MS) return new Set()
    return new Set(keys.slice(0, KNOWN_IMPORTED_MAX_SIZE))
  } catch {
    return new Set()
  }
}

function persistKnownImportedIds(ids: Set<string>) {
  try {
    const keys = Array.from(ids).slice(0, KNOWN_IMPORTED_MAX_SIZE)
    localStorage.setItem(
      KNOWN_IMPORTED_STORAGE_KEY,
      JSON.stringify({ keys, updatedAt: Date.now() })
    )
  } catch (e) {
    clientLogger.debug("Failed to persist known imported events", {
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

// Get default date range (last 30 days) - used for reset
function getDefaultDateRange(): { startDate: string; endDate: string } {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)
  return {
    startDate: toLocalDateString(startDate),
    endDate: toLocalDateString(endDate),
  }
}

function getRangeForPreset(preset: string): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()
  switch (preset) {
    case "last3":
      start.setMonth(start.getMonth() - 3)
      break
    case "last6":
      start.setMonth(start.getMonth() - 6)
      break
    case "last12":
      start.setDate(start.getDate() - 365)
      break
    case "thisYear":
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      break
    default:
      return { startDate: "", endDate: "" }
  }
  return {
    startDate: toLocalDateString(start),
    endDate: toLocalDateString(end),
  }
}

interface EventSearchContainerProps {
  onSelectForDashboard?: (eventId: string) => void
}

export type DateRangePreset =
  | "none"
  | "last3"
  | "last6"
  | "last12"
  | "thisYear"
  | "custom"

export default function EventSearchContainer({
  onSelectForDashboard,
}: EventSearchContainerProps = {}) {
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("last12")
  const useDateFilter = dateRangePreset !== "none"
  const [searchMode, setSearchMode] = useState<"events" | "practice-days">("events")
  const practiceDaysEnabled = isPracticeDaysEnabled()

  // Practice days month/year selection
  const currentDate = new Date()
  const [practiceYear, setPracticeYear] = useState<number>(currentDate.getFullYear())
  const [practiceMonth, setPracticeMonth] = useState<number>(currentDate.getMonth() + 1)
  const [practiceDaysSearchTrigger, setPracticeDaysSearchTrigger] = useState<number>(0)
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
  const [eventImportProgress, setEventImportProgress] = useState<
    Record<string, { stage?: string; counts?: { races: number; results: number; laps: number } }>
  >({})
  // Persisted set of event ids we've seen as fully imported; used so after reopen we still show "Ready" if API returns stale/empty ingest_depth
  const [knownImportedIds, setKnownImportedIds] = useState<Set<string>>(loadKnownImportedIds)
  const pollingIntervalsRef = useRef<Record<string, NodeJS.Timeout>>({}) // Track polling intervals per event
  const [searchKey, setSearchKey] = useState(0) // Key to force EventTable remount on new search
  const [isStartingSearch, setIsStartingSearch] = useState(false) // Track if we're starting a new search
  const dbEventsRef = useRef<Event[]>([]) // Ref to track DB events to ensure they're preserved
  const abortControllerRef = useRef<AbortController | null>(null) // Ref to track AbortController for cancelling LiveRC requests
  const [driverInEvents, setDriverInEvents] = useState<Record<string, boolean>>({}) // Map of sourceEventId to boolean
  const [isCheckingEntryLists, setIsCheckingEntryLists] = useState(false) // Track if we're checking entry lists
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [errors, setErrors] = useState<{
    track?: string
    startDate?: string
    endDate?: string
    year?: string
    month?: string
  }>({})
  const [apiError, setApiError] = useState<{
    message: string
    errorId?: string
    details?: unknown
    onRetry?: () => void
  } | null>(null)

  // Include practice days (events mode): combined list state
  const [includePracticeDays, setIncludePracticeDays] = useState(false)
  const [practiceDaysFromDb, setPracticeDaysFromDb] = useState<ApiIngestedPracticeDay[]>([])
  const [discoveredPracticeDays, setDiscoveredPracticeDays] = useState<
    DiscoveredPracticeDaySummary[]
  >([])
  const [isCheckingPracticeDays, setIsCheckingPracticeDays] = useState(false)
  const [ingestingPracticeDates, setIngestingPracticeDates] = useState<Set<string>>(new Set())
  /** Filter for combined results when include practice days: all | events | practice */
  const [resultFilter, setResultFilter] = useState<"all" | "events" | "practice">("all")

  // Track if ensureDbEventsVisible is currently executing to prevent infinite loops
  const isEnsuringDbEventsRef = useRef(false)
  // Ignore practice discover results from a previous search (e.g. user switched track before discover finished)
  const discoverRunIdRef = useRef(0)
  // Abort in-flight practice discover when user starts a new search or toggles off include practice days
  const discoverAbortControllerRef = useRef<AbortController | null>(null)

  const ensureDbEventsVisible = () => {
    // Prevent infinite loops by checking if already executing
    if (isEnsuringDbEventsRef.current) {
      clientLogger.debug("ensureDbEventsVisible already executing, skipping")
      return
    }

    isEnsuringDbEventsRef.current = true

    try {
      setEvents((prevEvents) => {
        if (dbEventsRef.current.length === 0) {
          return prevEvents
        }

        if (prevEvents.length === 0) {
          clientLogger.warn("Restoring DB events after LiveRC issue", {
            dbEventCount: dbEventsRef.current.length,
          })
          return dbEventsRef.current
        }

        const hasDbEvents = prevEvents.some((event) => !event.id.startsWith("liverc-"))
        if (!hasDbEvents) {
          clientLogger.warn("DB events missing from list - merging them back", {
            dbEventCount: dbEventsRef.current.length,
          })
          const existingLiveRCEvents = prevEvents.filter((event) => event.id.startsWith("liverc-"))
          return [...dbEventsRef.current, ...existingLiveRCEvents]
        }

        return prevEvents
      })
    } finally {
      // Reset flag after state update completes
      // Use setTimeout to ensure state update has been processed
      setTimeout(() => {
        isEnsuringDbEventsRef.current = false
      }, 0)
    }
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

      // Don't allow setting status override for scheduled events (except to clear it)
      // Find the event to check if it's scheduled
      const event = events.find((e) => e.id === eventId)
      if (event && isEventInFuture(event.eventDate) && status !== "scheduled") {
        // If trying to set a non-scheduled status on a scheduled event, set it to scheduled instead
        return { ...prev, [eventId]: "scheduled" }
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

  /** Per-request timeout for discover-range so one slow track doesn't block indefinitely. */
  const PRACTICE_DISCOVER_FETCH_MS = 20_000

  /** Discover practice days from LiveRC for a date range; filters out already-ingested dates. */
  async function discoverPracticeDaysInRange(
    trackId: string,
    practiceRangeMin: string | null,
    practiceRangeMax: string | null,
    ingestedPracticeDays: ApiIngestedPracticeDay[],
    options?: {
      trackSlug?: string
      signal?: AbortSignal
      /** When provided, enables streaming and calls with each month's practice days for partial UI updates */
      onStreamMonth?: (chunk: DiscoveredPracticeDaySummary[]) => void
    }
  ): Promise<DiscoveredPracticeDaySummary[]> {
    clientLogger.info("Practice discover started", {
      trackId,
      practiceRangeMin,
      practiceRangeMax,
      hasRange: !!(practiceRangeMin && practiceRangeMax),
    })
    if (!practiceRangeMin || !practiceRangeMax) {
      clientLogger.warn("Practice discover skipped: missing range", {
        practiceRangeMin,
        practiceRangeMax,
      })
      return []
    }

    const ingestedDates = new Set(
      ingestedPracticeDays
        .map((pd) => pd.eventDate)
        .filter((d): d is string => !!d)
        .map((d) => d.split("T")[0])
    )

    // Skip LiveRC when DB already covers the full range (performance)
    if (ingestedDates.size > 0) {
      const sorted = Array.from(ingestedDates).sort()
      const minIngested = sorted[0]
      const maxIngested = sorted[sorted.length - 1]
      if (minIngested <= practiceRangeMin && maxIngested >= practiceRangeMax) {
        clientLogger.info("Practice discover skipped: DB already covers range", {
          practiceRangeMin,
          practiceRangeMax,
          ingestedSpan: [minIngested, maxIngested],
        })
        return []
      }
    }

    const useStream = typeof options?.onStreamMonth === "function"
    const body = {
      track_id: trackId,
      start_date: practiceRangeMin,
      end_date: practiceRangeMax,
      ...(options?.trackSlug && { track_slug: options.trackSlug }),
      ...(useStream && { stream: true }),
    }

    let response: Response
    try {
      response = await fetch("/api/v1/practice-days/discover-range", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
        signal: options?.signal ?? AbortSignal.timeout(PRACTICE_DISCOVER_FETCH_MS * 2),
      })
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        clientLogger.debug("Practice discover aborted")
        return []
      }
      throw err
    }

    const allDiscovered: DiscoveredPracticeDaySummary[] = []

    if (useStream && response.body && response.ok) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            try {
              const obj = JSON.parse(trimmed) as {
                type: string
                year?: number
                month?: number
                practice_days?: DiscoveredPracticeDaySummary[]
                message?: string
              }
              if (obj.type === "month" && Array.isArray(obj.practice_days)) {
                const filtered = obj.practice_days.filter((pd) => {
                  const dateOnly =
                    typeof pd.date === "string" ? pd.date.split("T")[0] : (pd as { date?: string }).date
                  return dateOnly && !ingestedDates.has(dateOnly)
                })
                for (const pd of filtered) {
                  allDiscovered.push(pd as DiscoveredPracticeDaySummary)
                }
                options?.onStreamMonth?.(filtered)
              } else if (obj.type === "error") {
                clientLogger.warn("Practice discover-range stream error", { message: obj.message })
              }
            } catch {
              // ignore parse errors for partial lines
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
      clientLogger.info("Practice discover done (stream)", {
        totalDiscovered: allDiscovered.length,
      })
      return allDiscovered
    }

    const parsed = await parseApiResponse<{
      practice_days?: DiscoveredPracticeDaySummary[]
      practiceDays?: DiscoveredPracticeDaySummary[]
    }>(response)
    if (!parsed.success) {
      clientLogger.warn("Practice discover-range failed", {
        status: response.status,
        error: parsed.error?.message,
      })
      return []
    }

    const list = parsed.data?.practice_days ?? parsed.data?.practiceDays ?? []
    for (const pd of Array.isArray(list) ? list : []) {
      const dateOnly =
        typeof pd.date === "string" ? pd.date.split("T")[0] : (pd as { date?: string }).date
      if (dateOnly && !ingestedDates.has(dateOnly)) {
        allDiscovered.push(pd as DiscoveredPracticeDaySummary)
      }
    }

    clientLogger.info("Practice discover done", {
      totalDiscovered: allDiscovered.length,
    })
    return allDiscovered
  }

  // Check if an import is currently in progress for a DB event
  // Uses read-only GET endpoint to check status without triggering ingestion
  const checkImportInProgress = async (eventId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/v1/events/${eventId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await parseApiResponse<{
        id: string
        ingest_depth: string
        last_ingested_at: string | null
        status?: string
      }>(response)

      if (!result.success) {
        return false
      }

      // Check if ingestion is in progress by examining the event data
      // If ingest_depth is not "laps_full" and there's no last_ingested_at,
      // or if status is explicitly "in_progress", then ingestion may be in progress
      const ingestDepth = (result.data.ingest_depth || "").trim().toLowerCase()
      const isFullyImported = ingestDepth === "laps_full" || ingestDepth === "lapsfull"

      // If fully imported, not in progress
      if (isFullyImported) {
        return false
      }

      // If status is explicitly "in_progress", return true
      if (result.data.status === "in_progress") {
        return true
      }

      // We can't definitively determine if ingestion is in progress from GET endpoint alone
      // Return false to avoid false positives - user can manually trigger import if needed
      return false
    } catch (error) {
      // On error, assume not in progress (will be checked again later if needed)
      clientLogger.debug("Error checking import status", {
        eventId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  // Check import status for importable DB events in the background
  // Optimized to check events in parallel batches for better performance
  const checkImportStatusForEvents = async (eventsToCheck: Event[]) => {
    // Only check DB events that are importable (not fully imported)
    const importableDbEvents = eventsToCheck.filter(
      (event) =>
        !event.id.startsWith("liverc-") &&
        event.ingestDepth?.trim().toLowerCase() !== "laps_full" &&
        event.ingestDepth?.trim().toLowerCase() !== "lapsfull"
    )

    if (importableDbEvents.length === 0) {
      return
    }

    // Process events in parallel batches to avoid overwhelming the API
    // This dramatically improves performance compared to sequential checks
    const BATCH_SIZE = 5 // Check 5 events in parallel at a time
    for (let i = 0; i < importableDbEvents.length; i += BATCH_SIZE) {
      const batch = importableDbEvents.slice(i, i + BATCH_SIZE)

      // Check all events in the batch in parallel
      await Promise.allSettled(
        batch.map(async (event) => {
          try {
            const isInProgress = await checkImportInProgress(event.id)
            if (isInProgress) {
              updateEventStatusOverride(event.id, "importing")
              // Start polling to track progress
              pollEventImportStatus(event.id, 100, 2500, event.id, event.sourceEventId)
            }
          } catch (error) {
            // Log but continue checking other events
            clientLogger.debug("Error checking import status for event", {
              eventId: event.id,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        })
      )

      // Small delay between batches to avoid rate limiting
      // Reduced from 200ms per event to 100ms per batch (much faster overall)
      if (i + BATCH_SIZE < importableDbEvents.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }
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
      clientLogger.error("Failed to load favourites from localStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Load date range preset and range from localStorage
    try {
      const storedPreset = localStorage.getItem(DATE_RANGE_PRESET_STORAGE_KEY) as
        | DateRangePreset
        | null
      const storedDateRange = localStorage.getItem(LAST_DATE_RANGE_STORAGE_KEY)
      if (storedPreset && ["none", "last3", "last6", "last12", "thisYear", "custom"].includes(storedPreset)) {
        setDateRangePreset(storedPreset)
      }
      if (storedDateRange) {
        try {
          const { startDate: storedStart, endDate: storedEnd } = JSON.parse(storedDateRange)
          if (storedStart) setStartDate(storedStart)
          if (storedEnd) setEndDate(storedEnd)
        } catch {
          // ignore
        }
      }
      // If preset is not custom/none and we don't have valid dates, set from preset
      const preset = (storedPreset && ["none", "last3", "last6", "last12", "thisYear", "custom"].includes(storedPreset))
        ? storedPreset
        : "last12"
      if (preset !== "custom" && preset !== "none") {
        const range = getRangeForPreset(preset)
        setStartDate(range.startDate)
        setEndDate(range.endDate)
      }
    } catch (error) {
      clientLogger.error("Failed to load date range from localStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
      const range = getRangeForPreset("last12")
      setDateRangePreset("last12")
      setStartDate(range.startDate)
      setEndDate(range.endDate)
    }

    // Load last selected track from localStorage
    // Note: Track will be validated when tracks are loaded to ensure it still exists
    try {
      const storedTrack = localStorage.getItem(LAST_TRACK_STORAGE_KEY)
      if (storedTrack) {
        const parsedTrack = JSON.parse(storedTrack) as Track | null
        if (parsedTrack && parsedTrack.id) {
          // Store temporarily - will be validated after tracks load
          setSelectedTrack(parsedTrack)
        }
      }
    } catch (error) {
      clientLogger.error("Failed to load track from localStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Migrate old date filter toggle to preset: if user had filter on, treat as custom
    try {
      const storedUseDateFilter = localStorage.getItem(USE_DATE_FILTER_STORAGE_KEY)
      if (storedUseDateFilter && JSON.parse(storedUseDateFilter) === true) {
        setDateRangePreset("custom")
      }
    } catch {
      // ignore
    }

    // Load persisted pagination state from localStorage
    try {
      const storedPagination = localStorage.getItem(PAGINATION_STORAGE_KEY)
      if (storedPagination) {
        const { currentPage: storedPage, itemsPerPage: storedItemsPerPage } =
          JSON.parse(storedPagination)
        if (typeof storedPage === "number" && storedPage >= 1) {
          setCurrentPage(storedPage)
        }
        if (typeof storedItemsPerPage === "number" && storedItemsPerPage > 0) {
          setItemsPerPage(storedItemsPerPage)
        }
      }
    } catch (error) {
      clientLogger.error("Failed to load pagination state from localStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Load tracks from API
    loadTracks()
  }, [])

  // Validate selected track exists in loaded tracks whenever tracks change
  useEffect(() => {
    if (tracks.length > 0 && selectedTrack) {
      const trackExists = tracks.some((t) => t.id === selectedTrack.id)
      if (!trackExists) {
        clientLogger.warn("Selected track no longer exists in loaded tracks, clearing selection", {
          trackId: selectedTrack.id,
          trackName: selectedTrack.trackName,
          loadedTrackCount: tracks.length,
        })
        setSelectedTrack(null)
        setErrors({ track: "The selected track no longer exists. Please select a track again." })
        setApiError(null) // Clear any API errors related to the invalid track
        try {
          localStorage.removeItem(LAST_TRACK_STORAGE_KEY)
        } catch (error) {
          clientLogger.error("Failed to clear invalid track from localStorage", {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    }
  }, [tracks, selectedTrack])

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      // Stop all polling intervals when component unmounts
      Object.values(pollingIntervalsRef.current).forEach((intervalId) => {
        clearInterval(intervalId)
      })
      pollingIntervalsRef.current = {}
    }
  }, [])

  // Track mount status to prevent state updates after unmount
  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadTracks = async () => {
    try {
      setIsLoadingTracks(true)
      const response = await fetch("/api/v1/tracks?followed=false&active=true")
      const result = await parseApiResponse<{ tracks: ApiTrack[] }>(response)

      if (!result.success) {
        clientLogger.error("Error loading tracks", {
          error: result.error.message || String(result.error),
        })
        setErrors({ track: result.error.message })
        return
      }

      const loadedTracks = result.data.tracks.map((track) => ({
        id: track.id,
        trackName: track.trackName,
        sourceTrackSlug: track.sourceTrackSlug,
      }))

      setTracks(loadedTracks)

      // Validate that the stored selected track still exists in the loaded tracks
      // If not, clear it to prevent "Track not found" errors
      if (selectedTrack) {
        const trackExists = loadedTracks.some((t) => t.id === selectedTrack.id)
        if (!trackExists) {
          clientLogger.warn("Stored track no longer exists in database, clearing selection", {
            storedTrackId: selectedTrack.id,
            storedTrackName: selectedTrack.trackName,
          })
          setSelectedTrack(null)
          setApiError(null) // Clear any API errors related to the invalid track
          setErrors({ track: "The selected track no longer exists. Please select a track again." })
          try {
            localStorage.removeItem(LAST_TRACK_STORAGE_KEY)
          } catch (error) {
            clientLogger.error("Failed to clear invalid track from localStorage", {
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }
    } catch (error) {
      clientLogger.error("Error loading tracks", {
        error:
          error instanceof Error
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

  const validateForm = (trackOverride?: Track): boolean => {
    const newErrors: typeof errors = {}
    const effectiveTrack = trackOverride ?? selectedTrack

    if (!effectiveTrack) {
      newErrors.track = "Please select a track"
    }

    // Only validate dates when custom range is selected
    if (dateRangePreset === "custom") {
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
            newErrors.startDate =
              "Start date cannot be in the future. Please select today or earlier."
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

  const handleSearch = async (trackOverride?: Track) => {
    const trackToUse = trackOverride || selectedTrack
    // Update state if track override is provided to ensure consistency
    if (trackOverride && trackOverride.id !== selectedTrack?.id) {
      setSelectedTrack(trackOverride)
    }
    clientLogger.debug("EventSearchContainer: handleSearch called", {
      selectedTrack: trackToUse,
      startDate,
      endDate,
      useDateFilter,
      searchMode,
    })

    // For practice days mode, validation is handled by PracticeDaySearchContainer
    if (searchMode === "practice-days") {
      // Just ensure track, year, and month are set - PracticeDaySearchContainer will handle the rest
      // Check for valid values: year must be > 0, month must be between 1-12
      const hasValidYear = practiceYear && practiceYear > 0
      const hasValidMonth = practiceMonth && practiceMonth >= 1 && practiceMonth <= 12

      if (!trackToUse || !hasValidYear || !hasValidMonth) {
        setErrors({
          track: !trackToUse ? "Please select a track" : undefined,
          year: !hasValidYear ? "Please select a year" : undefined,
          month: !hasValidMonth ? "Please select a month" : undefined,
        })
        return
      }
      // Clear errors and trigger search by incrementing search trigger
      setErrors({})
      setPracticeDaysSearchTrigger((prev) => prev + 1)
      return
    }

    if (!validateForm(trackOverride) || !trackToUse) {
      clientLogger.debug("EventSearchContainer: Validation failed or no track selected", {
        validationPassed: validateForm(trackOverride),
        hasSelectedTrack: !!trackToUse,
      })
      return
    }

    // Validate that the track still exists in the loaded tracks list
    // This prevents searching with stale track IDs from localStorage
    const trackExists = tracks.some((t) => t.id === trackToUse.id)
    if (!trackExists) {
      clientLogger.warn("Selected track no longer exists in database, clearing selection", {
        trackId: trackToUse.id,
        trackName: trackToUse.trackName,
      })
      setSelectedTrack(null)
      setErrors({ track: "The selected track no longer exists. Please select a track again." })
      setApiError(null) // Clear any API errors related to the invalid track
      try {
        localStorage.removeItem(LAST_TRACK_STORAGE_KEY)
      } catch (error) {
        clientLogger.error("Failed to clear invalid track from localStorage", {
          error: error instanceof Error ? error.message : String(error),
        })
      }
      return
    }

    try {
      // Cancel any outstanding LiveRC request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }

      // Stop all polling intervals from previous searches to prevent them from
      // competing with the new search request. Any importing events in the new
      // results will have polling restarted by checkImportStatusForEvents.
      stopAllPolling()

      // Mark that we're starting a search to hide EventTable during transition
      setIsStartingSearch(true)
      // Clear all state FIRST to prevent any flash of old data
      // Order matters: clear search flag and events before setting loading state
      setHasSearched(false)
      setEvents([])
      dbEventsRef.current = [] // Clear DB events ref at start of new search
      setDriverInEvents({}) // Clear driver in events state on new search
      setCurrentPage(1) // Reset to first page on new search
      // Then increment search key to force EventTable remount with clean state
      setSearchKey((prev) => prev + 1)
      setIsLoadingEvents(true)
      setErrors({})

      clientLogger.debug("EventSearchContainer: Starting search", {
        trackId: trackToUse.id,
        useDateFilter,
      })
      // Note: isStartingSearch will be cleared when:
      // - For empty DB results: after LiveRC check completes (in checkLiveRC finally block)
      // - For DB results: after LiveRC check completes (in checkLiveRC finally block)
      // - For errors: in the catch block below

      // Persist form values
      try {
        localStorage.setItem(LAST_DATE_RANGE_STORAGE_KEY, JSON.stringify({ startDate, endDate }))
        localStorage.setItem(LAST_TRACK_STORAGE_KEY, JSON.stringify(trackToUse))
        localStorage.setItem(DATE_RANGE_PRESET_STORAGE_KEY, JSON.stringify(dateRangePreset))
      } catch (error) {
        clientLogger.error("Failed to persist form values", {
          error: error instanceof Error ? error.message : String(error),
        })
      }

      // Build query string - only include dates if date filter is enabled and dates are provided
      const params = new URLSearchParams({
        track_id: trackToUse.id,
      })

      if (useDateFilter) {
        if (startDate && startDate.trim() !== "") {
          params.append("start_date", startDate)
        }

        if (endDate && endDate.trim() !== "") {
          params.append("end_date", endDate)
        }
      }

      if (searchMode === "events" && includePracticeDays) {
        params.append("include_practice_days", "true")
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
        practice_days?: ApiIngestedPracticeDay[]
        practice_range_min?: string | null
        practice_range_max?: string | null
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
            message:
              result.error.message ||
              "Unable to search events. Please check your connection and try again.",
            errorId,
            details: result.error.details || { code: result.error.code, status: response.status },
            onRetry: handleSearch,
          })
        }
        setHasSearched(true) // Show "searched" state so user sees errors/empty instead of pre-search message
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

      const practiceDaysFromResponse =
        searchMode === "events" && includePracticeDays
          ? (result.data.practice_days ?? []).map((pd) => ({
              id: pd.id,
              eventName: pd.eventName,
              eventDate: pd.eventDate ?? null,
              sourceEventId: pd.sourceEventId,
              trackId: pd.trackId,
              ingestDepth: pd.ingestDepth,
            }))
          : []
      if (searchMode === "events") {
        if (includePracticeDays) {
          setPracticeDaysFromDb(practiceDaysFromResponse)
          setDiscoveredPracticeDays([])
        } else {
          setPracticeDaysFromDb([])
          setDiscoveredPracticeDays([])
        }
      }

      clientLogger.debug("EventSearchContainer: DB search completed", {
        eventCount: dbEvents.length,
        eventIds: dbEvents.map((e) => e.id),
        practiceDayCount: practiceDaysFromResponse.length,
      })

      // Store track data from search result for use in LiveRC discovery
      const trackDataFromSearch = result.data.track

      const practiceRangeMin =
        searchMode === "events" && includePracticeDays
          ? result.data.practice_range_min ?? null
          : null
      const practiceRangeMax =
        searchMode === "events" && includePracticeDays
          ? result.data.practice_range_max ?? null
          : null
      if (searchMode === "events" && includePracticeDays) {
        clientLogger.info("Search response practice range", {
          practice_range_min: result.data.practice_range_min ?? null,
          practice_range_max: result.data.practice_range_max ?? null,
          practiceRangeMin,
          practiceRangeMax,
        })
      }

      // If DB search returned no events, show empty state immediately and check LiveRC in background
      // If DB search returned events, show them immediately and check LiveRC in background
      // Note: LiveRC check now supports driver filtering, so we can call it even when filter is enabled
      if (dbEvents.length === 0) {
        // Show empty state immediately - don't block UI on LiveRC discovery
        // This improves perceived performance and gives users control
        setEvents(dbEvents)
        setHasSearched(true)
        setIsStartingSearch(false) // Clear immediately to show empty state
        setIsLoadingEvents(false) // Show empty state immediately, not loading
        setIsCheckingLiveRC(true) // Show LiveRC indicator separately
        keptLoadingForEmptyDB.current = false // No longer keeping loading state

        // After a DB cleanup, no events exist; clear cached "imported" IDs so LiveRC-only
        // events show as "new" with Import button instead of stale "Ready" with no actions
        setKnownImportedIds(new Set())
        persistKnownImportedIds(new Set())

        clientLogger.debug(
          "EventSearchContainer: No DB events found, starting LiveRC discovery in background",
          {
            trackId: trackToUse.id,
            trackName: trackToUse.trackName,
            sourceTrackSlug: trackToUse.sourceTrackSlug,
            hasTrackData: !!trackDataFromSearch,
            trackDataSourceSlug: trackDataFromSearch?.source_track_slug,
          }
        )

        // Start LiveRC check in background - don't block UI
        // Reduced timeout to 60 seconds (matching client timeout) for better UX
        const liveRCTimeout = setTimeout(() => {
          clientLogger.warn("LiveRC check timed out after 60 seconds", {
            trackId: trackToUse.id,
          })
          setIsCheckingLiveRC(false)
        }, 60 * 1000) // 60 second timeout (matches client timeout)

        checkLiveRC(trackDataFromSearch, [])
          .catch((error) => {
            clientLogger.error("Error in auto-check LiveRC", {
              trackId: trackToUse.id,
              error:
                error instanceof Error
                  ? {
                      name: error.name,
                      message: error.message,
                      stack: error.stack,
                    }
                  : String(error),
            })
            // Clear LiveRC checking state on error
            setIsCheckingLiveRC(false)
          })
          .finally(() => {
            clearTimeout(liveRCTimeout)
            setIsCheckingLiveRC(false)
          })

        if (includePracticeDays && trackToUse?.id) {
          // Use default lookback (or date filter) for discover so we get full window of practice days.
          const defaultEnd = new Date()
          const defaultStart = new Date()
          defaultStart.setDate(defaultStart.getDate() - PRACTICE_DISCOVER_DEFAULT_DAYS)
          const minStr = useDateFilter && startDate ? startDate : toLocalDateString(defaultStart)
          const maxStr = useDateFilter && endDate ? endDate : toLocalDateString(defaultEnd)
          clientLogger.info("Starting practice discover (no DB results)", {
            trackId: trackToUse.id,
            minStr,
            maxStr,
          })
          discoverAbortControllerRef.current?.abort()
          discoverAbortControllerRef.current = new AbortController()
          setIsCheckingPracticeDays(true)
          discoverRunIdRef.current = (discoverRunIdRef.current + 1) | 0
          const thisRunId = discoverRunIdRef.current
          discoverPracticeDaysInRange(
            trackToUse.id,
            minStr,
            maxStr,
            practiceDaysFromResponse,
            {
              trackSlug: trackDataFromSearch?.source_track_slug,
              signal: discoverAbortControllerRef.current.signal,
              onStreamMonth: (chunk) => {
                setDiscoveredPracticeDays((prev) => {
                  const next = [...prev]
                  const existingDates = new Set(prev.map((p) => (p.date ?? "").split("T")[0]))
                  for (const p of chunk) {
                    const d = (p.date ?? "").split("T")[0]
                    if (d && !existingDates.has(d)) {
                      next.push(p)
                      existingDates.add(d)
                    }
                  }
                  return next
                })
              },
            }
          )
            .then((discovered) => {
              if (discoverRunIdRef.current === thisRunId) {
                setDiscoveredPracticeDays(discovered)
              }
            })
            .catch((err) => {
              clientLogger.error("Practice discover failed", {
                error: err instanceof Error ? err.message : String(err),
              })
              if (discoverRunIdRef.current === thisRunId) {
                setDiscoveredPracticeDays([])
              }
            })
            .finally(() => {
              if (discoverRunIdRef.current === thisRunId) {
                setIsCheckingPracticeDays(false)
              }
            })
        }
      } else {
        // DB has results - show them immediately and check LiveRC in background
        // This provides instant feedback to users while LiveRC discovery runs asynchronously
        dbEventsRef.current = dbEvents
        setEvents(dbEvents)
        setHasSearched(true)
        setIsStartingSearch(false) // Clear immediately to show results
        setIsLoadingEvents(false) // Clear main loading state once DB data is visible
        setIsCheckingLiveRC(true) // Show LiveRC indicator separately

        // Clear stale overrides/progress for events that are now fully imported in this result set.
        // When user started import for a LiveRC event (keyed liverc-xxx) then left and came back,
        // the same event now has a DB id and may be laps_full; clear so we show derived "imported" status.
        const normalizedLapsFull = (d: string | undefined) =>
          (d || "").trim().toLowerCase() === "laps_full" || (d || "").trim().toLowerCase() === "lapsfull"
        setEventStatusOverrides((prev) => {
          const next = { ...prev }
          for (const event of dbEvents) {
            if (normalizedLapsFull(event.ingestDepth)) {
              delete next[event.id]
              if (event.sourceEventId) delete next[`liverc-${event.sourceEventId}`]
            }
          }
          return next
        })
        setEventImportProgress((prev) => {
          const next = { ...prev }
          for (const event of dbEvents) {
            if (normalizedLapsFull(event.ingestDepth)) {
              delete next[event.id]
              if (event.sourceEventId) delete next[`liverc-${event.sourceEventId}`]
            }
          }
          return next
        })
        setEventErrorMessages((prev) => {
          const next = { ...prev }
          for (const event of dbEvents) {
            if (normalizedLapsFull(event.ingestDepth)) {
              delete next[event.id]
              if (event.sourceEventId) delete next[`liverc-${event.sourceEventId}`]
            }
          }
          return next
        })

        // Persist fully-imported event ids so after reopening event search we still show "Ready" if API returns stale/empty ingest_depth
        setKnownImportedIds((prev) => {
          const next = new Set(prev)
          for (const event of dbEvents) {
            if (normalizedLapsFull(event.ingestDepth)) {
              next.add(event.id)
              if (event.sourceEventId) next.add(`liverc-${event.sourceEventId}`)
            }
          }
          persistKnownImportedIds(next)
          return next
        })

        clientLogger.debug(
          "EventSearchContainer: DB events set, starting LiveRC check in background",
          {
            dbEventCount: dbEvents.length,
            dbEventIds: dbEvents.map((e) => e.id),
          }
        )

        // Check if any importable events are currently importing (in background)
        const eventsForImportCheck = dbEvents.map((event) => ({
          id: event.id,
          eventName: event.eventName,
          eventDate: event.eventDate,
          ingestDepth: event.ingestDepth,
          sourceEventId: event.sourceEventId,
        }))
        checkImportStatusForEvents(eventsForImportCheck).catch((error) => {
          clientLogger.debug("Error checking import status for events", {
            error: error instanceof Error ? error.message : String(error),
          })
        })

        // Start LiveRC check in background - don't block UI rendering
        // Pass track data and event source IDs to avoid duplicate queries
        // Removed setTimeout delay - start immediately for better performance
        checkLiveRC(
          trackDataFromSearch,
          dbEvents.map((e) => e.sourceEventId).filter((id): id is string => id !== undefined)
        ).catch((error) => {
          clientLogger.error("Error in auto-check LiveRC", {
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                  }
                : String(error),
          })
        })

        if (includePracticeDays && selectedTrack?.id) {
          // Use default lookback range (or date filter) for discover so we get practice days
          // for the full window (e.g. last 12 months), not just the event date range.
          // Otherwise when events exist only in one month (e.g. August), October would never be requested.
          const defaultEnd = new Date()
          const defaultStart = new Date()
          defaultStart.setDate(defaultStart.getDate() - PRACTICE_DISCOVER_DEFAULT_DAYS)
          const minStr = useDateFilter && startDate ? startDate : toLocalDateString(defaultStart)
          const maxStr = useDateFilter && endDate ? endDate : toLocalDateString(defaultEnd)
          clientLogger.info("Starting practice discover (has DB results)", {
            trackId: selectedTrack.id,
            minStr,
            maxStr,
          })
          discoverAbortControllerRef.current?.abort()
          discoverAbortControllerRef.current = new AbortController()
          setIsCheckingPracticeDays(true)
          discoverRunIdRef.current = (discoverRunIdRef.current + 1) | 0
          const thisRunId = discoverRunIdRef.current
          discoverPracticeDaysInRange(
            selectedTrack.id,
            minStr,
            maxStr,
            practiceDaysFromResponse,
            {
              trackSlug: trackDataFromSearch?.source_track_slug,
              signal: discoverAbortControllerRef.current.signal,
              onStreamMonth: (chunk) => {
                setDiscoveredPracticeDays((prev) => {
                  const next = [...prev]
                  const existingDates = new Set(prev.map((p) => (p.date ?? "").split("T")[0]))
                  for (const p of chunk) {
                    const d = (p.date ?? "").split("T")[0]
                    if (d && !existingDates.has(d)) {
                      next.push(p)
                      existingDates.add(d)
                    }
                  }
                  return next
                })
              },
            }
          )
            .then((discovered) => {
              if (discoverRunIdRef.current === thisRunId) {
                setDiscoveredPracticeDays(discovered)
              }
            })
            .catch((err) => {
              clientLogger.error("Practice discover failed", {
                error: err instanceof Error ? err.message : String(err),
              })
              if (discoverRunIdRef.current === thisRunId) {
                setDiscoveredPracticeDays([])
              }
            })
            .finally(() => {
              if (discoverRunIdRef.current === thisRunId) {
                setIsCheckingPracticeDays(false)
              }
            })
        }
      }
    } catch (error) {
      const errorId = generateErrorId()
      clientLogger.error("Error searching events", {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : String(error),
        errorId,
      })
      const errorMessage =
        error instanceof Error
          ? `Network error: ${error.message}. Please check your connection and try again.`
          : "Unable to search events. Please try again."
      setErrors({ track: errorMessage })
      setApiError({
        message: errorMessage,
        errorId,
        details:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : String(error),
        onRetry: handleSearch,
      })
      setHasSearched(true) // Show "searched" state so user sees error instead of pre-search message
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
    // Client-side timeout: 60 seconds for better UX (matches ingestion client timeout)
    const clientTimeout = setTimeout(() => {
      abortController.abort()
    }, 60 * 1000)

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
      // Always include track info if we have sourceTrackSlug from any source
      const sourceTrackSlug =
        trackData?.source_track_slug ||
        (trackData as { sourceTrackSlug?: string })?.sourceTrackSlug ||
        selectedTrack.sourceTrackSlug ||
        ""
      const trackName =
        trackData?.track_name ||
        (trackData as { trackName?: string })?.trackName ||
        selectedTrack.trackName

      // Always include track info if we have sourceTrackSlug (required for LiveRC discovery)
      if (sourceTrackSlug) {
        requestBody.track = {
          id: trackData?.id || selectedTrack.id,
          source: trackData?.source || (selectedTrack.sourceTrackSlug ? "liverc" : "unknown"),
          sourceTrackSlug,
          trackName,
        }
        clientLogger.debug("checkLiveRC: Including track data in request", {
          trackId: selectedTrack.id,
          sourceTrackSlug,
          hasTrackData: !!trackData,
        })
      } else {
        clientLogger.error("checkLiveRC: Missing sourceTrackSlug, LiveRC discovery will fail", {
          trackId: selectedTrack.id,
          trackName: selectedTrack.trackName,
          hasTrackData: !!trackData,
          trackDataSourceSlug:
            trackData?.source_track_slug ||
            (trackData as { sourceTrackSlug?: string })?.sourceTrackSlug,
          selectedTrackSourceSlug: selectedTrack.sourceTrackSlug,
        })
        // Don't proceed if we don't have sourceTrackSlug - it's required for LiveRC discovery
        clearTimeout(clientTimeout)
        setIsCheckingLiveRC(false)
        if (isLoadingEvents) {
          setIsLoadingEvents(false)
        }
        return
      }

      clientLogger.debug("checkLiveRC: Making API request", {
        trackId: selectedTrack.id,
        requestBody: JSON.stringify(requestBody),
        hasSourceTrackSlug: !!sourceTrackSlug,
      })

      const response = await fetch("/api/v1/events/discover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      })

      clearTimeout(clientTimeout)

      clientLogger.debug("checkLiveRC: Received API response", {
        trackId: selectedTrack.id,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      })

      const result = await parseApiResponse<{
        new_events: ApiDiscoveredEvent[]
        existing_events: ApiDiscoveredEvent[]
      }>(response)

      clientLogger.debug("checkLiveRC: Parsed API response", {
        trackId: selectedTrack.id,
        success: result.success,
        newEventsCount: result.success ? result.data.new_events?.length : 0,
        existingEventsCount: result.success ? result.data.existing_events?.length : 0,
        error: result.success ? undefined : result.error,
      })

      if (!result.success) {
        // Handle timeout gracefully - it's expected if ingestion service is busy
        if (
          result.error.message?.includes("timeout") ||
          result.error.message?.includes("circuit open")
        ) {
          clientLogger.warn("LiveRC discovery timed out or circuit open", {
            trackId: selectedTrack.id,
            error: result.error.message,
          })
          // Timeout/circuit open is expected - user can manually retry
          // Don't show error, just let them see empty state with option to retry
          return
        }
        // Log other errors for debugging
        clientLogger.error("LiveRC discovery failed", {
          trackId: selectedTrack.id,
          errorCode: result.error.code,
          errorMessage: result.error.message,
          errorDetails: result.error.details,
        })
        // Error occurred but we'll continue silently to avoid disrupting UX
        // User can manually retry if needed
        return
      }

      // Log discovery results for debugging
      clientLogger.info("LiveRC discovery completed successfully", {
        trackId: selectedTrack.id,
        newEventsCount: result.data.new_events?.length || 0,
        existingEventsCount: result.data.existing_events?.length || 0,
        newEventIds: result.data.new_events?.map((e) => e.sourceEventId) || [],
      })

      // Add new events from LiveRC
      if (result.data.new_events && result.data.new_events.length > 0) {
        clientLogger.info("checkLiveRC: Found new LiveRC events to add", {
          trackId: selectedTrack.id,
          count: result.data.new_events.length,
          eventNames: result.data.new_events.map((e) => e.eventName),
        })
        // Convert discovered events to Event format
        // Store sourceEventId for import later
        const newEvents = result.data.new_events.map((event) => {
          // Debug: Log first few future events to see date format
          const isFuture = event.eventDate ? isEventInFuture(event.eventDate) : false
          if (result.data.new_events.indexOf(event) < 5) {
            clientLogger.info("LiveRC event date check", {
              eventName: event.eventName,
              eventDate: event.eventDate,
              eventDateType: typeof event.eventDate,
              parsedDate: event.eventDate ? new Date(event.eventDate).toISOString() : null,
              isFuture,
            })
          }
          return {
            id: event.id || `liverc-${event.sourceEventId}`,
            eventName: event.eventName,
            eventDate: event.eventDate,
            ingestDepth: "none", // Not imported yet
            sourceEventId: event.sourceEventId, // Store for import
          }
        })

        setNewEventsFromLiveRC(newEvents)

        // Add new events to the events list (they'll show with "New (LiveRC only)" status and Import button)
        // Use a callback to ensure we're working with the latest state
        setEvents((prevEvents) => {
          clientLogger.debug("EventSearchContainer: Adding LiveRC events to existing events", {
            prevEventCount: prevEvents.length,
            newEventCount: newEvents.length,
            prevEventIds: prevEvents.map((e) => e.id),
          })

          // Build sets of existing identifiers for deduplication
          const existingIds = new Set(prevEvents.map((e) => e.id))
          const existingSourceIds = new Set(
            prevEvents.map((e) => e.sourceEventId).filter((id): id is string => id !== undefined)
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
              clientLogger.debug("EventSearchContainer: Filtering out duplicate event by ID", {
                eventId: e.id,
              })
              return false
            }
            // Don't add if sourceEventId already exists in any event (DB or LiveRC)
            if (e.sourceEventId && existingSourceIds.has(e.sourceEventId)) {
              clientLogger.debug(
                "EventSearchContainer: Filtering out duplicate event by sourceEventId",
                { sourceEventId: e.sourceEventId }
              )
              return false
            }
            // Additional check: don't add if a DB event with this sourceEventId exists
            // This handles race conditions where checkLiveRC runs before DB event is visible
            if (e.sourceEventId) {
              const hasDbEventWithSourceId = filteredPrevEvents.some(
                (prev) => !prev.id.startsWith("liverc-") && prev.sourceEventId === e.sourceEventId
              )
              if (hasDbEventWithSourceId) {
                clientLogger.debug(
                  "EventSearchContainer: Filtering out event - DB event exists with same sourceEventId",
                  { sourceEventId: e.sourceEventId }
                )
                return false
              }
            }
            return true
          })

          const finalEvents = [...filteredPrevEvents, ...uniqueNewEvents]
          clientLogger.info("EventSearchContainer: Final events after adding LiveRC events", {
            finalEventCount: finalEvents.length,
            dbEventCount: filteredPrevEvents.filter((e) => !e.id.startsWith("liverc-")).length,
            newLiveRCEventCount: uniqueNewEvents.length,
            prevEventCount: prevEvents.length,
            filteredPrevEventCount: filteredPrevEvents.length,
            uniqueNewEventIds: uniqueNewEvents.map((e) => e.id),
            finalEventIds: finalEvents.map((e) => e.id),
            filteredOutCount: newEvents.length - uniqueNewEvents.length,
            existingIdsSize: existingIds.size,
            existingSourceIdsSize: existingSourceIds.size,
          })

          // Ensure we're actually returning events
          if (finalEvents.length === 0 && newEvents.length > 0) {
            clientLogger.error("EventSearchContainer: All LiveRC events were filtered out!", {
              newEventsCount: newEvents.length,
              uniqueNewEventsCount: uniqueNewEvents.length,
              existingIds: Array.from(existingIds),
              existingSourceIds: Array.from(existingSourceIds),
              newEventIds: newEvents.map((e) => e.id),
              newEventSourceIds: newEvents.map((e) => e.sourceEventId),
            })
          }

          // Clear loading state after processing events (for empty DB case)
          // This ensures events are visible before loading state is cleared (if events found)
          // Or loading is cleared immediately if no events found
          if (keptLoadingForEmptyDB.current) {
            if (finalEvents.length > 0) {
              // Events found - clear loading after React processes the update
              setTimeout(() => {
                setIsLoadingEvents(false)
                setIsStartingSearch(false)
              }, 0)
            } else {
              // No events found - clear loading immediately
              setIsLoadingEvents(false)
              setIsStartingSearch(false)
            }
          }

          return finalEvents
        })
      } else {
        clientLogger.info("checkLiveRC: No new LiveRC events found", {
          trackId: selectedTrack.id,
          currentEventCount: events.length,
        })
        setNewEventsFromLiveRC([])
        // No new events found - DB events should still be visible
        // Explicitly ensure DB events are preserved (they were set before LiveRC check)
        // The setEvents callback above preserves prevEvents, so DB events should still be there
        clientLogger.debug(
          "LiveRC discovery completed with no new events - DB events should still be visible",
          {
            currentEventCount: events.length,
          }
        )

        // Explicitly preserve DB events by ensuring they're still in state
        // This is a safety check - events should already be there from the initial setEvents(dbEvents) call
        ensureDbEventsVisible()

        // Clear loading state for empty DB case when no LiveRC events found
        if (keptLoadingForEmptyDB.current) {
          setIsLoadingEvents(false)
          setIsStartingSearch(false)
        }
      }
      // No new events found - silently continue (no toast notification needed)
    } catch (error) {
      clearTimeout(clientTimeout)

      // Ignore AbortError - it's expected when a new search starts or timeout occurs
      if (error instanceof Error && error.name === "AbortError") {
        clientLogger.debug("LiveRC check cancelled by new search or timeout")
        // Timeout is expected - user can manually retry
        return
      }

      clientLogger.error("Error checking LiveRC", {
        error:
          error instanceof Error
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
      // Mark that a search has been completed
      setHasSearched(true)
    }
  }

  const stopPollingEventStatus = (eventId: string) => {
    const intervalId = pollingIntervalsRef.current[eventId]
    if (intervalId) {
      clearInterval(intervalId)
      delete pollingIntervalsRef.current[eventId]
    }
  }

  // Stop all active polling intervals
  const stopAllPolling = () => {
    Object.keys(pollingIntervalsRef.current).forEach((eventId) => {
      stopPollingEventStatus(eventId)
    })
  }

  // Helper function to update a single event in the events array
  const updateEventInList = (
    eventId: string,
    updatedEventData: Partial<Event>,
    sourceEventId?: string
  ) => {
    setEvents((prevEvents) => {
      // First, try to find by eventId
      let eventIndex = prevEvents.findIndex((e) => e.id === eventId)

      // If not found and we have a sourceEventId, try finding by sourceEventId
      // This handles the case where a LiveRC event (liverc-*) got a new DB ID
      if (eventIndex === -1 && sourceEventId) {
        eventIndex = prevEvents.findIndex((e) => e.sourceEventId === sourceEventId)
      }

      if (eventIndex === -1) {
        // Event not found in list, return unchanged
        clientLogger.warn("Event not found in list for update", { eventId, sourceEventId })
        return prevEvents
      }

      const updatedEvents = [...prevEvents]
      updatedEvents[eventIndex] = {
        ...updatedEvents[eventIndex],
        ...updatedEventData,
      }

      return updatedEvents
    })
  }

  // Helper function to replace a LiveRC event with its DB equivalent
  const replaceLiveRCEventWithDBEvent = (oldEventId: string, newDbEvent: ApiEvent) => {
    setEvents((prevEvents) => {
      const eventIndex = prevEvents.findIndex((e) => e.id === oldEventId)
      if (eventIndex === -1) {
        // Event not found, return unchanged
        return prevEvents
      }

      const updatedEvents = [...prevEvents]
      // Replace the LiveRC event with the DB event
      updatedEvents[eventIndex] = {
        id: newDbEvent.id,
        eventName: newDbEvent.eventName,
        eventDate: newDbEvent.eventDate || newDbEvent.event_date || "",
        ingestDepth: (newDbEvent.ingestDepth || newDbEvent.ingest_depth || "").trim(),
        sourceEventId: newDbEvent.sourceEventId || newDbEvent.source_event_id,
      }

      return updatedEvents
    })
  }

  const pollEventImportStatus = (
    eventId: string,
    maxAttempts = 100,
    pollIntervalMs = 2500,
    displayEventId?: string,
    sourceEventId?: string
  ) => {
    // Stop any existing polling for this event
    stopPollingEventStatus(eventId)

    // Use displayEventId for progress lookup (the ID currently in events list), fallback to eventId
    const progressKey = displayEventId || eventId

    let attempts = 0
    let consecutiveErrors = 0
    const maxConsecutiveErrors = 3
    const startTime = Date.now()
    const maxDurationMs = 5 * 60 * 1000 // 5 minutes max
    let isMounted = true

    // Update progress immediately to show we're polling (replaces "Starting import...")
    setEventImportProgress((prev) => ({
      ...prev,
      [progressKey]: { stage: "Connecting to ingestion service..." },
    }))

    // Update status immediately on first tick (before waiting for interval)
    const updateStatusImmediately = () => {
      const elapsedMs = Date.now() - startTime
      let stage = "Starting import..."
      if (elapsedMs < 5000) {
        stage = "Starting import..."
      } else if (elapsedMs < 15000) {
        stage = "Fetching event data..."
      } else if (elapsedMs < 45000) {
        stage = "Importing races..."
      } else if (elapsedMs < 90000) {
        stage = "Importing results..."
      } else {
        stage = "Importing laps..."
      }
      setEventImportProgress((prev) => ({
        ...prev,
        [progressKey]: { stage },
      }))
    }

    const pollInterval = setInterval(async () => {
      // Check if component is still mounted
      if (!isMounted) {
        clearInterval(pollInterval)
        return
      }

      attempts++
      const elapsedMs = Date.now() - startTime

      // Stop polling if we've exceeded max attempts or duration
      if (attempts > maxAttempts || elapsedMs > maxDurationMs) {
        stopPollingEventStatus(eventId)
        // Clear progress state if polling timed out (only if mounted)
        if (isMountedRef.current) {
          setEventImportProgress((prev) => {
            const next = { ...prev }
            delete next[progressKey]
            delete next[eventId] // Also clean up by eventId in case it's different
            return next
          })
        }
        return
      }

      // Stop polling after too many consecutive errors
      if (consecutiveErrors >= maxConsecutiveErrors) {
        stopPollingEventStatus(eventId)
        if (isMountedRef.current) {
          setEventImportProgress((prev) => {
            const next = { ...prev }
            delete next[progressKey]
            delete next[eventId]
            return next
          })
        }
        clientLogger.warn("Stopped polling due to consecutive errors", {
          eventId,
          consecutiveErrors,
        })
        return
      }

      // Update stage based on elapsed time (simple heuristic)
      let stage = "Importing..."
      if (elapsedMs < 10000) {
        stage = "Fetching event data..."
      } else if (elapsedMs < 30000) {
        stage = "Importing races..."
      } else if (elapsedMs < 60000) {
        stage = "Importing results..."
      } else {
        stage = "Importing laps..."
      }

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setEventImportProgress((prev) => ({
          ...prev,
          [progressKey]: { stage },
        }))
      }

      try {
        // Use lightweight GET endpoint instead of full search
        const response = await fetch(`/api/v1/events/${eventId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        })

        const result = await parseApiResponse<{
          id: string
          ingest_depth: string
          last_ingested_at: string | null
          source_event_id?: string
        }>(response)

        if (!result.success) {
          consecutiveErrors++
          return
        }

        consecutiveErrors = 0 // Reset error count on success

        // Check if component is still mounted and event is still relevant
        if (!isMountedRef.current) {
          return
        }

        // Verify the event is still relevant by checking if selectedTrack is still set
        // This prevents race conditions when user performs a new search
        // Note: We can't reliably check events state here due to closure, but checking
        // selectedTrack is sufficient - if user changes track, polling should stop
        if (!selectedTrack) {
          stopPollingEventStatus(eventId)
          return
        }

        const ingestDepth = (result.data.ingest_depth || "").trim().toLowerCase()

        // If event is fully imported, stop polling and clear progress
        if (ingestDepth === "laps_full" || ingestDepth === "lapsfull") {
          stopPollingEventStatus(eventId)

          // Only update state if component is still mounted
          if (isMountedRef.current) {
            setEventImportProgress((prev) => {
              const next = { ...prev }
              delete next[progressKey]
              delete next[eventId] // Also clean up by eventId in case it's different
              return next
            })

            // Update event in place instead of refreshing entire list
            const eventData: Partial<Event> = {
              id: result.data.id,
              ingestDepth: result.data.ingest_depth,
              sourceEventId: result.data.source_event_id,
            }

            // If the event ID changed (LiveRC -> DB), replace the event
            if (result.data.id !== eventId && result.data.id !== displayEventId) {
              const oldEventId = displayEventId || eventId
              // Need to get full event data to replace - for now just update
              updateEventInList(eventId, eventData, result.data.source_event_id)
            } else {
              // Update existing event in place
              updateEventInList(eventId, eventData, result.data.source_event_id)
            }

            // Clear status override since event is now fully imported
            updateEventStatusOverride(eventId)
            // Also clear for the new ID if it changed
            if (result.data.id !== eventId) {
              updateEventStatusOverride(result.data.id)
            }

            // Persist so after reopening event search we still show "Ready"
            setKnownImportedIds((prev) => {
              const next = new Set(prev)
              next.add(result.data.id)
              const sid = result.data.source_event_id
              if (sid) next.add(`liverc-${sid}`)
              persistKnownImportedIds(next)
              return next
            })
          }
        }
      } catch (error) {
        consecutiveErrors++
        // Log error but continue polling (unless too many errors)
        clientLogger.warn("Error polling event import status", {
          eventId,
          error: error instanceof Error ? error.message : String(error),
          consecutiveErrors,
        })
      }
    }, pollIntervalMs)

    // Store interval ID for cleanup
    pollingIntervalsRef.current[eventId] = pollInterval

    // Update status immediately (don't wait for first interval)
    updateStatusImmediately()

    // Return cleanup function
    return () => {
      isMounted = false
      stopPollingEventStatus(eventId)
    }
  }

  const importEvent = async (
    event: Event,
    { refreshAfter = true }: { refreshAfter?: boolean } = {}
  ) => {
    if (!selectedTrack) {
      return false
    }

    // Validate that event is not in the future (Option 4: validation before API call)
    if (isEventInFuture(event.eventDate)) {
      const eventDateFormatted = event.eventDate ? formatDateLong(event.eventDate) : "a future date"
      const errorMessage = `This event is scheduled for ${eventDateFormatted}. Import will be available after the event occurs.`

      clientLogger.warn("Attempted to import future event", {
        eventId: event.id,
        eventName: event.eventName,
        eventDate: event.eventDate,
      })

      updateEventStatusOverride(event.id, "scheduled")
      updateEventErrorMessage(event.id, errorMessage)
      return false
    }

    updateEventStatusOverride(event.id, "importing")
    updateEventErrorMessage(event.id) // Clear any previous error

    // Set initial progress state immediately so user sees feedback right away
    setEventImportProgress((prev) => ({
      ...prev,
      [event.id]: { stage: "Starting import..." },
    }))

    // Start polling immediately (before API call) so status updates right away
    // We'll use a temporary event ID for polling until we get the real one from the API
    const tempPollingId = event.id
    pollEventImportStatus(tempPollingId, 100, 2500, event.id, event.sourceEventId)

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
        const result = await parseApiResponse<ApiIngestionResult | ApiQueuedIngestionResult>(response)
        if (!result.success) {
          if (result.error.code === "INGESTION_IN_PROGRESS") {
            clientLogger.warn("Import already in progress for event", {
              eventId: event.id,
              eventName: event.eventName,
            })
            return true
          }
          throw new Error(result.error.message)
        }
        const data = result.data
        if (data && "job_id" in data) {
          setEventImportProgress((prev) => ({ ...prev, [event.id]: { stage: "Queued..." } }))
          ingestionResponse = await pollIngestionJobUntilComplete(
            data.job_id,
            (status) =>
              setEventImportProgress((prev) => ({
                ...prev,
                [event.id]: { stage: status === "queued" ? "Queued..." : "Importing..." },
              }))
          )
        } else {
          ingestionResponse = data as ApiIngestionResult
        }
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

        // Use AbortController for timeout
        // Note: Browser fetch has NO built-in timeout, so we add one here
        // The API route has maxDuration=600s (10 min), so we set client timeout to 11 min
        // to account for network latency while staying under server timeout
        const controller = new AbortController()
        let timeoutId: NodeJS.Timeout | undefined
        try {
          timeoutId = setTimeout(() => controller.abort(), 11 * 60 * 1000) // 11 minutes (server timeout is 10 min)

          const response = await fetch("/api/v1/events/ingest", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          })

          if (timeoutId) {
            clearTimeout(timeoutId)
          }
          const result = await parseApiResponse<ApiIngestionResult | ApiQueuedIngestionResult>(response)
          if (!result.success) {
            if (result.error.code === "INGESTION_IN_PROGRESS") {
              clientLogger.warn("Import already in progress for event", {
                sourceEventId,
                eventName: event.eventName,
              })
              return true
            }
            throw new Error(result.error.message)
          }
          const data = result.data
          if (data && "job_id" in data) {
            setEventImportProgress((prev) => ({ ...prev, [event.id]: { stage: "Queued..." } }))
            ingestionResponse = await pollIngestionJobUntilComplete(
              data.job_id,
              (status) =>
                setEventImportProgress((prev) => ({
                  ...prev,
                  [event.id]: { stage: status === "queued" ? "Queued..." : "Importing..." },
                }))
            )
          } else {
            ingestionResponse = data as ApiIngestionResult
          }
        } catch (fetchError) {
          // Clear timeout if it was set
          if (timeoutId) {
            clearTimeout(timeoutId)
          }

          // Check if this is a connection/timeout error
          const isConnectionError =
            fetchError instanceof Error &&
            (fetchError.name === "AbortError" ||
              fetchError.message.includes("fetch failed") ||
              fetchError.message.includes("Failed to fetch") ||
              fetchError.message.includes("network") ||
              fetchError.message.includes("timeout") ||
              fetchError.message.includes("ECONNREFUSED") ||
              fetchError.message.includes("ENOTFOUND"))

          if (isConnectionError) {
            // Connection failed - check if ingestion actually succeeded in the background
            clientLogger.warn(
              "Connection error during ingestion, checking if ingestion succeeded",
              {
                sourceEventId,
                error: fetchError instanceof Error ? fetchError.message : String(fetchError),
              }
            )

            // Wait a moment for ingestion to potentially complete
            await new Promise((resolve) => setTimeout(resolve, 2000))

            // Check if event was actually ingested by searching for it
            if (selectedTrack) {
              try {
                const checkParams = new URLSearchParams({
                  track_id: selectedTrack.id,
                })
                if (useDateFilter) {
                  if (startDate && startDate.trim() !== "") {
                    checkParams.append("start_date", startDate)
                  }
                  if (endDate && endDate.trim() !== "") {
                    checkParams.append("end_date", endDate)
                  }
                }

                const checkResponse = await fetch(`/api/v1/events/search?${checkParams.toString()}`)
                const checkResult = await parseApiResponse<{
                  track: {
                    id: string
                    source: string
                    source_track_slug: string
                    track_name: string
                  }
                  events: ApiEvent[]
                }>(checkResponse)

                if (checkResult.success) {
                  // Try to find the event by sourceEventId
                  const foundEvent = checkResult.data.events.find(
                    (e) => e.sourceEventId === sourceEventId || e.source_event_id === sourceEventId
                  )

                  if (foundEvent) {
                    const ingestDepth = (foundEvent.ingestDepth || foundEvent.ingest_depth || "")
                      .trim()
                      .toLowerCase()

                    // If event is fully imported, treat as success
                    if (ingestDepth === "laps_full" || ingestDepth === "lapsfull") {
                      clientLogger.info("Ingestion succeeded despite connection error", {
                        sourceEventId,
                        eventId: foundEvent.id,
                      })

                      // Create a mock response to continue with success flow
                      ingestionResponse = {
                        event_id: foundEvent.id,
                        ingest_depth: "laps_full",
                        last_ingested_at: new Date().toISOString(),
                        races_ingested: 0,
                        results_ingested: 0,
                        laps_ingested: 0,
                        status: "updated",
                      }
                    } else {
                      // Event exists but not fully imported yet - start polling
                      clientLogger.info(
                        "Ingestion in progress despite connection error, starting polling",
                        {
                          sourceEventId,
                          eventId: foundEvent.id,
                          ingestDepth,
                        }
                      )

                      ingestionResponse = {
                        event_id: foundEvent.id,
                        ingest_depth: ingestDepth,
                        last_ingested_at: null,
                        races_ingested: 0,
                        results_ingested: 0,
                        laps_ingested: 0,
                        status: "in_progress",
                      }
                    }
                  } else {
                    // Event not found - rethrow original error
                    throw fetchError
                  }
                } else {
                  // Search failed - rethrow original error
                  throw fetchError
                }
              } catch (checkError) {
                // If check fails, rethrow original fetch error
                clientLogger.warn("Failed to check event status after connection error", {
                  sourceEventId,
                  checkError: checkError instanceof Error ? checkError.message : String(checkError),
                })
                throw fetchError
              }
            } else {
              // No track selected - can't check, rethrow error
              throw fetchError
            }
          } else {
            // Not a connection error - rethrow as-is
            throw fetchError
          }
        }
      }

      const ingestionStatus = ingestionResponse?.status ?? "updated"
      const isPendingResponse = ingestionStatus === "in_progress"
      const finalEventId = ingestionResponse?.event_id || event.id // Use event_id from response if available (for new imports)

      // If we have a new event ID (e.g., LiveRC event was created), update status override to use it
      if (finalEventId !== event.id && finalEventId) {
        // Clear old status override and set it on the new event ID
        updateEventStatusOverride(event.id) // Clear old
        updateEventStatusOverride(finalEventId, "importing") // Set importing status on new ID

        // Stop old polling and start new polling with the correct event ID
        stopPollingEventStatus(event.id)
        pollEventImportStatus(finalEventId, 100, 2500, event.id, event.sourceEventId)
      }

      const clearLiveRcPlaceholder = () => {
        setNewEventsFromLiveRC((prev) =>
          prev.filter((newEvent) => newEvent.sourceEventId !== event.sourceEventId)
        )
      }

      // Store progress - use event.id for lookup (the ID currently in the events list)
      // Also store with finalEventId if different (for after refresh when ID might change)
      const progressKey = event.id // Use current event ID for immediate display

      // Always set progress state, include counts if available
      const hasCounts =
        ingestionResponse &&
        (ingestionResponse.races_ingested > 0 ||
          ingestionResponse.results_ingested > 0 ||
          ingestionResponse.laps_ingested > 0)

      setEventImportProgress((prev) => {
        const progressData = hasCounts
          ? {
              stage: "Importing...",
              counts: {
                races: ingestionResponse!.races_ingested,
                results: ingestionResponse!.results_ingested,
                laps: ingestionResponse!.laps_ingested,
              },
            }
          : { stage: "Importing..." }

        const updated = {
          ...prev,
          [progressKey]: progressData,
        }
        // Also store with finalEventId if different (for after refresh)
        if (finalEventId !== event.id && finalEventId) {
          updated[finalEventId] = progressData
        }
        return updated
      })

      if (isPendingResponse) {
        clearLiveRcPlaceholder()
        updateEventErrorMessage(finalEventId !== event.id ? finalEventId : event.id)

        // Polling already started above, but ensure it's using the correct event ID
        if (finalEventId !== event.id) {
          // Already handled above when we detected the new event ID
        } else {
          // Ensure polling is running with the correct ID
          pollEventImportStatus(finalEventId, 100, 2500, event.id, event.sourceEventId)
        }

        // Polling will handle the update when import completes
        return true
      }

      // Import completed immediately - fetch updated event data and update in place
      stopPollingEventStatus(finalEventId)

      let didUpdateListFromSearch = false
      // Fetch the updated event data to update the list
      try {
        if (!selectedTrack) {
          throw new Error("No track selected")
        }

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

        const response = await fetch(`/api/v1/events/search?${params.toString()}`)
        const result = await parseApiResponse<{
          track: { id: string; source: string; source_track_slug: string; track_name: string }
          events: ApiEvent[]
        }>(response)

        if (result.success) {
          // Find the updated event - try by finalEventId first, then by sourceEventId
          let updatedEvent = result.data.events.find((e) => e.id === finalEventId)

          // If not found and we have a sourceEventId, try finding by sourceEventId
          if (!updatedEvent && event.sourceEventId) {
            updatedEvent = result.data.events.find(
              (e) =>
                e.sourceEventId === event.sourceEventId || e.source_event_id === event.sourceEventId
            )
          }

          if (updatedEvent) {
            didUpdateListFromSearch = true
            const eventData: Partial<Event> = {
              id: updatedEvent.id,
              eventName: updatedEvent.eventName,
              eventDate: updatedEvent.eventDate || updatedEvent.event_date || "",
              ingestDepth: (updatedEvent.ingestDepth || updatedEvent.ingest_depth || "").trim(),
              sourceEventId: updatedEvent.sourceEventId || updatedEvent.source_event_id,
            }

            // If the event ID changed (LiveRC -> DB), replace the event
            if (updatedEvent.id !== event.id && event.id.startsWith("liverc-")) {
              replaceLiveRCEventWithDBEvent(event.id, updatedEvent)
            } else {
              // Update existing event in place - find by original event.id, not finalEventId
              // because the event in the list still has the original ID
              updateEventInList(
                event.id,
                eventData,
                updatedEvent.sourceEventId || updatedEvent.source_event_id
              )
            }
          }
        }

        // Robust fallback: when search didn't return the new event (e.g. race with concurrent
        // imports or filters), update the row from the job result so the UI always shows completed
        if (
          !didUpdateListFromSearch &&
          event.id.startsWith("liverc-") &&
          finalEventId &&
          ingestionResponse
        ) {
          const syntheticEvent = {
            id: finalEventId,
            eventName: event.eventName,
            eventDate: event.eventDate ?? "",
            ingest_depth: ingestionResponse.ingest_depth,
            ingestDepth: ingestionResponse.ingest_depth,
            source_event_id: event.sourceEventId,
            sourceEventId: event.sourceEventId,
          }
          replaceLiveRCEventWithDBEvent(event.id, syntheticEvent)
          setKnownImportedIds((prev) => {
            const next = new Set(prev)
            next.add(finalEventId)
            if (event.sourceEventId) next.add(`liverc-${event.sourceEventId}`)
            persistKnownImportedIds(next)
            return next
          })
          didUpdateListFromSearch = true
        }
      } catch (error) {
        clientLogger.warn("Failed to fetch updated event data after import", {
          error: error instanceof Error ? error.message : String(error),
          eventId: finalEventId,
        })
        // Fallback below will still update the row from the job result
      }

      // Fallback when search didn't return the event or failed: update row from job result so the
      // queued import always shows completed (e.g. when two imports finish close together)
      if (
        event.id.startsWith("liverc-") &&
        finalEventId &&
        ingestionResponse &&
        !didUpdateListFromSearch
      ) {
        const syntheticEvent = {
          id: finalEventId,
          eventName: event.eventName,
          eventDate: event.eventDate ?? "",
          ingest_depth: ingestionResponse.ingest_depth,
          ingestDepth: ingestionResponse.ingest_depth,
          source_event_id: event.sourceEventId,
          sourceEventId: event.sourceEventId,
        }
        replaceLiveRCEventWithDBEvent(event.id, syntheticEvent)
        setKnownImportedIds((prev) => {
          const next = new Set(prev)
          next.add(finalEventId)
          if (event.sourceEventId) next.add(`liverc-${event.sourceEventId}`)
          persistKnownImportedIds(next)
          return next
        })
      }

      // Clear progress state after a delay so user can see final counts
      setTimeout(() => {
        setEventImportProgress((prev) => {
          const next = { ...prev }
          delete next[progressKey]
          if (finalEventId !== event.id && finalEventId) {
            delete next[finalEventId]
          }
          return next
        })
      }, 2000) // Clear after 2 seconds

      updateEventStatusOverride(finalEventId !== event.id ? finalEventId : event.id)
      updateEventErrorMessage(finalEventId !== event.id ? finalEventId : event.id) // Clear error on success
      clearLiveRcPlaceholder()

      return true
    } catch (error) {
      // Determine error message first to check if it's an expected error
      let errorMessage = `Import failed. Please try again.`
      let isExpectedError = false

      if (error instanceof Error) {
        const message = error.message || errorMessage
        // Check if this is an empty entry list error (expected error)
        if (message.toLowerCase().includes("entry list is empty")) {
          errorMessage = message
          isExpectedError = true
          // The message from the pipeline already includes helpful context, so we use it as-is
        } else {
          errorMessage = message
        }
      } else if (typeof error === "string") {
        errorMessage = error
        if (error.toLowerCase().includes("entry list is empty")) {
          isExpectedError = true
        }
      }

      // Log at appropriate level: warn for expected errors, error for unexpected errors
      if (isExpectedError) {
        clientLogger.warn("Event import skipped - entry list is empty", {
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : String(error),
        })
      } else {
        clientLogger.error("Error importing event", {
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                }
              : String(error),
        })
      }

      // Stop polling and clear progress on error
      stopPollingEventStatus(event.id)
      setEventImportProgress((prev) => {
        const next = { ...prev }
        delete next[event.id]
        return next
      })

      updateEventStatusOverride(event.id, "failed")
      updateEventErrorMessage(event.id, errorMessage)
      return false
    }
  }

  const handleImportSingle = (event: Event) => {
    void importEvent(event)
  }

  const handleDateRangePresetChange = (preset: DateRangePreset) => {
    setDateRangePreset(preset)
    if (preset !== "custom" && preset !== "none") {
      const range = getRangeForPreset(preset)
      setStartDate(range.startDate)
      setEndDate(range.endDate)
    }
    setErrors((prev) => ({
      ...prev,
      startDate: undefined,
      endDate: undefined,
    }))
  }

  const handleTrackSelect = (track: Track) => {
    setSelectedTrack(track)
    setErrors((prev) => ({ ...prev, track: undefined }))
  }

  const handleToggleFavourite = (trackId: string) => {
    const newFavourites = favourites.includes(trackId)
      ? favourites.filter((id) => id !== trackId)
      : [...favourites, trackId]

    setFavourites(newFavourites)

    try {
      localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(newFavourites))
    } catch (error) {
      clientLogger.error("Failed to save favourites", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Helper function to check if an event is importable
  const isEventImportable = (event: Event): boolean => {
    // Check if event is in the future - scheduled events cannot be imported
    if (isEventInFuture(event.eventDate)) {
      return false
    }

    const overrideStatus = eventStatusOverrides[event.id]
    if (overrideStatus) {
      // Only "new" status makes an event importable
      // "importing", "imported", "failed", "scheduled", etc. make it not importable
      if (overrideStatus === "new") {
        return true
      }
      // For any other override status (importing, imported, failed, scheduled), event is not importable
      return false
    }
    // Check if LiveRC-only event
    if (event.id.startsWith("liverc-")) {
      return true
    }
    // Check ingest depth
    const normalizedDepth = event.ingestDepth?.trim().toLowerCase() || ""
    return normalizedDepth !== "laps_full" && normalizedDepth !== "lapsfull"
  }

  // Handle check entry lists for driver
  const handleCheckEntryLists = async () => {
    if (!selectedTrack) return

    // Filter to liverc events (not yet imported) and DB events (already imported)
    const livercEvents = events.filter(
      (event) => event.id.startsWith("liverc-") && event.sourceEventId
    )
    const dbEvents = events.filter((event) => !event.id.startsWith("liverc-") && event.id)

    if (livercEvents.length === 0 && dbEvents.length === 0) {
      clientLogger.debug("No events to check")
      return
    }

    setIsCheckingEntryLists(true)
    setErrors({})

    try {
      // Add client-side timeout (6 minutes to match server timeout)
      const abortController = new AbortController()
      const timeoutId = setTimeout(
        () => {
          abortController.abort()
        },
        6 * 60 * 1000
      ) // 6 minutes

      // Build events array with both LiveRC and DB events
      const eventsToCheck: Array<{ source_event_id?: string; event_id?: string }> = []

      // Add LiveRC events
      for (const event of livercEvents) {
        if (event.sourceEventId) {
          eventsToCheck.push({
            source_event_id: event.sourceEventId,
          })
        }
      }

      // Add DB events
      for (const event of dbEvents) {
        eventsToCheck.push({
          event_id: event.id,
        })
      }

      let response: Response
      try {
        response = await fetch("/api/v1/events/check-entry-lists", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            events: eventsToCheck,
            track_slug: selectedTrack.sourceTrackSlug, // Required for LiveRC events
          }),
          signal: abortController.signal,
        })
      } catch (fetchError) {
        clearTimeout(timeoutId)
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          throw new Error(
            "Request timed out. The check is taking longer than expected. Please try again with fewer events or check if the ingestion service is running."
          )
        }
        throw fetchError
      }
      clearTimeout(timeoutId)

      const result = await parseApiResponse<{
        driver_in_events: Record<string, boolean>
        errors: Record<string, string>
      }>(response)

      if (!result.success) {
        clientLogger.error("Error checking entry lists", {
          error: result.error.message || String(result.error),
        })
        setApiError({
          message: result.error.message || "Unable to check entry lists. Please try again.",
          errorId: generateErrorId(),
          details: result.error.details || { code: result.error.code },
          onRetry: handleCheckEntryLists,
        })
        return
      }

      // Update state with results
      // The API returns results keyed by sourceEventId (for LiveRC) or eventId (for DB)
      setDriverInEvents(result.data.driver_in_events)

      // Log any errors for individual events
      if (Object.keys(result.data.errors).length > 0) {
        clientLogger.warn("Some entry list checks failed", {
          errors: result.data.errors,
        })
      }

      clientLogger.info("Entry list check completed", {
        checkedLiveRCEvents: livercEvents.length,
        checkedDbEvents: dbEvents.length,
        foundInEvents: Object.values(result.data.driver_in_events).filter(Boolean).length,
      })
    } catch (error) {
      const errorId = generateErrorId()
      clientLogger.error("Error checking entry lists", {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : String(error),
        errorId,
      })
      setApiError({
        message:
          error instanceof Error
            ? `Network error: ${error.message}. Please check your connection and try again.`
            : "Unable to check entry lists. Please try again.",
        errorId,
        details:
          error instanceof Error ? { name: error.name, message: error.message } : String(error),
        onRetry: handleCheckEntryLists,
      })
    } finally {
      setIsCheckingEntryLists(false)
    }
  }

  const handleImportPracticeDay = async (trackId: string, dateStr: string) => {
    const dateOnly = dateStr.split("T")[0]
    if (!dateOnly) return
    setIngestingPracticeDates((prev) => new Set(prev).add(dateOnly))
    setApiError(null)
    try {
      const res = await fetch("/api/v1/practice-days/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_id: trackId, date: dateOnly }),
      })
      const parsed = await parseApiResponse<{ eventId?: string }>(res)
      if (!parsed.success) {
        setApiError({
          message: parsed.error?.message ?? "Import failed",
          errorId: generateErrorId(),
          details: parsed.error?.details,
          onRetry: () => handleImportPracticeDay(trackId, dateStr),
        })
        return
      }
      // Optimistic update: add ingested practice day to list without refetching full search
      const eventId = parsed.data?.eventId
      if (eventId) {
        const newRow: ApiIngestedPracticeDay = {
          id: eventId,
          eventName: "",
          eventDate: dateOnly,
          sourceEventId: `${trackId}-practice-${dateOnly}`,
          trackId,
          ingestDepth: "",
        }
        setPracticeDaysFromDb((prev) => [...prev, newRow])
        setDiscoveredPracticeDays((prev) =>
          prev.filter((pd) => (pd.date ?? "").split("T")[0] !== dateOnly)
        )
      }
    } catch (err) {
      setApiError({
        message: err instanceof Error ? err.message : "Failed to import practice day",
        errorId: generateErrorId(),
        onRetry: () => handleImportPracticeDay(trackId, dateStr),
      })
    } finally {
      setIngestingPracticeDates((prev) => {
        const next = new Set(prev)
        next.delete(dateOnly)
        return next
      })
    }
  }

  // Get events count for button visibility (both LiveRC and DB events)
  const livercEventsCount = events.filter(
    (event) => event.id.startsWith("liverc-") && event.sourceEventId
  ).length
  const dbEventsCount = events.filter((event) => !event.id.startsWith("liverc-") && event.id).length
  const totalEventsCount = livercEventsCount + dbEventsCount

  // Combined list (events + practice days) when include practice days is on.
  // Practice days are merged by date so ingested rows keep discovered metadata (sessions, laps, drivers, classes).
  type CombinedItem =
    | { kind: "event"; event: Event }
    | {
        kind: "practice"
        ingested?: ApiIngestedPracticeDay
        discovered?: DiscoveredPracticeDaySummary
      }
  const combinedListItems: CombinedItem[] = useMemo(() => {
    if (!includePracticeDays || searchMode !== "events") {
      return events.map((e) => ({ kind: "event" as const, event: e }))
    }
    const byDate = new Map<
      string,
      { ingested?: ApiIngestedPracticeDay; discovered?: DiscoveredPracticeDaySummary }
    >()
    for (const pd of practiceDaysFromDb) {
      const d = pd.eventDate ? pd.eventDate.split("T")[0] : ""
      if (d) byDate.set(d, { ...byDate.get(d), ingested: pd })
    }
    for (const pd of discoveredPracticeDays) {
      const d = (pd.date ?? "").split("T")[0]
      if (d) byDate.set(d, { ...byDate.get(d), discovered: pd })
    }
    const practiceItems: CombinedItem[] = Array.from(byDate.entries()).map(([, v]) => ({
      kind: "practice" as const,
      ingested: v.ingested,
      discovered: v.discovered,
    }))
    const items: CombinedItem[] = [
      ...events.map((e) => ({ kind: "event" as const, event: e })),
      ...practiceItems,
    ]
    const getDate = (item: CombinedItem): string => {
      if (item.kind === "event") return item.event.eventDate ?? ""
      const pd = item
      return pd.ingested?.eventDate?.split("T")[0] ?? pd.discovered?.date ?? ""
    }
    items.sort((a, b) => {
      const da = getDate(a)
      const db = getDate(b)
      return db.localeCompare(da)
    })
    return items
  }, [
    includePracticeDays,
    searchMode,
    events,
    practiceDaysFromDb,
    discoveredPracticeDays,
  ])

  const filteredCombinedList =
    includePracticeDays && searchMode === "events"
      ? resultFilter === "all"
        ? combinedListItems
        : resultFilter === "events"
          ? combinedListItems.filter((i) => i.kind === "event")
          : combinedListItems.filter((i) => i.kind === "practice")
      : combinedListItems
  const totalItems =
    includePracticeDays && searchMode === "events"
      ? filteredCombinedList.length
      : events.length
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedEvents = events.slice(startIndex, endIndex)
  const paginatedCombinedItems =
    includePracticeDays && searchMode === "events"
      ? filteredCombinedList.slice(startIndex, endIndex)
      : []

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Persist to localStorage
    try {
      localStorage.setItem(
        PAGINATION_STORAGE_KEY,
        JSON.stringify({ currentPage: page, itemsPerPage })
      )
    } catch (error) {
      clientLogger.error("Failed to save pagination state to localStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Handle rows per page change
  const handleRowsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    // Reset to first page when changing items per page
    setCurrentPage(1)
    // Persist to localStorage
    try {
      localStorage.setItem(
        PAGINATION_STORAGE_KEY,
        JSON.stringify({ currentPage: 1, itemsPerPage: newItemsPerPage })
      )
    } catch (error) {
      clientLogger.error("Failed to save pagination state to localStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Reset pagination when list length changes (but keep itemsPerPage)
  useEffect(() => {
    const len = includePracticeDays && searchMode === "events" ? combinedListItems.length : events.length
    if (len > 0) {
      const maxPage = Math.max(1, Math.ceil(len / itemsPerPage))
      if (currentPage > maxPage) {
        setCurrentPage(1)
      }
    }
  }, [includePracticeDays, searchMode, combinedListItems.length, events.length, itemsPerPage, currentPage])

  if (isLoadingTracks) {
    return (
      <div className="text-center py-8 w-full min-w-0" role="status" aria-live="polite">
        <p className="text-[var(--token-text-secondary)]">Loading tracks...</p>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0 w-full"
      style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="sr-only" aria-live="polite">
        {isLoadingEvents
          ? "Loading events..."
          : isCheckingLiveRC || isCheckingPracticeDays
            ? "Checking LiveRC for events and practice days..."
            : ""}
      </div>

      {/* Form section: fixed, does not scroll */}
      <section
        className="flex-shrink-0 pb-6 border-b border-[var(--token-border-accent-soft)]"
        aria-label="Search filters"
      >
        {apiError && (
          <div className="mb-4">
            <ErrorDisplay
              message={apiError.message}
              errorId={apiError.errorId}
              details={apiError.details as string | Record<string, unknown> | undefined}
              onRetry={apiError.onRetry}
              retryLabel="Retry Search"
            />
          </div>
        )}
        <EventSearchForm
          searchMode={searchMode}
          onSearchModeChange={
            practiceDaysEnabled
              ? (mode) => {
                  setSearchMode(mode)
                  setErrors({})
                  setApiError(null)
                }
              : undefined
          }
          selectedTrack={selectedTrack}
          startDate={startDate}
          endDate={endDate}
          dateRangePreset={dateRangePreset}
          favourites={favourites}
          tracks={tracks}
          errors={errors}
          isLoading={isLoadingEvents}
          onTrackSelect={handleTrackSelect}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onDateRangePresetChange={handleDateRangePresetChange}
          onToggleFavourite={handleToggleFavourite}
          onSearch={handleSearch}
          practiceYear={practiceYear}
          practiceMonth={practiceMonth}
          onPracticeYearChange={setPracticeYear}
          onPracticeMonthChange={setPracticeMonth}
          includePracticeDays={includePracticeDays}
          onIncludePracticeDaysChange={setIncludePracticeDays}
        />
      </section>

      {/* Results section: scrollable */}
      <section
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pt-6"
        style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
        aria-label="Search results"
      >
        {/* Filter chips when including practice days */}
        {hasSearched &&
          (searchMode !== "practice-days" || !practiceDaysEnabled) &&
          includePracticeDays &&
          searchMode === "events" && (
            <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Filter results by type">
                {(["all", "events", "practice"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    role="tab"
                    aria-selected={resultFilter === filter}
                    onClick={() => {
                      setResultFilter(filter)
                      setCurrentPage(1)
                    }}
                    className={`min-h-[44px] min-w-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] ${
                      resultFilter === filter
                        ? "border-[var(--token-accent)] bg-[var(--token-accent)]/20 text-[var(--token-text-primary)]"
                        : "border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-secondary)] hover:bg-[var(--token-surface-raised)]"
                    }`}
                  >
                    {filter === "all" ? "All" : filter === "events" ? "Events" : "Practice days"}
                  </button>
                ))}
            </div>
          )}

        {isStartingSearch && (
          <div
            className="text-center py-8"
            style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
            role="status"
            aria-live="polite"
          >
            <p className="text-[var(--token-text-secondary)]">Searching for events...</p>
          </div>
        )}

        {!isStartingSearch && searchMode === "practice-days" && practiceDaysEnabled && (
          <PracticeDaySearchContainer
            selectedTrack={selectedTrack}
            year={practiceYear}
            month={practiceMonth}
            onSelectForDashboard={onSelectForDashboard}
            searchTrigger={practiceDaysSearchTrigger}
          />
        )}

        {!isStartingSearch && (searchMode !== "practice-days" || !practiceDaysEnabled) && (
          <>
            {!hasSearched && (
              <div
                className="py-8 flex-shrink-0"
                style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
              >
                <div
                  className="mx-auto px-4 space-y-3 text-center"
                  style={{
                    minWidth: "20rem",
                    maxWidth: "28rem",
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <p className="text-[var(--token-text-primary)] font-medium">
                    {selectedTrack
                      ? "Ready to search"
                      : "Select a track to get started"}
                  </p>
                  <p className="text-sm text-[var(--token-text-secondary)]">
                    {selectedTrack
                      ? searchMode === "events" && practiceDaysEnabled
                        ? "Select a track and click Search to find events, or adjust the date range and include practice days first."
                        : "Select a track and click Search to find events, or adjust the date range first."
                      : searchMode === "events" && practiceDaysEnabled
                        ? "Pick a track, optionally set a date range and include practice days, then click Search."
                        : "Pick a track, optionally set a date range, then click Search."}
                  </p>
                </div>
              </div>
            )}

            {hasSearched && (
              <>
                {(isCheckingLiveRC || isCheckingPracticeDays) && (
                  <div
                    className="rounded-lg border border-[var(--token-border-accent-soft)] bg-[var(--token-surface-elevated)] px-4 py-3 mb-4 flex items-center gap-3"
                    style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
                    role="status"
                    aria-live="polite"
                  >
                    <svg
                      className="animate-spin h-5 w-5 flex-shrink-0 text-[var(--token-accent)]"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <p className="text-[var(--token-text-primary)] font-medium m-0">
                      Checking LiveRC for events and practice days…
                    </p>
                  </div>
                )}

                {totalItems === 0 && !isCheckingLiveRC && !isCheckingPracticeDays && (
                  <div className="py-8 text-center">
                    <p className="text-[var(--token-text-primary)] font-medium mb-1">
                      No {includePracticeDays && searchMode === "events" ? "events or practice days" : "events"} found
                    </p>
                    <p className="text-sm text-[var(--token-text-secondary)]">
                      Try a different track or date range.
                    </p>
                  </div>
                )}

                {Object.keys(driverInEvents).length > 0 && totalItems > 0 && !(includePracticeDays && searchMode === "events") && (
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-sm text-[var(--token-text-secondary)]">
                      {Object.values(driverInEvents).filter(Boolean).length} event
                      {Object.values(driverInEvents).filter(Boolean).length === 1 ? "" : "s"} found
                      with your participation
                    </span>
                  </div>
                )}

                {totalItems > 0 && includePracticeDays && searchMode === "events" ? (
                  <>
                    <div className="mt-8 w-full min-w-0">
                      <EventSearchTableHeader />
                      <div className="divide-y divide-[var(--token-border-default)]">
                        {paginatedCombinedItems.map((item, idx) => {
                          if (item.kind === "event") {
                            const event = item.event
                            const statusOverride =
                              eventStatusOverrides?.[event.id] ??
                              (event.sourceEventId ? eventStatusOverrides?.[`liverc-${event.sourceEventId}`] : undefined) ??
                              (knownImportedIds?.has(event.id) || (event.sourceEventId && knownImportedIds?.has(`liverc-${event.sourceEventId}`)) ? "imported" : undefined)
                            const errorMsg = eventErrorMessages?.[event.id] ?? (event.sourceEventId ? eventErrorMessages?.[`liverc-${event.sourceEventId}`] : undefined)
                            const progress = eventImportProgress?.[event.id] ?? (event.sourceEventId ? eventImportProgress?.[`liverc-${event.sourceEventId}`] : undefined)
                            const containsDriver = event.sourceEventId ? driverInEvents?.[event.sourceEventId] === true : false
                            return (
                              <EventRow
                                key={`event-${event.id}-${idx}`}
                                event={event}
                                onImport={handleImportSingle}
                                statusOverride={statusOverride}
                                errorMessage={errorMsg}
                                containsDriver={containsDriver}
                                importProgress={progress}
                                onSelectForDashboard={onSelectForDashboard}
                                importDisabled={
                                  Object.keys(eventImportProgress ?? {}).length > 0 ||
                                  Object.values(eventStatusOverrides ?? {}).some((s) => s === "importing")
                                }
                              />
                            )
                          }
                          if (item.kind === "practice") {
                            const discovered = item.discovered
                            const ingested = item.ingested
                            const dateStr =
                              ingested?.eventDate ?? discovered?.date ?? ""
                            const dateOnly = dateStr.split("T")[0]
                            const isIngesting = dateOnly
                              ? ingestingPracticeDates.has(dateOnly)
                              : false
                            return (
                              <PracticeDayRow
                                key={`practice-${dateOnly}-${ingested?.id ?? "discovered"}-${idx}`}
                                date={dateStr}
                                trackName={selectedTrack?.trackName ?? ""}
                                sessionCount={discovered?.session_count ?? 0}
                                totalLaps={discovered?.total_laps ?? 0}
                                uniqueDrivers={discovered?.unique_drivers ?? 0}
                                uniqueClasses={discovered?.unique_classes ?? 0}
                                timeRangeStart={
                                  discovered?.time_range_start ?? undefined
                                }
                                timeRangeEnd={
                                  discovered?.time_range_end ?? undefined
                                }
                                isIngested={!!ingested}
                                eventId={ingested?.id}
                                onView={
                                  ingested && onSelectForDashboard
                                    ? () => onSelectForDashboard(ingested.id)
                                    : undefined
                                }
                                onIngest={
                                  !ingested && selectedTrack?.id
                                    ? () =>
                                        handleImportPracticeDay(
                                          selectedTrack.id,
                                          dateStr
                                        )
                                    : undefined
                                }
                                isIngesting={isIngesting}
                                importDisabled={ingestingPracticeDates.size > 0}
                              />
                            )
                          }
                          return null
                        })}
                      </div>
                    </div>
                    {hasSearched && totalItems > 0 && (
                      <ListPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                        itemsPerPage={itemsPerPage}
                        totalItems={totalItems}
                        itemLabel="items"
                        rowsPerPageOptions={[5, 10, 25, 50, 100]}
                        onRowsPerPageChange={handleRowsPerPageChange}
                      />
                    )}
                  </>
                ) : totalItems > 0 ? (
                  <>
                    <p className="text-sm text-[var(--token-text-secondary)] mb-3">
                      {totalItems} event{totalItems === 1 ? "" : "s"} found
                    </p>

                    <EventTable
                      key={searchKey}
                      events={paginatedEvents}
                      isLoading={isLoadingEvents}
                      hasSearched={hasSearched}
                      isCheckingLiveRC={isCheckingLiveRC}
                      onImportEvent={handleImportSingle}
                      statusOverrides={eventStatusOverrides}
                      knownImportedIds={knownImportedIds}
                      errorMessages={eventErrorMessages}
                      driverInEvents={driverInEvents}
                      eventImportProgress={eventImportProgress}
                      onSelectForDashboard={onSelectForDashboard}
                      importDisabled={
                        Object.keys(eventImportProgress).length > 0 ||
                        Object.values(eventStatusOverrides).some((s) => s === "importing")
                      }
                    />

                    {hasSearched && events.length > 0 && (
                      <ListPagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={handlePageChange}
                        itemsPerPage={itemsPerPage}
                        totalItems={totalItems}
                        itemLabel="events"
                        rowsPerPageOptions={[5, 10, 25, 50, 100]}
                        onRowsPerPageChange={handleRowsPerPageChange}
                      />
                    )}
                  </>
                ) : null}
              </>
            )}
          </>
        )}
      </section>
    </div>
  )
}
