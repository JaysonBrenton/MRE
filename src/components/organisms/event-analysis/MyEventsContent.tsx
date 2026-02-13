/**
 * @fileoverview My Events content - events matched via fuzzy logic with confirm/reject
 *
 * @created 2026-02-01
 * @creator Jayson Brenton
 *
 * @description Reusable content showing events where the user's driver name was matched.
 * Used in the My Events tab (SessionChartTabs) and the standalone My Events page.
 *
 * @relatedFiles
 * - src/app/(authenticated)/dashboard/my-event/page.tsx
 * - src/components/organisms/event-analysis/sessions/SessionChartTabs.tsx
 * - src/app/api/v1/personas/driver/events/route.ts
 * - src/app/api/v1/users/me/driver-links/events/[eventId]/route.ts
 */

"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import ListPagination from "@/components/organisms/event-analysis/ListPagination"
import ChartContainer from "@/components/organisms/event-analysis/ChartContainer"

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
  userDriverLinkStatus: "confirmed" | "suggested" | "rejected"
}

type DriverEventsResponse =
  | {
      success: true
      data: {
        events: Event[]
        participationDetails: ParticipationDetail[]
      }
    }
  | {
      success: false
      error?: {
        message?: string
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

export default function MyEventsContent() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [participationDetails, setParticipationDetails] = useState<ParticipationDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [filter, setFilter] = useState<"all" | "suggested">("all")
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [hasNoDriverPersona, setHasNoDriverPersona] = useState<boolean>(false)
  const [updatingEvents, setUpdatingEvents] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchUserInfo() {
      try {
        const response = await fetch("/api/v1/users/me")
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data?.isAdmin !== undefined) {
            setIsAdmin(data.data.isAdmin)
          }
        }
      } catch (err) {
        console.error("Failed to fetch user info:", err)
      }
    }
    fetchUserInfo()
  }, [])

  useEffect(() => {
    async function fetchFuzzyMatchedEvents() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch("/api/v1/personas/driver/events")
        const contentType = response.headers.get("content-type")
        const hasJsonContent = contentType && contentType.includes("application/json")

        let data: DriverEventsResponse | null = null
        if (hasJsonContent) {
          const text = await response.text()
          if (text.trim()) {
            try {
              data = JSON.parse(text) as DriverEventsResponse
            } catch (parseError) {
              console.error("Failed to parse JSON response:", parseError, "Response text:", text)
              throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`)
            }
          } else {
            throw new Error("Empty response from server")
          }
        } else {
          const text = await response.text()
          throw new Error(
            `Server returned non-JSON response (${response.status}): ${text.substring(0, 200)}`
          )
        }

        if (!response.ok) {
          if (data && data.success === false && data.error) {
            const errorMessage = data.error.message || "Failed to fetch events"
            if (
              response.status === 400 &&
              (errorMessage.includes("Driver persona") ||
                errorMessage.includes("only available to drivers") ||
                errorMessage.includes("driver profile"))
            ) {
              setHasNoDriverPersona(true)
              setEvents([])
              setParticipationDetails([])
              return
            }
            throw new Error(errorMessage)
          }
          if (response.status === 401) {
            throw new Error("Authentication required")
          }
          if (response.status === 400) {
            const errorMessage =
              (data && !data.success && "error" in data && data.error?.message) ||
              "User does not have Driver persona"
            if (
              errorMessage.includes("Driver persona") ||
              errorMessage.includes("only available to drivers") ||
              errorMessage.includes("driver profile")
            ) {
              setHasNoDriverPersona(true)
              setEvents([])
              setParticipationDetails([])
              return
            }
            throw new Error(errorMessage)
          }
          throw new Error(
            (data && !data.success && "error" in data && data.error?.message) ||
              `Failed to fetch events (${response.status})`
          )
        }

        if (data && data.success) {
          setEvents(data.data.events)
          setParticipationDetails(data.data.participationDetails)
        } else {
          throw new Error(
            (data && !data.success && "error" in data && data.error?.message) ||
              "Invalid response format"
          )
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
    router.push(`/dashboard?eventId=${eventId}`)
  }

  const refreshEvents = async () => {
    const refreshResponse = await fetch("/api/v1/personas/driver/events")
    if (refreshResponse.ok) {
      const refreshData = await refreshResponse.json()
      if (refreshData.success) {
        setEvents(refreshData.data.events)
        setParticipationDetails(refreshData.data.participationDetails)
      }
    }
  }

  const handleConfirm = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setError(null)
    setUpdatingEvents((prev) => new Set(prev).add(eventId))

    try {
      const response = await fetch(`/api/v1/users/me/driver-links/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || "Failed to confirm link")
      }
      await refreshEvents()
    } catch (err) {
      console.error("Error confirming link:", err)
      setError(err instanceof Error ? err.message : "Failed to confirm link")
    } finally {
      setUpdatingEvents((prev) => {
        const next = new Set(prev)
        next.delete(eventId)
        return next
      })
    }
  }

  const handleReject = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setError(null)
    setUpdatingEvents((prev) => new Set(prev).add(eventId))

    try {
      const response = await fetch(`/api/v1/users/me/driver-links/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || "Failed to reject link")
      }
      await refreshEvents()
    } catch (err) {
      console.error("Error rejecting link:", err)
      setError(err instanceof Error ? err.message : "Failed to reject link")
    } finally {
      setUpdatingEvents((prev) => {
        const next = new Set(prev)
        next.delete(eventId)
        return next
      })
    }
  }

  const handleBulkConfirm = async () => {
    const suggestedEvents = events.filter((event) => {
      const detail = participationMap.get(event.id)
      return detail?.userDriverLinkStatus === "suggested"
    })
    if (suggestedEvents.length === 0) return

    setError(null)
    setUpdatingEvents(new Set(suggestedEvents.map((e) => e.id)))

    try {
      await Promise.all(
        suggestedEvents.map((event) =>
          fetch(`/api/v1/users/me/driver-links/events/${event.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "confirmed" }),
          })
        )
      )
      await refreshEvents()
    } catch (err) {
      console.error("Error bulk confirming links:", err)
      setError(err instanceof Error ? err.message : "Failed to confirm links")
    } finally {
      setUpdatingEvents(new Set())
    }
  }

  const handleBulkReject = async () => {
    const suggestedEvents = events.filter((event) => {
      const detail = participationMap.get(event.id)
      return detail?.userDriverLinkStatus === "suggested"
    })
    if (suggestedEvents.length === 0) return

    setError(null)
    setUpdatingEvents(new Set(suggestedEvents.map((e) => e.id)))

    try {
      await Promise.all(
        suggestedEvents.map((event) =>
          fetch(`/api/v1/users/me/driver-links/events/${event.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "rejected" }),
          })
        )
      )
      await refreshEvents()
    } catch (err) {
      console.error("Error bulk rejecting links:", err)
      setError(err instanceof Error ? err.message : "Failed to reject links")
    } finally {
      setUpdatingEvents(new Set())
    }
  }

  const participationMap = useMemo(() => {
    const map = new Map<string, ParticipationDetail>()
    participationDetails.forEach((detail) => {
      map.set(detail.eventId, detail)
    })
    return map
  }, [participationDetails])

  const filteredEvents = useMemo(() => {
    if (filter === "suggested") {
      return events.filter((event) => {
        const detail = participationMap.get(event.id)
        return detail?.userDriverLinkStatus === "suggested"
      })
    }
    return events
  }, [events, filter, participationMap])

  const suggestedCount = useMemo(() => {
    return events.filter((event) => {
      const detail = participationMap.get(event.id)
      return detail?.userDriverLinkStatus === "suggested"
    }).length
  }, [events, participationMap])

  const totalItems = filteredEvents.length
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / itemsPerPage)),
    [totalItems, itemsPerPage]
  )
  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredEvents.slice(startIndex, endIndex)
  }, [filteredEvents, currentPage, itemsPerPage])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleRowsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [filteredEvents.length, filter])

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--token-text-muted)]">Loading events...</p>
      </div>
    )
  }

  if (!hasNoDriverPersona && events.length === 0 && error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
        <p className="text-red-600 dark:text-red-400">Error: {error}</p>
        <button
          onClick={() => setError(null)}
          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 ml-4 flex-shrink-0"
          aria-label="Dismiss error"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    )
  }

  if (!hasNoDriverPersona && events.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-[var(--token-text-muted)]">
          No events found that match your driver name.
        </p>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Events will appear here once the system discovers matches based on your driver name.
        </p>
        <Link
          href="/event-search"
          className="inline-flex items-center justify-center rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-accent)]"
        >
          Search for events
        </Link>
      </div>
    )
  }

  if (hasNoDriverPersona && events.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        {isAdmin ? (
          <>
            <p className="text-[var(--token-text-muted)] text-lg">
              This page is for drivers to view their race events.
            </p>
            <p className="text-sm text-[var(--token-text-secondary)]">
              As an administrator, you can manage events and view data through other pages. Events
              will appear here once you have a Driver persona set up.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Link
                href="/event-search"
                className="inline-flex items-center justify-center rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-accent)]"
              >
                Search for events
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-accent)]"
              >
                Go to My Event Analysis
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-[var(--token-text-muted)] text-lg">
              This page shows events where you participated as a driver.
            </p>
            <p className="text-sm text-[var(--token-text-secondary)]">
              To view your events, you&apos;ll need to set up your driver profile. Once configured,
              events where your driver name appears will be displayed here.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Link
                href="/event-search"
                className="inline-flex items-center justify-center rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-accent)]"
              >
                Search for events
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-accent)]"
              >
                Go to My Event Analysis
              </Link>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <p className="text-red-600 dark:text-red-400">Error: {error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 ml-4 flex-shrink-0"
            aria-label="Dismiss error"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === "all"
                ? "bg-[var(--token-accent)]/20 text-[var(--token-accent)]"
                : "border border-[var(--token-border-default)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)]"
            }`}
          >
            All Events
          </button>
          {suggestedCount > 0 && (
            <button
              onClick={() => setFilter("suggested")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === "suggested"
                  ? "bg-[var(--token-accent)]/20 text-[var(--token-accent)]"
                  : "border border-[var(--token-border-default)] text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)]"
              }`}
            >
              Suggestions Only ({suggestedCount})
            </button>
          )}
        </div>
        {filter === "suggested" && suggestedCount > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkReject}
              disabled={updatingEvents.size > 0}
              className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updatingEvents.size > 0 ? "Rejecting..." : `Reject All (${suggestedCount})`}
            </button>
            <button
              onClick={handleBulkConfirm}
              disabled={updatingEvents.size > 0}
              className="px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updatingEvents.size > 0 ? "Confirming..." : `Confirm All (${suggestedCount})`}
            </button>
          </div>
        )}
      </div>

      {filteredEvents.length === 0 && filter === "suggested" && (
        <div className="text-center py-8 text-[var(--token-text-muted)]">
          No suggested events found.
        </div>
      )}

      {filteredEvents.length > 0 && (
        <ChartContainer
          title="My Events"
          aria-label="Events table with similarity scores and status"
        >
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
                      Similarity Score
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-[var(--token-text-secondary)]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEvents.map((event) => {
                    const detail = participationMap.get(event.id)
                    return (
                      <tr
                        key={event.id}
                        className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)] cursor-pointer"
                        onClick={() => handleEventClick(event.id)}
                      >
                        <td className="px-4 py-3 text-[var(--token-text-primary)]">
                          {event.eventName}
                        </td>
                        <td className="px-4 py-3 text-[var(--token-text-secondary)]">
                          {event.track?.trackName || "Unknown Track"}
                        </td>
                        <td className="px-4 py-3 text-[var(--token-text-secondary)]">
                          {formatEventDate(event.eventDate)}
                        </td>
                        <td className="px-4 py-3 text-[var(--token-text-secondary)]">
                          {detail ? formatSimilarityScore(detail.similarityScore) : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-[var(--token-text-secondary)]">
                          {detail?.userDriverLinkStatus === "suggested" ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => handleConfirm(event.id, e)}
                                disabled={updatingEvents.has(event.id)}
                                className="px-2 py-1 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Confirm this match"
                              >
                                {updatingEvents.has(event.id) ? "..." : "Confirm"}
                              </button>
                              <button
                                onClick={(e) => handleReject(event.id, e)}
                                disabled={updatingEvents.has(event.id)}
                                className="px-2 py-1 text-xs font-medium rounded bg-gray-600 text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Reject this match"
                              >
                                {updatingEvents.has(event.id) ? "..." : "Reject"}
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                detail?.userDriverLinkStatus === "confirmed"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                              }`}
                            >
                              {detail?.userDriverLinkStatus === "confirmed"
                                ? "Confirmed"
                                : detail?.userDriverLinkStatus === "rejected"
                                  ? "Rejected"
                                  : detail?.userDriverLinkStatus || "Unknown"}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

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
          </div>
        </ChartContainer>
      )}
    </div>
  )
}
