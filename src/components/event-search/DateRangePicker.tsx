/**
 * @fileoverview Date range picker component for Event Search
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Date range picker with validation (max 3 months, no future dates)
 * 
 * @purpose Provides a date range selection interface for Event Search. Includes
 *          client-side validation for maximum range (3 months) and no future dates.
 *          Uses native date input on mobile for best UX.
 * 
 * @relatedFiles
 * - docs/frontend/liverc/user-workflow.md (UX specification)
 * - docs/design/mre-ux-principles.md (form patterns)
 */

"use client"

import { useState, useEffect } from "react"

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
}

export default function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  errors,
  disabled = false,
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

  // Get today's date in YYYY-MM-DD format (for max attribute)
  const today = new Date().toISOString().split("T")[0]

  // Calculate max end date (3 months from start date)
  const getMaxEndDate = (start: string): string => {
    if (!start) return today
    const startDateObj = new Date(start)
    const maxDate = new Date(startDateObj)
    maxDate.setDate(maxDate.getDate() + 90) // 3 months = 90 days
    const maxDateStr = maxDate.toISOString().split("T")[0]
    return maxDateStr < today ? maxDateStr : today
  }

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

  return (
    <div className="space-y-4">
      {/* Start Date */}
      <div>
        <label
          htmlFor="start-date"
          className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
        >
          Start Date
        </label>
        <input
          id="start-date"
          type="date"
          value={localStartDate}
          onChange={handleStartDateChange}
          max={today}
          disabled={disabled}
          className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {errors?.startDate && (
          <p className="mt-1 text-sm text-[var(--token-error-text)]">{errors.startDate}</p>
        )}
      </div>

      {/* End Date */}
      <div>
        <label
          htmlFor="end-date"
          className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
        >
          End Date
        </label>
        <input
          id="end-date"
          type="date"
          value={localEndDate}
          onChange={handleEndDateChange}
          min={localStartDate || undefined}
          max={getMaxEndDate(localStartDate)}
          disabled={disabled}
          className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {errors?.endDate && (
          <p className="mt-1 text-sm text-[var(--token-error-text)]">{errors.endDate}</p>
        )}
      </div>
    </div>
  )
}

