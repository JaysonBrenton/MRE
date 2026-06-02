/**
 * @fileoverview Collapsed "Filters" control for the Event Search modal.
 *
 * @description Renders a single "Filters" button that opens a popover hosting
 *              the secondary Event Search controls (Track Selection, Date
 *              Filter, and — when enabled — Include practice days). Replaces the
 *              always-on inline control row to lower cognitive load.
 *
 * @relatedFiles
 * - src/components/organisms/event-search/EventSearchForm.tsx (consumer)
 * - docs/architecture/event-search-omnibox.md (specification)
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import Button from "@/components/atoms/Button"
import Switch from "@/components/atoms/Switch"
import Tooltip from "@/components/molecules/Tooltip"
import { type Track } from "./TrackRow"

export interface EventSearchFiltersProps {
  selectedTrack: Track | null
  /** Human-readable summary of the active date filter (events mode). */
  dateFilterSummary: string
  /** Whether the Date Filter control should be offered (events mode). */
  showDateFilter: boolean
  onOpenTrackModal: () => void
  onOpenDateModal: () => void
  includePracticeDays: boolean
  onIncludePracticeDaysChange?: (checked: boolean) => void
  /** Whether the Include practice days toggle should be offered. */
  showPracticeToggle: boolean
  /** When true, full search includes LiveRC discovery alongside the database. */
  includeLiveRC: boolean
  onIncludeLiveRCChange?: (checked: boolean) => void
  /** Whether the Search LiveRC toggle should be offered (events mode). */
  showLiveRCToggle: boolean
  /** Reserved future source; UI-only toggle. */
  includeEverlaps: boolean
  onIncludeEverlapsChange?: (checked: boolean) => void
  /** Whether the Search Everlaps toggle should be offered (events mode). */
  showEverlapsToggle: boolean
  /** Count of non-default filters; renders a badge when > 0. */
  activeFilterCount: number
  disabled?: boolean
  trackErrorId?: string
}

export default function EventSearchFilters({
  selectedTrack,
  dateFilterSummary,
  showDateFilter,
  onOpenTrackModal,
  onOpenDateModal,
  includePracticeDays,
  onIncludePracticeDaysChange,
  showPracticeToggle,
  includeLiveRC,
  onIncludeLiveRCChange,
  showLiveRCToggle,
  includeEverlaps,
  onIncludeEverlapsChange,
  showEverlapsToggle,
  activeFilterCount,
  disabled = false,
  trackErrorId,
}: EventSearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative inline-flex">
      <Button
        type="button"
        id="event-search-filters-trigger"
        variant="default"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-11 shrink-0 justify-center gap-2 px-3"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Open search filters"
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        <span className="truncate">Filters</span>
        {activeFilterCount > 0 && (
          <span
            className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--token-accent)] px-1.5 text-xs font-semibold text-[var(--token-on-accent,white)]"
            aria-label={`${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`}
          >
            {activeFilterCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Search filters"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[20rem] max-w-[90vw] rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-4 shadow-2xl"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--token-text-tertiary)]">
                Track
              </span>
              <Button
                type="button"
                id="track-selector-trigger"
                aria-describedby={trackErrorId}
                variant="default"
                onClick={onOpenTrackModal}
                className="h-11 w-full justify-between px-3"
                aria-haspopup="dialog"
                aria-label={
                  selectedTrack
                    ? `Open track list, current track: ${selectedTrack.trackName}`
                    : "Open track list"
                }
              >
                <span className="truncate">{selectedTrack?.trackName ?? "Track Selection"}</span>
              </Button>
            </div>

            {showDateFilter && (
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--token-text-tertiary)]">
                  Date filter
                </span>
                <Button
                  type="button"
                  id="date-range-trigger"
                  variant="default"
                  onClick={onOpenDateModal}
                  className="h-11 w-full justify-between px-3"
                  aria-haspopup="dialog"
                  aria-label={`Open date filter, current: ${dateFilterSummary}`}
                >
                  <span className="truncate">{dateFilterSummary}</span>
                </Button>
              </div>
            )}

            {(showLiveRCToggle || showEverlapsToggle) && (
              <div className="space-y-3">
                <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--token-text-tertiary)]">
                  Sources
                </span>
                {showLiveRCToggle && onIncludeLiveRCChange && (
                  <div className="flex items-center justify-between gap-3">
                    <Tooltip
                      text={
                        selectedTrack
                          ? "On: include LiveRC discovery with database results. Off: database only (no LiveRC); the list shows events with full lap data (laps_full) when applicable."
                          : "Select a track first. LiveRC discovery only runs for a specific track."
                      }
                      position="top"
                    >
                      <label
                        htmlFor="search-live-rc-trigger"
                        className="text-sm font-medium text-[var(--token-text-primary)]"
                      >
                        Search LiveRC
                      </label>
                    </Tooltip>
                    <Switch
                      id="search-live-rc-trigger"
                      checked={includeLiveRC}
                      onChange={onIncludeLiveRCChange}
                      disabled={disabled || !selectedTrack}
                      aria-label="Search LiveRC: toggle on to include LiveRC with database, off for database only"
                      className="shrink-0"
                    />
                  </div>
                )}
                {showEverlapsToggle && onIncludeEverlapsChange && (
                  <div className="flex items-center justify-between gap-3">
                    <Tooltip
                      text="Reserved for a future Everlaps search path; the toggle is saved in the UI but does not change results yet."
                      position="top"
                    >
                      <label
                        htmlFor="search-everlaps-trigger"
                        className="text-sm font-medium text-[var(--token-text-primary)]"
                      >
                        Search Everlaps
                      </label>
                    </Tooltip>
                    <Switch
                      id="search-everlaps-trigger"
                      checked={includeEverlaps}
                      onChange={onIncludeEverlapsChange}
                      disabled={disabled}
                      aria-label="Include Everlaps when searching (not yet connected)"
                      className="shrink-0"
                    />
                  </div>
                )}
              </div>
            )}

            {showPracticeToggle && onIncludePracticeDaysChange && (
              <div className="flex items-center justify-between gap-3">
                <Tooltip
                  text={
                    selectedTrack
                      ? "Include practice days in the results list for the selected track."
                      : "Select a track first. Practice days are scoped to a track."
                  }
                  position="top"
                >
                  <label
                    htmlFor="include-practice-days-trigger"
                    className="text-sm font-medium text-[var(--token-text-primary)]"
                  >
                    Include practice days
                  </label>
                </Tooltip>
                <Switch
                  id="include-practice-days-trigger"
                  checked={includePracticeDays}
                  onChange={onIncludePracticeDaysChange}
                  disabled={disabled || !selectedTrack}
                  aria-label="Include practice days in event list results"
                  className="shrink-0"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
