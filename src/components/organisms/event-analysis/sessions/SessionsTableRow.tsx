/**
 * @fileoverview Individual session table row component with expand/collapse
 *
 * @created 2025-01-07
 * @creator System
 * @lastModified 2025-01-27
 *
 * @description Renders a single session row with expand/collapse and navigation.
 *   When showHybridColumns (TEST tab), adds Best Lap, Avg Lap, Total Laps,
 *   Fastest Driver and a View Details button that opens lap data modal.
 *
 * @relatedFiles
 * - src/components/event-analysis/sessions/SessionsTable.tsx
 * - src/components/event-analysis/sessions/SessionsTableResults.tsx
 * - src/components/event-analysis/sessions/SessionLapDataModal.tsx
 */

"use client"

import { useState, useMemo } from "react"
import { formatDuration, formatTimeUTC, formatLapTime } from "@/lib/format-session-data"
import { formatClassName } from "@/lib/format-class-name"
import SessionsTableResults from "./SessionsTableResults"
import { StandardTableRow, StandardTableCell } from "@/components/molecules/StandardTable"
import StandardButton from "@/components/atoms/StandardButton"
import type { SessionData } from "@/core/events/get-sessions-data"

export interface SessionsTableRowProps {
  session: SessionData
  /** Rich label (round, [i/n], class, heat) for the Session Name cell */
  raceDisplayLabel: string
  selectedDriverIds?: string[]
  onNavigate?: (sessionId: string) => void
  showHybridColumns?: boolean
  eventId?: string
  selectedClass?: string | null
  colCount?: number
  onViewLapDetails?: (session: SessionData) => void
}

function computeLapSummary(session: SessionData) {
  const results = session.results
  const validFast = results
    .map((r) => r.fastLapTime)
    .filter((t): t is number => t != null && Number.isFinite(t) && t > 0)
  const validAvg = results
    .map((r) => r.avgLapTime)
    .filter((t): t is number => t != null && Number.isFinite(t) && t > 0)
  const bestLap = validFast.length > 0 ? Math.min(...validFast) : null
  const avgLap = validAvg.length > 0 ? validAvg.reduce((a, b) => a + b, 0) / validAvg.length : null
  const totalLaps = results.reduce((sum, r) => sum + (r.lapsCompleted ?? 0), 0)
  let fastestDriver: string | null = null
  if (validFast.length > 0) {
    const best = Math.min(...validFast)
    const r = results.find((x) => x.fastLapTime != null && Math.abs(x.fastLapTime - best) < 0.001)
    fastestDriver = r?.driverName ?? null
  }
  return { bestLap, avgLap, totalLaps, fastestDriver }
}

export default function SessionsTableRow({
  session,
  raceDisplayLabel,
  selectedDriverIds = [],
  onNavigate: _onNavigate,
  showHybridColumns = false,
  eventId: _eventId,
  selectedClass: _selectedClass = null,
  colCount = 7,
  onViewLapDetails,
}: SessionsTableRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const lapSummary = useMemo(() => computeLapSummary(session), [session])

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const handleViewLapDetails = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onViewLapDetails) {
      onViewLapDetails(session)
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
      <StandardTableRow
        onClick={handleToggleExpand}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        aria-label={`${raceDisplayLabel} - Click to ${isExpanded ? "collapse" : "expand"} results`}
      >
        <StandardTableCell>
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
            <span>{raceDisplayLabel}</span>
          </div>
        </StandardTableCell>
        <StandardTableCell>{formatClassName(session.className)}</StandardTableCell>
        <StandardTableCell className="text-[var(--token-text-secondary)]">
          {formatTimeUTC(session.startTime)}
        </StandardTableCell>
        <StandardTableCell>{formatDuration(session.durationSeconds)}</StandardTableCell>
        <StandardTableCell className="text-center">{session.participantCount}</StandardTableCell>
        <StandardTableCell className="text-[var(--token-text-secondary)]">
          <div className="flex flex-col gap-0.5">
            {topFinishers.map((finisher, index) => (
              <div key={finisher.driverId} className="text-xs">
                <span className="text-[var(--token-text-primary)]">{index + 1}.</span>{" "}
                {finisher.driverName}
              </div>
            ))}
            {topFinishers.length === 0 && <span className="text-xs">No results</span>}
          </div>
        </StandardTableCell>
        <StandardTableCell>
          {showHybridColumns && onViewLapDetails && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <StandardButton
                type="button"
                onClick={handleViewLapDetails}
                className="!px-2 !py-1 !text-xs !bg-transparent !border-0 text-[var(--token-accent)] hover:!bg-[var(--token-accent)]/10"
                aria-label={`View lap data for ${raceDisplayLabel}`}
                title="View lap data"
              >
                View Details
              </StandardButton>
            </div>
          )}
        </StandardTableCell>
        {showHybridColumns && (
          <>
            <StandardTableCell className="font-mono">
              {formatLapTime(lapSummary.bestLap)}
            </StandardTableCell>
            <StandardTableCell className="font-mono">
              {formatLapTime(lapSummary.avgLap)}
            </StandardTableCell>
            <StandardTableCell className="text-center">{lapSummary.totalLaps}</StandardTableCell>
            <StandardTableCell className="text-[var(--token-text-secondary)]">
              {lapSummary.fastestDriver ?? "—"}
            </StandardTableCell>
          </>
        )}
      </StandardTableRow>
      {isExpanded && (
        <tr>
          <td colSpan={colCount} className="p-0">
            <SessionsTableResults session={session} selectedDriverIds={selectedDriverIds} />
          </td>
        </tr>
      )}
    </>
  )
}
