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
 * - src/components/event-search/DateRangePresetPicker.tsx (date range presets)
 * - docs/frontend/liverc/user-workflow.md (UX specification)
 */

"use client"

import { useState } from "react"
import TrackAndFavouritesModal from "./TrackAndFavouritesModal"
import { type Track } from "./TrackRow"
import { type DateRangePreset, PRESETS as DATE_RANGE_PRESETS } from "./DateRangePresetPicker"
import DateRangeModal from "./DateRangeModal"
import MonthYearPicker from "../practice-days/MonthYearPicker"
import Button from "@/components/atoms/Button"
import LabeledSwitch from "@/components/molecules/LabeledSwitch"
import Tooltip from "@/components/molecules/Tooltip"
import { clientLogger } from "@/lib/client-logger"
import { isPracticeDaysEnabled } from "@/lib/feature-flags"

export interface EventSearchFormProps {
  selectedTrack: Track | null
  startDate: string
  endDate: string
  dateRangePreset?: DateRangePreset
  favourites: string[]
  tracks: Track[]
  errors?: {
    track?: string
    startDate?: string
    endDate?: string
    year?: string
    month?: string
  }
  isLoading?: boolean
  onTrackSelect: (track: Track) => void
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  onDateRangePresetChange?: (preset: DateRangePreset) => void
  onToggleFavourite: (trackId: string) => void
  onSearch: (track?: Track) => void
  searchMode?: "events" | "practice-days"
  onSearchModeChange?: (mode: "events" | "practice-days") => void
  /** When true, a search or background discovery is currently in flight */
  isSearchingInFlight?: boolean
  /** Called when the user requests to stop the current search */
  onStop?: () => void
  practiceYear?: number
  practiceMonth?: number
  onPracticeYearChange?: (year: number) => void
  onPracticeMonthChange?: (month: number) => void
  /** When true, event search also includes practice days in the same list (events mode only) */
  includePracticeDays?: boolean
  onIncludePracticeDaysChange?: (checked: boolean) => void
  /** When true, only show events already ingested (skip LiveRC discovery) */
  ingestedEventsOnly?: boolean
  onIngestedEventsOnlyChange?: (checked: boolean) => void
}

export default function EventSearchForm({
  selectedTrack,
  startDate,
  endDate,
  favourites,
  tracks,
  errors,
  isLoading,
  onTrackSelect,
  onStartDateChange,
  onEndDateChange,
  dateRangePreset = "last12",
  onDateRangePresetChange,
  onToggleFavourite,
  onSearch,
  searchMode = "events",
  onSearchModeChange: _onSearchModeChange,
  isSearchingInFlight = false,
  onStop,
  practiceYear,
  practiceMonth,
  onPracticeYearChange,
  onPracticeMonthChange,
  includePracticeDays = false,
  onIncludePracticeDaysChange,
  ingestedEventsOnly = true,
  onIngestedEventsOnlyChange,
}: EventSearchFormProps) {
  const practiceDaysEnabled = isPracticeDaysEnabled()

  // Default to current year/month if not provided
  const currentDate = new Date()
  const defaultYear = practiceYear ?? currentDate.getFullYear()
  const defaultMonth = practiceMonth ?? currentDate.getMonth() + 1
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false)
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false)
  const trackErrorId = errors?.track ? "track-selector-error" : undefined

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    clientLogger.debug("EventSearchForm: handleSearch called", {
      hasOnSearch: !!onSearch,
      hasOnStop: !!onStop,
      selectedTrack,
      isLoading,
      isSearchingInFlight,
    })

    if (isSearchingInFlight) {
      if (onStop) {
        onStop()
      } else {
        clientLogger.error("EventSearchForm: onStop prop is missing while search is in flight")
      }
      return
    }

    if (onSearch) {
      onSearch()
    } else {
      clientLogger.error("EventSearchForm: onSearch prop is missing")
    }
  }

  const errorKeys = errors
    ? (Object.keys(errors) as (keyof typeof errors)[]).filter((k) => errors![k])
    : []

  return (
    <>
      <form onSubmit={handleSearch} className="space-y-6">
        {errorKeys.length > 1 && (
          <div
            className="rounded-lg border border-[var(--token-error-text)]/30 bg-[var(--token-error-text)]/10 px-4 py-3 text-sm text-[var(--token-text-primary)]"
            role="alert"
            aria-live="polite"
          >
            <p className="font-medium mb-1">Please fix the following:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {errorKeys.map((k) => (
                <li key={k}>{errors![k]}</li>
              ))}
            </ul>
          </div>
        )}
        <h2 className="text-base font-semibold text-[var(--token-text-primary)] mb-4">
          Search Filters
        </h2>
        {/* Where: Track + Date range side by side */}
        <div className="space-y-3" role="group" aria-labelledby="event-search-where">
          <span id="event-search-where" className="sr-only">
            Where
          </span>
          <div className="flex flex-wrap gap-6 items-start">
            <div>
              <Tooltip text="Choose the race track or venue to search events for." position="top">
                <label
                  htmlFor="track-selector-trigger"
                  className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
                >
                  Track Selection
                </label>
              </Tooltip>
              <Button
                type="button"
                id="track-selector-trigger"
                aria-describedby={trackErrorId}
                onClick={() => setIsTrackModalOpen(true)}
                variant="default"
                className="h-11 w-[9rem] min-w-[9rem] justify-center px-3"
                aria-haspopup="dialog"
                aria-expanded={isTrackModalOpen}
                aria-label="Select a track"
              >
                <span className="truncate">
                  {selectedTrack ? selectedTrack.trackName : "Select a Track"}
                </span>
              </Button>
              {errors?.track && (
                <p
                  id={trackErrorId}
                  className="mt-1 text-sm text-[var(--token-error-text)]"
                  role="alert"
                >
                  {errors.track}
                </p>
              )}
            </div>
            {searchMode === "events" && onDateRangePresetChange && (
              <div>
                <Tooltip
                  text="Filter events by when they occurred (e.g. last 12 months)."
                  position="top"
                >
                  <label
                    htmlFor="date-range-trigger"
                    className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
                  >
                    Event Date Range
                  </label>
                </Tooltip>
                <Button
                  type="button"
                  id="date-range-trigger"
                  variant="default"
                  onClick={() => setIsDateRangeModalOpen(true)}
                  className="h-11 w-[9rem] min-w-[9rem] justify-center px-3"
                  aria-haspopup="dialog"
                  aria-expanded={isDateRangeModalOpen}
                >
                  <span className="truncate">
                    {DATE_RANGE_PRESETS.find((p) => p.value === dateRangePreset)?.label ??
                      "Date range"}
                  </span>
                </Button>
              </div>
            )}
            {searchMode === "events" && practiceDaysEnabled && onIncludePracticeDaysChange && (
              <div>
                <Tooltip text="Include practice day sessions in the event list." position="top">
                  <label
                    htmlFor="include-practice-days-trigger"
                    className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
                  >
                    Include practice days
                  </label>
                </Tooltip>
                <div className="flex items-center min-h-11">
                  <LabeledSwitch
                    id="include-practice-days-trigger"
                    leftLabel="Off"
                    rightLabel="On"
                    checked={includePracticeDays}
                    onChange={onIncludePracticeDaysChange}
                    disabled={isLoading}
                    aria-label="Include practice days in results"
                  />
                </div>
              </div>
            )}
            {searchMode === "events" && onIngestedEventsOnlyChange && (
              <div>
                <Tooltip
                  text="Only show events already in MRE; turn off to discover events from LiveRC."
                  position="top"
                >
                  <label
                    htmlFor="ingested-events-only-trigger"
                    className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
                  >
                    Ingested events only
                  </label>
                </Tooltip>
                <div className="flex items-center min-h-11">
                  <LabeledSwitch
                    id="ingested-events-only-trigger"
                    leftLabel="Off"
                    rightLabel="On"
                    checked={ingestedEventsOnly}
                    onChange={onIngestedEventsOnlyChange}
                    disabled={isLoading}
                    aria-label="Search within ingested events only (skip LiveRC discovery)"
                  />
                </div>
              </div>
            )}
            <div>
              <label
                htmlFor="event-search-execute"
                className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
              >
                Search events
              </label>
              <div className="flex flex-wrap gap-4">
                <Button
                  type="submit"
                  id="event-search-execute"
                  variant={isSearchingInFlight ? "default" : "primary"}
                  disabled={!selectedTrack}
                  className={`h-11 w-[9rem] min-w-[9rem] font-semibold ${
                    isSearchingInFlight
                      ? "text-[var(--token-error-text)] border-[var(--token-error-text)]/60 bg-[var(--token-error-text)]/10 hover:bg-[var(--token-error-text)]/20"
                      : ""
                  }`}
                  aria-label={isSearchingInFlight ? "Stop current search" : "Run event search"}
                >
                  {isSearchingInFlight ? "Stop" : isLoading ? "Running..." : "Run"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* When: Month-Year (practice days mode) */}
        <div className="space-y-4" role="group">
          {/* Month/Year Picker - For practice days */}
          {searchMode === "practice-days" &&
            practiceDaysEnabled &&
            onPracticeYearChange &&
            onPracticeMonthChange && (
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
        </div>

        <p
          className="text-base mt-2 mb-4"
          style={{ minWidth: "20rem", width: "100%", boxSizing: "border-box" }}
          role="status"
          aria-live="polite"
        >
          <span className="font-medium text-[var(--token-text-secondary)]">Current Track: </span>
          <span className="font-semibold text-[var(--token-accent)]">
            {selectedTrack ? selectedTrack.trackName : "No track selected"}
          </span>
        </p>
      </form>

      {/* Track & Favourites modal (contains track selector + favourites; Change opens full track list inside) */}
      <TrackAndFavouritesModal
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
        selectedTrack={selectedTrack}
        tracks={tracks}
        favourites={favourites}
        trackError={errors?.track}
        onTrackSelect={onTrackSelect}
        onToggleFavourite={onToggleFavourite}
      />

      {/* Date range modal (Events mode) */}
      {searchMode === "events" && onDateRangePresetChange && (
        <DateRangeModal
          isOpen={isDateRangeModalOpen}
          onClose={() => setIsDateRangeModalOpen(false)}
          preset={dateRangePreset}
          startDate={startDate}
          endDate={endDate}
          onPresetChange={onDateRangePresetChange}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          errors={errors}
          disabled={isLoading}
        />
      )}
    </>
  )
}
