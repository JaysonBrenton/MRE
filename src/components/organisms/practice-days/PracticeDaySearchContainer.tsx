/**
 * @fileoverview Practice Day Search Container component
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description Container component for practice day search results
 */

"use client"

import { useState, useEffect, useRef } from "react"
import { type Track } from "../event-search/TrackRow"
import EventSearchTableHeader from "../event-search/EventSearchTableHeader"
import PracticeDayRow from "./PracticeDayRow"
import { parseApiResponse } from "@/lib/api-response-helper"
import { clientLogger } from "@/lib/client-logger"
import ListPagination from "../event-analysis/ListPagination"
import ErrorDisplay from "@/components/molecules/ErrorDisplay"

interface PracticeDaySummary {
  date: string
  trackSlug: string
  sessionCount: number
  totalLaps: number
  totalTrackTimeSeconds: number
  uniqueDrivers: number
  uniqueClasses: number
  timeRangeStart?: string
  timeRangeEnd?: string
  sessions: Array<{
    sessionId: string
    driverName: string
    className: string
    startTime: string
    durationSeconds: number
    lapCount: number
  }>
}

interface IngestedPracticeDay {
  id: string
  eventName: string
  eventDate: string | null
  sourceEventId: string
  trackId: string
  ingestDepth: string
}

interface PracticeDaySearchContainerProps {
  selectedTrack: Track | null
  year: number
  month: number
  onSelectForDashboard?: (eventId: string) => void
  searchTrigger?: number
}

export default function PracticeDaySearchContainer({
  selectedTrack,
  year,
  month,
  onSelectForDashboard,
  searchTrigger = 0,
}: PracticeDaySearchContainerProps) {
  // Calculate start and end dates for the selected month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
  const [practiceDays, setPracticeDays] = useState<PracticeDaySummary[]>([])
  const [ingestedPracticeDays, setIngestedPracticeDays] = useState<
    Map<string, IngestedPracticeDay>
  >(new Map())
  const [isLoading, setIsLoading] = useState(false)
  /** Date string (YYYY-MM-DD) of the practice day currently being uploaded, if any */
  const [ingestingDate, setIngestingDate] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  // Track previous searchTrigger to only search when it changes
  const prevSearchTriggerRef = useRef<number>(0)

  // Fetch practice days only when searchTrigger changes (and is > 0)
  useEffect(() => {
    // Only trigger search when searchTrigger changes and is > 0
    if (searchTrigger <= 0 || searchTrigger === prevSearchTriggerRef.current) {
      prevSearchTriggerRef.current = searchTrigger
      return
    }

    // Update the ref to track the current searchTrigger
    prevSearchTriggerRef.current = searchTrigger

    // Validate inputs: year must be > 0, month must be between 1-12
    if (!selectedTrack || !year || year <= 0 || !month || month < 1 || month > 12) {
      clientLogger.debug("Practice day search skipped - missing required fields", {
        hasTrack: !!selectedTrack,
        year,
        month,
      })
      return
    }

    clientLogger.debug("Practice day search triggered", {
      trackId: selectedTrack.id,
      trackName: selectedTrack.trackName,
      year,
      month,
      searchTrigger,
    })

    const abortControllerRef = new AbortController()

    const fetchPracticeDays = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // First, discover practice days from LiveRC (uses same cache as discover-range when available)
        const discoverBody: { track_id: string; year: number; month: number; track_slug?: string } = {
          track_id: selectedTrack.id,
          year,
          month,
        }
        if (selectedTrack.sourceTrackSlug?.trim()) {
          discoverBody.track_slug = selectedTrack.sourceTrackSlug.trim()
        }
        const discoverResponse = await fetch("/api/v1/practice-days/discover", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(discoverBody),
          signal: abortControllerRef.signal,
        })

        const discoverData = await parseApiResponse<{ practiceDays: PracticeDaySummary[] }>(
          discoverResponse
        )

        clientLogger.debug("Practice day discovery response", {
          success: discoverData.success,
          hasData: !!discoverData.success && !!discoverData.data,
          dataKeys: discoverData.success ? Object.keys(discoverData.data || {}) : [],
          error: !discoverData.success ? discoverData.error : undefined,
          responseStatus: discoverResponse.status,
          responseOk: discoverResponse.ok,
        })

        if (discoverData.success) {
          // Handle both camelCase and snake_case response formats
          const practiceDaysList =
            discoverData.data.practiceDays ||
            (
              discoverData.data as
                | { practice_days?: typeof discoverData.data.practiceDays }
                | undefined
            )?.practice_days ||
            (Array.isArray(discoverData.data) ? discoverData.data : [])

          // Transform snake_case to camelCase if needed
          // Always transform to ensure consistent data structure
          interface PracticeDayApiItem {
            date: string
            track_slug?: string
            trackSlug?: string
            session_count?: number
            sessionCount?: number
            total_laps?: number
            totalLaps?: number
            total_track_time_seconds?: number
            totalTrackTimeSeconds?: number
            unique_drivers?: number
            uniqueDrivers?: number
            unique_classes?: number
            uniqueClasses?: number
            time_range_start?: string
            timeRangeStart?: string
            time_range_end?: string
            timeRangeEnd?: string
            sessions?: SessionApiItem[]
          }
          interface SessionApiItem {
            session_id?: string
            sessionId?: string
            driver_name?: string
            driverName?: string
            class_name?: string
            className?: string
            start_time?: string
            startTime?: string
            duration_seconds?: number
            durationSeconds?: number
            lap_count?: number
            lapCount?: number
          }
          const transformedPracticeDays = practiceDaysList.map((pd: PracticeDayApiItem) => {
            // Ensure all numeric fields are numbers, defaulting to 0 if missing/invalid
            const sessionCount =
              typeof pd.session_count === "number"
                ? pd.session_count
                : typeof pd.sessionCount === "number"
                  ? pd.sessionCount
                  : 0
            const totalLaps =
              typeof pd.total_laps === "number"
                ? pd.total_laps
                : typeof pd.totalLaps === "number"
                  ? pd.totalLaps
                  : 0
            const uniqueDrivers =
              typeof pd.unique_drivers === "number"
                ? pd.unique_drivers
                : typeof pd.uniqueDrivers === "number"
                  ? pd.uniqueDrivers
                  : 0
            const uniqueClasses =
              typeof pd.unique_classes === "number"
                ? pd.unique_classes
                : typeof pd.uniqueClasses === "number"
                  ? pd.uniqueClasses
                  : 0

            return {
              date: pd.date,
              trackSlug: pd.track_slug || pd.trackSlug || "",
              sessionCount,
              totalLaps,
              totalTrackTimeSeconds:
                typeof pd.total_track_time_seconds === "number"
                  ? pd.total_track_time_seconds
                  : typeof pd.totalTrackTimeSeconds === "number"
                    ? pd.totalTrackTimeSeconds
                    : 0,
              uniqueDrivers,
              uniqueClasses,
              timeRangeStart: pd.time_range_start || pd.timeRangeStart,
              timeRangeEnd: pd.time_range_end || pd.timeRangeEnd,
              sessions: (pd.sessions || []).map((s: SessionApiItem) => ({
                sessionId: s.session_id || s.sessionId || "",
                driverName: s.driver_name || s.driverName || "",
                className: s.class_name || s.className || "",
                startTime: s.start_time || s.startTime || "",
                durationSeconds:
                  typeof s.duration_seconds === "number"
                    ? s.duration_seconds
                    : typeof s.durationSeconds === "number"
                      ? s.durationSeconds
                      : 0,
                lapCount:
                  typeof s.lap_count === "number"
                    ? s.lap_count
                    : typeof s.lapCount === "number"
                      ? s.lapCount
                      : 0,
              })),
            }
          })

          clientLogger.debug("Practice days discovered", {
            count: transformedPracticeDays.length,
            firstItem: transformedPracticeDays[0] ? Object.keys(transformedPracticeDays[0]) : [],
          })
          setPracticeDays(transformedPracticeDays)
        } else {
          const errorMessage = discoverData.error?.message || "Failed to discover practice days"
          clientLogger.error("Practice day discovery failed", {
            error: errorMessage,
            details: discoverData.error,
            responseStatus: discoverResponse.status,
            responseStatusText: discoverResponse.statusText,
          })
          setError(errorMessage)
        }

        // Also fetch already-ingested practice days
        const searchResponse = await fetch(
          `/api/v1/practice-days/search?track_id=${selectedTrack.id}&start_date=${startDate}&end_date=${endDate}`,
          { signal: abortControllerRef.signal }
        )

        const searchData = await parseApiResponse<{ practiceDays: IngestedPracticeDay[] }>(
          searchResponse
        )

        clientLogger.debug("Practice day search response", {
          success: searchData.success,
          hasData: !!searchData.success && !!searchData.data,
          responseStatus: searchResponse.status,
          responseOk: searchResponse.ok,
        })

        if (searchData.success) {
          // Handle both camelCase and snake_case response formats
          const ingestedList =
            searchData.data.practiceDays ||
            (searchData.data as { practice_days?: IngestedPracticeDay[] } | undefined)
              ?.practice_days ||
            (Array.isArray(searchData.data) ? searchData.data : [])

          const ingestedMap = new Map<string, IngestedPracticeDay>()
          ingestedList.forEach((pd) => {
            // Extract date from sourceEventId: {track-slug}-practice-{YYYY-MM-DD}
            const dateMatch = pd.sourceEventId.match(/-practice-(\d{4}-\d{2}-\d{2})/)
            if (dateMatch) {
              ingestedMap.set(dateMatch[1], pd)
            }
          })
          clientLogger.debug("Ingested practice days mapped", { count: ingestedMap.size })
          setIngestedPracticeDays(ingestedMap)
        } else {
          // Log search API errors but don't overwrite discovery errors
          clientLogger.warn("Practice day search API failed", {
            error: searchData.error?.message,
            details: searchData.error,
            responseStatus: searchResponse.status,
          })
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return
        }
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch practice days"
        clientLogger.error("Failed to fetch practice days", { error: err, message: errorMessage })
        setError(errorMessage || "An unexpected error occurred while fetching practice days")
      } finally {
        setIsLoading(false)
      }
    }

    fetchPracticeDays()
    return () => {
      abortControllerRef.abort()
    }
  }, [selectedTrack, year, month, startDate, endDate, searchTrigger])

  const handleIngest = async (date: string) => {
    if (!selectedTrack) return

    const dateOnly = date.split("T")[0]
    setIngestingDate(dateOnly)
    setError(null)

    try {
      const response = await fetch("/api/v1/practice-days/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          track_id: selectedTrack.id,
          date: date,
        }),
      })

      const data = await parseApiResponse(response)

      if (data.success) {
        // Refresh the list
        const searchResponse = await fetch(
          `/api/v1/practice-days/search?track_id=${selectedTrack.id}&start_date=${startDate}&end_date=${endDate}`
        )
        const searchData = await parseApiResponse<{ practiceDays: IngestedPracticeDay[] }>(
          searchResponse
        )

        if (searchData.success) {
          const ingestedMap = new Map<string, IngestedPracticeDay>()
          searchData.data.practiceDays.forEach((pd) => {
            const dateMatch = pd.sourceEventId.match(/-practice-(\d{4}-\d{2}-\d{2})/)
            if (dateMatch) {
              ingestedMap.set(dateMatch[1], pd)
            }
          })
          setIngestedPracticeDays(ingestedMap)
        }
      } else {
        setError(data.error?.message || "Failed to ingest practice day")
      }
    } catch (err) {
      clientLogger.error("Failed to ingest practice day", { error: err })
      setError(err instanceof Error ? err.message : "Failed to ingest practice day")
    } finally {
      setIngestingDate(null)
      setIsLoading(false)
    }
  }

  const handleView = (eventId: string) => {
    if (onSelectForDashboard) {
      onSelectForDashboard(eventId)
    } else {
      window.location.href = `/dashboard?eventId=${eventId}`
    }
  }

  // Pagination
  const totalPages = Math.ceil(practiceDays.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedPracticeDays = practiceDays.slice(startIndex, endIndex)

  if (!selectedTrack) {
    return (
      <div className="text-center py-12 text-gray-400">
        Please select a track to search for practice days
      </div>
    )
  }

  if (!year || year <= 0 || !month || month < 1 || month > 12) {
    return (
      <div className="text-center py-12 text-gray-400">
        Please select a valid year and month to search for practice days
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && error.trim() && <ErrorDisplay message={error} />}

      {isLoading && practiceDays.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-5 w-5 text-[var(--token-text-secondary)]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Loading practice days...</span>
          </div>
        </div>
      ) : practiceDays.length === 0 && !isLoading ? (
        <div className="text-center py-12 text-gray-400">
          <p className="mb-2">
            No practice days found for {selectedTrack.trackName} in {month}/{year}
          </p>
          <p className="text-sm text-[var(--token-text-muted)]">
            Try selecting a different month or track.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 w-full min-w-0">
            <EventSearchTableHeader />
            <div className="divide-y divide-[var(--token-border-default)]">
              {paginatedPracticeDays.map((practiceDay) => {
                const ingested = ingestedPracticeDays.get(practiceDay.date)
                return (
                  <PracticeDayRow
                    key={practiceDay.date}
                    date={practiceDay.date}
                    trackName={selectedTrack.trackName}
                    sessionCount={
                      typeof practiceDay.sessionCount === "number" ? practiceDay.sessionCount : 0
                    }
                    totalLaps={typeof practiceDay.totalLaps === "number" ? practiceDay.totalLaps : 0}
                    uniqueDrivers={
                      typeof practiceDay.uniqueDrivers === "number" ? practiceDay.uniqueDrivers : 0
                    }
                    uniqueClasses={
                      typeof practiceDay.uniqueClasses === "number" ? practiceDay.uniqueClasses : 0
                    }
                    timeRangeStart={practiceDay.timeRangeStart}
                    timeRangeEnd={practiceDay.timeRangeEnd}
                    isIngested={!!ingested}
                    eventId={ingested?.id}
                    onIngest={() => handleIngest(practiceDay.date)}
                    onView={ingested ? () => handleView(ingested.id) : undefined}
                    isIngesting={ingestingDate === practiceDay.date.split("T")[0]}
                    importDisabled={!!ingestingDate}
                  />
                )
              })}
            </div>
          </div>

          {totalPages > 1 && (
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={practiceDays.length}
            />
          )}
        </>
      )}
    </div>
  )
}
