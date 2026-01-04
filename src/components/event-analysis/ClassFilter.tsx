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
}

export default function ClassFilter({
  classes,
  selectedClass,
  onClassChange,
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
      <select
        id="class-filter"
        value={selectedClass || ""}
        onChange={(e) => onClassChange(e.target.value || null)}
        className="px-3 py-1.5 text-sm border border-[var(--token-border-default)] rounded-md bg-[var(--token-surface)] text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
      >
        <option value="">All Classes</option>
        {classes.map((className) => (
          <option key={className} value={className}>
            {className}
          </option>
        ))}
      </select>
    </div>
  )
}

