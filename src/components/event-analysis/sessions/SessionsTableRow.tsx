/**
 * @fileoverview Individual session table row component with expand/collapse
 * 
 * @created 2025-01-07
 * @creator System
 * @lastModified 2025-01-07
 * 
 * @description Renders a single session row with expand/collapse and navigation
 * 
 * @purpose Displays session summary with expandable full results
 * 
 * @relatedFiles
 * - src/components/event-analysis/sessions/SessionsTable.tsx
 * - src/components/event-analysis/sessions/SessionsTableResults.tsx
 */

"use client"

import { useState } from "react"
import { formatDuration, formatDateTime } from "@/lib/format-session-data"
import SessionsTableResults from "./SessionsTableResults"
import type { SessionData } from "@/core/events/get-sessions-data"

export interface SessionsTableRowProps {
  session: SessionData
  selectedDriverIds?: string[]
  onNavigate?: (sessionId: string) => void
}

export default function SessionsTableRow({
  session,
  selectedDriverIds = [],
  onNavigate,
}: SessionsTableRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onNavigate) {
      onNavigate(session.id)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleToggleExpand()
    }
  }

  // Get top 3 finishers
  const topFinishers = session.topFinishers.slice(0, 3)

  return (
    <>
      <tr
        className="border-b border-[var(--token-border-default)] hover:bg-[var(--token-surface-raised)] transition-colors cursor-pointer"
        onClick={handleToggleExpand}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        aria-label={`${session.raceLabel} - Click to ${isExpanded ? "collapse" : "expand"} results`}
      >
        <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)]">
          <div className="flex items-center gap-2">
            <span
              className="text-[var(--token-text-secondary)] transition-transform"
              style={{
                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                display: "inline-block",
              }}
              aria-hidden="true"
            >
              ▶
            </span>
            <span>{session.raceLabel}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)]">
          {session.className}
        </td>
        <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-secondary)]">
          {formatDateTime(session.startTime)}
        </td>
        <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)]">
          {formatDuration(session.durationSeconds)}
        </td>
        <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-primary)] text-center">
          {session.participantCount}
        </td>
        <td className="px-4 py-3 text-sm font-normal text-[var(--token-text-secondary)]">
          <div className="flex flex-col gap-0.5">
            {topFinishers.map((finisher, index) => (
              <div key={finisher.driverId} className="text-xs">
                <span className="text-[var(--token-text-primary)]">
                  {index + 1}.
                </span>{" "}
                {finisher.driverName}
              </div>
            ))}
            {topFinishers.length === 0 && (
              <span className="text-xs">No results</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm font-normal">
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={handleNavigate}
              className="text-[var(--token-accent)] hover:text-[var(--token-accent-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--token-interactive-focus-ring)] rounded px-2 py-1"
              aria-label={`View details for ${session.raceLabel}`}
              title="View session details"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={7} className="p-0">
            <SessionsTableResults
              session={session}
              selectedDriverIds={selectedDriverIds}
            />
          </td>
        </tr>
      )}
    </>
  )
}

