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

import { useMemo, useState } from "react"
import TrackSelectionModal from "./TrackSelectionModal"
import { type Track } from "./TrackRow"
import { type DateRangePreset, PRESETS as DATE_RANGE_PRESETS } from "./DateRangePresetPicker"
import DateRangeModal from "./DateRangeModal"
import MonthYearPicker from "../practice-days/MonthYearPicker"
import EventSearchOmnibox from "./EventSearchOmnibox"
import EventSearchFilters, { type EventSearchFilterDraft } from "./EventSearchFilters"
import {
  applyDatePresetToDraft,
  buildCommittedFilterDraft,
  dateFilterSummaryFromDraft,
} from "./event-search-filter-draft"
import { Search } from "lucide-react"
import Button from "@/components/atoms/Button"
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
  /** Select an event for the dashboard (omnibox event pick). */
  onSelectEvent?: (eventId: string) => void
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
  /** When true, the full search queries LiveRC as well as the database */
  includeLiveRC?: boolean
  /** When true, the full search will include Everlaps (pipeline not yet implemented) */
  includeEverlaps?: boolean
  /** When false, hide Ready (laps_full) events in results. Default true. */
  includeReady?: boolean
  /** When false, hide Scheduled (future) events in results. Default true. */
  includeScheduled?: boolean
  /** Commits staged source toggles from the Filters popover. */
  onApplyFilters: (draft: EventSearchFilterDraft) => void
  /** Resets committed filters to defaults (toggles + date range). */
  onClearFilters: () => void
  /** When true, Search is allowed without a selected track (database browse only). */
  canSearchWithoutTrack?: boolean
  /** True after a cross-track browse (omnibox empty); used for summary copy. */
  isGlobalBrowse?: boolean
  onOmniboxQueryChange?: (query: string) => void
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
  onStartDateChange: _onStartDateChange,
  onEndDateChange: _onEndDateChange,
  dateRangePreset = "last12",
  onDateRangePresetChange,
  onToggleFavourite,
  onSearch,
  onSelectEvent,
  searchMode = "events",
  onSearchModeChange: _onSearchModeChange,
  isSearchingInFlight = false,
  onStop,
  practiceYear,
  practiceMonth,
  onPracticeYearChange,
  onPracticeMonthChange,
  includePracticeDays = false,
  includeLiveRC = false,
  includeEverlaps = false,
  includeReady = true,
  includeScheduled = true,
  onApplyFilters,
  onClearFilters,
  canSearchWithoutTrack = false,
  isGlobalBrowse: _isGlobalBrowse = false,
  onOmniboxQueryChange,
}: EventSearchFormProps) {
  const practiceDaysEnabled = isPracticeDaysEnabled()

  // Default to current year/month if not provided
  const currentDate = new Date()
  const defaultYear = practiceYear ?? currentDate.getFullYear()
  const defaultMonth = practiceMonth ?? currentDate.getMonth() + 1
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false)
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false)
  const trackErrorId = errors?.track ? "track-selector-error" : undefined

  const committedFilterDraft = useMemo(
    () =>
      buildCommittedFilterDraft({
        selectedTrack,
        dateRangePreset,
        startDate,
        endDate,
        includeLiveRC,
        includeEverlaps,
        includePracticeDays,
        includeReady,
        includeScheduled,
      }),
    [
      selectedTrack,
      dateRangePreset,
      startDate,
      endDate,
      includeLiveRC,
      includeEverlaps,
      includePracticeDays,
      includeReady,
      includeScheduled,
    ]
  )

  const [filterDraft, setFilterDraft] = useState<EventSearchFilterDraft>(committedFilterDraft)

  const handleTrackPicked = (track: Track) => {
    setFilterDraft((prev) => ({ ...prev, selectedTrack: track }))
    setIsTrackModalOpen(false)
  }

  const syncFilterDraftFromCommitted = () => {
    setFilterDraft(committedFilterDraft)
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
      : dateFilterSummaryFromDraft(
          committedFilterDraft,
          formatCustomRangeSummary,
          DATE_RANGE_PRESETS
        )

  const draftDateFilterSummary =
    searchMode === "events"
      ? dateFilterSummaryFromDraft(filterDraft, formatCustomRangeSummary, DATE_RANGE_PRESETS)
      : dateFilterSummary

  /** Non-default filters surfaced as a badge on the Filters button. */
  const activeFilterCount =
    (searchMode === "events" && dateRangePreset !== "none" ? 1 : 0) +
    (searchMode === "events" && includePracticeDays ? 1 : 0) +
    (searchMode === "events" && includeLiveRC ? 1 : 0) +
    (searchMode === "events" && includeEverlaps ? 1 : 0) +
    (searchMode === "events" && !includeReady ? 1 : 0) +
    (searchMode === "events" && !includeScheduled ? 1 : 0)

  const isSearchBusy = isSearchingInFlight || isLoading

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
          <div
            className="rounded-lg border border-[var(--token-border-accent-soft)] bg-[var(--token-surface-elevated)] p-4 space-y-4"
            role="region"
            aria-label="Search filters"
          >
            {/* Omnibox: search by track or event name (database-only) */}
            {searchMode === "events" && (
              <EventSearchOmnibox
                onSelectTrack={(track) => {
                  onTrackSelect(track)
                }}
                onSelectEvent={(eventId) => onSelectEvent?.(eventId)}
                onQueryChange={onOmniboxQueryChange}
                disabled={isLoading}
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <EventSearchFilters
                draft={filterDraft}
                committedDraft={committedFilterDraft}
                onDraftChange={setFilterDraft}
                draftDateFilterSummary={draftDateFilterSummary}
                showDateFilter={searchMode === "events" && !!onDateRangePresetChange}
                onOpenTrackModal={() => setIsTrackModalOpen(true)}
                onOpenDateModal={() => setIsDateRangeModalOpen(true)}
                showPracticeToggle={searchMode === "events" && practiceDaysEnabled}
                showLiveRCToggle={searchMode === "events"}
                showEverlapsToggle={searchMode === "events"}
                showStatusToggles={searchMode === "events"}
                onApplyFilters={onApplyFilters}
                onClearFilters={onClearFilters}
                activeFilterCount={activeFilterCount}
                disabled={isLoading}
                trackErrorId={trackErrorId}
                suppressOutsideClose={isTrackModalOpen || isDateRangeModalOpen}
                onPopoverOpen={syncFilterDraftFromCommitted}
              />

              <div className="inline-flex shrink-0 items-center gap-3">
                <Button
                  type="submit"
                  id="event-search-run-trigger"
                  variant="primary"
                  disabled={(!canSearchWithoutTrack && !selectedTrack) || isSearchBusy}
                  className="h-11 w-[10.25rem] min-w-[10.25rem] shrink-0 justify-center gap-2 px-3"
                  aria-label={isSearchBusy ? "Searching" : "Run event search"}
                  aria-busy={isSearchBusy}
                >
                  {isSearchBusy ? (
                    <>
                      <Search
                        className="h-4 w-4 shrink-0 animate-spin"
                        strokeWidth={2}
                        aria-hidden
                      />
                      <span aria-live="polite">Searching</span>
                    </>
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
            </div>

            {errors?.track && (
              <p id={trackErrorId} className="text-sm text-[var(--token-error-text)]" role="alert">
                {errors.track}
              </p>
            )}
          </div>
        </div>

        {/* When: Month-Year (practice days mode) */}
        {searchMode === "practice-days" &&
          practiceDaysEnabled &&
          onPracticeYearChange &&
          onPracticeMonthChange && (
            <div className="space-y-4" role="group">
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
            </div>
          )}
      </form>

      <TrackSelectionModal
        tracks={tracks}
        favourites={favourites}
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
        onSelect={handleTrackPicked}
        onToggleFavourite={onToggleFavourite}
        selectedTrack={filterDraft.selectedTrack ?? selectedTrack}
      />

      {/* Date range modal (Events mode) */}
      {searchMode === "events" && onDateRangePresetChange && (
        <DateRangeModal
          isOpen={isDateRangeModalOpen}
          onClose={() => setIsDateRangeModalOpen(false)}
          preset={filterDraft.dateRangePreset}
          startDate={filterDraft.startDate}
          endDate={filterDraft.endDate}
          onPresetChange={(preset) => {
            setFilterDraft((prev) => applyDatePresetToDraft(prev, preset))
          }}
          onStartDateChange={(date) => {
            setFilterDraft((prev) => ({ ...prev, startDate: date }))
          }}
          onEndDateChange={(date) => {
            setFilterDraft((prev) => ({ ...prev, endDate: date }))
          }}
          errors={errors}
          disabled={isLoading}
        />
      )}
    </>
  )
}
