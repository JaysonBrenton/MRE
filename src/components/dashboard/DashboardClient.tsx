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
import EventOverview from "./EventOverview"
import EventEmptyState from "./EventEmptyState"

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

export default function DashboardClient() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [eventData, setEventData] = useState<EventAnalysisData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [])

  const fetchEventData = async (eventId: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/v1/events/${eventId}/analysis`)
      
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

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-8">
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-[var(--token-text-muted)]">
            Loading event data...
          </p>
        </div>
      </div>
    )
  }

  if (error && !selectedEventId) {
    // Show empty state if there was an error and no event selected
    return (
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-8">
        <EventEmptyState />
      </div>
    )
  }

  if (!selectedEventId || !eventData) {
    return (
      <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-8">
        <EventEmptyState />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] p-8">
      <EventOverview
        eventId={eventData.event.id}
        eventName={eventData.event.eventName}
        eventDate={eventData.event.eventDate}
        trackName={eventData.event.trackName}
        totalRaces={eventData.summary.totalRaces}
        totalDrivers={eventData.summary.totalDrivers}
        totalLaps={eventData.summary.totalLaps}
      />
    </div>
  )
}

