/**
 * @fileoverview View mode toggle switch component
 * 
 * @created 2025-01-23
 * @creator Auto-generated
 * @lastModified 2025-01-23
 * 
 * @description Toggle switch for switching between Driver View and Race View
 * 
 * @purpose Provides an accessible toggle switch UI for view mode selection.
 * 
 * @relatedFiles
 * - src/components/event-analysis/sessions/LapDataTable.tsx (consumer)
 */

"use client"

export interface ViewModeToggleProps {
  value: "driver" | "race"
  onChange: (value: "driver" | "race") => void
  leftLabel?: string
  rightLabel?: string
  className?: string
}

export default function ViewModeToggle({
  value,
  onChange,
  leftLabel = "Driver View",
  rightLabel = "Race View",
  className = "",
}: ViewModeToggleProps) {
  const isDriverView = value === "driver"

  const handleToggle = () => {
    onChange(isDriverView ? "race" : "driver")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleToggle()
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault()
      onChange(e.key === "ArrowLeft" ? "driver" : "race")
    }
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span
        className={`text-sm font-medium transition-colors ${
          isDriverView
            ? "text-[var(--token-text-primary)]"
            : "text-[var(--token-text-secondary)]"
        }`}
      >
        {leftLabel}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!isDriverView}
        aria-label={`Switch to ${isDriverView ? rightLabel : leftLabel}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] focus:ring-offset-[var(--token-surface)] ${
          isDriverView
            ? "bg-[var(--token-surface-elevated)] border-[var(--token-border-default)]"
            : "bg-[var(--token-accent)]/30 border-[var(--token-accent)]/50"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-[var(--token-surface)] border border-[var(--token-border-default)] shadow-sm transition-transform duration-200 ease-in-out ${
            isDriverView ? "translate-x-1" : "translate-x-6"
          }`}
        />
      </button>
      <span
        className={`text-sm font-medium transition-colors ${
          !isDriverView
            ? "text-[var(--token-text-primary)]"
            : "text-[var(--token-text-secondary)]"
        }`}
      >
        {rightLabel}
      </span>
    </div>
  )
}
