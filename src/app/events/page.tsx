/**
 * @fileoverview Events list page
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Events list page showing available race events
 * 
 * @purpose Displays a list of race events with filtering options and event cards.
 *          Users can browse and select events to view detailed analysis.
 * 
 * @relatedFiles
 * - app/components/AppShell.tsx (application shell wrapper)
 */

"use client"

import AppShell from "../components/AppShell"

// Mock event data
const mockEvents = [
  {
    id: "1",
    trackName: "Silverstone Circuit",
    eventName: "2024 RC Championship Round 1",
    dateRange: "March 15-17, 2024",
    status: "Imported",
  },
  {
    id: "2",
    trackName: "Monaco GP Track",
    eventName: "Spring Racing Series",
    dateRange: "April 5-7, 2024",
    status: "New",
  },
  {
    id: "3",
    trackName: "Spa-Francorchamps",
    eventName: "European RC Cup",
    dateRange: "May 10-12, 2024",
    status: "Needs Sync",
  },
  {
    id: "4",
    trackName: "Nürburgring",
    eventName: "Summer Classic",
    dateRange: "June 20-22, 2024",
    status: "Imported",
  },
  {
    id: "5",
    trackName: "Circuit de Barcelona-Catalunya",
    eventName: "Spanish RC Grand Prix",
    dateRange: "July 8-10, 2024",
    status: "New",
  },
  {
    id: "6",
    trackName: "Interlagos",
    eventName: "South American Championship",
    dateRange: "August 15-17, 2024",
    status: "Imported",
  },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "New":
      return "bg-[var(--token-accent)]"
    case "Imported":
      return "bg-[var(--token-accent-hover)]"
    case "Needs Sync":
      return "bg-[var(--token-text-muted)]"
    default:
      return "bg-[var(--token-text-muted)]"
  }
}

export default function EventsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-[var(--token-text-primary)] sm:text-4xl">
            Events
          </h1>
        </div>

        {/* Filter Row */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search events..."
              disabled
              className="w-full rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-4 py-2 text-sm text-[var(--token-text-muted)] placeholder-[var(--token-text-muted)] opacity-50"
            />
          </div>
          <div className="flex gap-4">
            <select
              disabled
              className="rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-4 py-2 text-sm text-[var(--token-text-muted)] opacity-50"
            >
              <option>Track</option>
            </select>
            <select
              disabled
              className="rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface)] px-4 py-2 text-sm text-[var(--token-text-muted)] opacity-50"
            >
              <option>Date Range</option>
            </select>
          </div>
        </div>

        {/* Event Card Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {mockEvents.map((event) => (
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
                    {event.trackName}
                  </p>
                </div>
                <span
                  className={`ml-2 rounded-full px-2 py-1 text-xs font-medium text-white ${getStatusColor(
                    event.status
                  )}`}
                >
                  {event.status}
                </span>
              </div>

              <p className="mb-4 text-sm text-[var(--token-text-muted)]">
                {event.dateRange}
              </p>

              <button
                className="mobile-button w-full rounded-md border border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)] px-4 py-2 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-accent)]"
                onClick={() => {
                  // Placeholder - will link to event detail page
                }}
              >
                Open event
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}

