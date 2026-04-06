/**
 * @fileoverview Track selection modal component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-28
 *
 * @description Searchable modal for selecting tracks with favourites (star-first ordering, single list)
 *
 * @purpose Provides a modal interface for track selection with typeahead search
 *          and favourites (star toggles; favourites sort first in one list). Full-screen on mobile, centered on desktop.
 *          Includes keyboard accessibility and focus trap. Renders via createPortal(document.body)
 *          so fixed positioning is not clipped by ancestor transform/overflow (nested modals).
 *
 * @relatedFiles
 * - src/components/event-search/TrackRow.tsx (track row component)
 * - docs/frontend/liverc/user-workflow.md (UX specification)
 */

"use client"

import { useState, useEffect, useRef, useMemo, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import TrackRow, { type Track } from "./TrackRow"
import { getModalResizableContainerStyles, MODAL_MAX_WIDTHS } from "@/lib/modal-styles"
import { useModalPanelDrag } from "@/hooks/useModalPanelDrag"

export interface TrackSelectionModalProps {
  tracks: Track[]
  favourites: string[] // Array of track IDs
  isOpen: boolean
  onClose: () => void
  onSelect: (track: Track) => void
  onToggleFavourite: (trackId: string) => void
  /** When nesting inside the shared Modal (portal z-index 200), pass `NESTED_MODAL_OVERLAY_Z_INDEX` from `@/lib/modal-styles` or higher */
  overlayZIndex?: number
  /** When nesting inside another modal, disable the second dimmed overlay */
  backdropVariant?: "dim" | "none"
}

const FAVOURITES_STORAGE_KEY = "mre_favourite_tracks"

const ALL_COUNTRIES = ""

/** Next 00:00:00.000 UTC — matches daily track catalogue cron (`ingestion/crontab`: `0 0 * * *`). */
function getNextUtcMidnightMs(fromMs: number): number {
  const d = new Date(fromMs)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0)
}

function formatRemainingHms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

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
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const { offset: dragOffset, isDragging, headerPointerDown } = useModalPanelDrag(isOpen, modalRef)

  useEffect(() => {
    queueMicrotask(() => setPortalTarget(document.body))
  }, [])

  useEffect(() => {
    if (!isOpen) return
    queueMicrotask(() => setNowMs(Date.now()))
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [isOpen])

  const nextSyncCountdownHms = useMemo(
    () => formatRemainingHms(getNextUtcMidnightMs(nowMs) - nowMs),
    [nowMs]
  )

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

  // Favourites first, then others — single list (no section headers)
  const orderedTracks = [
    ...filteredTracks.filter((track) => favourites.includes(track.id)),
    ...filteredTracks.filter((track) => !favourites.includes(track.id)),
  ]

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

  if (!isOpen || !portalTarget) return null

  const panelStyles: CSSProperties = {
    ...getModalResizableContainerStyles(MODAL_MAX_WIDTHS["2xl"]),
    resize: "both",
    overflow: "hidden",
    minHeight: "12rem",
    maxHeight: "calc(100vh - 2rem)",
    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
  }

  return createPortal(
    <div
      className={[
        "fixed inset-0 flex items-center justify-center p-4",
        backdropVariant === "dim" ? "bg-black/50 backdrop-blur-[2px]" : "bg-transparent",
        "transition-opacity duration-150 ease-out",
        isVisible ? "opacity-100" : "opacity-0",
      ].join(" ")}
      style={{ minWidth: 0, zIndex: overlayZIndex }}
      onPointerDown={(e) => {
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
          "bg-[var(--token-surface-raised)] rounded-lg shadow-2xl flex flex-col border border-[var(--token-border-accent-soft)] min-h-0",
          "transition-opacity duration-150 ease-out",
          isVisible ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={panelStyles}
      >
        {/* Sticky header + filters */}
        <div
          className="sticky top-0 z-10 shrink-0 bg-[var(--token-surface-raised)] border-b border-[var(--token-border-accent-soft)]"
          style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}
        >
          <div
            className={`flex items-start justify-between gap-4 px-4 pt-4 ${isDragging ? "cursor-grabbing" : "cursor-grab"} select-none`}
            style={{ minWidth: 0, width: "100%", boxSizing: "border-box", touchAction: "none" }}
            onPointerDown={headerPointerDown}
          >
            <div style={{ minWidth: 0, flex: "1 1 auto" }}>
              <h2
                id="track-modal-title"
                className="text-lg font-semibold text-[var(--token-text-primary)]"
              >
                Select Track
              </h2>
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

          {/* Filter row — glass strip matches event-analysis card texture (see EventTopAverageLapsPerClassTable) */}
          <div
            className="px-4 pb-4 pt-2"
            style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}
          >
            <div
              className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5"
              style={{
                minWidth: 0,
                boxSizing: "border-box",
                backgroundColor: "var(--glass-bg)",
                backdropFilter: "var(--glass-blur)",
                border: "1px solid var(--glass-border)",
                boxShadow: "var(--glass-shadow)",
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <label
                  htmlFor="track-search-filter"
                  className="shrink-0 text-xs font-medium text-[var(--token-text-secondary)]"
                >
                  Search
                </label>
                <input
                  ref={searchInputRef}
                  id="track-search-filter"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Track name"
                  className="min-w-0 flex-1 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] placeholder:text-[var(--token-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  aria-label="Search tracks"
                  style={{ boxSizing: "border-box" }}
                />
              </div>
              {countries.length > 0 && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="track-country-filter"
                    className="text-xs font-medium text-[var(--token-text-secondary)]"
                  >
                    Country
                  </label>
                  <select
                    id="track-country-filter"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="max-w-[min(100vw-4rem,18rem)] min-w-[8rem] rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
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
            <p className="mt-2 text-xs text-[var(--token-text-secondary)]" style={{ minWidth: 0 }}>
              Total tracks:{" "}
              <span className="font-medium tabular-nums text-[var(--token-text-primary)]">
                {tracks.length}
              </span>{" "}
              <span className="text-[var(--token-text-tertiary)]">·</span> Next sync in{" "}
              <span
                className="font-medium tabular-nums text-[var(--token-text-primary)]"
                title="Time until 00:00 UTC (daily scheduled catalogue sync)"
              >
                {nextSyncCountdownHms}
              </span>
            </p>
          </div>
        </div>

        {/* Track List — inset from panel edges so native resize (bottom/right) is not over the scroller;
            overflow-anchor off avoids scrollTop jumps when the flex scroller height changes during resize */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden mx-3 mb-3"
          style={{
            minWidth: 0,
            boxSizing: "border-box",
            overflowAnchor: "none",
            overscrollBehavior: "contain",
          }}
        >
          {orderedTracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              isFavourite={favourites.includes(track.id)}
              onSelect={handleSelect}
              onToggleFavourite={handleToggleFavourite}
            />
          ))}

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
    </div>,
    portalTarget
  )
}
