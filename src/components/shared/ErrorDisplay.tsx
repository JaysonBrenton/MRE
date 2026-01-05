/**
 * @fileoverview Shared error display components
 *
 * @created 2025-01-27
 * @creator Auto (AI Assistant)
 * @lastModified 2025-01-27
 *
 * @description Reusable error display components for consistent error handling
 *
 * @purpose Provides standardized error display components that can be reused
 *          across the application for consistent error messaging and UX.
 */

"use client"

import React from "react"

export interface ErrorDisplayProps {
  title?: string
  message: string
  onRetry?: () => void
  severity?: "error" | "warning" | "info"
}

/**
 * Error display component with consistent styling
 *
 * @param title - Optional error title
 * @param message - Error message to display (user-friendly, not technical)
 * @param onRetry - Optional retry callback
 * @param severity - Error severity level
 */
export function ErrorDisplay({
  title = "Error",
  message,
  onRetry,
  severity = "error",
}: ErrorDisplayProps) {
  const severityStyles = {
    error: "border-red-500/50 bg-red-500/10 text-red-400",
    warning: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
    info: "border-blue-500/50 bg-blue-500/10 text-blue-400",
  }

  return (
    <div className={`rounded-lg border p-4 ${severityStyles[severity]}`}>
      <h3 className="mb-2 font-semibold">{title}</h3>
      <p className="mb-4 text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded bg-[var(--token-accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--token-accent-hover)]"
        >
          Try Again
        </button>
      )}
    </div>
  )
}

/**
 * Inline error message component for form fields or small error contexts
 */
export function InlineError({ message }: { message: string }) {
  return (
    <p className="mt-1 text-sm text-red-400" role="alert">
      {message}
    </p>
  )
}
