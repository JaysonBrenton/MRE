/**
 * @fileoverview Month and Year Picker component for Practice Days
 * 
 * @created 2026-01-XX
 * @creator System
 * @lastModified 2026-01-XX
 * 
 * @description Month and year selection picker for practice day discovery
 */

"use client"

import { useState, useEffect } from "react"

export interface MonthYearPickerProps {
  year: number
  month: number
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  errors?: {
    year?: string
    month?: string
  }
  disabled?: boolean
  required?: boolean
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
]

// Generate years from current year back to 5 years ago, and forward 1 year
function getAvailableYears(): number[] {
  const currentYear = new Date().getFullYear()
  const years: number[] = []
  for (let i = currentYear + 1; i >= currentYear - 5; i--) {
    years.push(i)
  }
  return years
}

export default function MonthYearPicker({
  year,
  month,
  onYearChange,
  onMonthChange,
  errors,
  disabled = false,
  required = false,
}: MonthYearPickerProps) {
  const [localYear, setLocalYear] = useState(year.toString())
  const [localMonth, setLocalMonth] = useState(month.toString())
  const availableYears = getAvailableYears()

  // Update local state when props change
  useEffect(() => {
    setLocalYear(year.toString())
  }, [year])

  useEffect(() => {
    setLocalMonth(month.toString())
  }, [month])

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10)
    if (!isNaN(newYear)) {
      setLocalYear(e.target.value)
      onYearChange(newYear)
    }
  }

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value, 10)
    if (!isNaN(newMonth)) {
      setLocalMonth(e.target.value)
      onMonthChange(newMonth)
    }
  }

  const yearErrorId = errors?.year ? "year-error" : undefined
  const monthErrorId = errors?.month ? "month-error" : undefined

  return (
    <div className="space-y-4">
      {/* Year Selection */}
      <div>
        <label
          htmlFor="year-select"
          className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
        >
          Year {required && <span className="text-[var(--token-status-error-text)]">*</span>}
        </label>
        <select
          id="year-select"
          value={localYear}
          onChange={handleYearChange}
          disabled={disabled}
          className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-invalid={Boolean(errors?.year)}
          aria-describedby={yearErrorId}
        >
          <option value="">Select year</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {errors?.year && (
          <p id={yearErrorId} className="mt-1 text-sm text-[var(--token-error-text)]" role="alert">
            {errors.year}
          </p>
        )}
      </div>

      {/* Month Selection */}
      <div>
        <label
          htmlFor="month-select"
          className="block text-sm font-medium text-[var(--token-text-primary)] mb-2"
        >
          Month {required && <span className="text-[var(--token-status-error-text)]">*</span>}
        </label>
        <select
          id="month-select"
          value={localMonth}
          onChange={handleMonthChange}
          disabled={disabled}
          className="w-full h-11 px-4 rounded-md border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-invalid={Boolean(errors?.month)}
          aria-describedby={monthErrorId}
        >
          <option value="">Select month</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {errors?.month && (
          <p id={monthErrorId} className="mt-1 text-sm text-[var(--token-error-text)]" role="alert">
            {errors.month}
          </p>
        )}
      </div>
    </div>
  )
}
