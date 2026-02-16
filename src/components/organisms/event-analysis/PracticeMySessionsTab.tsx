/**
 * @fileoverview Practice Day "My Sessions" tab – selected driver's sessions in chronological order
 *
 * @description Table of the selected driver's sessions with start time, duration, laps,
 *              best lap, avg lap, consistency. Per practice-day-dashboard-visualization-design §9.2.
 */

"use client"

import { useMemo } from "react"
import { getSessionsData } from "@/core/events/get-sessions-data"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import SessionsTable from "./sessions/SessionsTable"
import LinkYourDriverPrompt from "./LinkYourDriverPrompt"

export interface PracticeMySessionsTabProps {
  data: EventAnalysisData
  selectedDriverId: string | null
  selectedClass: string | null
  onClassChange: (className: string | null) => void
  eventId: string
}

export default function PracticeMySessionsTab({
  data,
  selectedDriverId,
  selectedClass,
  onClassChange,
  eventId,
}: PracticeMySessionsTabProps) {
  const driverIds = useMemo(
    () => (selectedDriverId ? [selectedDriverId] : []),
    [selectedDriverId]
  )

  const sessionsData = useMemo(
    () => getSessionsData(data, driverIds, selectedClass),
    [data, driverIds, selectedClass]
  )

  const sessionsChronological = useMemo(() => {
    return [...sessionsData.sessions].sort((a, b) => {
      const ta = a.startTime?.getTime() ?? 0
      const tb = b.startTime?.getTime() ?? 0
      return ta - tb
    })
  }, [sessionsData.sessions])

  if (!selectedDriverId) {
    return (
      <div
        className="space-y-6"
        role="tabpanel"
        id="tabpanel-my-sessions"
        aria-labelledby="tab-my-sessions"
      >
        <LinkYourDriverPrompt />
        <div className="rounded-lg border border-[var(--token-border-default)] bg-[var(--token-surface-elevated)] p-6">
          <p className="text-sm text-[var(--token-text-secondary)]">
            Select a driver above to see their sessions in chronological order, or view All Sessions for the full list.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="space-y-6"
      role="tabpanel"
      id="tabpanel-my-sessions"
      aria-labelledby="tab-my-sessions"
    >
      <div>
        <h2 className="text-xl font-semibold text-[var(--token-text-primary)] mb-2">
          My Sessions
        </h2>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Your sessions in chronological order. Best lap, average lap, and consistency per session.
        </p>
      </div>
      <SessionsTable
        sessions={sessionsChronological}
        selectedDriverIds={driverIds}
        showHybridColumns
        eventId={eventId}
        selectedClass={selectedClass}
      />
    </div>
  )
}
