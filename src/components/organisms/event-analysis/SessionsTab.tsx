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
import { useEventActionsOptional } from "@/components/organisms/dashboard/EventActionsContext"
import SessionChartTabs from "./sessions/SessionChartTabs"
import {
  getSessionsData,
  getDriverLapTrends,
  buildHeatProgression,
} from "@/core/events/get-sessions-data"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"
import TabPanelIntro from "@/components/molecules/TabPanelIntro"
import { isPlaceholderClass, isSchedulePlaceholderLiveRcRow } from "@/lib/format-class-name"

export interface SessionsTabProps {
  data: EventAnalysisData
  selectedDriverIds: string[]
  selectedClass: string | null
  /** When provided, Select Class dropdown is shown in the sessions table; fallback to context when inside EventActionsProvider */
  onClassChange?: (className: string | null) => void
}

export default function SessionsTab({
  data,
  selectedDriverIds,
  selectedClass: selectedClassProp,
  onClassChange: onClassChangeProp,
}: SessionsTabProps) {
  // Normalize undefined to null
  const selectedClass = selectedClassProp ?? null
  const eventActions = useEventActionsOptional()
  const onClassChange = onClassChangeProp ?? eventActions?.onClassChange ?? undefined

  // Get sessions data with filters applied (for table rows)
  const sessionsData = useMemo(
    () => getSessionsData(data, selectedDriverIds, selectedClass),
    [data, selectedDriverIds, selectedClass]
  )

  /** All classes, no driver filter — [race#/total] matches LiveRC within each round. */
  const sessionLabelContextSessions = useMemo(() => {
    const all = getSessionsData(data, [], null).sessions
    return all.filter(
      (s) =>
        !isPlaceholderClass(s.className) &&
        !isSchedulePlaceholderLiveRcRow(s.className, s.raceLabel)
    )
  }, [data])

  // Class list with driver count per class (same semantics as Overview tab for consistency)
  const allClassesWithCounts = useMemo(() => {
    const map = new Map<string, Set<string>>()
    data.races.forEach((race) => {
      if (!map.has(race.className)) map.set(race.className, new Set())
      const s = map.get(race.className)!
      race.results.forEach((r) => {
        if ((r.lapsCompleted ?? 0) > 0) s.add(r.driverId)
      })
    })
    const result = new Map<string, number>()
    map.forEach((driverIds, className) => result.set(className, driverIds.size))
    return Array.from(result.entries()).sort((a, b) => b[1] - a[1])
  }, [data])

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
      className="dashboard-shell-tabpanel space-y-6"
      role="tabpanel"
      id="tabpanel-sessions"
      aria-labelledby="tab-sessions"
    >
      <TabPanelIntro
        eyebrow="Sessions"
        title={
          <>
            Event sessions and heats
            {selectedClass && typeof selectedClass === "string" && selectedClass.trim() !== ""
              ? ` — ${selectedClass}`
              : ""}
          </>
        }
        description="Race grid and lap analysis for the selected class and drivers. Driver bump-ups are on Event Details → Bump-Ups."
      />

      {/* Content - show all sessions when "All Classes" or when a specific class is selected */}
      <SessionChartTabs
        sessions={sessionsData.sessions}
        sessionLabelContextSessions={sessionLabelContextSessions}
        allClassesWithCounts={allClassesWithCounts}
        driverLapTrends={driverLapTrends}
        heatProgression={heatProgression}
        eventId={data.event.id}
        selectedClass={selectedClass}
        onClassChange={onClassChange}
        data={data}
        height={500}
      />
    </div>
  )
}
