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
 * - src/components/organisms/event-search/TrackSelectionModal.tsx (track list modal)
 * - src/components/event-search/DateRangePresetPicker.tsx (date range presets)
 * - docs/frontend/liverc/user-workflow.md (UX specification)
 */

"use client"

import { useState } from "react"
import TrackSelectionModal from "./TrackSelectionModal"
import { type Track } from "./TrackRow"
import { type DateRangePreset, PRESETS as DATE_RANGE_PRESETS } from "./DateRangePresetPicker"
import DateRangeModal from "./DateRangeModal"
import MonthYearPicker from "../practice-days/MonthYearPicker"
import { Search } from "lucide-react"
import Button from "@/components/atoms/Button"
import Switch from "@/components/atoms/Switch"
import Tooltip from "@/components/molecules/Tooltip"
import { clientLogger } from "@/lib/client-logger"
import { formatCustomRangeSummary } from "@/lib/date-utils"
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
  /** When true, event search queries LiveRC as well as the database */
  includeLiveRC?: boolean
  onIncludeLiveRCChange?: (checked: boolean) => void
  /** When true, event search will include Everlaps (pipeline not yet implemented) */
  includeEverlaps?: boolean
  onIncludeEverlapsChange?: (checked: boolean) => void
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
  includeLiveRC = false,
  onIncludeLiveRCChange,
  includeEverlaps = false,
  onIncludeEverlapsChange,
}: EventSearchFormProps) {
  const practiceDaysEnabled = isPracticeDaysEnabled()

  // Default to current year/month if not provided
  const currentDate = new Date()
  const defaultYear = practiceYear ?? currentDate.getFullYear()
  const defaultMonth = practiceMonth ?? currentDate.getMonth() + 1
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false)
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false)
  const trackErrorId = errors?.track ? "track-selector-error" : undefined

  const handleTrackPicked = (track: Track) => {
    onTrackSelect(track)
    setIsTrackModalOpen(false)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    clientLogger.debug("EventSearchForm: handleSearch called", {
      hasOnSearch: !!onSearch,
      selectedTrack,
      isLoading,
      isSearchingInFlight,
    })

    if (onSearch) {
      onSearch()
    } else {
      clientLogger.error("EventSearchForm: onSearch prop is missing")
    }
  }

  const handleStop = () => {
    if (!isSearchingInFlight) {
      return
    }
    if (onStop) {
      onStop()
    } else {
      clientLogger.error("EventSearchForm: onStop prop is missing while search is in flight")
    }
  }

  const errorKeys = errors
    ? (Object.keys(errors) as (keyof typeof errors)[]).filter((k) => errors![k])
    : []
  /** Track errors are shown under the track control; others need the summary banner. */
  const formSummaryKeys = errorKeys.filter((k) => k !== "track")

  const dateFilterSummary =
    searchMode === "practice-days"
      ? new Date(defaultYear, defaultMonth - 1, 1).toLocaleDateString("en-AU", {
          month: "long",
          year: "numeric",
        })
      : (() => {
          const baseLabel =
            DATE_RANGE_PRESETS.find((p) => p.value === dateRangePreset)?.label ?? "—"
          if (dateRangePreset === "custom" && startDate && endDate) {
            const range = formatCustomRangeSummary(startDate, endDate)
            return range ? `${baseLabel} (${range})` : baseLabel
          }
          return baseLabel
        })()

  const selectionSummaryText = `Selected track: ${selectedTrack?.trackName ?? "—"}\nDate Filter: ${dateFilterSummary}`

  return (
    <>
      <form onSubmit={handleSearch} className="space-y-6">
        {formSummaryKeys.length > 0 && (
          <div
            className="rounded-lg border border-[var(--token-error-text)]/30 bg-[var(--token-error-text)]/10 px-4 py-3 text-sm text-[var(--token-text-primary)]"
            role="alert"
            aria-live="polite"
          >
            <p className="font-medium mb-1">Please fix the following:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {formSummaryKeys.map((k) => (
                <li key={k}>{errors![k]}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="space-y-2">
          <h3
            id="event-search-filters-heading"
            className="text-sm font-medium text-[var(--token-text-primary)]"
          >
            Search filters
          </h3>
          <div
            className="rounded-lg border border-[var(--token-border-accent-soft)] bg-[var(--token-surface-elevated)] p-4 space-y-4"
            role="region"
            aria-labelledby="event-search-filters-heading"
          >
            {/* Where: Track + Date range side by side */}
            <div className="space-y-3" role="group" aria-labelledby="event-search-where">
              <span id="event-search-where" className="sr-only">
                Where
              </span>
              <div className="flex flex-wrap items-start gap-4 sm:gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex w-fit min-w-0 max-w-full flex-col items-stretch gap-2">
                    <div className="inline-flex max-w-full flex-wrap items-center gap-3">
                      <Tooltip
                        text="Choose the race track or venue to search events for."
                        position="top"
                      >
                        <Button
                          type="button"
                          id="track-selector-trigger"
                          aria-describedby={trackErrorId}
                          onClick={() => setIsTrackModalOpen(true)}
                          variant="default"
                          className="h-11 w-[9rem] min-w-[9rem] shrink-0 justify-center px-3"
                          aria-haspopup="dialog"
                          aria-expanded={isTrackModalOpen}
                          aria-label={
                            selectedTrack
                              ? `Open track list, current track: ${selectedTrack.trackName}`
                              : "Open track list"
                          }
                        >
                          <span className="truncate">Track Selection</span>
                        </Button>
                      </Tooltip>
                      {searchMode === "events" && onDateRangePresetChange && (
                        <Tooltip
                          text="Filter events by when they occurred (e.g. last 12 months)."
                          position="top"
                        >
                          <Button
                            type="button"
                            id="date-range-trigger"
                            variant="default"
                            onClick={() => setIsDateRangeModalOpen(true)}
                            className="h-11 w-[9rem] min-w-[9rem] shrink-0 justify-center px-3"
                            aria-haspopup="dialog"
                            aria-expanded={isDateRangeModalOpen}
                            aria-label={
                              "Open date filter, current: " +
                              (DATE_RANGE_PRESETS.find((p) => p.value === dateRangePreset)?.label ??
                                "Date range")
                            }
                          >
                            <span className="truncate">Date Filter</span>
                          </Button>
                        </Tooltip>
                      )}
                      {searchMode === "events" && onIncludeLiveRCChange && (
                        <div className="inline-flex min-h-11 w-max max-w-full flex-nowrap items-center gap-2">
                          <Tooltip
                            text="On: include LiveRC discovery with database results. Off: database only (no LiveRC); the list shows events with full lap data (laps_full) when applicable."
                            position="top"
                          >
                            <label
                              htmlFor="search-live-rc-trigger"
                              className="w-max max-w-full shrink-0 text-sm font-medium text-[var(--token-text-primary)]"
                            >
                              Search LiveRC:
                            </label>
                          </Tooltip>
                          <Switch
                            id="search-live-rc-trigger"
                            checked={includeLiveRC}
                            onChange={onIncludeLiveRCChange}
                            disabled={isLoading}
                            aria-label="Search LiveRC: toggle on to include LiveRC with database, off for database only"
                            className="shrink-0"
                          />
                        </div>
                      )}
                      {searchMode === "events" && onIncludeEverlapsChange && (
                        <div className="inline-flex min-h-11 w-max max-w-full flex-nowrap items-center gap-2">
                          <Tooltip
                            text="Reserved for a future Everlaps search path; the toggle is saved in the UI but does not change results yet."
                            position="top"
                          >
                            <label
                              htmlFor="search-everlaps-trigger"
                              className="w-max max-w-full shrink-0 text-sm font-medium text-[var(--token-text-primary)]"
                            >
                              Search Everlaps:
                            </label>
                          </Tooltip>
                          <Switch
                            id="search-everlaps-trigger"
                            checked={includeEverlaps}
                            onChange={onIncludeEverlapsChange}
                            disabled={isLoading}
                            aria-label="Include Everlaps when searching (not yet connected)"
                            className="shrink-0"
                          />
                        </div>
                      )}
                      {searchMode === "events" &&
                        practiceDaysEnabled &&
                        onIncludePracticeDaysChange && (
                          <div className="inline-flex min-h-11 w-max max-w-full flex-nowrap items-center gap-2">
                            <Tooltip
                              text="Include practice day sessions in the event list."
                              position="top"
                            >
                              <label
                                htmlFor="include-practice-days-trigger"
                                className="w-max max-w-full shrink-0 text-sm font-medium text-[var(--token-text-primary)]"
                              >
                                Include practice days:
                              </label>
                            </Tooltip>
                            <Switch
                              id="include-practice-days-trigger"
                              checked={includePracticeDays}
                              onChange={onIncludePracticeDaysChange}
                              disabled={isLoading}
                              aria-label="Include practice days in event list results"
                              className="shrink-0"
                            />
                          </div>
                        )}
                    </div>
                    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
                      <div className="inline-flex max-w-full shrink-0 flex-row items-center gap-3">
                        <Button
                          type="submit"
                          id="event-search-run-trigger"
                          variant="primary"
                          disabled={!selectedTrack || isSearchingInFlight || isLoading}
                          className="h-11 w-[9rem] min-w-[9rem] shrink-0 justify-center px-3"
                          aria-label="Run event search"
                        >
                          {isSearchingInFlight || isLoading ? (
                            "Running..."
                          ) : (
                            <Search className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                          )}
                        </Button>
                        <Button
                          type="button"
                          id="event-search-stop-trigger"
                          variant="default"
                          disabled={!isSearchingInFlight}
                          onClick={handleStop}
                          className="h-11 w-[9rem] min-w-[9rem] shrink-0 justify-center px-3 text-[var(--token-error-text)] border-[var(--token-error-text)]/60 bg-[var(--token-error-text)]/10 hover:bg-[var(--token-error-text)]/20 disabled:opacity-50 disabled:hover:bg-[var(--token-error-text)]/10"
                          aria-label="Stop current search"
                        >
                          Stop
                        </Button>
                      </div>
                      <textarea
                        readOnly
                        tabIndex={-1}
                        rows={2}
                        value={selectionSummaryText}
                        className="min-h-0 min-w-0 w-full flex-1 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] px-3 py-2 text-xs leading-snug text-[var(--token-text-primary)] self-stretch sm:self-center overflow-y-auto"
                        style={{ resize: "none" }}
                        aria-label="Current selected track and date filter"
                      />
                    </div>
                  </div>
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
      </form>

      <TrackSelectionModal
        tracks={tracks}
        favourites={favourites}
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
        onSelect={handleTrackPicked}
        onToggleFavourite={onToggleFavourite}
        selectedTrack={selectedTrack}
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
