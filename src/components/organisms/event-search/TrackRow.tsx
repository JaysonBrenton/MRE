/**
 * @fileoverview Track row component for track selection modal
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-28
 *
 * @description Individual track row in the track selection modal
 *
 * @purpose Displays a single track with a bookmark control for favourites. Handles
 *          click events for selection and favourite toggling (secondary action).
 *
 * @relatedFiles
 * - src/components/event-search/TrackSelectionModal.tsx (parent component)
 */

"use client"

export interface Track {
  id: string
  trackName: string
  sourceTrackSlug?: string
  country?: string
}

export interface TrackRowProps {
  track: Track
  isFavourite: boolean
  onSelect: (track: Track) => void
  onToggleFavourite: (trackId: string) => void
}

export default function TrackRow({
  track,
  isFavourite,
  onSelect,
  onToggleFavourite,
}: TrackRowProps) {
  const handleRowClick = () => {
    onSelect(track)
  }

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click — selecting the row still chooses the track
    onToggleFavourite(track.id)
  }

  return (
    <div
      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--token-surface-alt)] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleRowClick()
        }
      }}
      aria-label={`Select track ${track.trackName}`}
      style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}
    >
      <span
        className="text-[var(--token-text-primary)] flex-1 truncate"
        title={track.trackName}
        style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {track.trackName}
      </span>
      <button
        type="button"
        onClick={handleBookmarkClick}
        className={[
          "flex shrink-0 items-center justify-center rounded-md p-2 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] focus-visible:ring-offset-0",
          isFavourite
            ? "text-[var(--token-accent)] hover:bg-[var(--token-accent)]/10"
            : "text-[var(--token-text-muted)] opacity-65 hover:bg-[var(--token-surface-alt)] hover:text-[var(--token-text-secondary)] hover:opacity-100",
        ].join(" ")}
        aria-label={
          isFavourite
            ? `Remove ${track.trackName} from favourites`
            : `Save ${track.trackName} to favourites`
        }
        aria-pressed={isFavourite}
      >
        {isFavourite ? (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 19.118l-8.415 4.553a.75.75 0 01-1.085-.67V5.507c0-1.47 1.073-2.756 2.57-2.93z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
            />
          </svg>
        )}
      </button>
    </div>
  )
}
