/**
 * @fileoverview Track row component for track selection modal
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-28
 * 
 * @description Individual track row in the track selection modal
 * 
 * @purpose Displays a single track with star icon for favourites. Handles
 *          click events for selection and favourite toggling.
 * 
 * @relatedFiles
 * - src/components/event-search/TrackSelectionModal.tsx (parent component)
 */

"use client"

export interface Track {
  id: string
  trackName: string
  sourceTrackSlug?: string
}

export interface TrackRowProps {
  track: Track
  isFavourite: boolean
  onSelect: (track: Track) => void
  onToggleFavourite: (trackId: string) => void
}

export default function TrackRow({ track, isFavourite, onSelect, onToggleFavourite }: TrackRowProps) {

  const handleRowClick = () => {
    onSelect(track)
  }

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    onToggleFavourite(track.id)
  }

  return (
    <div
      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[var(--token-surface-raised)] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)]"
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
      style={{ minWidth: 0, width: '100%', boxSizing: 'border-box' }}
    >
      <span 
        className="text-[var(--token-text-primary)] flex-1 truncate" 
        title={track.trackName}
        style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {track.trackName}
      </span>
      <button
        type="button"
        onClick={handleStarClick}
        className="ml-4 p-2 flex items-center justify-center flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded-md"
        aria-label={isFavourite ? `Remove ${track.trackName} from favourites` : `Add ${track.trackName} to favourites`}
        aria-pressed={isFavourite}
        style={{ flexShrink: 0 }}
      >
        <svg
          className={`w-5 h-5 ${isFavourite ? "fill-yellow-400" : "fill-none"} stroke-[var(--token-text-secondary)] ${isFavourite ? "stroke-yellow-400" : ""}`}
          viewBox="0 0 24 24"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>
    </div>
  )
}
