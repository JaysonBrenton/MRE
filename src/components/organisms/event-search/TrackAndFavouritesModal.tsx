/**
 * @fileoverview Modal containing track selector and favourite tracks
 *
 * @description Presents the current track, Change button (opens full track list),
 *              and favourite tracks in a modal. Used from EventSearchForm so the
 *              main form shows a compact trigger that opens this modal.
 *
 * @relatedFiles
 * - src/components/organisms/event-search/EventSearchForm.tsx
 * - src/components/organisms/event-search/TrackSelectionModal.tsx
 */

"use client"

import { useState } from "react"
import Modal from "@/components/molecules/Modal"
import Button from "@/components/atoms/Button"
import TrackSelectionModal from "./TrackSelectionModal"
import { type Track } from "./TrackRow"
import { getContentBlockStyles } from "@/lib/modal-styles"

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export interface TrackAndFavouritesModalProps {
  isOpen: boolean
  onClose: () => void
  selectedTrack: Track | null
  tracks: Track[]
  favourites: string[]
  trackError?: string
  onTrackSelect: (track: Track) => void
  onToggleFavourite: (trackId: string) => void
  onSearch?: (track?: Track) => void
}

const FAVOURITES_VISIBLE_CAP = 4

export default function TrackAndFavouritesModal({
  isOpen,
  onClose,
  selectedTrack,
  tracks,
  favourites,
  trackError,
  onTrackSelect,
  onToggleFavourite,
  onSearch,
}: TrackAndFavouritesModalProps) {
  const [isTrackListOpen, setIsTrackListOpen] = useState(false)
  const [favouritesExpanded, setFavouritesExpanded] = useState(false)

  const favouriteTrackOptions = favourites
    .map((trackId) => tracks.find((track) => track.id === trackId))
    .filter((track): track is Track => Boolean(track))
  const visibleFavourites = favouritesExpanded
    ? favouriteTrackOptions
    : favouriteTrackOptions.slice(0, FAVOURITES_VISIBLE_CAP)
  const remainingCount = favouriteTrackOptions.length - FAVOURITES_VISIBLE_CAP
  const trackErrorId = trackError ? "track-selector-error-modal" : undefined

  const handleSelectTrack = (track: Track) => {
    onTrackSelect(track)
    setIsTrackListOpen(false)
    onClose()
    if (onSearch) {
      setTimeout(() => onSearch(track), 0)
    }
  }

  const handleFavouriteSelect = (track: Track) => {
    onTrackSelect(track)
    onClose()
    // Defer search to next tick so container has committed track selection; pass track so search runs when selectedTrack was previously null
    if (onSearch) {
      setTimeout(() => onSearch(track), 0)
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Current Track"
        subtitle={
          selectedTrack ? (
            <span title={selectedTrack.trackName} className="block truncate">
              {selectedTrack.trackName}
            </span>
          ) : (
            "No track selected"
          )
        }
        maxWidth="lg"
        ariaLabel="Select track"
      >
        <div className="p-4 space-y-3" style={getContentBlockStyles()}>
          {!selectedTrack && favouriteTrackOptions.length === 0 && (
            <p className="text-sm text-[var(--token-text-secondary)] mb-3">
              Select a track to search for events.
            </p>
          )}
          <div>
            <label
              htmlFor="track-selector-change-btn"
              className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
            >
              {selectedTrack ? "Select a different track" : "Choose a track"}
            </label>
            <div id="track-selector-modal" className="flex gap-2 items-center">
              <Button
                type="button"
                id="track-selector-change-btn"
                variant={selectedTrack ? "default" : "primary"}
                onClick={() => setIsTrackListOpen(true)}
                className="flex-shrink-0 h-11 px-3 gap-1.5"
                aria-label={selectedTrack ? "Change track" : "Select track"}
                aria-describedby={trackErrorId}
                aria-haspopup="dialog"
                aria-expanded={isTrackListOpen}
              >
                {selectedTrack ? "Change track" : "Select track"}
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-[var(--token-text-secondary)]" />
              </Button>
            </div>
            {trackError && (
              <p
                id={trackErrorId}
                className="mt-1 text-sm text-[var(--token-error-text)]"
                role="alert"
              >
                {trackError}
              </p>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-[var(--token-border-default)]">
            <p className="block text-sm font-medium text-[var(--token-text-primary)] mb-2">
              Favourite tracks
            </p>
            {favouriteTrackOptions.length === 0 ? (
              <p className="text-sm text-[var(--token-text-secondary)]">
                No favourite tracks yet. Add tracks from the track list.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2" aria-label="Favourite tracks">
                {visibleFavourites.map((track) => (
                  <div
                    key={track.id}
                    className={`group rounded-full border flex items-center gap-1 transition-all ${
                      track.id === selectedTrack?.id
                        ? "border-[var(--token-accent)] bg-[var(--token-accent)]/10 hover:bg-[var(--token-accent)]/15"
                        : "border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] hover:bg-[var(--token-surface-raised)] hover:border-[var(--token-accent)]/40 hover:shadow-sm"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleFavouriteSelect(track)}
                      className="pl-3 pr-1 py-1 text-xs font-medium text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                    >
                      {track.trackName}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleFavourite(track.id)}
                      className="mr-1 p-0.5 rounded-full hover:bg-[var(--token-surface-alt)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)] flex items-center justify-center"
                      aria-label={`Remove ${track.trackName} from favourites`}
                      title="Remove from favourites"
                    >
                      <svg
                        className="w-3 h-3 text-[var(--token-text-secondary)] group-hover:text-[var(--token-text-primary)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
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
                ))}
                {!favouritesExpanded && remainingCount > 0 && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => setFavouritesExpanded(true)}
                    className="h-8 px-3 text-xs rounded-full"
                  >
                    +{remainingCount} more
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <TrackSelectionModal
        tracks={tracks}
        favourites={favourites}
        isOpen={isTrackListOpen}
        onClose={() => setIsTrackListOpen(false)}
        onSelect={handleSelectTrack}
        onToggleFavourite={onToggleFavourite}
        overlayZIndex={110}
      />
    </>
  )
}
