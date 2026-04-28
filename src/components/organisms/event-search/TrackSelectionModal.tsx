/**
 * @fileoverview Track selection modal component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-28
 *
 * @description Searchable modal for selecting tracks with favourites (single list, same order as non-favourites)
 *
 * @purpose Provides a modal interface for track selection with typeahead search
 *          and favourites (star toggles; list order follows column sort only). Full-screen on mobile, centered on desktop.
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
import FavouriteTracksChips from "./FavouriteTracksChips"
import TrackRow, { TRACK_SELECTION_TABLE_CLASS, type Track } from "./TrackRow"
import ListPagination from "@/components/organisms/event-analysis/ListPagination"
import { clientLogger } from "@/lib/client-logger"
import {
  getModalResizableContainerStyles,
  NESTED_MODAL_OVERLAY_Z_INDEX,
  TRACK_SELECTION_MODAL_DEFAULT_HEIGHT_REM,
  TRACK_SELECTION_MODAL_DEFAULT_WIDTH_REM,
} from "@/lib/modal-styles"
import { DEFAULT_TABLE_ROWS_PER_PAGE } from "@/lib/table-pagination"
import { useModalPanelDrag } from "@/hooks/useModalPanelDrag"

export interface TrackSelectionModalProps {
  tracks: Track[]
  favourites: string[] // Array of track IDs
  isOpen: boolean
  onClose: () => void
  onSelect: (track: Track) => void
  onToggleFavourite: (trackId: string) => void
  /** Event-search current track (highlights matching favourite chip). */
  selectedTrack?: Track | null
  /** Default stacks above `MODAL_PORTAL_Z_INDEX` (200) shells such as Event Search modal; override if needed. */
  overlayZIndex?: number
  /** When nesting inside another modal, disable the second dimmed overlay */
  backdropVariant?: "dim" | "none"
}

const FAVOURITES_STORAGE_KEY = "mre_favourite_tracks"

const ALL_COUNTRIES = ""

type TrackSortField = "trackName" | "country"
type TrackSortDirection = "asc" | "desc"

function compareTracksForSort(
  a: Track,
  b: Track,
  field: TrackSortField,
  direction: TrackSortDirection
): number {
  const dir = direction === "asc" ? 1 : -1
  if (field === "trackName") {
    const c = a.trackName.localeCompare(b.trackName, undefined, { sensitivity: "base" })
    if (c !== 0) return c * dir
    const c2 = (a.country?.trim() || "").localeCompare(b.country?.trim() || "", undefined, {
      sensitivity: "base",
    })
    if (c2 !== 0) return c2 * dir
    return a.id.localeCompare(b.id) * dir
  }
  const ac = (a.country?.trim() || "").toLowerCase()
  const bc = (b.country?.trim() || "").toLowerCase()
  const c = ac.localeCompare(bc, undefined, { sensitivity: "base" })
  if (c !== 0) return c * dir
  const nt = a.trackName.localeCompare(b.trackName, undefined, { sensitivity: "base" })
  if (nt !== 0) return nt * dir
  return a.id.localeCompare(b.id) * dir
}

export default function TrackSelectionModal({
  tracks,
  favourites: initialFavourites,
  isOpen,
  onClose,
  onSelect,
  onToggleFavourite,
  selectedTrack = null,
  overlayZIndex = NESTED_MODAL_OVERLAY_Z_INDEX,
  backdropVariant = "dim",
}: TrackSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCountry, setSelectedCountry] = useState<string>(ALL_COUNTRIES)
  const [favourites, setFavourites] = useState<string[]>(initialFavourites)
  const [isVisible, setIsVisible] = useState(false)

  // Props load after first paint (e.g. parent reads localStorage); keep picker stars in sync.
  useEffect(() => {
    if (!isOpen) return
    queueMicrotask(() => setFavourites(initialFavourites))
  }, [isOpen, initialFavourites])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listScrollRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const [trackListPage, setTrackListPage] = useState(1)
  const [tracksPerPage, setTracksPerPage] = useState(DEFAULT_TABLE_ROWS_PER_PAGE)
  const [trackSortField, setTrackSortField] = useState<TrackSortField>("trackName")
  const [trackSortDirection, setTrackSortDirection] = useState<TrackSortDirection>("asc")
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const prevIsOpenForTrackPageRef = useRef(isOpen)
  const { offset: dragOffset, isDragging, headerPointerDown } = useModalPanelDrag(isOpen, modalRef)

  useEffect(() => {
    queueMicrotask(() => setPortalTarget(document.body))
  }, [])

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

  useEffect(() => {
    queueMicrotask(() => setTrackListPage(1))
  }, [searchQuery, selectedCountry])

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

  const filteredTracks = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return tracks.filter((track) => {
      const matchesSearch = track.trackName.toLowerCase().includes(q)
      const matchesCountry =
        selectedCountry === ALL_COUNTRIES || (track.country?.trim() ?? "") === selectedCountry
      return matchesSearch && matchesCountry
    })
  }, [tracks, searchQuery, selectedCountry])

  const orderedTracks = useMemo(() => {
    const cmp = (a: Track, b: Track) =>
      compareTracksForSort(a, b, trackSortField, trackSortDirection)
    return [...filteredTracks].sort(cmp)
  }, [filteredTracks, trackSortField, trackSortDirection])

  const handleTrackColumnSort = (field: TrackSortField) => {
    if (field === trackSortField) {
      setTrackSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setTrackSortField(field)
      setTrackSortDirection("asc")
    }
  }

  useEffect(() => {
    queueMicrotask(() => setTrackListPage(1))
  }, [trackSortField, trackSortDirection])

  const totalTrackListItems = orderedTracks.length
  const trackListTotalPages = Math.max(
    1,
    totalTrackListItems > 0 ? Math.ceil(totalTrackListItems / tracksPerPage) : 1
  )

  // Reset page when the dialog opens; clamp while open if the last page no longer exists.
  // Dev-only: React warns if this dependency array ever changes *length* between renders (e.g. Fast Refresh after editing deps).
  useEffect(() => {
    const wasOpen = prevIsOpenForTrackPageRef.current
    prevIsOpenForTrackPageRef.current = isOpen

    if (!isOpen) {
      return
    }

    if (!wasOpen) {
      queueMicrotask(() => setTrackListPage(1))
      return
    }

    queueMicrotask(() => setTrackListPage((p) => Math.min(p, trackListTotalPages)))
  }, [isOpen, trackListTotalPages])

  const paginatedTracks = orderedTracks.slice(
    (trackListPage - 1) * tracksPerPage,
    trackListPage * tracksPerPage
  )

  useEffect(() => {
    listScrollRef.current?.scrollTo({ top: 0, behavior: "auto" })
  }, [trackListPage, tracksPerPage])

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

  const panelMaxHeight = "min(92dvh, calc(100dvh - 2rem))"
  const panelStyles: CSSProperties = {
    ...getModalResizableContainerStyles(TRACK_SELECTION_MODAL_DEFAULT_WIDTH_REM),
    height: `min(${TRACK_SELECTION_MODAL_DEFAULT_HEIGHT_REM}, ${panelMaxHeight})`,
    resize: "both",
    overflow: "hidden",
    minHeight: "12rem",
    maxHeight: panelMaxHeight,
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
              <div className="min-w-0 shrink-0 w-[min(100vw-4rem,18rem)]">
                <input
                  ref={searchInputRef}
                  id="track-search-filter"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter track names"
                  className="w-full min-w-0 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] placeholder:text-[var(--token-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  aria-label="Search tracks"
                  style={{ boxSizing: "border-box" }}
                />
              </div>
              {countries.length > 0 && (
                <div className="shrink-0 w-[min(100vw-4rem,18rem)]">
                  <select
                    id="track-country-filter"
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="w-full min-w-0 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-2 py-1 text-xs text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
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
            <FavouriteTracksChips
              variant="modal"
              favourites={favourites}
              tracks={tracks}
              selectedTrack={selectedTrack}
              onTrackSelect={handleSelect}
              onToggleFavourite={handleToggleFavourite}
            />
          </div>
        </div>

        {/* Track list + pagination — inset from panel edges so native resize (bottom/right) is not over the scroller */}
        <div
          className="min-h-0 flex-1 flex flex-col mx-3 mb-3"
          style={{ minWidth: 0, boxSizing: "border-box" }}
        >
          <div
            ref={listScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
            style={{
              minWidth: 0,
              boxSizing: "border-box",
              overflowAnchor: "none",
              overscrollBehavior: "contain",
            }}
          >
            {filteredTracks.length > 0 && (
              <table
                className={TRACK_SELECTION_TABLE_CLASS}
                style={{ minWidth: 0, tableLayout: "fixed" }}
              >
                <colgroup>
                  <col style={{ width: "2.5rem" }} />
                  <col />
                  <col style={{ width: "13rem" }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-[var(--token-surface-raised)]">
                  <tr className="border-b border-[var(--token-border-default)]">
                    <th scope="col" className="w-10 py-2 pl-3 pr-0 align-middle">
                      <span className="sr-only">Favourite</span>
                    </th>
                    <th
                      scope="col"
                      className="max-w-0 px-2 py-2 text-left align-middle text-sm font-medium text-[var(--token-text-secondary)]"
                      aria-sort={
                        trackSortField === "trackName"
                          ? trackSortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => handleTrackColumnSort("trackName")}
                        className="text-left text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
                        aria-label={`Sort by track name, ${trackSortField === "trackName" ? (trackSortDirection === "asc" ? "ascending" : "descending") : "not sorted"}`}
                      >
                        Track name
                        {trackSortField === "trackName" && (
                          <span className="ml-1.5 tabular-nums" aria-hidden="true">
                            {trackSortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-2 text-left align-middle text-sm font-medium text-[var(--token-text-secondary)]"
                      style={{ width: "13rem" }}
                      aria-sort={
                        trackSortField === "country"
                          ? trackSortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => handleTrackColumnSort("country")}
                        className="text-left text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
                        aria-label={`Sort by country, ${trackSortField === "country" ? (trackSortDirection === "asc" ? "ascending" : "descending") : "not sorted"}`}
                      >
                        Country
                        {trackSortField === "country" && (
                          <span className="ml-1.5 tabular-nums" aria-hidden="true">
                            {trackSortDirection === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTracks.map((track) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      isFavourite={favourites.includes(track.id)}
                      onSelect={handleSelect}
                      onToggleFavourite={handleToggleFavourite}
                    />
                  ))}
                </tbody>
              </table>
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

          {totalTrackListItems > 0 && (
            <div className="shrink-0 pt-3 border-t border-[var(--token-border-accent-soft)]">
              <ListPagination
                embedded
                currentPage={trackListPage}
                totalPages={trackListTotalPages}
                onPageChange={setTrackListPage}
                itemsPerPage={tracksPerPage}
                totalItems={totalTrackListItems}
                itemLabel="tracks"
                onRowsPerPageChange={(n) => {
                  setTracksPerPage(n)
                  setTrackListPage(1)
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    portalTarget
  )
}
