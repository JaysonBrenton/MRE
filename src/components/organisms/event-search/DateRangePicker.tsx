/**
 * @fileoverview Date range picker component for Event Search
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Date range picker with validation (7 year lookback, no future dates)
 *
 * @purpose Provides a date range selection interface for Event Search. Includes
 *          client-side bounds (lookback) and no future dates.
 *          Uses native date input on mobile for best UX.
 *
 * @relatedFiles
 * - docs/frontend/liverc/user-workflow.md (UX specification)
 * - docs/design/mre-ux-principles.md (form patterns)
 */

"use client"

import { useState, useEffect } from "react"
import { getEventSearchEarliestSelectableYmd, toLocalDateString } from "@/lib/date-utils"

export interface DateRangePickerProps {
  startDate: string
  endDate: string
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  errors?: {
    startDate?: string
    endDate?: string
  }
  disabled?: boolean
  required?: boolean
}

export default function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  errors,
  disabled = false,
  required = false,
}: DateRangePickerProps) {
  const [localStartDate, setLocalStartDate] = useState(startDate)
  const [localEndDate, setLocalEndDate] = useState(endDate)

  // Update local state when props change
  useEffect(() => {
    setLocalStartDate(startDate)
  }, [startDate])

  useEffect(() => {
    setLocalEndDate(endDate)
  }, [endDate])

  const minSelectable = getEventSearchEarliestSelectableYmd()
  const today = toLocalDateString(new Date())

  // End date may run through today; start/end must stay within the lookback window
  const getMaxEndDate = (_start: string): string => today

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value
    setLocalStartDate(newStartDate)
    onStartDateChange(newStartDate)
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = e.target.value
    setLocalEndDate(newEndDate)
    onEndDateChange(newEndDate)
  }

  const startErrorId = errors?.startDate ? "start-date-error" : undefined
  const endErrorId = errors?.endDate ? "end-date-error" : undefined

  const endInputMin = !localStartDate
    ? minSelectable
    : localStartDate < minSelectable
      ? minSelectable
      : localStartDate

  return (
    <div className="space-y-4">
      {/* Start Date */}
      <div>
        <label
          htmlFor="start-date"
          className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
        >
          Start Date {required && <span className="text-[var(--token-status-error-text)]">*</span>}
        </label>
        <input
          id="start-date"
          type="date"
          value={localStartDate}
          onChange={handleStartDateChange}
          min={minSelectable}
          max={today}
          disabled={disabled}
          className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-invalid={Boolean(errors?.startDate)}
          aria-describedby={startErrorId}
        />
        {errors?.startDate && (
          <p id={startErrorId} className="mt-1 text-sm text-[var(--token-error-text)]" role="alert">
            {errors.startDate}
          </p>
        )}
      </div>

      {/* End Date */}
      <div>
        <label
          htmlFor="end-date"
          className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
        >
          End Date {required && <span className="text-[var(--token-status-error-text)]">*</span>}
        </label>
        <input
          id="end-date"
          type="date"
          value={localEndDate}
          onChange={handleEndDateChange}
          min={endInputMin}
          max={getMaxEndDate(localStartDate)}
          disabled={disabled}
          className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
  )
}
