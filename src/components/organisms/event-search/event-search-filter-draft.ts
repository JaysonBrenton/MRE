/**
 * @fileoverview Shared filter draft types and helpers for Event Search.
 */

import { getRangeForPreset, type DateRangePreset } from "./DateRangePresetPicker"
import { type Track } from "./TrackRow"

export interface EventSearchFilterDraft {
  selectedTrack: Track | null
  dateRangePreset: DateRangePreset
  startDate: string
  endDate: string
  includeLiveRC: boolean
  includeEverlaps: boolean
  includePracticeDays: boolean
  /** When false, hide events with Ready status (laps_full). Default true = show all. */
  includeReady: boolean
  /** When false, hide events with Scheduled status (future date). Default true = show all. */
  includeScheduled: boolean
}

export const DEFAULT_EVENT_SEARCH_FILTER_DRAFT: EventSearchFilterDraft = {
  selectedTrack: null,
  dateRangePreset: "none",
  startDate: "",
  endDate: "",
  includeLiveRC: false,
  includeEverlaps: false,
  includePracticeDays: false,
  includeReady: true,
  includeScheduled: true,
}

export function buildCommittedFilterDraft(input: {
  selectedTrack: Track | null
  dateRangePreset: DateRangePreset
  startDate: string
  endDate: string
  includeLiveRC: boolean
  includeEverlaps: boolean
  includePracticeDays: boolean
  includeReady: boolean
  includeScheduled: boolean
}): EventSearchFilterDraft {
  return {
    selectedTrack: input.selectedTrack,
    dateRangePreset: input.dateRangePreset,
    startDate: input.startDate,
    endDate: input.endDate,
    includeLiveRC: input.includeLiveRC,
    includeEverlaps: input.includeEverlaps,
    includePracticeDays: input.includePracticeDays,
    includeReady: input.includeReady,
    includeScheduled: input.includeScheduled,
  }
}

export function isFilterDraftEqual(a: EventSearchFilterDraft, b: EventSearchFilterDraft): boolean {
  return (
    a.selectedTrack?.id === b.selectedTrack?.id &&
    a.dateRangePreset === b.dateRangePreset &&
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    a.includeLiveRC === b.includeLiveRC &&
    a.includeEverlaps === b.includeEverlaps &&
    a.includePracticeDays === b.includePracticeDays &&
    a.includeReady === b.includeReady &&
    a.includeScheduled === b.includeScheduled
  )
}

export function applyDatePresetToDraft(
  draft: EventSearchFilterDraft,
  preset: DateRangePreset
): EventSearchFilterDraft {
  if (preset === "none") {
    return { ...draft, dateRangePreset: preset, startDate: "", endDate: "" }
  }
  if (preset === "custom") {
    return { ...draft, dateRangePreset: preset }
  }
  const range = getRangeForPreset(preset)
  return {
    ...draft,
    dateRangePreset: preset,
    startDate: range.startDate,
    endDate: range.endDate,
  }
}

export function dateFilterSummaryFromDraft(
  draft: EventSearchFilterDraft,
  formatCustomRange: (start: string, end: string) => string | null,
  presetLabels: ReadonlyArray<{ value: DateRangePreset; label: string }>
): string {
  const baseLabel = presetLabels.find((p) => p.value === draft.dateRangePreset)?.label ?? "—"
  if (draft.dateRangePreset === "custom" && draft.startDate && draft.endDate) {
    const range = formatCustomRange(draft.startDate, draft.endDate)
    return range ? `${baseLabel} (${range})` : baseLabel
  }
  return baseLabel
}
