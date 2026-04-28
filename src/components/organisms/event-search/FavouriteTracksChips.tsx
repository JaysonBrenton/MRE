/**
 * @fileoverview Favourite track quick-select chips (shared UI)
 *
 * @description Maps persisted favourite IDs to tracks and renders chips to select
 *              a track or remove it from favourites. Shown in the track selection modal.
 */

"use client"

import { useState } from "react"
import Button from "@/components/atoms/Button"
import { type Track } from "./TrackRow"

export interface FavouriteTracksChipsProps {
  favourites: string[]
  tracks: Track[]
  selectedTrack: Track | null
  onTrackSelect: (track: Track) => void
  onToggleFavourite: (trackId: string) => void
  /** "form" adds a top border for placement below search filters; "modal" sits under the track modal filter row. */
  variant?: "form" | "modal"
}

const FAVOURITES_VISIBLE_CAP = 4

export default function FavouriteTracksChips({
  favourites,
  tracks,
  selectedTrack,
  onTrackSelect,
  onToggleFavourite,
  variant = "form",
}: FavouriteTracksChipsProps) {
  const [favouritesExpanded, setFavouritesExpanded] = useState(false)
  const headingId =
    variant === "modal" ? "track-modal-favourites-heading" : "event-search-favourites-heading"
  const outerClass =
    variant === "form"
      ? "pt-4 mt-4 border-t border-[var(--token-border-default)]"
      : "pt-3 w-full min-w-0"

  const favouriteTrackOptions = favourites
    .map((trackId) => tracks.find((track) => track.id === trackId))
    .filter((track): track is Track => Boolean(track))
  const hasOverflowingFavourites = favouriteTrackOptions.length > FAVOURITES_VISIBLE_CAP
  const visibleFavourites = favouritesExpanded
    ? favouriteTrackOptions
    : favouriteTrackOptions.slice(0, FAVOURITES_VISIBLE_CAP)
  const remainingCount = hasOverflowingFavourites
    ? favouriteTrackOptions.length - FAVOURITES_VISIBLE_CAP
    : 0

  return (
    <div className={outerClass}>
      <div className="space-y-2">
        <h3 id={headingId} className="text-sm font-medium text-[var(--token-text-primary)]">
          Favourite tracks
        </h3>
        <div
          className="rounded-lg border border-[var(--token-border-accent-soft)] bg-[var(--token-surface-elevated)] p-4"
          role="region"
          aria-labelledby={headingId}
        >
          {favouriteTrackOptions.length === 0 ? (
            <p className="text-sm text-[var(--token-text-secondary)]">
              No favourite tracks yet. Add tracks from the track list.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleFavourites.map((track) => (
                <div
                  key={track.id}
                  className={`group rounded-full border flex items-center gap-1 transition-all ${
                    track.id === selectedTrack?.id
                      ? "border-[var(--token-accent)] bg-[var(--token-accent)]/10 hover:bg-[var(--token-accent)]/15"
                      : "border-transparent bg-[var(--token-surface-alt)] hover:bg-[var(--token-surface-raised)] hover:border-[var(--token-accent)]/40 hover:shadow-sm"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onTrackSelect(track)}
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
              {hasOverflowingFavourites && (
                <Button
                  type="button"
                  variant="default"
                  onClick={() => setFavouritesExpanded((prev) => !prev)}
                  className="h-8 px-3 text-xs rounded-full"
                >
                  {favouritesExpanded ? "Show fewer" : `+${remainingCount} more`}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
