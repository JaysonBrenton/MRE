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
import MonthYearPicker from "../practice-days/MonthYearPicker"
import { clientLogger } from "@/lib/client-logger"
import { isPracticeDaysEnabled } from "@/lib/feature-flags"

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
  onSearch: (track?: Track) => void
  onReset: () => void
  livercEventsCount?: number
  hasSearched?: boolean
  isCheckingEntryLists?: boolean
  driverInEvents?: Record<string, boolean>
  onCheckEntryLists?: () => void
  searchMode?: "events" | "practice-days"
  onSearchModeChange?: (mode: "events" | "practice-days") => void
  practiceYear?: number
  practiceMonth?: number
  onPracticeYearChange?: (year: number) => void
  onPracticeMonthChange?: (month: number) => void
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
  livercEventsCount = 0,
  hasSearched = false,
  isCheckingEntryLists = false,
  driverInEvents = {},
  onCheckEntryLists,
  searchMode = "events",
  onSearchModeChange,
  practiceYear,
  practiceMonth,
  onPracticeYearChange,
  onPracticeMonthChange,
}: EventSearchFormProps) {
  const practiceDaysEnabled = isPracticeDaysEnabled()
  
  // Default to current year/month if not provided
  const currentDate = new Date()
  const defaultYear = practiceYear ?? currentDate.getFullYear()
  const defaultMonth = practiceMonth ?? currentDate.getMonth() + 1
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [favouritesExpanded, setFavouritesExpanded] = useState(false)
  const trackErrorId = errors?.track ? "track-selector-error" : undefined
  const favouriteTrackOptions = favourites
    .map((trackId) => tracks.find((track) => track.id === trackId))
    .filter((track): track is Track => Boolean(track))
  const FAVOURITES_VISIBLE_CAP = 4
  const visibleFavourites = favouritesExpanded ? favouriteTrackOptions : favouriteTrackOptions.slice(0, FAVOURITES_VISIBLE_CAP)
  const remainingCount = favouriteTrackOptions.length - FAVOURITES_VISIBLE_CAP

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    clientLogger.debug("EventSearchForm: handleSearch called", { 
      hasOnSearch: !!onSearch, 
      selectedTrack, 
      isLoading 
    })
    if (onSearch) {
      onSearch()
    } else {
      clientLogger.error("EventSearchForm: onSearch prop is missing")
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
        {/* Where: Track + Favourites */}
        <div className="space-y-3" role="group" aria-labelledby="event-search-where">
          <span id="event-search-where" className="sr-only">Where</span>
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
            className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-left text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors hover:bg-[var(--token-surface-raised)]"
            aria-haspopup="dialog"
            aria-expanded={isModalOpen}
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
            <div>
              <p className="text-xs font-medium text-[var(--token-text-secondary)] mb-2 mt-3">Favourite tracks</p>
              <div className="flex flex-wrap gap-2" aria-label="Favourite tracks">
              {visibleFavourites.map((track) => (
                <div
                  key={track.id}
                  className="group rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] hover:bg-[var(--token-surface-raised)] flex items-center gap-1"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onTrackSelect(track)
                      // Pass track directly to search to avoid stale state issue
                      if (onSearch) {
                        onSearch(track)
                      }
                    }}
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
                  <button
                    type="button"
                    onClick={() => setFavouritesExpanded(true)}
                    className="rounded-full border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] hover:bg-[var(--token-surface-raised)] px-3 py-1 text-xs font-medium text-[var(--token-text-secondary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
                  >
                    +{remainingCount} more
                  </button>
                )}
              </div>
            </div>
          )}
          </div>
        </div>

        {/* When: Search Type, Date Filter, Date Range / Month-Year */}
        <div className="space-y-4" role="group" aria-labelledby="event-search-when">
          <span id="event-search-when" className="sr-only">When</span>

        {/* Search Mode Toggle (Practice Days vs Events) */}
        {practiceDaysEnabled && onSearchModeChange && (
          <div>
            <label className="block text-sm font-medium text-[var(--token-text-primary)] mb-2">
              Search Type
            </label>
            <div className="flex items-center gap-3">
              <span
                className={`text-sm font-medium transition-colors ${
                  searchMode === "events"
                    ? "text-[var(--token-text-primary)]"
                    : "text-[var(--token-text-secondary)]"
                }`}
              >
                Events
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={searchMode === "practice-days"}
                aria-label={`Switch to ${searchMode === "events" ? "Practice Days" : "Events"}`}
                onClick={() => onSearchModeChange(searchMode === "events" ? "practice-days" : "events")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onSearchModeChange(searchMode === "events" ? "practice-days" : "events")
                  } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    e.preventDefault()
                    onSearchModeChange(e.key === "ArrowLeft" ? "events" : "practice-days")
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] focus:ring-offset-[var(--token-surface)] ${
                  searchMode === "events"
                    ? "bg-[var(--token-surface-elevated)] border-[var(--token-border-default)]"
                    : "bg-[var(--token-accent)]/30 border-[var(--token-accent)]/50"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-[var(--token-surface)] border border-[var(--token-border-default)] shadow-sm transition-transform duration-200 ease-in-out ${
                    searchMode === "events" ? "translate-x-1" : "translate-x-6"
                  }`}
                />
              </button>
              <span
                className={`text-sm font-medium transition-colors ${
                  searchMode === "practice-days"
                    ? "text-[var(--token-text-primary)]"
                    : "text-[var(--token-text-secondary)]"
                }`}
              >
                Practice Days
              </span>
            </div>
          </div>
        )}

        {/* Date Filter Toggle - Hidden for practice days (always required) */}
        {searchMode === "events" && (
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
        )}

        {/* Month/Year Picker - For practice days */}
        {searchMode === "practice-days" && practiceDaysEnabled && onPracticeYearChange && onPracticeMonthChange && (
          <div className="transition-all duration-200">
            <MonthYearPicker
              year={defaultYear}
              month={defaultMonth}
              onYearChange={onPracticeYearChange}
              onMonthChange={onPracticeMonthChange}
              errors={{
                year: errors?.year,
                month: errors?.month,
              }}
              required={true}
            />
          </div>
        )}

        {/* Date Range Picker - For events mode */}
        {searchMode === "events" && useDateFilter && (
          <div className="transition-all duration-200">
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={onStartDateChange}
              onEndDateChange={onEndDateChange}
              errors={errors}
              required={false}
              disabled={false}
            />
          </div>
        )}

        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4">
          <button
            type="submit"
            disabled={isLoading || !selectedTrack}
            className="mobile-button flex items-center justify-center rounded-md border border-[var(--token-accent)] bg-[var(--token-accent)] px-5 text-sm font-medium text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed active:opacity-90 h-11"
          >
            {isLoading ? "Searching..." : "Search"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center justify-center rounded-md border border-[var(--token-border-default)] bg-transparent px-5 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-elevated)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] h-11"
          >
            Reset
          </button>
          {/* Check Entry Lists Button - Only show when there are events to check (LiveRC or DB) */}
          {livercEventsCount > 0 && hasSearched && onCheckEntryLists && (
            <button
              type="button"
              onClick={onCheckEntryLists}
              disabled={isCheckingEntryLists}
              className="flex items-center justify-center gap-2 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] px-5 text-sm font-medium text-[var(--token-text-primary)] transition-colors hover:bg-[var(--token-surface-raised)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 disabled:cursor-not-allowed h-11"
              aria-label="Check for Participation"
            >
              {isCheckingEntryLists ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-[var(--token-text-secondary)]" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Checking entry lists...</span>
                </>
              ) : (
                <span>Check for Participation</span>
              )}
            </button>
          )}
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
