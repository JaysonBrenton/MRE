/**
 * @fileoverview Event search form component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Form for Event Search with track selection and date range
 * 
 * @purpose Provides the search form UI with two-column desktop layout and
 *          single-column mobile layout. Includes track selector, date range
 *          picker, search button, and reset button.
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

export interface EventSearchFormProps {
  selectedTrack: Track | null
  startDate: string
  endDate: string
  ignoreDates: boolean
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
  onIgnoreDatesChange: (checked: boolean) => void
  onToggleFavourite: (trackId: string) => void
  onSearch: () => void
  onReset: () => void
}

export default function EventSearchForm({
  selectedTrack,
  startDate,
  endDate,
  ignoreDates,
  favourites,
  tracks,
  errors,
  isLoading,
  onTrackSelect,
  onStartDateChange,
  onEndDateChange,
  onIgnoreDatesChange,
  onToggleFavourite,
  onSearch,
  onReset,
}: EventSearchFormProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("EventSearchForm: handleSearch called", { 
      hasOnSearch: !!onSearch, 
      selectedTrack, 
      isLoading 
    })
    if (onSearch) {
      onSearch()
    } else {
      console.error("EventSearchForm: onSearch prop is missing!")
    }
  }

  const handleReset = () => {
    onReset()
  }

  return (
    <>
      <form onSubmit={handleSearch} className="space-y-6">
        {/* Two-column layout on desktop, single-column on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
            >
              {selectedTrack ? selectedTrack.trackName : "Select a track"}
            </button>
            {errors?.track && (
              <p className="mt-1 text-sm text-[var(--token-error-text)]">{errors.track}</p>
            )}
          </div>

          {/* Date Range Picker */}
          <div>
            <div className="mb-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ignoreDates}
                  onChange={(e) => onIgnoreDatesChange(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-interactive-focus-ring)] focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
                />
                <span className="text-sm text-[var(--token-text-primary)]">
                  Show all events (ignore dates)
                </span>
              </label>
            </div>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={onStartDateChange}
              onEndDateChange={onEndDateChange}
              errors={errors}
              disabled={ignoreDates}
            />
          </div>
        </div>

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

