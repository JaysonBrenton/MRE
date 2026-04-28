/**
 * @fileoverview Date range preset picker for Event Search
 *
 * @description Single "When" control: preset chips (No filter, Last 3/6/12 months,
 * This year, Custom). Custom expands inline From/To fields below the chips; dates
 * apply as the user changes them. When Custom is selected, a short summary appears
 * once both dates are set.
 */

"use client"

import { useEffect, useState } from "react"
import {
  formatCustomRangeSummary,
  getEventSearchEarliestSelectableYmd,
  toLocalDateString,
} from "@/lib/date-utils"
import CustomDateField from "./CustomDateField"

export type DateRangePreset = "none" | "last3" | "last6" | "last12" | "thisYear" | "custom"

export interface DateRangePresetPickerProps {
  preset: DateRangePreset
  startDate: string
  endDate: string
  onPresetChange: (preset: DateRangePreset) => void
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  errors?: { startDate?: string; endDate?: string }
  disabled?: boolean
  /** When true, omit the "Date range" label (e.g. when used inside a modal that has its own title) */
  hideLabel?: boolean
}

function getRangeForPreset(preset: DateRangePreset): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()
  switch (preset) {
    case "none":
      return { startDate: "", endDate: "" }
    case "last3":
      start.setMonth(start.getMonth() - 3)
      break
    case "last6":
      start.setMonth(start.getMonth() - 6)
      break
    case "last12":
      start.setDate(start.getDate() - 365)
      break
    case "thisYear":
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      break
    default:
      return { startDate: "", endDate: "" }
  }
  return {
    startDate: toLocalDateString(start),
    endDate: toLocalDateString(end),
  }
}

export const PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: "none", label: "No filter" },
  { value: "last3", label: "Last 3 months" },
  { value: "last6", label: "Last 6 months" },
  { value: "last12", label: "Last 12 months" },
  { value: "thisYear", label: "This year" },
  { value: "custom", label: "Custom" },
]

export default function DateRangePresetPicker({
  preset,
  startDate,
  endDate,
  onPresetChange,
  onStartDateChange,
  onEndDateChange,
  errors,
  disabled = false,
  hideLabel = false,
}: DateRangePresetPickerProps) {
  const [localStart, setLocalStart] = useState(startDate)
  const [localEnd, setLocalEnd] = useState(endDate)

  const minSelectableYmd = getEventSearchEarliestSelectableYmd()
  const todayYmd = toLocalDateString(new Date())

  const endMinYmd = !localStart
    ? minSelectableYmd
    : localStart < minSelectableYmd
      ? minSelectableYmd
      : localStart

  useEffect(() => {
    setLocalStart(startDate)
  }, [startDate])
  useEffect(() => {
    setLocalEnd(endDate)
  }, [endDate])

  const handlePresetClick = (value: DateRangePreset) => {
    onPresetChange(value)
    if (value === "custom") {
      return
    }
    if (value !== "none") {
      const range = getRangeForPreset(value)
      onStartDateChange(range.startDate)
      onEndDateChange(range.endDate)
      setLocalStart(range.startDate)
      setLocalEnd(range.endDate)
    }
  }

  const setStart = (v: string) => {
    setLocalStart(v)
    onStartDateChange(v)
  }

  const setEnd = (v: string) => {
    setLocalEnd(v)
    onEndDateChange(v)
  }

  const startErrorId = errors?.startDate ? "custom-range-start-error" : undefined
  const endErrorId = errors?.endDate ? "custom-range-end-error" : undefined

  return (
    <div className="space-y-4">
      {!hideLabel && (
        <p className="text-sm font-medium text-[var(--token-text-primary)]">Date range</p>
      )}
      <div
        className="flex min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain"
        role="group"
        aria-label="Date range presets"
      >
        {PRESETS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => handlePresetClick(value)}
            disabled={disabled}
            className={`shrink-0 min-h-[44px] min-w-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 ${
              preset === value
                ? "border-[var(--token-accent)] bg-[var(--token-accent)]/20 text-[var(--token-text-primary)]"
                : "border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-secondary)] hover:bg-[var(--token-surface-raised)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="space-y-3">
          <div
            className="rounded-3xl border border-[var(--token-border-default)] p-4"
            style={{ background: "var(--token-surface-elevated)" }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 flex-1 sm:min-w-[12rem]">
                <CustomDateField
                  id="custom-preset-start"
                  label="From"
                  value={localStart}
                  onChange={setStart}
                  minDate={minSelectableYmd}
                  maxDate={todayYmd}
                  disabled={disabled}
                  errorMessage={errors?.startDate}
                  describedById={startErrorId}
                  placeholder="Select start date"
                  appearance="compact"
                />
              </div>
              <div className="min-w-0 flex-1 sm:min-w-[12rem]">
                <CustomDateField
                  id="custom-preset-end"
                  label="To"
                  value={localEnd}
                  onChange={setEnd}
                  minDate={endMinYmd}
                  maxDate={todayYmd}
                  disabled={disabled}
                  errorMessage={errors?.endDate}
                  describedById={endErrorId}
                  placeholder="Select end date"
                  appearance="compact"
                />
              </div>
            </div>
          </div>
          <p className="text-sm text-[var(--token-text-secondary)]" aria-live="polite">
            {localStart && localEnd
              ? formatCustomRangeSummary(localStart, localEnd)
              : "Choose a start and end date."}
          </p>
        </div>
      )}
    </div>
  )
}

export { getRangeForPreset }
