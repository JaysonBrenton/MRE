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

import { useState, KeyboardEvent } from "react"
import SessionsTable from "./SessionsTable"
import LapDataTable from "./LapDataTable"
import type { SessionData, DriverLapTrend, HeatProgressionData } from "@/core/events/get-sessions-data"

export type ChartTabId = "overview" | "driver-performance" | "driver-bump-ups"

export interface SessionChartTabsProps {
  sessions: SessionData[]
  driverLapTrends: DriverLapTrend[]
  heatProgression: HeatProgressionData[]
  eventId: string
  selectedClass: string | null
  height?: number
  className?: string
}

const defaultTabs: Array<{ id: ChartTabId; label: string }> = [
  { id: "overview", label: "Race Overview" },
  { id: "driver-performance", label: "Race Details" },
  { id: "driver-bump-ups", label: "Driver Bump-Ups" },
]

export default function SessionChartTabs({
  sessions,
  driverLapTrends,
  heatProgression,
  eventId,
  selectedClass,
  height = 500,
  className = "",
}: SessionChartTabsProps) {
  const [activeTab, setActiveTab] = useState<ChartTabId>("overview")

  // Determine which tabs to show
  const availableTabs = defaultTabs

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tabId: ChartTabId
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      setActiveTab(tabId)
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      const currentIndex = availableTabs.findIndex((t) => t.id === activeTab)
      const prevIndex =
        currentIndex > 0 ? currentIndex - 1 : availableTabs.length - 1
      setActiveTab(availableTabs[prevIndex].id)
    } else if (event.key === "ArrowRight") {
      event.preventDefault()
      const currentIndex = availableTabs.findIndex((t) => t.id === activeTab)
      const nextIndex =
        currentIndex < availableTabs.length - 1 ? currentIndex + 1 : 0
      setActiveTab(availableTabs[nextIndex].id)
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Tab Navigation */}
      <div
        className="border-b border-[var(--token-border-default)] overflow-x-auto"
        role="tablist"
        aria-label="Session chart tabs"
      >
        <div className="flex min-w-max">
          {availableTabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`chartpanel-${tab.id}`}
                id={`charttab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
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
      <div role="tabpanel" aria-labelledby={`charttab-${activeTab}`}>
        {activeTab === "overview" && (
          <SessionsTable
            sessions={sessions}
            selectedDriverIds={driverLapTrends.map((trend) => trend.driverId)}
          />
        )}

        {activeTab === "driver-performance" && (
          <LapDataTable
            eventId={eventId}
            selectedClass={selectedClass}
          />
        )}

        {activeTab === "driver-bump-ups" && (
          <div className="flex items-center justify-center h-64 text-[var(--token-text-secondary)]">
            Under Development
          </div>
        )}
      </div>
    </div>
  )
}

