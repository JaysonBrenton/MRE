/**
 * @fileoverview Date range preset picker for Event Search
 *
 * @description Single "When" control: preset chips (No filter, Last 3/6/12 months,
 * This year, Custom) with optional custom start/end inputs. Replaces the
 * "Filter by date range" checkbox + conditional date inputs.
 */

"use client"

import { useState, useEffect } from "react"
import { toLocalDateString } from "@/lib/date-utils"

export type DateRangePreset =
  | "none"
  | "last3"
  | "last6"
  | "last12"
  | "thisYear"
  | "custom"

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

const today = () => toLocalDateString(new Date())

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

  useEffect(() => {
    setLocalStart(startDate)
  }, [startDate])
  useEffect(() => {
    setLocalEnd(endDate)
  }, [endDate])

  const handlePresetClick = (value: DateRangePreset) => {
    onPresetChange(value)
    if (value !== "custom" && value !== "none") {
      const range = getRangeForPreset(value)
      onStartDateChange(range.startDate)
      onEndDateChange(range.endDate)
      setLocalStart(range.startDate)
      setLocalEnd(range.endDate)
    }
  }

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setLocalStart(v)
    onStartDateChange(v)
  }
  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setLocalEnd(v)
    onEndDateChange(v)
  }

  const maxEndDate = (): string => {
    if (!localStart) return today()
    const start = new Date(localStart)
    const max = new Date(start)
    max.setDate(max.getDate() + 90)
    const maxStr = max.toISOString().split("T")[0]
    return maxStr < today() ? maxStr : today()
  }

  const startErrorId = errors?.startDate ? "preset-start-error" : undefined
  const endErrorId = errors?.endDate ? "preset-end-error" : undefined

  return (
    <div className="space-y-4">
      {!hideLabel && (
        <p className="text-sm font-medium text-[var(--token-text-primary)]">Date range</p>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Date range presets">
        {PRESETS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => handlePresetClick(value)}
            disabled={disabled}
            className={`min-h-[44px] min-w-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] disabled:opacity-50 ${
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
        <div className="space-y-4 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-4">
          <div>
            <label
              htmlFor="preset-start-date"
              className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
            >
              Start date
            </label>
            <input
              id="preset-start-date"
              type="date"
              value={localStart}
              onChange={handleStartChange}
              max={today()}
              disabled={disabled}
              className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
              aria-invalid={Boolean(errors?.startDate)}
              aria-describedby={startErrorId}
            />
            {errors?.startDate && (
              <p id={startErrorId} className="mt-1 text-sm text-[var(--token-error-text)]" role="alert">
                {errors.startDate}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="preset-end-date"
              className="block text-sm font-medium text-[var(--token-text-primary)] mb-1"
            >
              End date
            </label>
            <input
              id="preset-end-date"
              type="date"
              value={localEnd}
              onChange={handleEndChange}
              min={localStart || undefined}
              max={maxEndDate()}
              disabled={disabled}
              className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
              aria-invalid={Boolean(errors?.endDate)}
              aria-describedby={endErrorId}
            />
            {errors?.endDate && (
              <p id={endErrorId} className="mt-1 text-sm text-[var(--token-error-text)]" role="alert">
                {errors.endDate}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export { getRangeForPreset }
