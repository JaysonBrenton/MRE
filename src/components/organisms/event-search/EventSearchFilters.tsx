/**
 * @fileoverview Collapsed "Filters" control for the Event Search modal.
 *
 * @description Renders a single "Filters" button that opens a popover hosting
 *              the secondary Event Search controls (Track Selection, Date
 *              Filter, and — when enabled — Include practice days). All fields
 *              use staged draft state; Apply commits without running search.
 *
 * @relatedFiles
 * - src/components/organisms/event-search/EventSearchForm.tsx (consumer)
 * - docs/architecture/event-search-omnibox.md (specification)
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import Button from "@/components/atoms/Button"
import Switch from "@/components/atoms/Switch"
import Tooltip from "@/components/molecules/Tooltip"
import {
  DEFAULT_EVENT_SEARCH_FILTER_DRAFT,
  type EventSearchFilterDraft,
  isFilterDraftEqual,
} from "./event-search-filter-draft"

export type { EventSearchFilterDraft } from "./event-search-filter-draft"
export { DEFAULT_EVENT_SEARCH_FILTER_DRAFT } from "./event-search-filter-draft"

export interface EventSearchFiltersProps {
  draft: EventSearchFilterDraft
  committedDraft: EventSearchFilterDraft
  onDraftChange: (draft: EventSearchFilterDraft) => void
  /** Human-readable summary of the draft date filter (events mode). */
  draftDateFilterSummary: string
  /** Whether the Date Filter control should be offered (events mode). */
  showDateFilter: boolean
  onOpenTrackModal: () => void
  onOpenDateModal: () => void
  /** Whether the Include practice days toggle should be offered. */
  showPracticeToggle: boolean
  /** Whether the Search LiveRC toggle should be offered (events mode). */
  showLiveRCToggle: boolean
  /** Whether the Search Everlaps toggle should be offered (events mode). */
  showEverlapsToggle: boolean
  /** Commits staged draft to the container (does not run search). */
  onApplyFilters: (draft: EventSearchFilterDraft) => void
  /** Resets committed filters to defaults (does not run search). */
  onClearFilters: () => void
  /** Count of non-default committed filters; renders a badge when > 0. */
  activeFilterCount: number
  disabled?: boolean
  trackErrorId?: string
  /** When true, outside click does not close the popover (nested modal open). */
  suppressOutsideClose?: boolean
  /** Fired when the popover opens so the parent can sync draft from committed state. */
  onPopoverOpen?: () => void
}

export default function EventSearchFilters({
  draft,
  committedDraft,
  onDraftChange,
  draftDateFilterSummary,
  showDateFilter,
  onOpenTrackModal,
  onOpenDateModal,
  showPracticeToggle,
  showLiveRCToggle,
  showEverlapsToggle,
  onApplyFilters,
  onClearFilters,
  activeFilterCount,
  disabled = false,
  trackErrorId,
  suppressOutsideClose = false,
  onPopoverOpen,
}: EventSearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isDraftDirty = !isFilterDraftEqual(draft, committedDraft)
  const canClearFilters =
    activeFilterCount > 0 ||
    !!committedDraft.selectedTrack ||
    committedDraft.dateRangePreset !== "none" ||
    !isFilterDraftEqual(draft, DEFAULT_EVENT_SEARCH_FILTER_DRAFT) ||
    !isFilterDraftEqual(committedDraft, DEFAULT_EVENT_SEARCH_FILTER_DRAFT)

  const closeWithoutApply = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleToggleOpen = () => {
    if (!isOpen) {
      onPopoverOpen?.()
      setIsOpen(true)
      return
    }
    closeWithoutApply()
  }

  const handleApply = () => {
    onApplyFilters(draft)
    setIsOpen(false)
  }

  const handleClearFilters = () => {
    onDraftChange({ ...DEFAULT_EVENT_SEARCH_FILTER_DRAFT })
    onClearFilters()
  }

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (e: MouseEvent) => {
      if (suppressOutsideClose) return
      if (!containerRef.current?.contains(e.target as Node)) {
        closeWithoutApply()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeWithoutApply()
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, suppressOutsideClose, closeWithoutApply])

  const showToggleSection = showLiveRCToggle || showEverlapsToggle || showPracticeToggle
  const showFooter = showToggleSection || showDateFilter

  return (
    <div ref={containerRef} className="relative inline-flex">
      <Button
        type="button"
        id="event-search-filters-trigger"
        variant="default"
        disabled={disabled}
        onClick={handleToggleOpen}
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
                  draft.selectedTrack
                    ? `Open track list, current track: ${draft.selectedTrack.trackName}`
                    : "Open track list"
                }
              >
                <span className="truncate">
                  {draft.selectedTrack?.trackName ?? "Track Selection"}
                </span>
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
                  aria-label={`Open date filter, current: ${draftDateFilterSummary}`}
                >
                  <span className="truncate">{draftDateFilterSummary}</span>
                </Button>
              </div>
            )}

            {showToggleSection && (
              <>
                {(showLiveRCToggle || showEverlapsToggle) && (
                  <div className="space-y-3">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--token-text-tertiary)]">
                      Sources
                    </span>
                    {showLiveRCToggle && (
                      <div className="flex items-center justify-between gap-3">
                        <Tooltip
                          text={
                            draft.selectedTrack
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
                          checked={draft.includeLiveRC}
                          onChange={(checked) =>
                            onDraftChange({ ...draft, includeLiveRC: checked })
                          }
                          disabled={disabled || !draft.selectedTrack}
                          aria-label="Search LiveRC: toggle on to include LiveRC with database, off for database only"
                          className="shrink-0"
                        />
                      </div>
                    )}
                    {showEverlapsToggle && (
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
                          checked={draft.includeEverlaps}
                          onChange={(checked) =>
                            onDraftChange({ ...draft, includeEverlaps: checked })
                          }
                          disabled={disabled}
                          aria-label="Include Everlaps when searching (not yet connected)"
                          className="shrink-0"
                        />
                      </div>
                    )}
                  </div>
                )}

                {showPracticeToggle && (
                  <div className="flex items-center justify-between gap-3">
                    <Tooltip
                      text={
                        draft.selectedTrack
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
                      checked={draft.includePracticeDays}
                      onChange={(checked) =>
                        onDraftChange({ ...draft, includePracticeDays: checked })
                      }
                      disabled={disabled || !draft.selectedTrack}
                      aria-label="Include practice days in event list results"
                      className="shrink-0"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {showFooter && (
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--token-border-default)] pt-3">
              <button
                type="button"
                id="event-search-filters-clear"
                onClick={handleClearFilters}
                disabled={disabled || !canClearFilters}
                className="text-sm font-medium text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--token-interactive-focus-ring)] rounded disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
              >
                Clear filters
              </button>
              <Button
                type="button"
                id="event-search-filters-apply"
                variant="primary"
                disabled={disabled}
                onClick={handleApply}
                className="h-9 shrink-0 px-4"
                aria-label={isDraftDirty ? "Apply filter changes" : "Close filters without changes"}
              >
                Apply
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
