/**
 * @fileoverview My Event page - displays events matched via fuzzy logic
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Page showing events where the user's driver name was matched using fuzzy matching
 * 
 * @purpose Displays events discovered through fuzzy name matching, allowing users to see
 *          events where they may have participated based on name similarity.
 * 
 * @relatedFiles
 * - src/app/api/v1/personas/driver/events/route.ts (API endpoint)
 * - src/core/personas/driver-events.ts (driver event discovery logic)
 */

'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Event {
  id: string
  eventName: string
  eventDate: string | null
  eventUrl: string
  track?: {
    id: string
    trackName: string
  }
}

interface ParticipationDetail {
  eventId: string
  matchType: "fuzzy" | "exact" | "transponder"
  similarityScore: number
  userDriverLinkStatus: "confirmed" | "suggested" | "rejected" | "conflict"
}

interface DriverEventsResponse {
  success: true
  data: {
    events: Event[]
    participationDetails: ParticipationDetail[]
  }
}

const formatEventDate = (eventDate: string | null): string => {
  if (!eventDate) {
    return "Date TBD"
  }

  const date = new Date(eventDate)
  if (isNaN(date.getTime())) {
    return "Invalid date"
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

const formatSimilarityScore = (score: number): string => {
  return `${Math.round(score * 100)}%`
}

export default function MyEventPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [participationDetails, setParticipationDetails] = useState<ParticipationDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    async function fetchFuzzyMatchedEvents() {
      try {
        setLoading(true)
        setError(null)

        // Fetch all matched events (exact, fuzzy, and transponder matches)
        const response = await fetch("/api/v1/personas/driver/events")

        // Check if response has content before parsing JSON
        const contentType = response.headers.get("content-type")
        const hasJsonContent = contentType && contentType.includes("application/json")
        
        let data: any = null
        if (hasJsonContent) {
          const text = await response.text()
          if (text.trim()) {
            try {
              data = JSON.parse(text)
            } catch (parseError) {
              console.error("Failed to parse JSON response:", parseError, "Response text:", text)
              throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`)
            }
          } else {
            throw new Error("Empty response from server")
          }
        } else {
          // Non-JSON response (likely an error page or empty response)
          const text = await response.text()
          throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 200)}`)
        }

        if (!response.ok) {
          // Parse error response from API
          if (data && data.success === false && data.error) {
            throw new Error(data.error.message || "Failed to fetch events")
          }
          if (response.status === 401) {
            throw new Error("Authentication required")
          }
          if (response.status === 400) {
            throw new Error(data?.error?.message || "User does not have Driver persona")
          }
          throw new Error(data?.error?.message || `Failed to fetch events (${response.status})`)
        }

        if (data && data.success) {
          setEvents(data.data.events)
          setParticipationDetails(data.data.participationDetails)
        } else {
          throw new Error(data?.error?.message || "Invalid response format")
        }
      } catch (err) {
        console.error("Error fetching fuzzy matched events:", err)
        setError(err instanceof Error ? err.message : "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchFuzzyMatchedEvents()
  }, [])

  const handleEventClick = (eventId: string) => {
    router.push(`/events/analyse/${eventId}`)
  }

  // Create a map of eventId -> participation details for quick lookup
  const participationMap = new Map<string, ParticipationDetail>()
  participationDetails.forEach(detail => {
    participationMap.set(detail.eventId, detail)
  })

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-semibold text-[var(--token-text-primary)]">
          My Event
        </h1>
        <p className="mt-2 text-sm text-[var(--token-text-secondary)]">
          Events matched to your driver name
        </p>
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
            No events found that match your driver name.
          </p>
          <p className="text-sm text-[var(--token-text-secondary)]">
            Events will appear here once the system discovers matches based on your driver name.
          </p>
          <Link
            href="/event-search"
            className="inline-flex items-center justify-center rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-accent)]"
          >
            Search for events
          </Link>
        </div>
      )}

      {/* Events Table */}
      {!loading && !error && events.length > 0 && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--token-border-default)]">
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Event Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Track
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Match Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Similarity Score
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const detail = participationMap.get(event.id)
                  return (
                    <tr
                      key={event.id}
                      className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface)] cursor-pointer"
                      onClick={() => handleEventClick(event.id)}
                    >
                      <td className="px-4 py-3 text-[var(--token-text-primary)]">{event.eventName}</td>
                      <td className="px-4 py-3 text-[var(--token-text-secondary)]">{event.track?.trackName || "Unknown Track"}</td>
                      <td className="px-4 py-3 text-[var(--token-text-secondary)]">
                        {formatEventDate(event.eventDate)}
                      </td>
                      <td className="px-4 py-3 text-[var(--token-text-secondary)]">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          detail?.matchType === "exact"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : detail?.matchType === "transponder"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        }`}>
                          {detail?.matchType === "exact" ? "Exact Match" : 
                           detail?.matchType === "transponder" ? "Transponder Match" : 
                           "Fuzzy Match"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--token-text-secondary)]">
                        {detail ? formatSimilarityScore(detail.similarityScore) : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-[var(--token-text-secondary)]">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          detail?.userDriverLinkStatus === "confirmed"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : detail?.userDriverLinkStatus === "suggested"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                        }`}>
                          {detail?.userDriverLinkStatus === "confirmed" ? "Confirmed" : 
                           detail?.userDriverLinkStatus === "suggested" ? "Suggested" : 
                           detail?.userDriverLinkStatus || "Unknown"}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="text-sm text-[var(--token-text-secondary)]">
            Showing {events.length} event{events.length !== 1 ? "s" : ""} matched to your driver name
          </div>
        </div>
      )}
    </div>
  )
}

