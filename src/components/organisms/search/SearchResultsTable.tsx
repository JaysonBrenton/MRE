/**
 * @fileoverview Search results table component
 *
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 *
 * @description Displays unified search results (events and sessions)
 */

"use client"

import Link from "next/link"
import {
  StandardTable,
  StandardTableHeader,
  StandardTableRow,
  StandardTableCell,
} from "@/components/molecules/StandardTable"
import { useAppSelector } from "@/store/hooks"
import type { EventSearchResult, SessionSearchResult } from "@/core/search/types"

function formatDate(dateString: string | null): string {
  if (!dateString) return "—"
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString()
  } catch {
    return dateString
  }
}

function formatSessionType(sessionType: string | null): string {
  if (!sessionType) return "—"
  return sessionType.charAt(0).toUpperCase() + sessionType.slice(1)
}

export default function SearchResultsTable() {
  const { events, sessions, isLoading, hasSearched, error } = useAppSelector(
    (state) => state.search
  )

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-[var(--token-text-secondary)]">Searching...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error: {error}</p>
      </div>
    )
  }

  if (!hasSearched) {
    return (
      <div className="text-center py-8">
        <p className="text-[var(--token-text-secondary)]">
          Enter search criteria and click Search to see results
        </p>
      </div>
    )
  }

  if (events.length === 0 && sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[var(--token-text-secondary)]">No results found</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Events Section */}
      {events.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-[var(--token-text-primary)] mb-4">
            Events ({events.length})
          </h2>
          <StandardTable>
            <StandardTableHeader>
              <StandardTableRow>
                <StandardTableCell header>Event Name</StandardTableCell>
                <StandardTableCell header>Track</StandardTableCell>
                <StandardTableCell header>Date</StandardTableCell>
                <StandardTableCell header>Actions</StandardTableCell>
              </StandardTableRow>
            </StandardTableHeader>
            <tbody>
              {events.map((event) => (
                <EventResultRow key={event.id} event={event} />
              ))}
            </tbody>
          </StandardTable>
        </div>
      )}

      {/* Sessions Section */}
      {sessions.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-[var(--token-text-primary)] mb-4">
            Sessions ({sessions.length})
          </h2>
          <StandardTable>
            <StandardTableHeader>
              <StandardTableRow>
                <StandardTableCell header>Session Name</StandardTableCell>
                <StandardTableCell header>Class</StandardTableCell>
                <StandardTableCell header>Type</StandardTableCell>
                <StandardTableCell header>Event</StandardTableCell>
                <StandardTableCell header>Date</StandardTableCell>
                <StandardTableCell header>Actions</StandardTableCell>
              </StandardTableRow>
            </StandardTableHeader>
            <tbody>
              {sessions.map((session) => (
                <SessionResultRow key={session.id} session={session} />
              ))}
            </tbody>
          </StandardTable>
        </div>
      )}
    </div>
  )
}

function EventResultRow({ event }: { event: EventSearchResult }) {
  return (
    <StandardTableRow>
      <StandardTableCell>{event.eventName}</StandardTableCell>
      <StandardTableCell>{event.trackName}</StandardTableCell>
      <StandardTableCell>{formatDate(event.eventDate)}</StandardTableCell>
      <StandardTableCell>
        <Link
          href={`/dashboard?eventId=${event.id}`}
          className="text-[var(--token-accent)] hover:underline"
        >
          View Event
        </Link>
      </StandardTableCell>
    </StandardTableRow>
  )
}

function SessionResultRow({ session }: { session: SessionSearchResult }) {
  return (
    <StandardTableRow>
      <StandardTableCell>{session.raceLabel}</StandardTableCell>
      <StandardTableCell>{session.className}</StandardTableCell>
      <StandardTableCell>{formatSessionType(session.sessionType)}</StandardTableCell>
      <StandardTableCell>{session.eventName}</StandardTableCell>
      <StandardTableCell>{formatDate(session.eventDate)}</StandardTableCell>
      <StandardTableCell>
        <Link
          href={`/dashboard?eventId=${session.eventId}`}
          className="text-[var(--token-accent)] hover:underline"
        >
          View Event
        </Link>
      </StandardTableCell>
    </StandardTableRow>
  )
}
