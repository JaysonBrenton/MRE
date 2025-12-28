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

import { useState, useEffect, useRef } from "react"
import TrackRow, { type Track } from "./TrackRow"
import { logger } from "@/lib/logger"

export interface TrackSelectionModalProps {
  tracks: Track[]
  favourites: string[] // Array of track IDs
  isOpen: boolean
  onClose: () => void
  onSelect: (track: Track) => void
  onToggleFavourite: (trackId: string) => void
}

const FAVOURITES_STORAGE_KEY = "mre_favourite_tracks"

export default function TrackSelectionModal({
  tracks,
  favourites: initialFavourites,
  isOpen,
  onClose,
  onSelect,
  onToggleFavourite,
}: TrackSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [favourites, setFavourites] = useState<string[]>(initialFavourites)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
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

  // Filter tracks based on search query
  const filteredTracks = tracks.filter((track) =>
    track.trackName.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
      logger.error("Failed to save favourites to localStorage", {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="track-modal-title"
      style={{ minWidth: 0 }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl max-h-[90vh] bg-[var(--token-surface)] rounded-lg shadow-lg flex flex-col sm:max-h-[600px]"
        onClick={(e) => e.stopPropagation()}
        style={{ 
          minWidth: 0,
          width: '100%',
          maxWidth: '42rem',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-4 py-4 border-b border-[var(--token-border-default)]"
          style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}
        >
          <h2 
            id="track-modal-title" 
            className="text-lg font-semibold text-[var(--token-text-primary)]"
            style={{ minWidth: 0, flex: '1 1 auto' }}
          >
            Select Track
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md flex-shrink-0"
            aria-label="Close modal"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Search Input */}
        <div 
          className="px-4 py-4 border-b border-[var(--token-border-default)]"
          style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}
        >
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks..."
            className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] placeholder:text-[var(--token-text-secondary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors"
            aria-label="Search tracks"
            style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Track List */}
        <div 
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ 
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {/* Favourite Tracks Section */}
          {favouriteTracks.length > 0 && (
            <div style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
              <div className="px-4 py-2 bg-[var(--token-surface-alt)] border-b border-[var(--token-border-default)]">
                <h3 className="text-sm font-medium text-[var(--token-text-secondary)]">
                  Favourite Tracks
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
            <div style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
              {favouriteTracks.length > 0 && (
                <div className="px-4 py-2 bg-[var(--token-surface-alt)] border-b border-[var(--token-border-default)] border-t border-[var(--token-border-default)]">
                  <h3 className="text-sm font-medium text-[var(--token-text-secondary)]">
                    All Tracks
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
            <div className="px-4 py-8 text-center">
              <p className="text-[var(--token-text-secondary)]">No tracks found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div 
          className="px-4 py-4 border-t border-[var(--token-border-default)]"
          style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="mobile-button w-full sm:w-auto flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] sm:px-5 h-11"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
