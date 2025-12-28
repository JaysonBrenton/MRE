/**
 * @fileoverview Error display component with retry and expandable details
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Displays error messages with retry functionality and expandable technical details
 * 
 * @purpose Provides consistent error display with actionable guidance and optional technical details
 * 
 * @relatedFiles
 * - src/components/event-search/EventSearchContainer.tsx (uses this component)
 */

"use client"

import { useState } from "react"

export interface ErrorDisplayProps {
  message: string
  errorId?: string
  details?: string | Record<string, unknown>
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export default function ErrorDisplay({
  message,
  errorId,
  details,
  onRetry,
  retryLabel = "Retry",
  className = "",
}: ErrorDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasDetails = details !== undefined && details !== null

  const formatDetails = (): string => {
    if (!details) return ""
    if (typeof details === "string") return details
    return JSON.stringify(details, null, 2)
  }

  return (
    <div
      className={`rounded-md border border-[var(--token-status-error-text)] bg-[var(--token-status-error-bg)] p-4 ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <svg
          className="h-5 w-5 flex-shrink-0 text-[var(--token-status-error-text)] mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--token-status-error-text)]">
            {message}
          </p>
          {errorId && (
            <p className="mt-1 text-xs text-[var(--token-text-muted)]">
              Error ID: <code className="font-mono">{errorId}</code>
            </p>
          )}
          {hasDetails && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs font-medium text-[var(--token-status-error-text)] hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] rounded"
                aria-expanded={isExpanded}
                aria-controls="error-details"
              >
                {isExpanded ? "Hide" : "Show"} technical details
              </button>
              {isExpanded && (
                <pre
                  id="error-details"
                  className="mt-2 p-3 rounded-md bg-[var(--token-surface)] border border-[var(--token-border-default)] text-xs text-[var(--token-text-secondary)] overflow-x-auto"
                >
                  {formatDetails()}
                </pre>
              )}
            </div>
          )}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mobile-button flex-shrink-0 flex items-center justify-center rounded-md border border-[var(--token-status-error-text)] bg-[var(--token-status-error-bg)] px-4 py-2 text-sm font-medium text-[var(--token-status-error-text)] transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  )
}

