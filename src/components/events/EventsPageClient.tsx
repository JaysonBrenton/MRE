/**
 * @fileoverview Client component for Events list page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Client-side component for displaying events list
 * 
 * @purpose Handles client-side interactivity for the events page
 */

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface ImportedEvent {
  id: string
  source: string
  sourceEventId: string
  eventName: string
  eventDate: string | null
  eventEntries: number
  eventDrivers: number
  eventUrl: string
  ingestDepth: string
  lastIngestedAt: string | null
  track: {
    id: string
    trackName: string
  }
}

interface EventsResponse {
  success: true
  data: {
    events: ImportedEvent[]
  }
}

const getStatusColor = () => {
  return "bg-[var(--token-accent-hover)]"
}

const formatEventDate = (eventDate: string | null): string => {
  if (!eventDate) {
    return "Date TBD"
  }

  const date = new Date(eventDate)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

export default function EventsPageClient() {
  const router = useRouter()
  const [events, setEvents] = useState<ImportedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEvents() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/v1/events")

        if (!response.ok) {
          throw new Error("Failed to fetch events")
        }

        const data: EventsResponse = await response.json()

        if (data.success) {
          setEvents(data.data.events)
        } else {
          throw new Error("Invalid response format")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const handleEventClick = (eventId: string) => {
    router.push(`/events/analyse/${eventId}`)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-[var(--token-text-primary)] sm:text-4xl">
          Events
        </h1>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <p className="text-[var(--token-text-muted)]">Loading events...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-12">
          <p className="text-red-500">Error: {error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && events.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <p className="text-[var(--token-text-muted)]">
            No imported events found yet. Use Event Search to discover LiveRC races and import them into your workspace.
          </p>
          <Link
            href="/event-search"
            className="mobile-button inline-flex items-center justify-center rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-accent)]"
          >
            Search for events
          </Link>
        </div>
      )}

      {/* Event Card Grid */}
      {!loading && !error && events.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <div
              key={event.id}
              className="group rounded-lg border border-[var(--token-border-muted)] bg-[var(--token-surface)] p-6 transition-all hover:scale-[1.02] hover:shadow-lg"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="mb-1 text-lg font-semibold text-[var(--token-text-primary)]">
                    {event.eventName}
                  </h3>
                  <p className="text-sm text-[var(--token-text-muted)]">
                    {event.track.trackName}
                  </p>
                </div>
                <span
                  className={`ml-2 rounded-full px-2 py-1 text-xs font-medium text-white ${getStatusColor()}`}
                >
                  Imported
                </span>
              </div>

              <p className="mb-4 text-sm text-[var(--token-text-muted)]">
                {formatEventDate(event.eventDate)}
              </p>

              <button
                className="mobile-button w-full rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-accent)]"
                onClick={() => handleEventClick(event.id)}
              >
                Open event
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
