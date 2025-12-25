/**
 * @fileoverview Event search form component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Form for Event Search with track selection and optional date range
 * 
 * @purpose Provides the search form UI with track selector and optional date filters.
 *          Date filters are hidden by default and shown when "Filter by date range" is enabled.
 * 
 * @relatedFiles
 * - src/components/event-search/TrackSelectionModal.tsx (track modal)
 * - src/components/event-search/DateRangePicker.tsx (date picker)
 * - docs/frontend/liverc/user-workflow.md (UX specification)
 */

"use client"

import { useState } from "react"
import TrackSelectionModal from "./TrackSelectionModal"
import { type Track } from "./TrackRow"
import DateRangePicker from "./DateRangePicker"
import { logger } from "@/lib/logger"

export interface EventSearchFormProps {
  selectedTrack: Track | null
  startDate: string
  endDate: string
  useDateFilter: boolean
  favourites: string[]
  tracks: Track[]
  errors?: {
    track?: string
    startDate?: string
    endDate?: string
  }
  isLoading?: boolean
  onTrackSelect: (track: Track) => void
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  onUseDateFilterChange: (checked: boolean) => void
  onToggleFavourite: (trackId: string) => void
  onSearch: () => void
  onReset: () => void
}

export default function EventSearchForm({
  selectedTrack,
  startDate,
  endDate,
  useDateFilter,
  favourites,
  tracks,
  errors,
  isLoading,
  onTrackSelect,
  onStartDateChange,
  onEndDateChange,
  onUseDateFilterChange,
  onToggleFavourite,
  onSearch,
  onReset,
}: EventSearchFormProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const trackErrorId = errors?.track ? "track-selector-error" : undefined
  const favouriteTrackOptions = favourites
    .map((trackId) => tracks.find((track) => track.id === trackId))
    .filter((track): track is Track => Boolean(track))

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    logger.debug("EventSearchForm: handleSearch called", { 
      hasOnSearch: !!onSearch, 
      selectedTrack, 
      isLoading 
    })
    if (onSearch) {
      onSearch()
    } else {
      logger.error("EventSearchForm: onSearch prop is missing")
    }
  }

  const handleReset = () => {
    onReset()
  }

  const handleUseDateFilterToggle = (checked: boolean) => {
    onUseDateFilterChange(checked)
  }

  return (
    <>
      <form onSubmit={handleSearch} className="space-y-6">
        {/* Track Selector */}
        <div>
          <label
            htmlFor="track-selector"
            className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
          >
            Track
          </label>
          <button
            type="button"
            id="track-selector"
            onClick={() => setIsModalOpen(true)}
            className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-left text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors hover:bg-[var(--token-surface)]"
            aria-haspopup="dialog"
            aria-expanded={isModalOpen}
            aria-invalid={Boolean(errors?.track)}
            aria-describedby={trackErrorId}
          >
            {selectedTrack ? selectedTrack.trackName : "Select a track"}
          </button>
          {errors?.track && (
            <p
              id={trackErrorId}
              className="mt-1 text-sm text-[var(--token-error-text)]"
              role="alert"
            >
              {errors.track}
            </p>
          )}
          {favouriteTrackOptions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Favourite tracks">
              {favouriteTrackOptions.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => onTrackSelect(track)}
                  className="mobile-button rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-3 py-1 text-xs font-medium text-[var(--token-text-primary)] hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                >
                  {track.trackName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date Filter Toggle */}
        <div>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useDateFilter}
              onChange={(e) => handleUseDateFilterToggle(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-interactive-focus-ring)] focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
            />
            <span className="text-sm text-[var(--token-text-primary)]">
              Filter by date range
            </span>
          </label>
        </div>

        {/* Date Range Picker - Only shown when useDateFilter is true */}
        {useDateFilter && (
          <div className="transition-all duration-200">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={onStartDateChange}
              onEndDateChange={onEndDateChange}
              errors={errors}
              disabled={false}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            type="submit"
            disabled={isLoading || !selectedTrack}
            className="mobile-button w-full sm:w-auto flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed sm:px-5 h-11"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="mobile-button w-full sm:w-auto flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-4 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] sm:px-5 h-11"
          >
            Reset
          </button>
        </div>
      </form>

      {/* Track Selection Modal */}
      <TrackSelectionModal
        tracks={tracks}
        favourites={favourites}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={onTrackSelect}
        onToggleFavourite={onToggleFavourite}
      />
    </>
  )
}
