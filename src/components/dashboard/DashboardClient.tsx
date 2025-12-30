/**
 * @fileoverview Dashboard client component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Client-side wrapper for dashboard that handles event selection from sessionStorage
 * 
 * @purpose Manages sessionStorage access and event data fetching for the dashboard.
 *          Displays EventOverview when an event is selected, or EventEmptyState when none is selected.
 * 
 * @relatedFiles
 * - src/app/dashboard/page.tsx (parent server component)
 * - src/components/dashboard/EventOverview.tsx (event overview display)
 * - src/components/dashboard/EventEmptyState.tsx (empty state)
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import EventOverview from "./EventOverview"
import EventEmptyState from "./EventEmptyState"
import { formatDateLong } from "@/lib/date-utils"

const STORAGE_KEY_SELECTED_EVENT = "mre-selected-event-id"

interface EventAnalysisData {
  event: {
    id: string
    eventName: string
    eventDate: string
    trackName: string
  }
  summary: {
    totalRaces: number
    totalDrivers: number
    totalLaps: number
    dateRange: {
      earliest: string | null
      latest: string | null
    }
  }
}

interface ImportedEventSummary {
  id: string
  eventName: string
  eventDate: string | null
  track: {
    trackName: string
  }
}

export default function DashboardClient() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [eventData, setEventData] = useState<EventAnalysisData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recentEvents, setRecentEvents] = useState<ImportedEventSummary[]>([])
  const [isLoadingRecent, setIsLoadingRecent] = useState(true)
  const [recentError, setRecentError] = useState<string | null>(null)

  useEffect(() => {
    // Check sessionStorage for selected event
    if (typeof window !== "undefined") {
      const storedEventId = sessionStorage.getItem(STORAGE_KEY_SELECTED_EVENT)
      setSelectedEventId(storedEventId)
      
      if (storedEventId) {
        fetchEventData(storedEventId)
      } else {
        setIsLoading(false)
      }
    }
    fetchRecentEvents()
  }, [])

  const fetchEventData = async (eventId: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/v1/events/${eventId}/summary`)
      
      if (!response.ok) {
        if (response.status === 404) {
          // Event not found, clear from sessionStorage
          sessionStorage.removeItem(STORAGE_KEY_SELECTED_EVENT)
          setSelectedEventId(null)
          setError("Event not found")
        } else {
          setError("Failed to load event data")
        }
        setIsLoading(false)
        return
      }
      
      const result = await response.json()
      
      if (result.success && result.data) {
        setEventData(result.data)
      } else {
        setError("Invalid response from server")
      }
    } catch (err) {
      setError("Failed to fetch event data")
      console.error("Error fetching event data:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchRecentEvents = async () => {
    setIsLoadingRecent(true)
    setRecentError(null)
    try {
      const response = await fetch("/api/v1/events?limit=5", { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to load recent events")
      }
      const data = await response.json()
      if (data.success && Array.isArray(data.data.events)) {
        setRecentEvents(data.data.events)
      } else {
        setRecentError("Unable to load recent events")
      }
    } catch (err) {
      setRecentError(err instanceof Error ? err.message : "Unable to load recent events")
    } finally {
      setIsLoadingRecent(false)
    }
  }

  const renderSelectedEvent = () => {
    if (isLoading) {
      return (
        <div className="flex h-64 w-full min-w-0 items-center justify-center" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          <p className="text-sm text-[var(--token-text-muted)]">Loading event data...</p>
        </div>
      )
    }

    if (error && !selectedEventId) {
      return <EventEmptyState />
    }

    if (!selectedEventId || !eventData) {
      return <EventEmptyState />
    }

    return (
      <EventOverview
        eventId={eventData.event.id}
        eventName={eventData.event.eventName}
        eventDate={eventData.event.eventDate}
        trackName={eventData.event.trackName}
        totalRaces={eventData.summary.totalRaces}
        totalDrivers={eventData.summary.totalDrivers}
        totalLaps={eventData.summary.totalLaps}
      />
    )
  }

  const renderRecentEvents = () => {
    if (isLoadingRecent) {
      return (
        <p className="text-sm text-[var(--token-text-muted)]">Loading recent events...</p>
      )
    }

    if (recentError) {
      return (
        <p className="text-sm text-[var(--token-error-text)]">{recentError}</p>
      )
    }

    if (recentEvents.length === 0) {
      return (
        <div className="space-y-3 text-sm text-[var(--token-text-secondary)]">
          <p>Import an event to see it appear here for quick access.</p>
          <Link
            href="/event-search"
            className="inline-flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            Search for events
          </Link>
        </div>
      )
    }

    return (
      <ul className="space-y-3">
        {recentEvents.map((event) => (
          <li key={event.id} className="flex items-center justify-between gap-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] p-3">
            <div>
              <p className="text-sm font-medium text-[var(--token-text-primary)]">{event.eventName}</p>
              <p className="text-xs text-[var(--token-text-secondary)]">
                {event.track.trackName} • {event.eventDate ? formatDateLong(event.eventDate) : "Date TBD"}
              </p>
            </div>
            <Link
              href={`/events/analyse/${event.id}`}
              className="inline-flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-2 text-xs font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
            >
              View analysis
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-6 w-full min-w-0" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-8 w-full min-w-0" style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        {renderSelectedEvent()}
      </div>
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--token-text-primary)]">Recent events</h3>
        </div>
        {renderRecentEvents()}
      </div>
    </div>
  )
}
