/**
 * @fileoverview Event Search omnibox (database-only type-ahead).
 *
 * @description A single Google-style search input for the dashboard Event
 *              Search modal. Debounced type-ahead queries
 *              GET /api/v1/events/search/suggest and presents grouped track and
 *              event suggestions. Selecting a track runs a track-scoped DB
 *              search; selecting an event opens it for the dashboard.
 *
 * @purpose Lower cognitive load by letting users search by track OR event name
 *          from one input, instead of a track-first multi-control form. Reads
 *          only from the MRE database — no LiveRC discovery.
 *
 * @relatedFiles
 * - src/app/api/v1/events/search/suggest/route.ts (suggestion API)
 * - src/components/organisms/event-search/EventSearchForm.tsx (consumer)
 * - docs/architecture/event-search-omnibox.md (specification)
 */

"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { parseApiResponse } from "@/lib/api-response-helper"
import { clientLogger } from "@/lib/client-logger"
import { formatDateDisplay } from "@/lib/date-utils"
import type { Track } from "./TrackRow"

const SUGGEST_DEBOUNCE_MS = 250
const SUGGEST_MIN_QUERY_LENGTH = 2

interface TrackSuggestion {
  id: string
  trackName: string
  sourceTrackSlug: string
  city: string | null
  state: string | null
  country: string | null
}

interface EventSuggestion {
  id: string
  eventName: string
  eventDate: string | null
  trackId: string
  trackName: string
  ingestDepth: string
}

interface SuggestResponse {
  query: string
  tracks: TrackSuggestion[]
  events: EventSuggestion[]
}

/** Flattened option used for keyboard navigation across both groups. */
type FlatOption =
  | { kind: "track"; index: number; track: TrackSuggestion }
  | { kind: "event"; index: number; event: EventSuggestion }

export interface EventSearchOmniboxProps {
  /** Called when the user picks a track suggestion. */
  onSelectTrack: (track: Track) => void
  /** Called when the user picks an event suggestion (event id). */
  onSelectEvent: (eventId: string) => void
  /** Fired when the input value changes (parent uses this for empty-query browse). */
  onQueryChange?: (query: string) => void
  disabled?: boolean
  placeholder?: string
}

function trackSubtitle(track: TrackSuggestion): string {
  return [track.city, track.state, track.country].filter(Boolean).join(", ")
}

export default function EventSearchOmnibox({
  onSelectTrack,
  onSelectEvent,
  onQueryChange,
  disabled = false,
  placeholder = "Search by track or event name…",
}: EventSearchOmniboxProps) {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<SuggestResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const [dropdownRect, setDropdownRect] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const baseId = useId()
  const listboxId = `${baseId}-listbox`

  const trimmed = query.trim()
  const belowMinLength = trimmed.length < SUGGEST_MIN_QUERY_LENGTH

  useEffect(() => {
    onQueryChange?.(query)
  }, [query, onQueryChange])

  // Build a flat, ordered option list (tracks first, then events) for keyboard nav.
  const flatOptions = useMemo<FlatOption[]>(() => {
    if (!suggestions) return []
    const options: FlatOption[] = []
    suggestions.tracks.forEach((track, index) => options.push({ kind: "track", index, track }))
    suggestions.events.forEach((event, index) => options.push({ kind: "event", index, event }))
    return options
  }, [suggestions])

  const hasResults = flatOptions.length > 0

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (belowMinLength) {
      abortRef.current?.abort()
      abortRef.current = null
      setSuggestions(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      ;(async () => {
        try {
          const response = await fetch(
            `/api/v1/events/search/suggest?q=${encodeURIComponent(trimmed)}`,
            { signal: controller.signal, cache: "no-store" }
          )
          const result = await parseApiResponse<SuggestResponse>(response)
          if (controller.signal.aborted) return
          if (result.success) {
            setSuggestions(result.data)
            setHighlightedIndex(-1)
          } else {
            clientLogger.warn("Event search suggest failed", {
              code: result.error.code,
              message: result.error.message,
            })
            setSuggestions({ query: trimmed, tracks: [], events: [] })
          }
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return
          clientLogger.error("Event search suggest request error", {
            error: error instanceof Error ? error.message : String(error),
          })
          setSuggestions({ query: trimmed, tracks: [], events: [] })
        } finally {
          if (!controller.signal.aborted) {
            setIsLoading(false)
          }
        }
      })()
    }, SUGGEST_DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [trimmed, belowMinLength])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  // Keep the portaled dropdown anchored to the input as the modal resizes / scrolls.
  const dropdownVisible = isOpen && !belowMinLength
  useEffect(() => {
    if (!dropdownVisible) {
      setDropdownRect(null)
      return
    }

    const update = () => {
      if (!inputRef.current) return
      const r = inputRef.current.getBoundingClientRect()
      setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width })
    }

    update()

    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
    }
  }, [dropdownVisible])

  const closeDropdown = () => {
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleSelectTrack = (track: TrackSuggestion) => {
    onSelectTrack({
      id: track.id,
      trackName: track.trackName,
      sourceTrackSlug: track.sourceTrackSlug,
      country: track.country ?? undefined,
    })
    setQuery("")
    setSuggestions(null)
    closeDropdown()
    inputRef.current?.blur()
  }

  const handleSelectEvent = (event: EventSuggestion) => {
    onSelectEvent(event.id)
    setQuery("")
    setSuggestions(null)
    closeDropdown()
    inputRef.current?.blur()
  }

  const activateOption = (option: FlatOption | undefined) => {
    if (!option) return
    if (option.kind === "track") {
      handleSelectTrack(option.track)
    } else {
      handleSelectEvent(option.event)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault()
      closeDropdown()
      return
    }
    if (!isOpen || !hasResults) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < flatOptions.length - 1 ? prev + 1 : 0))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : flatOptions.length - 1))
        break
      case "Enter":
        if (highlightedIndex >= 0) {
          e.preventDefault()
          activateOption(flatOptions[highlightedIndex])
        }
        break
    }
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (!listRef.current?.contains(document.activeElement)) {
        closeDropdown()
      }
    }, 150)
  }

  const showDropdown = dropdownVisible
  const activeOptionId = highlightedIndex >= 0 ? `${baseId}-option-${highlightedIndex}` : undefined

  return (
    <div className="relative" style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`h-12 w-full rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] pl-4 text-base text-[var(--token-text-primary)] placeholder:text-[var(--token-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 ${query ? "pr-10" : "pr-4"}`}
          role="combobox"
          aria-label="Search events and tracks"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listboxId : undefined}
          aria-activedescendant={activeOptionId}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("")
              setSuggestions(null)
              closeDropdown()
              inputRef.current?.focus()
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)]"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {showDropdown &&
        dropdownRect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Track and event suggestions"
            style={{
              position: "fixed",
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: dropdownRect.width,
              zIndex: 9999,
            }}
            className="max-h-80 overflow-y-auto rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] shadow-2xl"
          >
            {isLoading && !hasResults && (
              <p className="px-3 py-3 text-sm text-[var(--token-text-muted)]" role="status">
                Searching…
              </p>
            )}

            {!isLoading && !hasResults && (
              <p className="px-3 py-3 text-sm text-[var(--token-text-muted)]">
                No tracks or events found in your database.
              </p>
            )}

            {suggestions && suggestions.tracks.length > 0 && (
              <div role="group" aria-label="Tracks">
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--token-text-tertiary)]">
                  Tracks
                </p>
                {suggestions.tracks.map((track, index) => {
                  const flatIndex = index
                  const subtitle = trackSubtitle(track)
                  return (
                    <button
                      key={`track-${track.id}`}
                      type="button"
                      id={`${baseId}-option-${flatIndex}`}
                      role="option"
                      aria-selected={highlightedIndex === flatIndex}
                      onMouseEnter={() => setHighlightedIndex(flatIndex)}
                      onClick={() => handleSelectTrack(track)}
                      className={`flex w-full flex-col items-start px-3 py-2 text-left transition-colors focus:outline-none ${
                        highlightedIndex === flatIndex
                          ? "bg-[var(--token-accent)]/20"
                          : "hover:bg-[var(--token-surface-raised)]"
                      }`}
                    >
                      <span className="text-sm font-medium text-[var(--token-text-primary)]">
                        {track.trackName}
                      </span>
                      {subtitle && (
                        <span className="text-xs text-[var(--token-text-muted)]">{subtitle}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {suggestions && suggestions.events.length > 0 && (
              <div role="group" aria-label="Events">
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--token-text-tertiary)]">
                  Events
                </p>
                {suggestions.events.map((event, index) => {
                  const flatIndex = (suggestions.tracks.length || 0) + index
                  const dateLabel = event.eventDate ? formatDateDisplay(event.eventDate) : ""
                  return (
                    <button
                      key={`event-${event.id}`}
                      type="button"
                      id={`${baseId}-option-${flatIndex}`}
                      role="option"
                      aria-selected={highlightedIndex === flatIndex}
                      onMouseEnter={() => setHighlightedIndex(flatIndex)}
                      onClick={() => handleSelectEvent(event)}
                      className={`flex w-full flex-col items-start px-3 py-2 text-left transition-colors focus:outline-none ${
                        highlightedIndex === flatIndex
                          ? "bg-[var(--token-accent)]/20"
                          : "hover:bg-[var(--token-surface-raised)]"
                      }`}
                    >
                      <span className="text-sm font-medium text-[var(--token-text-primary)]">
                        {event.eventName}
                      </span>
                      <span className="text-xs text-[var(--token-text-muted)]">
                        {[event.trackName, dateLabel].filter(Boolean).join(" • ")}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
