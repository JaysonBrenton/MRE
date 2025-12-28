/**
 * @fileoverview Driver selection header component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Header component for driver selection with actions
 * 
 * @purpose Displays selection count and provides quick actions (Select All, Clear).
 * 
 * @relatedFiles
 * - src/components/event-analysis/CollapsibleDriverPanel.tsx (uses this)
 */

"use client"

export interface DriverSelectionHeaderProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onClear: () => void
}

export default function DriverSelectionHeader({
  selectedCount,
  totalCount,
  onSelectAll,
  onClear,
}: DriverSelectionHeaderProps) {
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <span className="text-xs text-[var(--token-text-secondary)]">
        {selectedCount} / {totalCount} selected
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onSelectAll()
        }}
        className="text-xs text-[var(--token-accent)] hover:text-[var(--token-accent-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded px-2 py-1 mobile-button"
        aria-label="Select all drivers"
        style={{ minWidth: "44px", minHeight: "44px" }}
      >
        Select All
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClear()
        }}
        className="text-xs text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded px-2 py-1 mobile-button"
        aria-label="Clear selection"
        style={{ minWidth: "44px", minHeight: "44px" }}
      >
        Clear
      </button>
    </div>
  )
}
