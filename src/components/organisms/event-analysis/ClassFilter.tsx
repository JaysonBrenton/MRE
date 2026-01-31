/**
 * @fileoverview Class filter component for filtering by race class
 *
 * @created 2025-01-29
 * @creator Auto-generated
 *
 * @description Reusable class filter dropdown component
 *
 * @purpose Provides consistent class filtering UI across EntryList and DriverList
 */

"use client"

export interface ClassFilterProps {
  classes: string[]
  selectedClass: string | null
  onClassChange: (className: string | null) => void
  onClassInfoClick?: (className: string) => void
  raceClasses?: Map<string, { vehicleType: string | null; vehicleTypeNeedsReview: boolean }>
}

export default function ClassFilter({
  classes,
  selectedClass,
  onClassChange,
  onClassInfoClick,
  raceClasses,
}: ClassFilterProps) {
  if (classes.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="class-filter"
        className="text-sm font-medium text-[var(--token-text-secondary)]"
      >
        Filter by Class:
      </label>
      <div className="flex items-center gap-1">
        <select
          id="class-filter"
          value={selectedClass || ""}
          onChange={(e) => onClassChange(e.target.value || null)}
          className="px-3 py-1.5 text-sm border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
        >
          <option value="">All Classes</option>
          {classes.map((className) => {
            const raceClassInfo = raceClasses?.get(className)
            const needsReview = raceClassInfo?.vehicleTypeNeedsReview ?? false
            return (
              <option key={className} value={className}>
                {className}
                {needsReview ? " ⚠" : ""}
              </option>
            )
          })}
        </select>
        {selectedClass && onClassInfoClick && (
          <button
            type="button"
            onClick={() => onClassInfoClick(selectedClass)}
            className="p-1.5 text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded"
            aria-label={`View details for ${selectedClass}`}
            title="View class details"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        )}
        {selectedClass && raceClasses?.get(selectedClass)?.vehicleTypeNeedsReview && (
          <span
            className="px-1.5 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded"
            title="Vehicle type needs review"
          >
            ⚠
          </span>
        )}
      </div>
    </div>
  )
}
