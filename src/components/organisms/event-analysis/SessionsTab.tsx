/**
 * @fileoverview Sessions / Heats tab component
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Sessions and heats analysis tab with charts and table views
 *
 * @purpose Provides comprehensive analysis of sessions/heats with multiple visualizations
 *          and table view. Supports driver filtering and class filtering.
 *
 * @relatedFiles
 * - src/core/events/get-sessions-data.ts (data processing)
 * - src/components/event-analysis/sessions/ (session components)
 */

"use client"

import { useMemo } from "react"
import SessionChartTabs from "./sessions/SessionChartTabs"
import {
  getSessionsData,
  getDriverLapTrends,
  buildHeatProgression,
} from "@/core/events/get-sessions-data"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface SessionsTabProps {
  data: EventAnalysisData
  selectedDriverIds: string[]
  selectedClass: string | null
}

export default function SessionsTab({
  data,
  selectedDriverIds,
  selectedClass: selectedClassProp,
}: SessionsTabProps) {
  // Normalize undefined to null
  const selectedClass = selectedClassProp ?? null

  // Get sessions data with filters applied
  const sessionsData = useMemo(
    () => getSessionsData(data, selectedDriverIds, selectedClass),
    [data, selectedDriverIds, selectedClass]
  )

  // Get driver lap trends (only if drivers are selected)
  const driverLapTrends = useMemo(() => {
    if (selectedDriverIds.length === 0) {
      return []
    }
    return getDriverLapTrends(data, selectedDriverIds)
  }, [data, selectedDriverIds])

  // Get heat progression data
  const heatProgression = useMemo(() => buildHeatProgression(data), [data])

  return (
    <div
      className="space-y-6"
      role="tabpanel"
      id="tabpanel-sessions"
      aria-labelledby="tab-sessions"
    >
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-[var(--token-text-primary)] mb-2">
          Sessions and Heats
          {selectedClass && typeof selectedClass === "string" && selectedClass.trim() !== ""
            ? ` - ${selectedClass}`
            : ""}
        </h2>
      </div>

      {/* Content */}
      {selectedClass && selectedClass.trim() !== "" ? (
        <SessionChartTabs
          sessions={sessionsData.sessions}
          driverLapTrends={driverLapTrends}
          heatProgression={heatProgression}
          eventId={data.event.id}
          selectedClass={selectedClass}
          height={500}
        />
      ) : null}
    </div>
  )
}
