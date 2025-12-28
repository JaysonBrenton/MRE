/**
 * @fileoverview Import status toast notification component
 * 
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 * 
 * @description Toast notification for import status updates
 * 
 * @purpose Displays toast notifications for import started, completed, and
 *          failed states. Auto-dismisses after a delay or can be manually closed.
 * 
 * @relatedFiles
 * - src/components/event-search/EventSearchContainer.tsx (parent component)
 */

"use client"

import { useEffect } from "react"

export type ImportStatus = "started" | "pending" | "completed" | "failed"

export interface ImportStatusToastProps {
  status: ImportStatus
  message: string
  eventName?: string
  onClose: () => void
  autoDismiss?: boolean
  autoDismissDelay?: number
}

export default function ImportStatusToast({
  status,
  message,
  eventName,
  onClose,
  autoDismiss = true,
  autoDismissDelay = 5000,
}: ImportStatusToastProps) {
  useEffect(() => {
    if (autoDismiss) {
      const timer = setTimeout(() => {
        onClose()
      }, autoDismissDelay)

      return () => clearTimeout(timer)
    }
  }, [autoDismiss, autoDismissDelay, onClose])

  const statusColors = {
    started:
      "bg-[var(--token-status-info-bg)] text-[var(--token-status-info-text)] border-[var(--token-status-info-text)]",
    pending:
      "bg-[var(--token-status-info-bg)] text-[var(--token-status-info-text)] border-[var(--token-status-info-text)]",
    completed:
      "bg-[var(--token-status-success-bg)] text-[var(--token-status-success-text)] border-[var(--token-status-success-text)]",
    failed:
      "bg-[var(--token-status-error-bg)] text-[var(--token-status-error-text)] border-[var(--token-status-error-text)]",
  }

  const liveMode = status === "failed" ? "assertive" : "polite"

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-md p-4 rounded-md border ${statusColors[status]} shadow-lg`}
      role="alert"
      aria-live={liveMode}
      aria-atomic="true"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-medium">{message}</p>
          {eventName && <p className="text-sm mt-1 opacity-90">{eventName}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-md hover:bg-black/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)]"
          aria-label="Close notification"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
