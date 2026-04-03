/**
 * @fileoverview Track selection modal component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-28
 *
 * @description Searchable modal for selecting tracks with favourites support
 *
 * @purpose Provides a modal interface for track selection with typeahead search
 *          and favourites functionality. Full-screen on mobile, centered on desktop.
 *          Includes keyboard accessibility and focus trap.
 *
 * @relatedFiles
 * - src/components/event-search/TrackRow.tsx (track row component)
 * - docs/frontend/liverc/user-workflow.md (UX specification)
 */

"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import Button from "@/components/atoms/Button"
import TrackRow, { type Track } from "./TrackRow"
import { clientLogger } from "@/lib/client-logger"

export interface TrackSelectionModalProps {
  tracks: Track[]
  favourites: string[] // Array of track IDs
  isOpen: boolean
  onClose: () => void
  onSelect: (track: Track) => void
  onToggleFavourite: (trackId: string) => void
  /** When opening from another modal (e.g. TrackAndFavouritesModal), pass 110 to stack above */
  overlayZIndex?: number
  /** When nesting inside another modal, disable the second dimmed overlay */
  backdropVariant?: "dim" | "none"
}

const FAVOURITES_STORAGE_KEY = "mre_favourite_tracks"

const ALL_COUNTRIES = ""

export default function TrackSelectionModal({
  tracks,
  favourites: initialFavourites,
  isOpen,
  onClose,
  onSelect,
  onToggleFavourite,
  overlayZIndex = 50,
  backdropVariant = "dim",
}: TrackSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCountry, setSelectedCountry] = useState<string>(ALL_COUNTRIES)
  const [favourites, setFavourites] = useState<string[]>(initialFavourites)
  const [isVisible, setIsVisible] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Distinct countries from tracks (sorted). Exclude values that are clearly not countries (e.g. emails).
  const countries = useMemo(() => {
    const set = new Set<string>()
    for (const t of tracks) {
      const c = t.country?.trim()
      if (!c) continue
      if (c.includes("@") || c.length > 60) continue
      set.add(c)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [tracks])

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  // Animate in after mount (avoids "pop in" feel)
  useEffect(() => {
    if (!isOpen) {
      queueMicrotask(() => setIsVisible(false))
      return
    }
    const id = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  // Trap focus within the modal while it is open
  useEffect(() => {
    if (!isOpen) return
    const modalElement = modalRef.current
    if (!modalElement) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const focusableElements = modalElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
      if (focusableElements.length === 0) {
        return
      }
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    modalElement.addEventListener("keydown", handleKeyDown)
    return () => {
      modalElement.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  // Filter tracks based on search query and country
  const filteredTracks = tracks.filter((track) => {
    const matchesSearch = track.trackName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCountry =
      selectedCountry === ALL_COUNTRIES || (track.country?.trim() ?? "") === selectedCountry
    return matchesSearch && matchesCountry
  })

  // Separate favourite and non-favourite tracks
  const favouriteTracks = filteredTracks.filter((track) => favourites.includes(track.id))
  const otherTracks = filteredTracks.filter((track) => !favourites.includes(track.id))

  const handleToggleFavourite = (trackId: string) => {
    const newFavourites = favourites.includes(trackId)
      ? favourites.filter((id) => id !== trackId)
      : [...favourites, trackId]

    setFavourites(newFavourites)

    // Persist to localStorage
    try {
      localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(newFavourites))
    } catch (error) {
      clientLogger.error("Failed to save favourites to localStorage", {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    onToggleFavourite(trackId)
  }

  const handleSelect = (track: Track) => {
    onSelect(track)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className={[
        "fixed inset-0 flex items-center justify-center p-4",
        backdropVariant === "dim" ? "bg-black/50 backdrop-blur-[2px]" : "bg-transparent",
        "transition-opacity duration-150 ease-out",
        isVisible ? "opacity-100" : "opacity-0",
      ].join(" ")}
      style={{ minWidth: 0, zIndex: overlayZIndex }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="track-modal-title"
    >
      <div
        ref={modalRef}
        className={[
          "max-h-[calc(100vh-2rem)] bg-[var(--token-surface-raised)] rounded-xl shadow-xl flex flex-col border border-[var(--token-border-default)]",
          "transition-transform duration-150 ease-out will-change-transform",
          isVisible ? "translate-y-0 scale-100" : "translate-y-1 scale-[0.98]",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "42rem",
          minWidth: "20rem",
          boxSizing: "border-box",
          flexShrink: 0,
          flexGrow: 0,
        }}
      >
        {/* Sticky header + filters */}
        <div
          className="sticky top-0 z-10 bg-[var(--token-surface-raised)] border-b border-[var(--token-border-default)]"
          style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}
        >
          <div
            className="flex items-start justify-between gap-4 px-4 pt-4"
            style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}
          >
            <div style={{ minWidth: 0, flex: "1 1 auto" }}>
              <h2
                id="track-modal-title"
                className="text-lg font-semibold text-[var(--token-text-primary)]"
              >
                Select Track
              </h2>
              <p className="mt-0.5 text-sm text-[var(--token-text-secondary)]">
                Click a track to select it
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 flex items-center justify-center text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md flex-shrink-0"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div
            className="px-4 pb-4 pt-3 space-y-3"
            style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}
          >
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--token-text-secondary)] pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"
                />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to filter, then click a track"
                className="w-full h-11 pl-10 pr-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] placeholder:text-[var(--token-text-secondary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors"
                aria-label="Search tracks"
                style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}
              />
            </div>
            {countries.length > 0 && (
              <div>
                <label
                  htmlFor="track-country-filter"
                  className="block text-sm font-medium text-[var(--token-text-secondary)] mb-1.5"
                >
                  Country
                </label>
                <select
                  id="track-country-filter"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors"
                  aria-label="Filter tracks by country"
                >
                  <option value={ALL_COUNTRIES}>All countries</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Track List */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{
            minWidth: 0,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* Favourite Tracks Section */}
          {favouriteTracks.length > 0 && (
            <div style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}>
              <div className="px-4 py-2 bg-[var(--token-surface-alt)] border-b border-[var(--token-border-default)] flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <h3 className="text-sm font-medium text-[var(--token-text-secondary)]">
                  Your favourites
                </h3>
              </div>
              {favouriteTracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  isFavourite={true}
                  onSelect={handleSelect}
                  onToggleFavourite={handleToggleFavourite}
                />
              ))}
            </div>
          )}

          {/* Other Tracks */}
          {otherTracks.length > 0 && (
            <div style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}>
              {favouriteTracks.length > 0 && (
                <div className="px-4 py-2 bg-[var(--token-surface-alt)] border-b border-[var(--token-border-default)] border-t border-[var(--token-border-default)]">
                  <h3 className="text-sm font-medium text-[var(--token-text-secondary)]">
                    All tracks
                  </h3>
                </div>
              )}
              {otherTracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  isFavourite={false}
                  onSelect={handleSelect}
                  onToggleFavourite={handleToggleFavourite}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {filteredTracks.length === 0 && (
            <div className="px-4 py-12 text-center w-full min-w-0">
              <p className="text-[var(--token-text-primary)] font-medium">No tracks found</p>
              <p className="mt-1 text-sm text-[var(--token-text-secondary)]">
                {countries.length > 0
                  ? "Try a different search term or country"
                  : "Try a different search term"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
