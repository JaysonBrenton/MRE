"use client"

import { useMemo, useState } from "react"
import { useDashboardContext } from "@/components/dashboard/context/DashboardContext"
import type { ImportedEventSummary } from "@/types/dashboard"

export default function ContextRibbon() {
  const {
    selectedEventId,
    selectedEvent,
    selectEvent,
    recentEvents,
    isRecentLoading,
    fetchRecentEvents,
  } = useDashboardContext()
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [eventScope, setEventScope] = useState<"all" | "my">("all")

  const filteredEvents = useMemo(() => {
    if (!search) return recentEvents
    return recentEvents.filter((event) => {
      const matcher = `${event.eventName} ${event.track.trackName}`.toLowerCase()
      return matcher.includes(search.toLowerCase())
    })
  }, [recentEvents, search])

  const handleEventScopeChange = (scope: "all" | "my") => {
    setEventScope(scope)
    fetchRecentEvents(scope)
  }

  const handleSelectEvent = (event: ImportedEventSummary) => {
    selectEvent(event.id)
    setSelectorOpen(false)
  }

  return (
    <section className="sticky top-16 z-30 border-b border-[var(--token-border-muted)] bg-[var(--token-surface)]/85 backdrop-blur-lg">
      <div className="flex flex-col gap-4 px-4 py-4 lg:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="flex flex-1 flex-col">
              <span className="text-[10px] uppercase tracking-[0.4em] text-[var(--token-text-muted)]">
                Event Context
              </span>
              <button
                type="button"
                onClick={() => setSelectorOpen((prev) => !prev)}
                className="flex items-center justify-between rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 py-2 text-left transition hover:border-[var(--token-accent)]"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--token-text-primary)]">
                    {selectedEvent ? `${selectedEvent.eventName}` : "Choose an event"}
                  </p>
                  <p className="text-xs text-[var(--token-text-muted)]">
                    {selectedEvent ? selectedEvent.trackName : "Search recent events"}
                  </p>
                </div>
                <svg className="h-4 w-4 text-[var(--token-text-muted)]" viewBox="0 0 24 24" fill="none">
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleEventScopeChange("all")}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest transition ${
                eventScope === "all"
                  ? "bg-[var(--token-accent)]/25 text-[var(--token-accent)]"
                  : "text-[var(--token-text-muted)] hover:text-[var(--token-text-primary)]"
              }`}
            >
              All Events
            </button>
            <button
              type="button"
              onClick={() => handleEventScopeChange("my")}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest transition ${
                eventScope === "my"
                  ? "bg-[var(--token-accent)]/25 text-[var(--token-accent)]"
                  : "text-[var(--token-text-muted)] hover:text-[var(--token-text-primary)]"
              }`}
            >
              My Events
            </button>
          </div>
        </div>
      </div>

      {selectorOpen && (
        <div className="border-t border-[var(--token-border-muted)] bg-[var(--token-surface-elevated)]">
          <div className="space-y-4 px-4 py-4 lg:px-6">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-2">
              <svg className="h-4 w-4 text-[var(--token-text-muted)]" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth={1.5} />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              </svg>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search track, event, date"
                className="flex-1 border-none bg-transparent text-sm text-[var(--token-text-primary)] placeholder:text-[var(--token-text-muted)] focus:outline-none"
              />
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto pr-2">
              {isRecentLoading && <p className="text-sm text-[var(--token-text-muted)]">Loading events…</p>}
              {!isRecentLoading && filteredEvents.length === 0 && (
                <p className="text-sm text-[var(--token-text-muted)]">No events match your search.</p>
              )}

              {filteredEvents.map((event) => {
                const isActive = selectedEventId === event.id
                return (
                  <button
                    key={event.id}
                    onClick={() => handleSelectEvent(event)}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-[var(--token-accent)] bg-[var(--token-accent)]/10"
                        : "border-[var(--token-border-default)] hover:border-[var(--token-accent)]"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-[var(--token-text-primary)]">{event.eventName}</p>
                      <p className="text-xs text-[var(--token-text-muted)]">{event.track.trackName}</p>
                    </div>
                    {isActive && (
                      <span className="text-[11px] uppercase tracking-widest text-[var(--token-accent)]">Active</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
