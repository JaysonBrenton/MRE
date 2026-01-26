/**
 * @fileoverview Context bar component for testing tab
 *
 * @created 2025-01-24
 * @creator Auto-generated
 * @lastModified 2025-01-24
 *
 * @description Displays current viewing context: event, class, and driver count
 *
 * @purpose Provides "you are here" context for users viewing the testing tab
 *
 * @relatedFiles
 * - src/components/event-analysis/overview-testing/OverviewTabTesting.tsx (uses this)
 */

"use client"

export interface ContextBarProps {
  eventName: string
  selectedClass: string | null
  selectedDriverCount: number
}

export default function ContextBar({
  eventName,
  selectedClass,
  selectedDriverCount,
}: ContextBarProps) {
  const classDisplay = selectedClass || "All classes"
  const driverCountText = selectedDriverCount === 1 ? "driver" : "drivers"

  return (
    <div className="mb-4 px-4 py-2 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)]">
      <p className="text-sm text-[var(--token-text-secondary)]">
        Viewing <span className="font-semibold text-[var(--token-text-primary)]">{eventName}</span> ·{" "}
        <span className="font-semibold text-[var(--token-text-primary)]">{classDisplay}</span> ·{" "}
        <span className="font-semibold text-[var(--token-text-primary)]">{selectedDriverCount}</span> {driverCountText}
      </p>
    </div>
  )
}
