/**
 * @fileoverview Chart data availability notice
 *
 * @created 2025-12-27
 * @creator Codex (AI Assistant)
 * @lastModified 2025-12-27
 *
 * @description Warns users when selected drivers lack the telemetry required to
 *              render the current chart.
 *
 * @purpose Maintains trust by explicitly calling out why some drivers are not
 *          visualised even though they are selected in Chart Controls.
 */

"use client"

import type { ReactNode } from "react"
import { useState, useEffect } from "react"

export interface ChartDataNoticeProps {
  title: string
  description: ReactNode
  driverNames: string[]
  className?: string
  onDismiss?: () => void
  eventId: string
  noticeType: string
}

export default function ChartDataNotice({
  title,
  description,
  driverNames,
  className = "",
  onDismiss,
  eventId,
  noticeType,
}: ChartDataNoticeProps) {
  const [isDismissed, setIsDismissed] = useState(true) // Start as dismissed until we check sessionStorage

  // Create a unique storage key for this event and notice type
  const storageKey = `mre-chart-notice-dismissed-${eventId}-${noticeType}`

  // Check sessionStorage on mount to see if this notice was previously dismissed
  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const dismissed = window.sessionStorage.getItem(storageKey)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDismissed(dismissed === "true")
  }, [storageKey])

  if (driverNames.length === 0 || isDismissed) {
    return null
  }

  const visibleNames = driverNames.slice(0, 5)
  const remainingCount = driverNames.length - visibleNames.length

  const handleDismiss = () => {
    setIsDismissed(true)
    // Persist dismissal in sessionStorage
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "true")
    }
    onDismiss?.()
  }

  return (
    <div
      className={`mb-6 rounded-lg border border-[var(--token-border-default)] bg-[var(--token-status-warning-bg)] px-4 py-3 text-sm text-[var(--token-text-primary)] relative ${className}`}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded focus:outline-none focus:ring-2 focus:ring-[var(--token-interactive-focus-ring)]"
        aria-label="Dismiss notice"
      >
        <svg
          className="w-5 h-5 text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
      <p className="font-semibold text-[var(--token-status-warning-text)] pr-8">{title}</p>
      <div className="mt-1 text-[var(--token-text-secondary)]">{description}</div>
      <ul className="mt-2 list-inside list-disc text-[var(--token-text-secondary)]">
        {visibleNames.map((name, index) => (
          <li key={`${name}-${index}`}>{name}</li>
        ))}
      </ul>
      {remainingCount > 0 && (
        <p className="mt-1 text-[var(--token-text-muted)]">+{remainingCount} more</p>
      )}
    </div>
  )
}
