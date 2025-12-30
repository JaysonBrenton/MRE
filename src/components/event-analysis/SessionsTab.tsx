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

import { useMemo, useState, useCallback } from "react"
import SessionControls, {
  type ViewMode,
  type PresetView,
} from "./sessions/SessionControls"
import SessionChartTabs from "./sessions/SessionChartTabs"
import SessionsTable from "./sessions/SessionsTable"
import {
  getSessionsData,
  getDriverLapTrends,
  buildHeatProgression,
} from "@/core/events/get-sessions-data"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export interface SessionsTabProps {
  data: EventAnalysisData
  selectedDriverIds: string[]
  onDriverSelectionChange: (driverIds: string[]) => void
}

export default function SessionsTab({
  data,
  selectedDriverIds,
  onDriverSelectionChange,
}: SessionsTabProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("chart")
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [presetView, setPresetView] = useState<PresetView>("overview")

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
  const heatProgression = useMemo(
    () => buildHeatProgression(data),
    [data]
  )

  const handleClassChange = useCallback((className: string | null) => {
    setSelectedClass(className)
  }, [])

  const isFilteringByDrivers = selectedDriverIds.length > 0

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
          Sessions / Heats
        </h2>
        <p className="text-sm text-[var(--token-text-secondary)]">
          Analyze race sessions and heats with interactive charts and detailed
          results tables.
        </p>
      </div>

      {/* Controls */}
      <SessionControls
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedClass={selectedClass}
        availableClasses={sessionsData.availableClasses}
        onClassChange={handleClassChange}
        presetView={presetView}
        onPresetViewChange={setPresetView}
        isFilteringByDrivers={isFilteringByDrivers}
        selectedDriverCount={selectedDriverIds.length}
      />

      {/* Content */}
      {viewMode === "chart" && (
        <SessionChartTabs
          sessions={sessionsData.sessions}
          driverLapTrends={driverLapTrends}
          heatProgression={heatProgression}
          height={500}
        />
      )}

      {viewMode === "table" && (
        <SessionsTable
          sessions={sessionsData.sessions}
          selectedDriverIds={selectedDriverIds}
        />
      )}

      {/* Summary Stats */}
      {sessionsData.sessions.length > 0 && (
        <div className="text-sm text-[var(--token-text-secondary)]">
          Showing {sessionsData.sessions.length} of {sessionsData.totalSessions}{" "}
          session{sessionsData.sessions.length !== 1 ? "s" : ""}
          {selectedClass && ` in ${selectedClass}`}
          {isFilteringByDrivers &&
            ` with ${selectedDriverIds.length} selected driver${selectedDriverIds.length !== 1 ? "s" : ""}`}
        </div>
      )}
    </div>
  )
}
