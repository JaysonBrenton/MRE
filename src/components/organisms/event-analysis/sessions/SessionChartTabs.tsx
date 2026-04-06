/**
 * @fileoverview Session chart tabs - tabbed interface for different chart views
 *
 * @created 2025-01-27
 * @creator Jayson Brenton
 * @lastModified 2025-01-27
 *
 * @description Tabbed interface component for switching between different session chart visualizations
 *
 * @purpose Manages active chart state and renders appropriate chart based on active tab.
 *
 * @relatedFiles
 * - src/components/event-analysis/sessions/SessionsTable.tsx
 */

"use client"

import { useState, useEffect, KeyboardEvent } from "react"
import { getSession } from "@/lib/auth-client"
import SessionsTable from "./SessionsTable"
import MyLapsContent from "../MyLapsContent"
import type {
  SessionData,
  DriverLapTrend,
  HeatProgressionData,
} from "@/core/events/get-sessions-data"
import type { EventAnalysisData } from "@/core/events/get-event-analysis-data"

export type ChartTabId = "overview" | "my-laps"

export interface SessionChartTabsProps {
  sessions: SessionData[]
  /** Full list of [className, driverCount] for dropdown; when provided, dropdown shows all classes regardless of filter */
  allClassesWithCounts?: Array<[string, number]>
  driverLapTrends: DriverLapTrend[]
  heatProgression: HeatProgressionData[]
  eventId: string
  selectedClass: string | null
  /** When provided, Select Class dropdown is shown in the sessions table */
  onClassChange?: (className: string | null) => void
  /** Full event analysis data for Lap Analysis and other session views */
  data?: EventAnalysisData
  /** Logged-in user's driver name; passed to Lap Analysis for "my laps" filtering when present in event */
  userDriverName?: string | null
  height?: number
  className?: string
}

const defaultTabs: Array<{ id: ChartTabId; label: string }> = [
  { id: "overview", label: "Race grid" },
  { id: "my-laps", label: "Lap analysis" },
]

export default function SessionChartTabs({
  sessions,
  allClassesWithCounts,
  driverLapTrends,
  heatProgression: _heatProgression,
  eventId,
  selectedClass,
  onClassChange,
  data,
  userDriverName: userDriverNameProp,
  height = 500,
  className = "",
}: SessionChartTabsProps) {
  const [activeTab, setActiveTab] = useState<ChartTabId>("overview")
  const [userDriverName, setUserDriverName] = useState<string | null>(userDriverNameProp ?? null)

  // Fetch user's driver name from session if not provided via props
  useEffect(() => {
    if (userDriverNameProp) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserDriverName(userDriverNameProp)
      return
    }

    getSession().then((session) => {
      if (session?.user?.name) {
        setUserDriverName(session.user.name)
      }
    })
  }, [userDriverNameProp])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tabId: ChartTabId) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setActiveTab(tabId)
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      const currentIndex = defaultTabs.findIndex((t) => t.id === activeTab)
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : defaultTabs.length - 1
      setActiveTab(defaultTabs[prevIndex].id)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      const currentIndex = defaultTabs.findIndex((t) => t.id === activeTab)
      const nextIndex = currentIndex < defaultTabs.length - 1 ? currentIndex + 1 : 0
      setActiveTab(defaultTabs[nextIndex].id)
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <p className="max-w-[42rem] text-sm text-[var(--token-text-secondary)]">
        Switch between the race grid and lap analysis. Driver bump-ups are under Event Details →
        Bump-Ups.
      </p>
      {/* Tab Navigation */}
      <div
        className="overflow-x-hidden border-b border-[var(--token-border-default)]"
        role="tablist"
        aria-label="Session views: race grid, lap analysis"
      >
        <div className="flex min-w-0 flex-wrap">
          {defaultTabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`chartpanel-${tab.id}`}
                id={`charttab-${tab.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setActiveTab(tab.id)
                }}
                onKeyDown={(e) => handleKeyDown(e, tab.id)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--token-interactive-focus-ring)] ${
                  isActive
                    ? "border-[var(--token-accent)] text-[var(--token-accent)]"
                    : "border-transparent text-[var(--token-text-secondary)] hover:text-[var(--token-text-primary)] hover:border-[var(--token-border-default)]"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chart Content */}
      <div role="tabpanel" id={`chartpanel-${activeTab}`} aria-labelledby={`charttab-${activeTab}`}>
        {activeTab === "overview" && (
          <SessionsTable
            sessions={sessions}
            selectedDriverIds={driverLapTrends.map((trend) => trend.driverId)}
            showHybridColumns
            eventId={eventId}
            selectedClass={selectedClass}
          />
        )}

        {activeTab === "my-laps" && (
          <MyLapsContent
            eventId={eventId}
            selectedClass={selectedClass}
            data={data}
            userDriverName={userDriverName}
          />
        )}
      </div>
    </div>
  )
}
